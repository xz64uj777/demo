(function () {
  'use strict';

  function boot() {
    if (typeof THREE === 'undefined') {
      document.body.innerHTML = '<p style="color:#fff;font-family:sans-serif;padding:2rem;text-align:center">Three.js failed to load. Check your network connection.</p>';
      return;
    }
    var wrap = document.getElementById('canvas-wrap');
    if (!wrap) return;
    window.game = new DemoGame(wrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();