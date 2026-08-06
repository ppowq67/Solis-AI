(function() {
  "use strict";
  const t = window.fetch;
  window.enableFetchInterceptor = function() {
    const e = setInterval(() => {
      if (window.apiManager) {
        clearInterval(e);
        window.fetch = function(e, n = {}) {
          const o = typeof e === "string" ? e : e.url;
          if (!o || typeof o !== "string" || !o.includes("/api/") || o.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/i)) {
            return t(e, n);
          }
          const i = (n.method || "GET").toUpperCase();
          const c = {
            method: i,
            ...n
          };
          return window.apiManager.request(o, c);
        };
      }
    }, 100);
    setTimeout(() => clearInterval(e), 1e4);
  };
})();
