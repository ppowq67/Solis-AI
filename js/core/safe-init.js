(function() {
  "use strict";
  try {
    const waitForManagers = () => new Promise(e => {
      let n = 0;
      const a = setInterval(() => {
        n++;
        const t = typeof window.apiManager !== "undefined" && window.apiManager !== null;
        const o = typeof window.wsManager !== "undefined" && window.wsManager !== null;
        const i = typeof window.ws !== "undefined" && window.ws !== null;
        if ((t || n > 50) && (o || n > 100) && (i || n > 100)) {
          clearInterval(a);
          e();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(a);
        e();
      }, 5e3);
    });
    window.managersReady = waitForManagers().then(() => {
      const e = {
        apiManager: !!window.apiManager,
        wsManager: !!window.wsManager,
        wsHelper: !!window.ws
      };
      return e;
    }).catch(e => {
      console.error("[SafeInit] Error during initialization:", e);
      return {
        apiManager: false,
        wsManager: false,
        wsHelper: false
      };
    });
    window.apiManager = window.apiManager || {
      request: async (e, n) => {
        console.warn("[SafeInit] Using fallback fetch for:", e);
        return fetch(e, n);
      },
      get: async e => fetch(e),
      post: async (e, n) => fetch(e, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(n)
      }),
      getStats: () => ({
        note: "APIManager not ready"
      })
    };
    window.wsManager = window.wsManager || {
      emit: () => console.warn("[SafeInit] WebSocket not ready"),
      request: async () => Promise.reject("WebSocket not ready"),
      getStatus: () => ({
        connected: false
      })
    };
    window.ws = window.ws || {
      emit: (e, n) => {
        console.warn("[SafeInit] Using fallback WebSocket for:", e);
        if (window.solisWSClient && window.solisWSClient.socket) {
          window.solisWSClient.socket.emit(e, n);
        }
        return false;
      },
      request: async (e, n) => Promise.reject("WebSocket not ready"),
      getStatus: () => ({
        connected: false
      })
    };
  } catch (e) {
    console.error("[SafeInit] FATAL initialization error:", e);
    console.error(e.stack);
  }
})();
