(function () {
  'use strict';

  var SOLIS_OG_IMAGE = 'https://solisai.video/assets/og-image.png?v=2';

  function setOgMeta(opts) {
    if (!opts) return;
    function setMeta(prop, content, useName) {
      if (!content) return;
      var sel = useName
        ? 'meta[name="' + prop + '"]'
        : 'meta[property="' + prop + '"]';
      var el = document.querySelector(sel);
      if (!el) {
        el = document.createElement('meta');
        if (useName) el.setAttribute('name', prop);
        else el.setAttribute('property', prop);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    }
    if (opts.title) {
      document.title = opts.title;
      setMeta('og:title', opts.title);
      setMeta('twitter:title', opts.title, true);
    }
    if (opts.description) {
      setMeta('og:description', opts.description);
      setMeta('twitter:description', opts.description, true);
    }
    if (opts.image) {
      setMeta('og:image', opts.image);
      setMeta('twitter:image', opts.image, true);
    }
    if (opts.url) setMeta('og:url', opts.url);
  }

  var state = {
    mode: 'clip', // clip | profile
    creator: null,
    following: false,
    projectId: '',
    solId: '',
  };

  function apiBase() {
    try {
      if (window.API_BASE_URL) return String(window.API_BASE_URL).replace(/\/$/, '');
    } catch (_) {}
    var host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return location.protocol + '//' + host + ':5500/api';
    }
    return 'https://api.solisai.video/api';
  }

  function absoluteApi(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    var base = apiBase().replace(/\/api$/, '');
    return base + (path.charAt(0) === '/' ? path : '/' + path);
  }

  function authHeaders() {
    var h = { Accept: 'application/json', 'Content-Type': 'application/json' };
    try {
      if (typeof window.getAuthHeaders === 'function') {
        Object.assign(h, window.getAuthHeaders());
      }
    } catch (_) {}
    return h;
  }

  function looksLikeEmail(s) {
    return typeof s === 'string' && /[^@\s]+@[^@\s]+\.[^@\s]+/.test(s);
  }

  function scrubCreator(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var out = {};
    Object.keys(raw).forEach(function (k) {
      var lk = String(k).toLowerCase();
      if (lk.indexOf('email') >= 0 || lk.indexOf('mail') >= 0) return;
      var v = raw[k];
      if (looksLikeEmail(v)) return;
      out[k] = v;
    });
    if (!out.public_id && out.id) out.public_id = out.id;
    if (!out.name || looksLikeEmail(out.name)) out.name = out.username || 'Creator';
    if (looksLikeEmail(out.username)) out.username = '';
    return out;
  }

  function initials(name) {
    var s = String(name || 'S').trim();
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (s[0] || 'S').toUpperCase();
  }

  function formatCount(n) {
    var x = Number(n) || 0;
    if (x >= 1000000) return (x / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (x >= 1000) return (x / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(x);
  }

  function parseRoute() {
    var parts = (location.pathname || '').split('/').filter(Boolean);
    var q = new URLSearchParams(location.search || '');
    if (q.get('demo') === '1') {
      return { mode: q.get('u') || q.get('profile') ? 'profile' : 'clip', demo: true };
    }

    var fromQ = (q.get('id') || q.get('project') || q.get('sol') || '').trim();
    var idxPreview = parts.indexOf('preview');
    var idxShare = parts.indexOf('share');
    var idxShareable = parts.indexOf('shareable');
    var idxU = parts.indexOf('u');

    if (idxU >= 0 && parts[idxU + 1]) {
      return { mode: 'profile', solId: String(parts[idxU + 1]).toUpperCase() };
    }
    if (fromQ && /^SOL-/i.test(fromQ)) {
      return { mode: 'profile', solId: fromQ.toUpperCase() };
    }
    if (fromQ && fromQ.indexOf('prj_') === 0) {
      return { mode: 'clip', projectId: fromQ };
    }

    var clipIdx = idxPreview >= 0 ? idxPreview : (idxShare >= 0 ? idxShare : idxShareable);
    if (clipIdx >= 0 && parts[clipIdx + 1]) {
      var cid = parts[clipIdx + 1];
      if (/^SOL-/i.test(cid)) return { mode: 'profile', solId: cid.toUpperCase() };
      return { mode: 'clip', projectId: cid };
    }

    var last = parts[parts.length - 1] || '';
    if (/^SOL-/i.test(last)) return { mode: 'profile', solId: last.toUpperCase() };
    if (String(last).indexOf('prj_') === 0) return { mode: 'clip', projectId: last };

    // file open / bare shareable.html
    if (location.protocol === 'file:' || /shareable\.html$/i.test(location.pathname)) {
      return { mode: 'clip', demo: true };
    }
    return { mode: 'clip', projectId: '' };
  }

  function showError(msg) {
    document.getElementById('clipRoot').hidden = true;
    document.getElementById('profileRoot').hidden = true;
    var err = document.getElementById('pageError');
    var errMsg = document.getElementById('pageErrorMsg');
    err.hidden = false;
    if (errMsg && msg) errMsg.textContent = msg;
  }

  function openWall(title, msg) {
    var wall = document.getElementById('signupWall');
    var login = document.getElementById('wallLogin');
    var t = document.getElementById('wallTitle');
    var m = document.getElementById('wallMsg');
    if (t && title) t.textContent = title;
    if (m && msg) m.textContent = msg;
    if (login) {
      login.href = '/login.html?redirect=' + encodeURIComponent(location.pathname + location.search);
    }
    if (wall) wall.hidden = false;
  }

  function closeWall() {
    var wall = document.getElementById('signupWall');
    if (wall) wall.hidden = true;
  }

  function setFollowUi(following) {
    state.following = !!following;
    var btn = document.getElementById('followBtn');
    if (!btn) return;
    btn.classList.toggle('is-following', state.following);
    btn.textContent = state.following ? 'Following' : 'Follow';
    btn.setAttribute('aria-pressed', state.following ? 'true' : 'false');
  }

  function paintBadges(containerId, badges) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (!badges || !badges.length) return;
    if (window.SolisBadges && typeof window.SolisBadges.renderList === 'function') {
      window.SolisBadges.renderList(el, badges, 24);
      return;
    }
    var sol = state.creator && (state.creator.public_id || state.creator.id);
    if (sol && window.SolisBadges && window.SolisBadges.fetchAndRender) {
      window.SolisBadges.fetchAndRender(sol, [containerId], 24);
    }
  }

  function mixHex(hex, toward, amount) {
    function parse(h) {
      h = String(h || '').replace('#', '');
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      return [
        parseInt(h.slice(0, 2), 16) || 0,
        parseInt(h.slice(2, 4), 16) || 0,
        parseInt(h.slice(4, 6), 16) || 0,
      ];
    }
    var a = parse(hex);
    var b = parse(toward);
    var t = Math.max(0, Math.min(1, amount));
    function ch(i) {
      return Math.round(a[i] + (b[i] - a[i]) * t);
    }
    return '#' + [ch(0), ch(1), ch(2)].map(function (n) {
      return n.toString(16).padStart(2, '0');
    }).join('');
  }

  function applyBannerPalette(hex) {
    var banner = document.getElementById('profileBanner');
    if (!banner) return;
    // Default: soft white low-poly. With a PFP color, lift it into pale pastel facets.
    var base = hex || null;
    if (!base) {
      banner.style.setProperty('--poly-a', '#ffffff');
      banner.style.setProperty('--poly-b', '#f3f1ee');
      banner.style.setProperty('--poly-c', '#ebe7e2');
      banner.style.setProperty('--poly-d', '#e4dfd8');
      banner.style.setProperty('--poly-e', '#d9d3cb');
      banner.style.background = '#f7f5f2';
      return;
    }
    banner.style.setProperty('--poly-a', mixHex(base, '#ffffff', 0.82));
    banner.style.setProperty('--poly-b', mixHex(base, '#ffffff', 0.72));
    banner.style.setProperty('--poly-c', mixHex(base, '#ffffff', 0.64));
    banner.style.setProperty('--poly-d', mixHex(base, '#f5f5f5', 0.55));
    banner.style.setProperty('--poly-e', mixHex(base, '#ffffff', 0.48));
    banner.style.background = mixHex(base, '#ffffff', 0.88);
  }

  function extractDominantColor(img, cb) {
    try {
      if (!img || !img.complete || !img.naturalWidth) {
        cb(null);
        return;
      }
      var canvas = document.createElement('canvas');
      var size = 24;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        cb(null);
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      var data = ctx.getImageData(0, 0, size, size).data;
      var buckets = {};
      var bestKey = null;
      var bestCount = 0;
      for (var i = 0; i < data.length; i += 4) {
        var a = data[i + 3];
        if (a < 180) continue;
        var r = data[i];
        var g = data[i + 1];
        var b = data[i + 2];
        // Skip near-white / near-black (avatar backgrounds)
        var maxc = Math.max(r, g, b);
        var minc = Math.min(r, g, b);
        if (maxc < 40 || minc > 235) continue;
        var rq = Math.round(r / 24) * 24;
        var gq = Math.round(g / 24) * 24;
        var bq = Math.round(b / 24) * 24;
        var key = rq + ',' + gq + ',' + bq;
        buckets[key] = (buckets[key] || 0) + 1;
        if (buckets[key] > bestCount) {
          bestCount = buckets[key];
          bestKey = key;
        }
      }
      if (!bestKey) {
        cb(null);
        return;
      }
      var parts = bestKey.split(',').map(Number);
      var hex = '#' + parts.map(function (n) {
        return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
      }).join('');
      cb(hex);
    } catch (_) {
      cb(null);
    }
  }

  function setAvatar(imgId, fallbackId, picture, name) {
    var img = document.getElementById(imgId);
    var fb = document.getElementById(fallbackId);
    if (!img || !fb) return;
    if (picture) {
      img.crossOrigin = 'anonymous';
      img.src = absoluteApi(picture);
      img.alt = name || '';
      img.hidden = false;
      fb.hidden = true;
      img.onload = function () {
        if (imgId === 'pAvatar') {
          extractDominantColor(img, applyBannerPalette);
        }
      };
      img.onerror = function () {
        img.hidden = true;
        fb.hidden = false;
        fb.textContent = initials(name);
        if (imgId === 'pAvatar') applyBannerPalette(null);
      };
    } else {
      img.hidden = true;
      fb.hidden = false;
      fb.textContent = initials(name);
      if (imgId === 'pAvatar') applyBannerPalette(null);
    }
  }

  function paintCreatorOntoClip(creator) {
    var c = scrubCreator(creator) || {};
    var name = c.name || 'Creator';
    var username = String(c.username || '').replace(/^@/, '');
    var sol = c.public_id || c.solis_id || c.id || '';

    document.getElementById('creatorName').textContent = name;
    document.getElementById('creatorHandle').textContent = username ? '@' + username : '';
    setAvatar('creatorAvatar', 'creatorFallback', c.picture, name);
    paintBadges('clipBadges', c.badges);

    var caption = document.getElementById('clipCaption');
    if (caption) {
      var bio = String(c.bio || '').trim();
      caption.textContent = bio;
      caption.hidden = !bio;
    }
  }

  function paintProfile(creator, following, isSelf) {
    var c = scrubCreator(creator) || {};
    state.creator = c;
    state.solId = c.public_id || c.solis_id || c.id || state.solId;

    document.getElementById('clipRoot').hidden = true;
    document.getElementById('profileRoot').hidden = false;
    document.getElementById('pageError').hidden = true;

    var name = c.name || 'Creator';
    var username = String(c.username || '').replace(/^@/, '');
    var sol = state.solId || '';

    document.getElementById('pName').textContent = name;
    document.getElementById('pHandle').textContent = username ? '@' + username : '';
    document.title = name + ' · Solis AI';
    setOgMeta({
      title: name + ' · Solis AI',
      description: bio || 'Follow creators on Solis AI.',
      image: (c.picture && /^https?:\/\//i.test(c.picture)) ? c.picture : SOLIS_OG_IMAGE,
      url: location.href.split('?')[0],
    });

    var bioEl = document.getElementById('pBio');
    var bio = String(c.bio || '').trim();
    if (bioEl) {
      bioEl.textContent = bio;
      bioEl.hidden = !bio;
    }

    document.getElementById('pFollowers').textContent = formatCount(c.followers);
    setAvatar('pAvatar', 'pAvatarFallback', c.picture, name);
    if (!c.picture) applyBannerPalette(null);
    paintBadges('pBadges', c.badges);
    setFollowUi(following);

    var followBtn = document.getElementById('followBtn');
    if (followBtn) {
      followBtn.hidden = !!isSelf;
    }

    if ((!c.badges || !c.badges.length) && sol && window.SolisBadges) {
      window.SolisBadges.fetchAndRender(sol, ['pBadges'], 24);
    }
  }

  async function toggleFollow() {
    var sol = state.solId;
    if (!sol) return;
    var btn = document.getElementById('followBtn');
    if (btn) btn.disabled = true;

    var was = state.following;
    setFollowUi(!was);
    var followersEl = document.getElementById('pFollowers');
    var prevCount = Number(state.creator && state.creator.followers) || 0;
    var optimistic = Math.max(0, prevCount + (was ? -1 : 1));
    if (followersEl) followersEl.textContent = formatCount(optimistic);

    try {
      var res = await fetch(apiBase() + '/follows/' + encodeURIComponent(sol), {
        method: was ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
      var data = await res.json().catch(function () { return {}; });

      if (res.status === 401) {
        setFollowUi(was);
        if (followersEl) followersEl.textContent = formatCount(prevCount);
        openWall('Sign in to follow', 'Follow creators with a free Solis account — takes a few seconds.');
        return;
      }
      if (!res.ok) {
        setFollowUi(was);
        if (followersEl) followersEl.textContent = formatCount(prevCount);
        return;
      }

      var serverFollowing = data.following != null ? !!data.following : !was;
      setFollowUi(serverFollowing);
      if (data.followers != null) {
        if (state.creator) state.creator.followers = data.followers;
        if (followersEl) followersEl.textContent = formatCount(data.followers);
      } else if (state.creator) {
        state.creator.followers = optimistic;
      }
    } catch (_) {
      setFollowUi(was);
      if (followersEl) followersEl.textContent = formatCount(prevCount);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function wireVideo(video) {
    var tap = document.getElementById('tapPlay');
    if (!video) return;
    if (video.dataset.solisWired === '1') return;
    video.dataset.solisWired = '1';

    function syncTap() {
      if (!tap) return;
      var show = !!video.paused;
      tap.hidden = !show;
      tap.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    if (tap) {
      tap.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var p = video.play();
        if (p && typeof p.then === 'function') {
          p.then(syncTap).catch(function () { syncTap(); });
        } else {
          syncTap();
        }
      });
    }

    video.addEventListener('click', function (e) {
      // Ignore clicks that hit overlay controls
      if (e.target.closest && e.target.closest('.side-btn, .creator-row, .tap-play')) return;
      if (video.paused) {
        var p = video.play();
        if (p && typeof p.then === 'function') p.catch(function () {});
      } else {
        video.pause();
      }
      syncTap();
    });
    video.addEventListener('play', syncTap);
    video.addEventListener('pause', syncTap);
    video.addEventListener('ended', syncTap);
    syncTap();
  }

  function goToProfile(solId) {
    if (!solId) return;
    var isDemo = /DEMO/i.test(solId) || /(?:\?|&)demo=1(?:&|$)/.test(location.search || '');
    if (isDemo || location.protocol === 'file:') {
      var demoUrl = 'shareable.html?demo=1&u=1';
      history.pushState({ mode: 'profile', solId: solId, demo: true }, '', demoUrl);
      loadProfile(solId, true);
      return;
    }
    var url = '/u/' + encodeURIComponent(solId);
    history.pushState({ mode: 'profile', solId: solId }, '', url);
    loadProfile(solId);
  }

  async function loadProfile(solId, demo) {
    state.mode = 'profile';
    state.solId = solId;

    if (demo || solId === 'SOL-DEMO1234' || /DEMO/i.test(String(solId || ''))) {
      paintProfile({
        name: 'Speed Clips',
        username: 'speedclips',
        public_id: 'SOL-DEMO1234',
        bio: 'Funny moments and viral edits. Made with Solis AI.',
        picture: '',
        followers: 1284,
        badges: [
          { badge_type: 'verified', badge_info: { name: 'Verified', color: '#ff6b35' } },
          { badge_type: 'team', badge_info: { name: 'Solis Team', color: '#ea580c' } },
        ],
      }, false, false);
      return;
    }

    try {
      var res = await fetch(apiBase() + '/public/profile/' + encodeURIComponent(solId), {
        method: 'GET',
        credentials: 'include',
        headers: authHeaders(),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showError(data.error || 'Profile not found.');
        return;
      }
      paintProfile(data.creator, !!data.following, !!data.is_self);
    } catch (_) {
      showError('Could not load this profile.');
    }
  }

  async function loadClip(projectId, demo) {
    state.mode = 'clip';
    state.projectId = projectId;
    document.getElementById('profileRoot').hidden = true;
    document.getElementById('clipRoot').hidden = false;
    document.getElementById('pageError').hidden = true;

    var video = document.getElementById('previewVideo');
    var skel = document.getElementById('skel');
    wireVideo(video);

    if (demo) {
      paintCreatorOntoClip({
        name: 'Speed Clips',
        username: 'speedclips',
        public_id: 'SOL-DEMO1234',
        bio: 'Ishowspeed Funny Moments Compilation',
        followers: 1284,
        badges: [
          { badge_type: 'verified', badge_info: { name: 'Verified', color: '#ff6b35' } },
          { badge_type: 'team', badge_info: { name: 'Solis Team', color: '#ea580c' } },
        ],
      });
      state.solId = 'SOL-DEMO1234';
      state.creator = scrubCreator({
        name: 'Speed Clips',
        username: 'speedclips',
        public_id: 'SOL-DEMO1234',
      });
      if (skel) skel.style.display = 'none';
      if (video) {
        video.poster = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
        video.style.background =
          'center / cover no-repeat url(https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg), #111';
      }
      document.title = 'Clip by Speed Clips · Solis AI';
      setOgMeta({
        title: 'Clip by Speed Clips · Solis AI',
        description: 'Ishowspeed Funny Moments Compilation',
        image: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        url: location.href.split('?')[0],
      });
      return;
    }

    if (!projectId || projectId.indexOf('prj_') !== 0) {
      showError('Invalid share link.');
      return;
    }

    try {
      var res = await fetch(apiBase() + '/public/preview/' + encodeURIComponent(projectId), {
        method: 'GET',
        credentials: 'omit',
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showError(data.error || 'This clip may be expired or still generating.');
        return;
      }

      var creator = scrubCreator(data.creator);
      state.creator = creator;
      state.solId = (creator && (creator.public_id || creator.id)) || '';
      paintCreatorOntoClip(creator);

      var caption = document.getElementById('clipCaption');
      if (caption && data.title && !(creator && creator.bio)) {
        caption.textContent = data.title;
        caption.hidden = false;
      }

      document.title = ((data.title || 'Clip') + ' · Solis AI');
      var ogImage = (data.thumbnail_url && /^https?:\/\//i.test(data.thumbnail_url))
        ? data.thumbnail_url
        : SOLIS_OG_IMAGE;
      setOgMeta({
        title: (data.title || 'Clip') + ' · Solis AI',
        description: (creator && creator.name)
          ? ('Watch a clip by ' + creator.name + ' on Solis AI')
          : 'Watch this clip on Solis AI',
        image: ogImage,
        url: location.href.split('?')[0],
      });
      if (video && data.thumbnail_url) {
        video.poster = absoluteApi(data.thumbnail_url);
      }
      var videoUrl = absoluteApi(data.video_url || ('/api/public/preview/' + projectId + '/video'));
      if (video) {
        video.src = videoUrl;
        video.addEventListener('loadeddata', function () {
          if (skel) skel.style.display = 'none';
        }, { once: true });
        video.addEventListener('error', function () {
          if (skel) skel.style.display = 'none';
        });
        try { video.play().catch(function () {}); } catch (_) {}
      }
    } catch (_) {
      showError('Could not load this clip.');
    }
  }

  function wireChrome() {
    document.getElementById('downloadBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      openWall('Sign up to download', 'Watching is free. Downloads need a Solis account.');
    });
    document.getElementById('shareBtn')?.addEventListener('click', async function () {
      var url = location.href.split('?')[0];
      try {
        await navigator.clipboard.writeText(url);
      } catch (_) {
        prompt('Copy this link', url);
      }
    });
    document.getElementById('wallClose')?.addEventListener('click', closeWall);
    document.getElementById('signupWall')?.addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closeWall();
    });
    document.getElementById('followBtn')?.addEventListener('click', function () {
      toggleFollow();
    });
    document.getElementById('creatorLink')?.addEventListener('click', function () {
      var sol = state.solId || (state.creator && (state.creator.public_id || state.creator.id));
      if (sol) goToProfile(sol);
    });
    window.addEventListener('popstate', function () {
      boot(true);
    });
  }

  async function boot(fromPop) {
    var route = parseRoute();
    if (!fromPop) wireChrome();

    if (route.mode === 'profile') {
      await loadProfile(route.solId || 'SOL-DEMO1234', route.demo);
      return;
    }
    await loadClip(route.projectId || '', route.demo);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(false); });
  } else {
    boot(false);
  }
})();
