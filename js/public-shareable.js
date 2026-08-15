(function() {
  "use strict";
  var e = {
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
      var n = String(o).toLowerCase();
      if (n.indexOf("email") >= 0 || n.indexOf("mail") >= 0) return;
      var r = e[o];
      if (looksLikeEmail(r)) return;
      t[o] = r;
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
    var n = e.indexOf("preview");
    var r = e.indexOf("share");
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
    var l = n >= 0 ? n : r >= 0 ? r : i;
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
    var c = e[e.length - 1] || "";
    if (/^SOL-/i.test(c)) return {
      mode: "profile",
      solId: c.toUpperCase()
    };
    if (String(c).indexOf("prj_") === 0) return {
      mode: "clip",
      projectId: c
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
    var n = document.getElementById("wallLogin");
    var r = document.getElementById("wallTitle");
    var i = document.getElementById("wallMsg");
    if (r && e) r.textContent = e;
    if (i && t) i.textContent = t;
    if (n) {
      n.href = "/login.html?redirect=" + encodeURIComponent(location.pathname + location.search);
    }
    if (o) o.hidden = false;
  }
  function closeWall() {
    var e = document.getElementById("signupWall");
    if (e) e.hidden = true;
  }
  function setFollowUi(t) {
    e.following = !!t;
    var o = document.getElementById("followBtn");
    if (!o) return;
    o.classList.toggle("is-following", e.following);
    o.textContent = e.following ? "Following" : "Follow";
    o.setAttribute("aria-pressed", e.following ? "true" : "false");
  }
  function paintBadges(t, o) {
    var n = document.getElementById(t);
    if (!n) return;
    n.innerHTML = "";
    if (!o || !o.length) return;
    if (window.SolisBadges && typeof window.SolisBadges.renderList === "function") {
      window.SolisBadges.renderList(n, o, 24);
      return;
    }
    var r = e.creator && (e.creator.public_id || e.creator.id);
    if (r && window.SolisBadges && window.SolisBadges.fetchAndRender) {
      window.SolisBadges.fetchAndRender(r, [ t ], 24);
    }
  }
  function mixHex(e, t, o) {
    function parse(e) {
      e = String(e || "").replace("#", "");
      if (e.length === 3) e = e[0] + e[0] + e[1] + e[1] + e[2] + e[2];
      return [ parseInt(e.slice(0, 2), 16) || 0, parseInt(e.slice(2, 4), 16) || 0, parseInt(e.slice(4, 6), 16) || 0 ];
    }
    var n = parse(e);
    var r = parse(t);
    var i = Math.max(0, Math.min(1, o));
    function ch(e) {
      return Math.round(n[e] + (r[e] - n[e]) * i);
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
      var n = 24;
      o.width = n;
      o.height = n;
      var r = o.getContext("2d", {
        willReadFrequently: true
      });
      if (!r) {
        t(null);
        return;
      }
      r.drawImage(e, 0, 0, n, n);
      var i = r.getImageData(0, 0, n, n).data;
      var a = {};
      var l = null;
      var d = 0;
      for (var c = 0; c < i.length; c += 4) {
        var s = i[c + 3];
        if (s < 180) continue;
        var f = i[c];
        var u = i[c + 1];
        var p = i[c + 2];
        var m = Math.max(f, u, p);
        var g = Math.min(f, u, p);
        if (m < 40 || g > 235) continue;
        var v = Math.round(f / 24) * 24;
        var y = Math.round(u / 24) * 24;
        var h = Math.round(p / 24) * 24;
        var w = v + "," + y + "," + h;
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
      var E = l.split(",").map(Number);
      var I = "#" + E.map(function(e) {
        return Math.max(0, Math.min(255, e)).toString(16).padStart(2, "0");
      }).join("");
      t(I);
    } catch (e) {
      t(null);
    }
  }
  function setAvatar(e, t, o, n) {
    var r = document.getElementById(e);
    var i = document.getElementById(t);
    if (!r || !i) return;
    if (o) {
      r.crossOrigin = "anonymous";
      r.src = absoluteApi(o);
      r.alt = n || "";
      r.hidden = false;
      i.hidden = true;
      r.onload = function() {
        if (e === "pAvatar") {
          extractDominantColor(r, applyBannerPalette);
        }
      };
      r.onerror = function() {
        r.hidden = true;
        i.hidden = false;
        i.textContent = initials(n);
        if (e === "pAvatar") applyBannerPalette(null);
      };
    } else {
      r.hidden = true;
      i.hidden = false;
      i.textContent = initials(n);
      if (e === "pAvatar") applyBannerPalette(null);
    }
  }
  function paintCreatorOntoClip(e) {
    var t = scrubCreator(e) || {};
    var o = t.name || "Creator";
    var n = String(t.username || "").replace(/^@/, "");
    var r = t.public_id || t.solis_id || t.id || "";
    document.getElementById("creatorName").textContent = o;
    document.getElementById("creatorHandle").textContent = n ? "@" + n : "";
    setAvatar("creatorAvatar", "creatorFallback", t.picture, o);
    paintBadges("clipBadges", t.badges);
    var i = document.getElementById("clipCaption");
    if (i) {
      var a = String(t.bio || "").trim();
      i.textContent = a;
      i.hidden = !a;
    }
  }
  function paintProfile(t, o, n) {
    var r = scrubCreator(t) || {};
    e.creator = r;
    e.solId = r.public_id || r.solis_id || r.id || e.solId;
    document.getElementById("clipRoot").hidden = true;
    document.getElementById("profileRoot").hidden = false;
    document.getElementById("pageError").hidden = true;
    var i = r.name || "Creator";
    var a = String(r.username || "").replace(/^@/, "");
    var l = e.solId || "";
    document.getElementById("pName").textContent = i;
    document.getElementById("pHandle").textContent = a ? "@" + a : "";
    document.title = i + " · Solis AI";
    var d = document.getElementById("pBio");
    var c = String(r.bio || "").trim();
    if (d) {
      d.textContent = c;
      d.hidden = !c;
    }
    document.getElementById("pFollowers").textContent = formatCount(r.followers);
    setAvatar("pAvatar", "pAvatarFallback", r.picture, i);
    if (!r.picture) applyBannerPalette(null);
    paintBadges("pBadges", r.badges);
    setFollowUi(o);
    var s = document.getElementById("followBtn");
    if (s) {
      s.hidden = !!n;
    }
    if ((!r.badges || !r.badges.length) && l && window.SolisBadges) {
      window.SolisBadges.fetchAndRender(l, [ "pBadges" ], 24);
    }
  }
  async function toggleFollow() {
    var t = e.solId;
    if (!t) return;
    var o = document.getElementById("followBtn");
    if (o) o.disabled = true;
    var n = e.following;
    setFollowUi(!n);
    var r = document.getElementById("pFollowers");
    var i = Number(e.creator && e.creator.followers) || 0;
    var a = Math.max(0, i + (n ? -1 : 1));
    if (r) r.textContent = formatCount(a);
    try {
      var l = await fetch(apiBase() + "/follows/" + encodeURIComponent(t), {
        method: n ? "DELETE" : "POST",
        credentials: "include",
        headers: authHeaders()
      });
      var d = await l.json().catch(function() {
        return {};
      });
      if (l.status === 401) {
        setFollowUi(n);
        if (r) r.textContent = formatCount(i);
        openWall("Sign in to follow", "Follow creators with a free Solis account — takes a few seconds.");
        return;
      }
      if (!l.ok) {
        setFollowUi(n);
        if (r) r.textContent = formatCount(i);
        return;
      }
      var c = d.following != null ? !!d.following : !n;
      setFollowUi(c);
      if (d.followers != null) {
        if (e.creator) e.creator.followers = d.followers;
        if (r) r.textContent = formatCount(d.followers);
      } else if (e.creator) {
        e.creator.followers = a;
      }
    } catch (e) {
      setFollowUi(n);
      if (r) r.textContent = formatCount(i);
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
    var n = "/u/" + encodeURIComponent(e);
    history.pushState({
      mode: "profile",
      solId: e
    }, "", n);
    loadProfile(e);
  }
  async function loadProfile(t, o) {
    e.mode = "profile";
    e.solId = t;
    if (o || t === "SOL-DEMO1234" || /DEMO/i.test(String(t || ""))) {
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
      var n = await fetch(apiBase() + "/public/profile/" + encodeURIComponent(t), {
        method: "GET",
        credentials: "include",
        headers: authHeaders()
      });
      var r = await n.json().catch(function() {
        return {};
      });
      if (!n.ok) {
        showError(r.error || "Profile not found.");
        return;
      }
      paintProfile(r.creator, !!r.following, !!r.is_self);
    } catch (e) {
      showError("Could not load this profile.");
    }
  }
  async function loadClip(t, o) {
    e.mode = "clip";
    e.projectId = t;
    document.getElementById("profileRoot").hidden = true;
    document.getElementById("clipRoot").hidden = false;
    document.getElementById("pageError").hidden = true;
    var n = document.getElementById("previewVideo");
    var r = document.getElementById("skel");
    wireVideo(n);
    if (o) {
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
      e.solId = "SOL-DEMO1234";
      e.creator = scrubCreator({
        name: "Speed Clips",
        username: "speedclips",
        public_id: "SOL-DEMO1234"
      });
      if (r) r.style.display = "none";
      if (n) {
        n.poster = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
        n.style.background = "center / cover no-repeat url(https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg), #111";
      }
      document.title = "Clip by Speed Clips · Solis AI";
      return;
    }
    if (!t || t.indexOf("prj_") !== 0) {
      showError("Invalid share link.");
      return;
    }
    try {
      var i = await fetch(apiBase() + "/public/preview/" + encodeURIComponent(t), {
        method: "GET",
        credentials: "omit"
      });
      var a = await i.json().catch(function() {
        return {};
      });
      if (!i.ok) {
        showError(a.error || "This clip may be expired or still generating.");
        return;
      }
      var l = scrubCreator(a.creator);
      e.creator = l;
      e.solId = l && (l.public_id || l.id) || "";
      paintCreatorOntoClip(l);
      var d = document.getElementById("clipCaption");
      if (d && a.title && !(l && l.bio)) {
        d.textContent = a.title;
        d.hidden = false;
      }
      document.title = (a.title || "Clip") + " · Solis AI";
      var c = absoluteApi(a.video_url || "/api/public/preview/" + t + "/video");
      if (n) {
        n.src = c;
        n.addEventListener("loadeddata", function() {
          if (r) r.style.display = "none";
        }, {
          once: true
        });
        n.addEventListener("error", function() {
          if (r) r.style.display = "none";
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
      var t = e.solId || e.creator && (e.creator.public_id || e.creator.id);
      if (t) goToProfile(t);
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
