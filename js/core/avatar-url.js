(function(t) {
  function isExternalAvatar(t) {
    if (!t || typeof t !== "string") return false;
    if (t.startsWith("/")) return false;
    if (t.startsWith("data:")) return false;
    return /^https?:\/\//i.test(t);
  }
  function resolveAvatarUrl(r, e) {
    let a = r;
    let n = e;
    if (r && typeof r === "object") {
      a = r.id || r.user_id;
      n = n ?? r.picture ?? r.avatar ?? r.photo;
    }
    if (n && n.startsWith("/") && !n.includes("googleusercontent.com")) {
      return n;
    }
    if (a && (isExternalAvatar(n) || !n)) {
      const r = (t.API_BASE_URL || "").replace(/\/api\/?$/, "") || "";
      return `${r}/api/avatar/${encodeURIComponent(a)}`;
    }
    return n || null;
  }
  t.resolveAvatarUrl = resolveAvatarUrl;
  t.isExternalAvatar = isExternalAvatar;
})(typeof window !== "undefined" ? window : globalThis);
