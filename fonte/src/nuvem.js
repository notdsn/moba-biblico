// Login Google (Firebase Auth) + perfil na nuvem (Firestore perfis/{uid}). Sem login, o jogo segue só com o perfil local.
// O SDK é carregado sob demanda (import dinâmico): quem não entra não baixa nada além do necessário para restaurar a sessão.
import cfg from './firebase_config.js';
import { perfil, mesclarPerfil, definirLendarias } from './perfil.js';
const DONO_LENDARIAS = 'edclash7@gmail.com';
const IDS_LENDA = ['davi', 'sansao', 'debora', 'gideao', 'golias', 'farao', 'jezabel', 'nabuco', 'josue', 'elias', 'acabe', 'dalila', 'herodes', 'hama', 'balaao', 'ester', 'ninrode', 'sarai', 'moises', 'golias2'];
let fb = null, user = null, ouvintes = [], pronto = null, sincronizado = false;
const avisar = () => { for (const f of ouvintes) try { f(user); } catch (e) { } };
export const usuario = () => user;
export const nuvemSincronizada = () => sincronizado;
export function aoMudarUsuario(f) { ouvintes.push(f); }
export const ehLendario = () => !!(user && user.emailVerified && (user.email || '').toLowerCase() === DONO_LENDARIAS);
async function carregarSDK() {
  if (fb) return fb;
  const [{ initializeApp }, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(cfg); const auth = A.getAuth(app); const db = F.getFirestore(app);
  fb = { A, F, auth, db }; return fb;
}
// liberadas pelo Edson: por enquanto só a do Davi (Davi Celestial); as outras seguem pausadas
const LENDARIAS_LIBERADAS = ['davi'];
async function conferirLendarias() {
  if (!ehLendario()) { definirLendarias([]); return; }
  const base = new URL('models/tripo/skins/', location.href);
  const ok = await Promise.all(IDS_LENDA.filter(id => LENDARIAS_LIBERADAS.includes(id)).map(id => fetch(new URL(id + '_lendaria.glb', base), { method: 'HEAD', cache: 'no-store' }).then(r => r.ok && !/text\/html/.test(r.headers.get('content-type') || '') ? id : null).catch(() => null)));
  definirLendarias(ok.filter(Boolean));
}
async function sincronizar() {
  if (!user || !fb) return; const { F, db } = fb;
  try { const ref = F.doc(db, 'perfis', user.uid); const snap = await F.getDoc(ref); if (snap.exists()) mesclarPerfil(snap.data()); await salvarNuvem(); sincronizado = true; }
  catch (e) { sincronizado = false; console.warn('[nuvem] sincronização falhou:', e && (e.code || e.message)); }
}
export async function salvarNuvem() {
  if (!user || !fb) return false; const { F, db } = fb;
  try { const dados = JSON.parse(JSON.stringify(perfil())); dados.atualizado = Date.now(); dados.email = user.email || null; await F.setDoc(F.doc(db, 'perfis', user.uid), dados); return true; }
  catch (e) { console.warn('[nuvem] salvar falhou:', e && (e.code || e.message)); return false; }
}
// restaura a sessão (e conclui um login por redirecionamento) sem travar o carregamento do jogo
export function iniciarNuvem() {
  if (pronto) return pronto;
  pronto = carregarSDK().then(async ({ A, auth }) => {
    try { await A.getRedirectResult(auth); } catch (e) { console.warn('[nuvem] redirect:', e && (e.code || e.message)); }
    await new Promise(ok => { let primeiro = true; A.onAuthStateChanged(auth, async (u) => { user = u || null; sincronizado = false; if (user) { await sincronizar(); } await conferirLendarias(); avisar(); if (primeiro) { primeiro = false; ok(); } }); });
  }).catch(e => { console.warn('[nuvem] indisponível:', e && e.message); });
  return pronto;
}
export async function entrarGoogle() {
  const { A, auth } = await carregarSDK(); const prov = new A.GoogleAuthProvider(); prov.setCustomParameters({ prompt: 'select_account' });
  try { await A.signInWithPopup(auth, prov); return true; }
  catch (e) { const c = e && e.code || '';
    if (/popup-blocked|operation-not-supported|web-storage-unsupported|internal-error/.test(c)) { await A.signInWithRedirect(auth, prov); return true; } // Safari do iPhone sem pop-up: vai pelo redirecionamento
    if (/popup-closed-by-user|cancelled-popup-request/.test(c)) return false;
    console.warn('[nuvem] login falhou:', c || (e && e.message)); throw e; }
}
export async function sairGoogle() { if (!fb) return; await salvarNuvem(); await fb.A.signOut(fb.auth); }
