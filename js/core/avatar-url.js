(function(t) {
  function isExternalAvatar(t) {
    if (!t || typeof t !== "string") return false;
    if (t.startsWith("/")) return false;
    if (t.startsWith("data:")) return false;
    return /^https?:\/\//i.test(t);
  }
  function apiOrigin() {
    const r = (t.API_BASE_URL || "").replace(/\/api\/?$/, "") || "";
    if (r) return r;
    if (typeof t.API_ORIGIN === "string" && t.API_ORIGIN) return t.API_ORIGIN;
    try {
      const r = String(t.location?.hostname || "");
      if (r && r !== "localhost" && r !== "127.0.0.1") {
        return "https://api.solisai.video";
      }
    } catch (t) {}
    return "";
  }
  function absolutizeApiPath(r) {
    if (!r || typeof r !== "string") return r;
    if (!r.startsWith("/")) return r;
    if (typeof t.apiUrl === "function" && r.startsWith("/api/")) {
      try {
        const i = t.apiUrl(r);
        if (i && /^https?:\/\//i.test(i)) return i;
      } catch (t) {}
    }
    const i = apiOrigin();
    return i ? `${i}${r}` : r;
  }
  function resolveAvatarUrl(t, r) {
    let i = t;
    let e = r;
    if (t && typeof t === "object") {
      i = t.id || t.user_id;
      e = e ?? t.picture ?? t.avatar ?? t.photo;
    }
    if (e && e.startsWith("/") && !e.includes("googleusercontent.com")) {
      return absolutizeApiPath(e);
    }
    if (i && (isExternalAvatar(e) || !e)) {
      return absolutizeApiPath(`/api/avatar/${encodeURIComponent(i)}`);
    }
    return e || null;
  }
  t.resolveAvatarUrl = resolveAvatarUrl;
  t.isExternalAvatar = isExternalAvatar;
})(typeof window !== "undefined" ? window : globalThis);
