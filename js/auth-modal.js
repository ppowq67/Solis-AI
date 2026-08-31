/**
 * Auth modal — open/close + OAuth (Google / TikTok / YouTube).
 * Shared by index.html; login.html redirects here with ?login=1.
 */
(function (global) {
  'use strict';

  var SKIP_KEY = 'solis_skip_auth_redirect';

  var OAUTH = {
    google: {
      btnId: 'googleLoginBtn',
      textId: 'googleBtnText',
      label: 'Sign in with Google',
      path: '/api/auth/google?fresh=1',
    },
    tiktok: {
      btnId: 'tiktokLoginBtn',
      textId: 'tiktokBtnText',
      label: 'Continue with TikTok',
      path: '/api/auth/tiktok?fresh=1',
    },
    youtube: {
      btnId: 'youtubeLoginBtn',
      textId: 'youtubeBtnText',
      label: 'Continue with YouTube',
      path: '/api/auth/youtube?fresh=1',
    },
  };

  function apiBase() {
    if (global.API_BASE_URL) return String(global.API_BASE_URL).replace(/\/$/, '');
    var host = location.hostname || '';
    var local = host === 'localhost' || host === '127.0.0.1';
    if (local) return location.protocol + '//' + host + ':5500/api';
    return 'https://api.solisai.video/api';
  }

  function oauthUrl(path) {
    if (typeof global.apiUrl === 'function') return global.apiUrl(path);
    var base = apiBase();
    var p = String(path || '');
    if (p.indexOf('/api/') === 0) p = p.slice(4);
    else if (p.indexOf('/api') === 0) p = p.slice(4);
    if (p.charAt(0) !== '/') p = '/' + p;
    return base + p;
  }

  function modalEl() {
    return document.getElementById('auth-modal');
  }

  function closeAuthModal(opts) {
    var el = modalEl();
    if (!el) return;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('auth-modal-open');
    document.body.classList.remove('auth-modal-open');
    if (!opts || opts.cleanUrl !== false) {
      try {
        var u = new URL(location.href);
        u.searchParams.delete('login');
        u.searchParams.delete('auth');
        var qs = u.searchParams.toString();
        history.replaceState({}, '', u.pathname + (qs ? '?' + qs : '') + u.hash);
      } catch (_) {}
    }
  }

  function isOpen() {
    var el = modalEl();
    return el && !el.hidden;
  }

  function resetOAuth(provider) {
    var cfg = OAUTH[provider];
    if (!cfg) return;
    var btn = document.getElementById(cfg.btnId);
    var text = document.getElementById(cfg.textId);
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.classList.remove('is-connecting');
    }
    if (text) text.textContent = cfg.label;
  }

  function resetAllOAuth() {
    Object.keys(OAUTH).forEach(resetOAuth);
  }

  function unlockOAuthUi() {
    resetAllOAuth();
  }

  function openAuthModal(opts) {
    var el = modalEl();
    if (!el) return;
    // Always clear stuck "Connecting…" from a prior YouTube/Google attempt (bfcache / back)
    unlockOAuthUi();
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('auth-modal-open');
    document.body.classList.add('auth-modal-open');
    var focusBtn = el.querySelector('#googleLoginBtn') || el.querySelector('button, [href]');
    if (focusBtn) setTimeout(function () { focusBtn.focus(); }, 40);
    if (opts && opts.replaceUrl) {
      try {
        var u = new URL(location.href);
        u.searchParams.set('login', '1');
        history.replaceState({}, '', u.pathname + u.search);
      } catch (_) {}
    }
  }

  async function handleOAuth(provider) {
    var cfg = OAUTH[provider];
    if (!cfg) return;
    var btn = document.getElementById(cfg.btnId);
    var text = document.getElementById(cfg.textId);
    try {
      // Clear any other provider stuck mid-connect (e.g. YouTube → back → Google)
      Object.keys(OAUTH).forEach(function (p) {
        if (p !== provider) resetOAuth(p);
      });
      if (text) text.textContent = 'Connecting…';
      if (btn) {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.classList.add('is-connecting');
      }
      try {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('solis_template_memory');
        localStorage.removeItem('solis_caption_by_template');
        localStorage.removeItem('solis_memory_owner_id');
      } catch (_) {}
      sessionStorage.removeItem(SKIP_KEY);
      // Full-page nav to API (avoids credentialed CORS). Backend 302s to the provider.
      var authUrl = oauthUrl(cfg.path);
      var sep = authUrl.indexOf('?') >= 0 ? '&' : '?';
      // Safety: if navigation is blocked / cancelled, unlock after a beat
      setTimeout(unlockOAuthUi, 8000);
      location.assign(authUrl + sep + 'nav=1');
    } catch (e) {
      sessionStorage.setItem(SKIP_KEY, '1');
      console.error('Login error:', e);
      var msg = String((e && e.message) || '');
      alert(/failed to fetch|networkerror|load failed/i.test(msg)
        ? 'Could not reach Solis servers. Check your connection and try again.'
        : (msg || 'Login failed. Please try again.'));
      unlockOAuthUi();
    }
  }

  function wireOAuth() {
    Object.keys(OAUTH).forEach(function (provider) {
      var cfg = OAUTH[provider];
      var btn = document.getElementById(cfg.btnId);
      if (!btn || btn.__solisAuthBound) return;
      btn.__solisAuthBound = true;
      btn.addEventListener('click', function () { handleOAuth(provider); });
    });
  }

  function wireChrome() {
    var el = modalEl();
    if (!el || el.__solisChromeBound) return;
    el.__solisChromeBound = true;

    var backdrop = el.querySelector('[data-auth-dismiss]');
    if (backdrop) backdrop.addEventListener('click', function () {
      unlockOAuthUi();
      closeAuthModal();
    });

    var closeBtn = el.querySelector('[data-auth-close]');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      unlockOAuthUi();
      closeAuthModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        unlockOAuthUi();
        closeAuthModal();
      }
    });

    document.querySelectorAll('[data-open-auth]').forEach(function (node) {
      node.addEventListener('click', function (e) {
        e.preventDefault();
        openAuthModal();
      });
    });
  }

  function finishLogoutLanding() {
    sessionStorage.setItem(SKIP_KEY, '1');
    sessionStorage.removeItem('solis_just_logged_out');
    try {
      var savedTheme = localStorage.getItem('theme');
      localStorage.clear();
      if (savedTheme) localStorage.setItem('theme', savedTheme);
    } catch (_) {}
    fetch(apiBase() + '/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {});
  }

  function bootFromQuery() {
    var params = new URLSearchParams(location.search);
    var force =
      params.has('logout') ||
      params.get('login') === '1' ||
      params.get('auth') === '1' ||
      sessionStorage.getItem('solis_just_logged_out') === '1';

    if (params.has('logout') || sessionStorage.getItem('solis_just_logged_out') === '1') {
      finishLogoutLanding();
    }

    if (force) {
      openAuthModal({ replaceUrl: true });
      try {
        var u = new URL(location.href);
        u.searchParams.delete('logout');
        history.replaceState({}, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : ''));
      } catch (_) {}
    }
  }

  function goToAppOrLogin() {
    var open = function () { openAuthModal(); };
    try {
      fetch(apiBase() + '/auth/check', { method: 'GET', credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.authenticated && d.user) location.href = '/dashboard';
          else open();
        })
        .catch(open);
    } catch (_) {
      open();
    }
  }

  function init() {
    wireChrome();
    wireOAuth();
    unlockOAuthUi();
    bootFromQuery();
  }

  // bfcache / back from Google-YouTube account picker left buttons on "Connecting…"
  window.addEventListener('pageshow', unlockOAuthUi);
  window.addEventListener('pagehide', unlockOAuthUi);
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') unlockOAuthUi();
  });
  window.addEventListener('focus', unlockOAuthUi);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.openAuthModal = openAuthModal;
  global.closeAuthModal = closeAuthModal;
  global.goToAppOrLogin = goToAppOrLogin;
  global.resetAuthOAuthButtons = unlockOAuthUi;
})(window);
