// Ajustes para iPhone/iPad no Safari (sem API de tela cheia no iOS)
(function () {
  var d = document.documentElement, ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  if (ios) d.classList.add('ios'); if (standalone) d.classList.add('standalone');
  // bloqueia zoom de pinça e de toque duplo (o iOS ignora user-scalable=no)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.scale !== undefined && e.scale !== 1) e.preventDefault(); }, { passive: false });
  var ultimo = 0; document.addEventListener('touchend', function (e) { var t = Date.now(); if (t - ultimo < 320 && !(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); ultimo = t; }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // barra do Safari aparece/some: repassa como resize e volta a página para o topo
  var avisar = function () { window.scrollTo(0, 0); window.dispatchEvent(new Event('resize')); };
  if (window.visualViewport) visualViewport.addEventListener('resize', function () { clearTimeout(avisar._t); avisar._t = setTimeout(avisar, 60); });
  window.addEventListener('orientationchange', function () { setTimeout(avisar, 250); setTimeout(avisar, 700); });
  // dica "Adicionar à Tela de Início" (uma vez por sessão, só no iPhone fora do modo app)
  window.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('dicaIos'); if (!el || !ios || standalone) return;
    var visto = false; try { visto = sessionStorage.getItem('dicaIos') === '1' || localStorage.getItem('dicaIosNunca') === '1'; } catch (e) {}
    if (visto) return;
    var fechar = function (nunca) { el.classList.remove('on'); try { sessionStorage.setItem('dicaIos', '1'); if (nunca) localStorage.setItem('dicaIosNunca', '1'); } catch (e) {} };
    el.querySelector('button').addEventListener('click', function () { fechar(true); });
    setTimeout(function () { el.classList.add('on'); setTimeout(function () { fechar(false); }, 10000); }, 1200);
  });
})();
