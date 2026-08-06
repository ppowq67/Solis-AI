class PortalManager {
  constructor() {
    this.initialized = false;
    this.memberCount = 0;
    this.partnerCount = 0;
    this.scheduledCount = 0;
    this.activity = null;
    this.initElements();
  }
  initElements() {
    this.membersValue = document.querySelector('[data-stat="members"] .portal-stat-value');
    this.partnersValue = document.querySelector('[data-stat="partners"] .portal-stat-value');
    this.scheduledValue = document.querySelector('[data-stat="scheduled"] .portal-stat-value');
    this.timeSavedValue = document.getElementById("timeSavedValue");
    this.viralScoreValue = document.getElementById("viralScoreValue");
    this.clipsMonthElement = document.querySelector('[data-activity="clips-month"]');
    this.avgScoreElement = document.querySelector('[data-activity="avg-score"]');
    this.totalExportsElement = document.querySelector('[data-activity="total-exports"]');
    this.hoursSavedElement = document.querySelector('[data-activity="hours-saved"]');
  }
  _apiBase() {
    return typeof API_BASE_URL !== "undefined" && API_BASE_URL ? API_BASE_URL : "/api";
  }
  async loadPortalStats() {
    this.memberCount = 0;
    this.partnerCount = 0;
    this.scheduledCount = 0;
    await this.loadActivityStats();
    this.updateUI();
  }
  async loadActivityStats() {
    try {
      const t = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const e = await fetch(`${this._apiBase()}/portal/activity`, {
        method: "GET",
        credentials: "include",
        headers: t
      });
      if (!e.ok) throw new Error(`HTTP ${e.status}`);
      const i = await e.json();
      if (i.success && i.activity) {
        this.activity = i.activity;
        return;
      }
    } catch (t) {
      console.warn("Portal activity API unavailable, using library fallback:", t);
    }
    this.activity = this.computeActivityFromLibrary();
  }
  computeActivityFromLibrary() {
    const t = Array.isArray(window.clipsStudio?.libraryItems) ? window.clipsStudio.libraryItems : [];
    const e = new Date;
    const i = new Date(e.getFullYear(), e.getMonth(), 1);
    const a = new Date(e);
    a.setHours(0, 0, 0, 0);
    const n = (a.getDay() + 6) % 7;
    a.setDate(a.getDate() - n);
    const s = new Date(e);
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - 6);
    const o = [ 0, 0, 0, 0, 0, 0, 0 ];
    let r = 0;
    let c = 0;
    let l = 0;
    const u = 24 * 60 * 60 * 1e3;
    t.forEach(t => {
      const n = t.timestamp ? new Date(t.timestamp) : null;
      if (!n || Number.isNaN(n.getTime())) return;
      if (n >= i) r += 1;
      if (n >= a) c += 1;
      if (e - n <= u) l += 1;
      if (n >= s) {
        const t = Math.floor((n - s) / u);
        if (t >= 0 && t < 7) o[t] += 1;
      }
    });
    return {
      clips_total: t.length,
      clips_month: r,
      clips_week: c,
      gens_24h: l,
      avg_score: null,
      scored_clips: 0,
      output_seconds: 0,
      day_counts: o
    };
  }
  updateUI() {
    if (this.membersValue) this.membersValue.textContent = this.memberCount;
    if (this.partnersValue) this.partnersValue.textContent = this.partnerCount;
    if (this.scheduledValue) this.scheduledValue.textContent = this.scheduledCount;
    const t = this.activity || this.computeActivityFromLibrary();
    const e = t.clips_total || 0;
    if (this.timeSavedValue) {
      const i = Math.round((t.output_seconds || 0) / 60);
      this.timeSavedValue.textContent = i > 0 ? `${i}m` : `${e}`;
    }
    if (this.viralScoreValue) {
      this.viralScoreValue.textContent = t.avg_score != null ? t.avg_score : "—";
    }
    this.updateActivityStats(t);
  }
  updateActivityStats(t) {
    t = t || this.activity || this.computeActivityFromLibrary();
    const e = Array.isArray(t.day_counts) ? t.day_counts : [ 0, 0, 0, 0, 0, 0, 0 ];
    const i = t.clips_week || 0;
    const a = t.clips_month || 0;
    const n = t.clips_total || 0;
    const s = t.gens_24h || 0;
    const o = t.avg_score;
    if (this.clipsMonthElement) {
      const t = this.clipsMonthElement.querySelector(".activity-val");
      const n = this.clipsMonthElement.querySelector("[data-change], .activity-change");
      if (t) t.textContent = String(a);
      if (n) n.textContent = `+${i} this week`;
      this.updateSparkline(this.clipsMonthElement, e);
    }
    if (this.avgScoreElement) {
      const t = this.avgScoreElement.querySelector(".activity-val");
      const e = this.avgScoreElement.querySelector("[data-change], .activity-change");
      if (o != null) {
        if (t) t.textContent = String(o);
        if (e) {
          if (o >= 80) e.textContent = "Strong"; else if (o >= 60) e.textContent = "Solid"; else e.textContent = "Building";
        }
        this.updateScoreRing(this.avgScoreElement, o);
      } else {
        if (t) t.textContent = "—";
        if (e) e.textContent = n ? "No scores yet" : "No clips yet";
        this.updateScoreRing(this.avgScoreElement, 0);
      }
    }
    if (this.totalExportsElement) {
      const t = this.totalExportsElement.querySelector(".activity-val");
      const i = this.totalExportsElement.querySelector("[data-change], .activity-change");
      if (t) t.textContent = String(n);
      if (i) i.textContent = "Completed";
      this.updateBars(this.totalExportsElement, e);
    }
    if (this.hoursSavedElement) {
      const i = this.hoursSavedElement.querySelector(".activity-val");
      const a = this.hoursSavedElement.querySelector("[data-change], .activity-change");
      const n = Number(t.output_seconds) || 0;
      if (n > 0) {
        const t = n / 3600;
        const s = t >= 1 ? `${t.toFixed(t >= 10 ? 0 : 1)}h` : `${Math.round(n / 60)}m`;
        if (i) i.textContent = s;
        if (a) a.textContent = "Output length";
        this.updateSparkline(this.hoursSavedElement, e);
      } else {
        if (i) i.textContent = String(s);
        if (a) a.textContent = "Last 24h";
        this.updateSparkline(this.hoursSavedElement, e);
      }
    }
  }
  updateSparkline(t, e) {
    if (!t || !e?.length) return;
    const i = t.querySelector(".activity-chart-line");
    const a = t.querySelector(".activity-chart-area");
    if (!i || !a) return;
    const n = 160;
    const s = 48;
    const o = 4;
    const r = Math.max(...e, 1);
    const c = n / Math.max(e.length - 1, 1);
    const l = e.map((t, e) => {
      const i = e * c;
      const a = o + (1 - (Number(t) || 0) / r) * (s - o * 2);
      return [ i, a ];
    });
    const u = l.map((t, e) => `${e === 0 ? "M" : "L"}${t[0].toFixed(1)},${t[1].toFixed(1)}`).join(" ");
    const h = `${u} L${n},${s} L0,${s} Z`;
    i.setAttribute("d", u);
    a.setAttribute("d", h);
  }
  updateScoreRing(t, e) {
    const i = Math.max(0, Math.min(100, Number(e) || 0));
    const a = t?.querySelector(".activity-meter-fill");
    if (a) {
      a.style.width = `${i}%`;
      return;
    }
    const n = t?.querySelector(".activity-ring-fill");
    if (!n) return;
    if (n.tagName === "circle" || n.getAttribute("pathLength")) {
      n.setAttribute("stroke-dasharray", `${i} 100`);
    } else {
      n.style.width = `${i}%`;
    }
  }
  updateBars(t, e) {
    const i = t?.querySelectorAll("[data-bars] span");
    if (!i?.length || !e?.length) return;
    const a = Math.max(...e, 1);
    i.forEach((t, i) => {
      const n = e[i % e.length];
      const s = a <= 0 ? 12 : Math.max(10, Math.round((Number(n) || 0) / a * 100));
      t.style.setProperty("--h", `${s}%`);
    });
  }
  async init() {
    if (this.initialized) return;
    this.initElements();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.loadPortalStats());
    } else {
      await this.loadPortalStats();
    }
    this.initialized = true;
  }
  async refresh() {
    await this.loadActivityStats();
    this.updateUI();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.portalManager = new PortalManager;
  window.portalManager.init();
});

if (document.readyState === "interactive" || document.readyState === "complete") {
  window.portalManager = new PortalManager;
  window.portalManager.init();
}
