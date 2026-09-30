// conversão opcional PNG -> KTX2 com o toktx (KTX-Software). Só usado com --ktx2 quando o toktx existe.
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
export async function ktx2(doc) {
  const r = doc.getRoot(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktx2-')); r.listExtensionsUsed();
  doc.createExtension((await import('@gltf-transform/extensions')).KHRTextureBasisu).setRequired(true);
  for (const [i, t] of r.listTextures().entries()) {
    const normal = r.listMaterials().some(m => m.getNormalTexture() === t);
    const src = path.join(dir, i + '.png'), dst = path.join(dir, i + '.ktx2'); fs.writeFileSync(src, t.getImage());
    execFileSync('toktx', ['--t2', '--genmipmap', ...(normal ? ['--encode', 'uastc', '--assign_oetf', 'linear'] : ['--encode', 'etc1s', '--qlevel', '160']), dst, src]);
    t.setImage(fs.readFileSync(dst)).setMimeType('image/ktx2');
  }
}
