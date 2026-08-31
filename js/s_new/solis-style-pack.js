(function() {
  const e = "/clips/style-pack";
  const t = "solis_style_pack_session";
  const n = 12 * 60 * 60 * 1e3;
  const s = 90 * 1e3;
  let r = null;
  let o = null;
  let a = 0;
  function apiBase() {
    try {
      if (typeof window.API_BASE_URL === "string") return window.API_BASE_URL;
    } catch (e) {}
    return "";
  }
  function authHeaders() {
    try {
      if (typeof getAuthHeaders === "function") return getAuthHeaders() || {};
    } catch (e) {}
    return {};
  }
  function emptyPack() {
    return {
      version: 0,
      anims: [],
      presets: {},
      font_weights: {},
      shadows: {
        none: "none"
      }
    };
  }
  function readSession() {
    try {
      const e = sessionStorage.getItem(t);
      if (!e) return null;
      const s = JSON.parse(e);
      if (!s || !s.data || !s.t) return null;
      if (Date.now() - Number(s.t) > n) {
        sessionStorage.removeItem(t);
        return null;
      }
      return s.data;
    } catch (e) {
      return null;
    }
  }
  function writeSession(e) {
    try {
      sessionStorage.setItem(t, JSON.stringify({
        t: Date.now(),
        data: e
      }));
    } catch (e) {}
  }
  function hydrateFromCache() {
    if (r && r.version) return r;
    const e = readSession();
    if (e && e.version) {
      r = e;
      return r;
    }
    return null;
  }
  async function load(t) {
    const n = !!(t && t.force);
    if (!n) {
      const e = hydrateFromCache();
      if (e) return e;
    }
    if (!n && a && Date.now() < a) {
      const e = new Error("style-pack cooldown");
      e.code = "cooldown";
      throw e;
    }
    if (o) return o;
    o = (async () => {
      const t = {
        Accept: "application/json",
        ...authHeaders()
      };
      const n = r || readSession();
      if (n && n._etag) t["If-None-Match"] = n._etag;
      const o = await fetch(apiBase() + e, {
        method: "GET",
        credentials: "include",
        headers: t
      });
      if (o.status === 304 && n && n.version) {
        r = n;
        writeSession(n);
        a = 0;
        return r;
      }
      if (!o.ok) {
        a = Date.now() + s;
        throw new Error("style-pack " + o.status);
      }
      const i = await o.json();
      if (!i || typeof i !== "object" || !i.version) {
        a = Date.now() + s;
        throw new Error("style-pack invalid");
      }
      i._etag = o.headers.get("ETag") || n?._etag || null;
      r = i;
      a = 0;
      writeSession({
        version: i.version,
        anims: i.anims,
        presets: i.presets,
        font_weights: i.font_weights,
        shadows: i.shadows,
        _etag: i._etag
      });
      try {
        window.dispatchEvent(new CustomEvent("solis:style-pack", {
          detail: r
        }));
      } catch (e) {}
      return r;
    })();
    try {
      return await o;
    } finally {
      o = null;
    }
  }
  function ensure(e) {
    if (hydrateFromCache()) return Promise.resolve(r);
    return load(e);
  }
  function get() {
    return hydrateFromCache() || emptyPack();
  }
  function presets() {
    return get().presets || {};
  }
  function anims() {
    const e = get().anims;
    return Array.isArray(e) ? e : [];
  }
  function fontWeights() {
    return get().font_weights || {};
  }
  function shadows() {
    return get().shadows || {
      none: "none"
    };
  }
  function ready() {
    return !!hydrateFromCache()?.version;
  }
  function preset(e) {
    const t = String(e || "").toLowerCase();
    const n = presets();
    return n[t] || n[e] || null;
  }
  window.SolisStylePack = {
    load: load,
    ensure: ensure,
    get: get,
    presets: presets,
    anims: anims,
    fontWeights: fontWeights,
    shadows: shadows,
    preset: preset,
    ready: ready
  };
})();
