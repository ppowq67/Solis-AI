(function() {
  "use strict";
  var e = "https://solisai.video/assets/og-image.png?v=2";
  function setOgMeta(e) {
    if (!e) return;
    function setMeta(e, t, o) {
      if (!t) return;
      var r = o ? 'meta[name="' + e + '"]' : 'meta[property="' + e + '"]';
      var n = document.querySelector(r);
      if (!n) {
        n = document.createElement("meta");
        if (o) n.setAttribute("name", e); else n.setAttribute("property", e);
        document.head.appendChild(n);
      }
      n.setAttribute("content", t);
    }
    if (e.title) {
      document.title = e.title;
      setMeta("og:title", e.title);
      setMeta("twitter:title", e.title, true);
    }
    if (e.description) {
      setMeta("og:description", e.description);
      setMeta("twitter:description", e.description, true);
    }
    if (e.image) {
      setMeta("og:image", e.image);
      setMeta("twitter:image", e.image, true);
    }
    if (e.url) setMeta("og:url", e.url);
  }
  var t = {
    mode: "clip",
    creator: null,
    following: false,
    projectId: "",
    solId: ""
  };
  function apiBase() {
    try {
      if (window.API_BASE_URL) return String(window.API_BASE_URL).replace(/\/$/, "");
    } catch (e) {}
    var e = location.hostname;
    if (e === "localhost" || e === "127.0.0.1") {
      return location.protocol + "//" + e + ":5500/api";
    }
    return "https://api.solisai.video/api";
  }
  function absoluteApi(e) {
    if (!e) return "";
    if (/^https?:\/\//i.test(e)) return e;
    var t = apiBase().replace(/\/api$/, "");
    return t + (e.charAt(0) === "/" ? e : "/" + e);
  }
  function authHeaders() {
    var e = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };
    try {
      if (typeof window.getAuthHeaders === "function") {
        Object.assign(e, window.getAuthHeaders());
      }
    } catch (e) {}
    return e;
  }
  function looksLikeEmail(e) {
    return typeof e === "string" && /[^@\s]+@[^@\s]+\.[^@\s]+/.test(e);
  }
  function scrubCreator(e) {
    if (!e || typeof e !== "object") return null;
    var t = {};
    Object.keys(e).forEach(function(o) {
      var r = String(o).toLowerCase();
      if (r.indexOf("email") >= 0 || r.indexOf("mail") >= 0) return;
      var n = e[o];
      if (looksLikeEmail(n)) return;
      t[o] = n;
    });
    if (!t.public_id && t.id) t.public_id = t.id;
    if (!t.name || looksLikeEmail(t.name)) t.name = t.username || "Creator";
    if (looksLikeEmail(t.username)) t.username = "";
    return t;
  }
  function initials(e) {
    var t = String(e || "S").trim();
    var o = t.split(/\s+/).filter(Boolean);
    if (o.length >= 2) return (o[0][0] + o[1][0]).toUpperCase();
    return (t[0] || "S").toUpperCase();
  }
  function formatCount(e) {
    var t = Number(e) || 0;
    if (t >= 1e6) return (t / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (t >= 1e3) return (t / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(t);
  }
  function parseRoute() {
    var e = (location.pathname || "").split("/").filter(Boolean);
    var t = new URLSearchParams(location.search || "");
    if (t.get("demo") === "1") {
      return {
        mode: t.get("u") || t.get("profile") ? "profile" : "clip",
        demo: true
      };
    }
    var o = (t.get("id") || t.get("project") || t.get("sol") || "").trim();
    var r = e.indexOf("preview");
    var n = e.indexOf("share");
    var i = e.indexOf("shareable");
    var a = e.indexOf("u");
    if (a >= 0 && e[a + 1]) {
      return {
        mode: "profile",
        solId: String(e[a + 1]).toUpperCase()
      };
    }
    if (o && /^SOL-/i.test(o)) {
      return {
        mode: "profile",
        solId: o.toUpperCase()
      };
    }
    if (o && o.indexOf("prj_") === 0) {
      return {
        mode: "clip",
        projectId: o
      };
    }
    var l = r >= 0 ? r : n >= 0 ? n : i;
    if (l >= 0 && e[l + 1]) {
      var d = e[l + 1];
      if (/^SOL-/i.test(d)) return {
        mode: "profile",
        solId: d.toUpperCase()
      };
      return {
        mode: "clip",
        projectId: d
      };
    }
    var s = e[e.length - 1] || "";
    if (/^SOL-/i.test(s)) return {
      mode: "profile",
      solId: s.toUpperCase()
    };
    if (String(s).indexOf("prj_") === 0) return {
      mode: "clip",
      projectId: s
    };
    if (location.protocol === "file:" || /shareable\.html$/i.test(location.pathname)) {
      return {
        mode: "clip",
        demo: true
      };
    }
    return {
      mode: "clip",
      projectId: ""
    };
  }
  function showError(e) {
    document.getElementById("clipRoot").hidden = true;
    document.getElementById("profileRoot").hidden = true;
    var t = document.getElementById("pageError");
    var o = document.getElementById("pageErrorMsg");
    t.hidden = false;
    if (o && e) o.textContent = e;
  }
  function openWall(e, t) {
    var o = document.getElementById("signupWall");
    var r = document.getElementById("wallLogin");
    var n = document.getElementById("wallTitle");
    var i = document.getElementById("wallMsg");
    if (n && e) n.textContent = e;
    if (i && t) i.textContent = t;
    if (r) {
      r.href = "/login.html?redirect=" + encodeURIComponent(location.pathname + location.search);
    }
    if (o) o.hidden = false;
  }
  function closeWall() {
    var e = document.getElementById("signupWall");
    if (e) e.hidden = true;
  }
  function setFollowUi(e) {
    t.following = !!e;
    var o = document.getElementById("followBtn");
    if (!o) return;
    o.classList.toggle("is-following", t.following);
    o.textContent = t.following ? "Following" : "Follow";
    o.setAttribute("aria-pressed", t.following ? "true" : "false");
  }
  function paintBadges(e, o) {
    var r = document.getElementById(e);
    if (!r) return;
    r.innerHTML = "";
    if (!o || !o.length) return;
    if (window.SolisBadges && typeof window.SolisBadges.renderList === "function") {
      window.SolisBadges.renderList(r, o, 24);
      return;
    }
    var n = t.creator && (t.creator.public_id || t.creator.id);
    if (n && window.SolisBadges && window.SolisBadges.fetchAndRender) {
      window.SolisBadges.fetchAndRender(n, [ e ], 24);
    }
  }
  function mixHex(e, t, o) {
    function parse(e) {
      e = String(e || "").replace("#", "");
      if (e.length === 3) e = e[0] + e[0] + e[1] + e[1] + e[2] + e[2];
      return [ parseInt(e.slice(0, 2), 16) || 0, parseInt(e.slice(2, 4), 16) || 0, parseInt(e.slice(4, 6), 16) || 0 ];
    }
    var r = parse(e);
    var n = parse(t);
    var i = Math.max(0, Math.min(1, o));
    function ch(e) {
      return Math.round(r[e] + (n[e] - r[e]) * i);
    }
    return "#" + [ ch(0), ch(1), ch(2) ].map(function(e) {
      return e.toString(16).padStart(2, "0");
    }).join("");
  }
  function applyBannerPalette(e) {
    var t = document.getElementById("profileBanner");
    if (!t) return;
    var o = e || null;
    if (!o) {
      t.style.setProperty("--poly-a", "#ffffff");
      t.style.setProperty("--poly-b", "#f3f1ee");
      t.style.setProperty("--poly-c", "#ebe7e2");
      t.style.setProperty("--poly-d", "#e4dfd8");
      t.style.setProperty("--poly-e", "#d9d3cb");
      t.style.background = "#f7f5f2";
      return;
    }
    t.style.setProperty("--poly-a", mixHex(o, "#ffffff", .82));
    t.style.setProperty("--poly-b", mixHex(o, "#ffffff", .72));
    t.style.setProperty("--poly-c", mixHex(o, "#ffffff", .64));
    t.style.setProperty("--poly-d", mixHex(o, "#f5f5f5", .55));
    t.style.setProperty("--poly-e", mixHex(o, "#ffffff", .48));
    t.style.background = mixHex(o, "#ffffff", .88);
  }
  function extractDominantColor(e, t) {
    try {
      if (!e || !e.complete || !e.naturalWidth) {
        t(null);
        return;
      }
      var o = document.createElement("canvas");
      var r = 24;
      o.width = r;
      o.height = r;
      var n = o.getContext("2d", {
        willReadFrequently: true
      });
      if (!n) {
        t(null);
        return;
      }
      n.drawImage(e, 0, 0, r, r);
      var i = n.getImageData(0, 0, r, r).data;
      var a = {};
      var l = null;
      var d = 0;
      for (var s = 0; s < i.length; s += 4) {
        var c = i[s + 3];
        if (c < 180) continue;
        var f = i[s];
        var u = i[s + 1];
        var p = i[s + 2];
        var m = Math.max(f, u, p);
        var g = Math.min(f, u, p);
        if (m < 40 || g > 235) continue;
        var h = Math.round(f / 24) * 24;
        var v = Math.round(u / 24) * 24;
        var y = Math.round(p / 24) * 24;
        var w = h + "," + v + "," + y;
        a[w] = (a[w] || 0) + 1;
        if (a[w] > d) {
          d = a[w];
          l = w;
        }
      }
      if (!l) {
        t(null);
        return;
      }
      var I = l.split(",").map(Number);
      var E = "#" + I.map(function(e) {
        return Math.max(0, Math.min(255, e)).toString(16).padStart(2, "0");
      }).join("");
      t(E);
    } catch (e) {
      t(null);
    }
  }
  function setAvatar(e, t, o, r) {
    var n = document.getElementById(e);
    var i = document.getElementById(t);
    if (!n || !i) return;
    if (o) {
      n.crossOrigin = "anonymous";
      n.src = absoluteApi(o);
      n.alt = r || "";
      n.hidden = false;
      i.hidden = true;
      n.onload = function() {
        if (e === "pAvatar") {
          extractDominantColor(n, applyBannerPalette);
        }
      };
      n.onerror = function() {
        n.hidden = true;
        i.hidden = false;
        i.textContent = initials(r);
        if (e === "pAvatar") applyBannerPalette(null);
      };
    } else {
      n.hidden = true;
      i.hidden = false;
      i.textContent = initials(r);
      if (e === "pAvatar") applyBannerPalette(null);
    }
  }
  function paintCreatorOntoClip(e) {
    var t = scrubCreator(e) || {};
    var o = t.name || "Creator";
    var r = String(t.username || "").replace(/^@/, "");
    var n = t.public_id || t.solis_id || t.id || "";
    document.getElementById("creatorName").textContent = o;
    document.getElementById("creatorHandle").textContent = r ? "@" + r : "";
    setAvatar("creatorAvatar", "creatorFallback", t.picture, o);
    paintBadges("clipBadges", t.badges);
    var i = document.getElementById("clipCaption");
    if (i) {
      var a = String(t.bio || "").trim();
      i.textContent = a;
      i.hidden = !a;
    }
  }
  function paintProfile(o, r, n) {
    var i = scrubCreator(o) || {};
    t.creator = i;
    t.solId = i.public_id || i.solis_id || i.id || t.solId;
    document.getElementById("clipRoot").hidden = true;
    document.getElementById("profileRoot").hidden = false;
    document.getElementById("pageError").hidden = true;
    var a = i.name || "Creator";
    var l = String(i.username || "").replace(/^@/, "");
    var d = t.solId || "";
    document.getElementById("pName").textContent = a;
    document.getElementById("pHandle").textContent = l ? "@" + l : "";
    document.title = a + " · Solis AI";
    setOgMeta({
      title: a + " · Solis AI",
      description: c || "Follow creators on Solis AI.",
      image: i.picture && /^https?:\/\//i.test(i.picture) ? i.picture : e,
      url: location.href.split("?")[0]
    });
    var s = document.getElementById("pBio");
    var c = String(i.bio || "").trim();
    if (s) {
      s.textContent = c;
      s.hidden = !c;
    }
    document.getElementById("pFollowers").textContent = formatCount(i.followers);
    setAvatar("pAvatar", "pAvatarFallback", i.picture, a);
    if (!i.picture) applyBannerPalette(null);
    paintBadges("pBadges", i.badges);
    setFollowUi(r);
    var f = document.getElementById("followBtn");
    if (f) {
      f.hidden = !!n;
    }
    if ((!i.badges || !i.badges.length) && d && window.SolisBadges) {
      window.SolisBadges.fetchAndRender(d, [ "pBadges" ], 24);
    }
  }
  async function toggleFollow() {
    var e = t.solId;
    if (!e) return;
    var o = document.getElementById("followBtn");
    if (o) o.disabled = true;
    var r = t.following;
    setFollowUi(!r);
    var n = document.getElementById("pFollowers");
    var i = Number(t.creator && t.creator.followers) || 0;
    var a = Math.max(0, i + (r ? -1 : 1));
    if (n) n.textContent = formatCount(a);
    try {
      var l = await fetch(apiBase() + "/follows/" + encodeURIComponent(e), {
        method: r ? "DELETE" : "POST",
        credentials: "include",
        headers: authHeaders()
      });
      var d = await l.json().catch(function() {
        return {};
      });
      if (l.status === 401) {
        setFollowUi(r);
        if (n) n.textContent = formatCount(i);
        openWall("Sign in to follow", "Follow creators with a free Solis account — takes a few seconds.");
        return;
      }
      if (!l.ok) {
        setFollowUi(r);
        if (n) n.textContent = formatCount(i);
        return;
      }
      var s = d.following != null ? !!d.following : !r;
      setFollowUi(s);
      if (d.followers != null) {
        if (t.creator) t.creator.followers = d.followers;
        if (n) n.textContent = formatCount(d.followers);
      } else if (t.creator) {
        t.creator.followers = a;
      }
    } catch (e) {
      setFollowUi(r);
      if (n) n.textContent = formatCount(i);
    } finally {
      if (o) o.disabled = false;
    }
  }
  function wireVideo(e) {
    var t = document.getElementById("tapPlay");
    if (!e) return;
    function syncTap() {
      if (!t) return;
      t.hidden = !e.paused;
    }
    t && t.addEventListener("click", function(t) {
      t.stopPropagation();
      e.play().catch(function() {});
      syncTap();
    });
    e.addEventListener("click", function() {
      if (e.paused) e.play().catch(function() {}); else e.pause();
      syncTap();
    });
    e.addEventListener("play", syncTap);
    e.addEventListener("pause", syncTap);
    syncTap();
  }
  function goToProfile(e) {
    if (!e) return;
    var t = /DEMO/i.test(e) || /(?:\?|&)demo=1(?:&|$)/.test(location.search || "");
    if (t || location.protocol === "file:") {
      var o = "shareable.html?demo=1&u=1";
      history.pushState({
        mode: "profile",
        solId: e,
        demo: true
      }, "", o);
      loadProfile(e, true);
      return;
    }
    var r = "/u/" + encodeURIComponent(e);
    history.pushState({
      mode: "profile",
      solId: e
    }, "", r);
    loadProfile(e);
  }
  async function loadProfile(e, o) {
    t.mode = "profile";
    t.solId = e;
    if (o || e === "SOL-DEMO1234" || /DEMO/i.test(String(e || ""))) {
      paintProfile({
        name: "Speed Clips",
        username: "speedclips",
        public_id: "SOL-DEMO1234",
        bio: "Funny moments and viral edits. Made with Solis AI.",
        picture: "",
        followers: 1284,
        badges: [ {
          badge_type: "verified",
          badge_info: {
            name: "Verified",
            color: "#ff6b35"
          }
        }, {
          badge_type: "team",
          badge_info: {
            name: "Solis Team",
            color: "#ea580c"
          }
        } ]
      }, false, false);
      return;
    }
    try {
      var r = await fetch(apiBase() + "/public/profile/" + encodeURIComponent(e), {
        method: "GET",
        credentials: "include",
        headers: authHeaders()
      });
      var n = await r.json().catch(function() {
        return {};
      });
      if (!r.ok) {
        showError(n.error || "Profile not found.");
        return;
      }
      paintProfile(n.creator, !!n.following, !!n.is_self);
    } catch (e) {
      showError("Could not load this profile.");
    }
  }
  async function loadClip(o, r) {
    t.mode = "clip";
    t.projectId = o;
    document.getElementById("profileRoot").hidden = true;
    document.getElementById("clipRoot").hidden = false;
    document.getElementById("pageError").hidden = true;
    var n = document.getElementById("previewVideo");
    var i = document.getElementById("skel");
    wireVideo(n);
    if (r) {
      paintCreatorOntoClip({
        name: "Speed Clips",
        username: "speedclips",
        public_id: "SOL-DEMO1234",
        bio: "Ishowspeed Funny Moments Compilation",
        followers: 1284,
        badges: [ {
          badge_type: "verified",
          badge_info: {
            name: "Verified",
            color: "#ff6b35"
          }
        }, {
          badge_type: "team",
          badge_info: {
            name: "Solis Team",
            color: "#ea580c"
          }
        } ]
      });
      t.solId = "SOL-DEMO1234";
      t.creator = scrubCreator({
        name: "Speed Clips",
        username: "speedclips",
        public_id: "SOL-DEMO1234"
      });
      if (i) i.style.display = "none";
      if (n) {
        n.poster = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
        n.style.background = "center / cover no-repeat url(https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg), #111";
      }
      document.title = "Clip by Speed Clips · Solis AI";
      setOgMeta({
        title: "Clip by Speed Clips · Solis AI",
        description: "Ishowspeed Funny Moments Compilation",
        image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        url: location.href.split("?")[0]
      });
      return;
    }
    if (!o || o.indexOf("prj_") !== 0) {
      showError("Invalid share link.");
      return;
    }
    try {
      var a = await fetch(apiBase() + "/public/preview/" + encodeURIComponent(o), {
        method: "GET",
        credentials: "omit"
      });
      var l = await a.json().catch(function() {
        return {};
      });
      if (!a.ok) {
        showError(l.error || "This clip may be expired or still generating.");
        return;
      }
      var d = scrubCreator(l.creator);
      t.creator = d;
      t.solId = d && (d.public_id || d.id) || "";
      paintCreatorOntoClip(d);
      var s = document.getElementById("clipCaption");
      if (s && l.title && !(d && d.bio)) {
        s.textContent = l.title;
        s.hidden = false;
      }
      document.title = (l.title || "Clip") + " · Solis AI";
      var c = l.thumbnail_url && /^https?:\/\//i.test(l.thumbnail_url) ? l.thumbnail_url : e;
      setOgMeta({
        title: (l.title || "Clip") + " · Solis AI",
        description: d && d.name ? "Watch a clip by " + d.name + " on Solis AI" : "Watch this clip on Solis AI",
        image: c,
        url: location.href.split("?")[0]
      });
      if (n && l.thumbnail_url) {
        n.poster = absoluteApi(l.thumbnail_url);
      }
      var f = absoluteApi(l.video_url || "/api/public/preview/" + o + "/video");
      if (n) {
        n.src = f;
        n.addEventListener("loadeddata", function() {
          if (i) i.style.display = "none";
        }, {
          once: true
        });
        n.addEventListener("error", function() {
          if (i) i.style.display = "none";
        });
        try {
          n.play().catch(function() {});
        } catch (e) {}
      }
    } catch (e) {
      showError("Could not load this clip.");
    }
  }
  function wireChrome() {
    document.getElementById("downloadBtn")?.addEventListener("click", function(e) {
      e.preventDefault();
      openWall("Sign up to download", "Watching is free. Downloads need a Solis account.");
    });
    document.getElementById("shareBtn")?.addEventListener("click", async function() {
      var e = location.href.split("?")[0];
      try {
        await navigator.clipboard.writeText(e);
      } catch (t) {
        prompt("Copy this link", e);
      }
    });
    document.getElementById("wallClose")?.addEventListener("click", closeWall);
    document.getElementById("signupWall")?.addEventListener("click", function(e) {
      if (e.target === e.currentTarget) closeWall();
    });
    document.getElementById("followBtn")?.addEventListener("click", function() {
      toggleFollow();
    });
    document.getElementById("creatorLink")?.addEventListener("click", function() {
      var e = t.solId || t.creator && (t.creator.public_id || t.creator.id);
      if (e) goToProfile(e);
    });
    window.addEventListener("popstate", function() {
      boot(true);
    });
  }
  async function boot(e) {
    var t = parseRoute();
    if (!e) wireChrome();
    if (t.mode === "profile") {
      await loadProfile(t.solId || "SOL-DEMO1234", t.demo);
      return;
    }
    await loadClip(t.projectId || "", t.demo);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      boot(false);
    });
  } else {
    boot(false);
  }
})();
