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
    return "";
  }
  function absolutizeApiPath(t) {
    if (!t || typeof t !== "string") return t;
    if (!t.startsWith("/")) return t;
    const r = apiOrigin();
    return r ? `${r}${t}` : t;
  }
  function resolveAvatarUrl(t, r) {
    let e = t;
    let i = r;
    if (t && typeof t === "object") {
      e = t.id || t.user_id;
      i = i ?? t.picture ?? t.avatar ?? t.photo;
    }
    if (i && i.startsWith("/") && !i.includes("googleusercontent.com")) {
      return absolutizeApiPath(i);
    }
    if (e && (isExternalAvatar(i) || !i)) {
      return absolutizeApiPath(`/api/avatar/${encodeURIComponent(e)}`);
    }
    return i || null;
  }
  t.resolveAvatarUrl = resolveAvatarUrl;
  t.isExternalAvatar = isExternalAvatar;
})(typeof window !== "undefined" ? window : globalThis);
