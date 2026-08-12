(function(t) {
  function isExternalAvatar(t) {
    if (!t || typeof t !== "string") return false;
    if (t.startsWith("/")) return false;
    if (t.startsWith("data:")) return false;
    return /^https?:\/\//i.test(t);
  }
  function apiOrigin() {
    const i = (t.API_BASE_URL || "").replace(/\/api\/?$/, "") || "";
    if (i) return i;
    if (typeof t.API_ORIGIN === "string" && t.API_ORIGIN) return t.API_ORIGIN;
    try {
      const i = String(t.location?.hostname || "");
      if (i && i !== "localhost" && i !== "127.0.0.1") {
        return "https://api.solisai.video";
      }
    } catch (t) {}
    return "";
  }
  function absolutizeApiPath(i) {
    if (!i || typeof i !== "string") return i;
    if (!i.startsWith("/")) return i;
    if (typeof t.apiUrl === "function" && i.startsWith("/api/")) {
      try {
        const r = t.apiUrl(i);
        if (r && /^https?:\/\//i.test(r)) return r;
      } catch (t) {}
    }
    const r = apiOrigin();
    return r ? `${r}${i}` : i;
  }
  function resolveAvatarUrl(t, i) {
    let r = t;
    let e = i;
    if (t && typeof t === "object") {
      r = t.public_id || t.solis_id || t.id || t.user_id;
      e = e ?? t.picture ?? t.avatar ?? t.photo;
    }
    if (e && e.startsWith("/") && !e.includes("googleusercontent.com")) {
      return absolutizeApiPath(e);
    }
    if (r && (isExternalAvatar(e) || !e)) {
      return absolutizeApiPath(`/api/avatar/${encodeURIComponent(r)}`);
    }
    return e || null;
  }
  t.resolveAvatarUrl = resolveAvatarUrl;
  t.isExternalAvatar = isExternalAvatar;
})(typeof window !== "undefined" ? window : globalThis);
