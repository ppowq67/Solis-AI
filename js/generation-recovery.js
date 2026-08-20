class GenerationRecoverySystem {
  constructor() {
    this.API_BASE = window.API_BASE_URL || window.API_BASE || "/api";
    this.activeGenerations = new Map;
    this.socketListeners = new Map;
    this.recoveryInProgress = false;
  }
  get spinnerSystem() {
    return window.generationProgressSpinner || null;
  }
  async autoRecover() {
    if (this.recoveryInProgress) return;
    this.recoveryInProgress = true;
    try {
      const e = typeof initGenerationProgressSpinner === "function" ? initGenerationProgressSpinner() : this.spinnerSystem;
      if (e && typeof e.syncFromServer === "function") {
        await e.syncFromServer({
          force: true
        });
        return;
      }
      const t = await this.fetchActiveGenerations();
      if (!t.length) return;
      for (const e of t) {
        await this.recoverGeneration(e);
      }
    } catch (e) {
      console.error("[RECOVERY] Error during recovery:", e);
    } finally {
      this.recoveryInProgress = false;
    }
  }
  async fetchActiveGenerations() {
    try {
      const e = await fetch(`${this.API_BASE}/clips/status/active`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include"
      });
      if (!e.ok) return [];
      const t = await e.json();
      if (!t.success) return [];
      return t.active_generations || [];
    } catch (e) {
      console.error("[RECOVERY] Network error fetching active generations:", e);
      return [];
    }
  }
  async recoverGeneration(e) {
    const {project_id: t, status: n, progress: s, message: r, template_id: o, template: i, splitscreen_secondary_type: a} = e;
    if (!t) return;
    this.activeGenerations.set(t, e);
    const c = a ? {
      secondaryType: a
    } : {};
    const d = this.spinnerSystem;
    if (d && typeof d.restoreGeneration === "function") {
      d.restoreGeneration(t, s || 0, r || "Resuming...", n || "processing", o || i || null, c);
    } else if (d && typeof d.updateProgress === "function") {
      d.updateProgress(t, s || 0, r || "Resuming...");
    }
    this.attachWebSocketListener(t);
  }
  attachWebSocketListener(e) {
    if (this.socketListeners.has(e)) return;
    const t = typeof window.getSolisSocketOrigin === "function" ? window.getSolisSocketOrigin() : "https://api.solisai.video";
    const n = window.socket || window.videoGenerationSocket || window.io && window.io(t, {
      path: "/socket.io/",
      transports: [ "websocket", "polling" ],
      withCredentials: true
    });
    if (!n) return;
    const listener = t => {
      if (t.project_id !== e) return;
      const n = this.spinnerSystem;
      if (t.status === "completed") {
        if (n?.updateProgress) n.updateProgress(e, 100, t.message || "Complete!");
        if (n?.completeGeneration) n.completeGeneration(e);
        this.handleGenerationComplete(e);
      } else if (t.status === "error") {
        if (n?.failGeneration) n.failGeneration(e);
        this.handleGenerationError(e, t.message);
      } else if (n?.updateProgress) {
        n.updateProgress(e, t.progress, t.message);
      }
      if (this.activeGenerations.has(e)) {
        const n = this.activeGenerations.get(e);
        n.progress = t.progress;
        n.message = t.message;
        n.status = t.status;
      }
    };
    n.on("clips_status_update", listener);
    this.socketListeners.set(e, {
      socket: n,
      listener: listener,
      eventName: "clips_status_update"
    });
  }
  handleGenerationComplete(e) {
    this.activeGenerations.delete(e);
    this.detachSocketListener(e);
    if (window.onGenerationComplete) window.onGenerationComplete(e);
  }
  handleGenerationError(e) {
    this.activeGenerations.delete(e);
    this.detachSocketListener(e);
  }
  detachSocketListener(e) {
    const t = this.socketListeners.get(e);
    if (t) {
      const {socket: n, listener: s, eventName: r} = t;
      n.off(r, s);
      this.socketListeners.delete(e);
    }
  }
  getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || "";
  }
}

window.generationRecovery = new GenerationRecoverySystem;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.generationRecovery.autoRecover().then(() => {
      if (typeof restoreGenerationStateFromServer === "function") {
        restoreGenerationStateFromServer();
      }
    });
  }, 300);
});

if (typeof window.socket !== "undefined" && window.socket !== null) {
  window.socket.on("connect", () => {
    window.generationRecovery.autoRecover();
  });
}
