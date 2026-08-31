(function() {
  const e = false;
  if (!e) {
    window.SolisInstantRecipe = {
      enabled: false,
      prefetch: async () => null,
      willOffer: () => false,
      didOffer: () => false,
      markUserEdited: () => {},
      sendFeedback: () => {},
      get: () => null
    };
    return;
  }
  const t = .32;
  const n = 5200;
  let r = null;
  let i = "";
  let o = null;
  let s = "";
  let l = false;
  let c = false;
  let a = null;
  function apiUrl(e) {
    if (typeof window.apiUrl === "function") return window.apiUrl(e);
    return e;
  }
  function authHeaders() {
    const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
    return {
      "Content-Type": "application/json",
      ...e
    };
  }
  function videoKeyFromUrl(e) {
    const t = String(e || "");
    const n = t.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/i);
    if (n) return "yt:" + n[1];
    return "u:" + t.split("?")[0].slice(-24);
  }
  function currentUrl() {
    return (document.getElementById("youtubeUrlInput")?.value || "").trim();
  }
  function isValidUrl(e) {
    try {
      if (window.clipsStudio && typeof window.clipsStudio.isValidMediaUrl === "function") {
        return window.clipsStudio.isValidMediaUrl(e);
      }
    } catch (e) {}
    return /youtu\.?be|tiktok\.com|instagram\.com\/(reels?|p)\//i.test(String(e || ""));
  }
  function allowedTemplates() {
    const e = new Set([ "basic", "prime", "elite", "pro", "nextgen" ]);
    let t = "free";
    try {
      t = String(window.currentUser?.plan || window.currentUser?.plan_type || "free").toLowerCase();
    } catch (e) {}
    const n = [ "ranked_compilation" ];
    if (e.has(t)) n.push("splitscreen");
    return n;
  }
  function userLayout() {
    try {
      if (typeof window.getSplitscreenConfig === "function") {
        return window.getSplitscreenConfig();
      }
    } catch (e) {}
    return null;
  }
  function isLibrary() {
    try {
      return !!window.clipsStudio?.currentTemplateForPreview?.isLibraryPreview;
    } catch (e) {
      return false;
    }
  }
  function willOffer(e) {
    if (l || c || isLibrary()) return false;
    const n = currentUrl();
    if (!n || !isValidUrl(n)) return false;
    const a = String(e || window.clipsStudio?.currentTemplateForPreview?.id || "");
    if (!isSplitscreen(a)) return false;
    if (r && i === videoKeyFromUrl(n)) return true;
    if (o && o.ok && s === n && Number(o.confidence) >= t) return true;
    return false;
  }
  function isSplitscreen(e) {
    const t = String(e || "").toLowerCase();
    return t === "splitscreen" || t.includes("split");
  }
  function didOffer() {
    return c;
  }
  function markUserEdited() {
    l = true;
    if (a) {
      clearTimeout(a);
      a = null;
    }
  }
  function resetForUrl(e) {
    const t = videoKeyFromUrl(e);
    if (i && i !== t && r?.abort) {
      try {
        r.abort();
      } catch (e) {}
    }
    if (s && s !== e) {
      o = null;
      c = false;
      l = false;
    }
  }
  async function prefetch(e, t) {
    e = String(e || "").trim();
    if (!e || !isValidUrl(e)) return null;
    resetForUrl(e);
    const l = videoKeyFromUrl(e);
    if (o && o.ok && s === e && !t?.force) {
      return o;
    }
    if (r && i === l && !t?.force) return r.promise;
    const c = new AbortController;
    const a = setTimeout(() => c.abort(), n);
    const u = t?.templateId || window.clipsStudio?.currentTemplateForPreview?.id || "";
    const f = {
      url: e,
      allowed_templates: allowedTemplates(),
      template_id: u || undefined,
      user_layout: isSplitscreen(u) ? userLayout() : undefined,
      force: !!t?.force
    };
    const d = (async () => {
      try {
        const t = await fetch(apiUrl("/api/clips/instant-recipe"), {
          method: "POST",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify(f),
          signal: c.signal
        });
        if (!t.ok) return null;
        const n = await t.json();
        if (!n || !n.ok) return null;
        o = n;
        s = e;
        if (typeof window.solisLog === "function") {
          window.solisLog("InstantRecipe", `${n.why_short || n.template} · ${Math.round((n.confidence || 0) * 100)}% · ${n.source || ""} · ${(n.skills || []).join("+") || "rules"} · ${n.elapsed_ms || 0}ms`);
        }
        return n;
      } catch (e) {
        if (e?.name === "AbortError") return null;
        console.warn("[InstantRecipe] fetch failed:", e?.message || e);
        return null;
      } finally {
        clearTimeout(a);
        if (r && i === l) r = null;
      }
    })();
    r = {
      promise: d,
      abort: () => c.abort()
    };
    i = l;
    return d;
  }
  function sendFeedback(e) {
    if (!o || !o.video_key) return;
    try {
      fetch(apiUrl("/api/clips/instant-recipe/feedback"), {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({
          video_key: o.video_key,
          channel_key: o.channel_key || "",
          accepted: !!e,
          recipe: o
        })
      }).catch(() => {});
    } catch (e) {}
  }
  function applyToPreview(e) {
    if (!o || !o.ok || l || isLibrary()) return false;
    if (Number(o.confidence) < t) return false;
    const n = window.SolisMemory;
    if (!n || typeof n.offerInstantRecipe !== "function") return false;
    const r = e || window.clipsStudio?.currentTemplateForPreview?.id;
    if (!r || !isSplitscreen(r)) return false;
    const i = n.offerInstantRecipe(o, r);
    if (i) {
      c = true;
      if (o.captions && o.captions.on === false) {
        window.__solisRecipeSkipCaptions = true;
      } else if (o.captions && o.captions.on) {
        window.__solisCaptionsOptedIn = true;
      }
      if (o.hook && o.hook.on === false) {
        window.__solisRecipeSkipHook = true;
      }
    }
    return i;
  }
  function onPreviewOpen(e) {
    c = false;
    l = false;
    window.__solisRecipeSkipCaptions = false;
    if (a) {
      clearTimeout(a);
      a = null;
    }
    if (isLibrary()) return;
    const t = currentUrl();
    const run = async () => {
      if (l) return;
      const n = o && s === t ? o : await prefetch(t, {
        templateId: e
      });
      if (l || !n) {
        try {
          window.SolisMemory?.retrySuggest?.(e);
        } catch (e) {}
        return;
      }
      if (!applyToPreview(e)) {
        try {
          window.SolisMemory?.retrySuggest?.(e);
        } catch (e) {}
      }
    };
    if (o && s === t) {
      a = setTimeout(run, 80);
    } else {
      prefetch(t, {
        templateId: e
      });
      a = setTimeout(run, 220);
    }
  }
  function onPreviewClose() {
    if (a) {
      clearTimeout(a);
      a = null;
    }
    c = false;
    l = false;
  }
  function wrapMemory() {
    const e = window.SolisMemory;
    if (!e || e._irWrapped) return;
    const t = e.recordLayout;
    if (typeof t === "function") {
      e.recordLayout = function() {
        try {
          if (!e._applying) markUserEdited();
        } catch (e) {}
        return t.apply(this, arguments);
      };
    }
    const n = e.onTemplatePreviewOpen;
    if (typeof n === "function") {
      e.onTemplatePreviewOpen = function(e) {
        try {
          onPreviewOpen(e);
        } catch (e) {}
        return n.apply(this, arguments);
      };
    }
    const r = e.onTemplatePreviewClose;
    if (typeof r === "function") {
      e.onTemplatePreviewClose = function() {
        try {
          onPreviewClose();
        } catch (e) {}
        return r.apply(this, arguments);
      };
    }
    e._irWrapped = true;
  }
  function boot() {
    wrapMemory();
    if (!window.SolisMemory) {
      setTimeout(boot, 200);
    }
  }
  window.SolisInstantRecipe = {
    prefetch: prefetch,
    willOffer: willOffer,
    didOffer: didOffer,
    markUserEdited: markUserEdited,
    sendFeedback: sendFeedback,
    get: () => o
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, {
      once: true
    });
  } else {
    boot();
  }
})();
