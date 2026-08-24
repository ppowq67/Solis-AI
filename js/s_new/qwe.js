window.getCSRFToken = function() {
  const e = document.querySelector('meta[name="csrf-token"]');
  if (e) return e.getAttribute("content");
  const t = "csrf_token=";
  const i = decodeURIComponent(document.cookie);
  const n = i.split(";");
  for (let e of n) {
    e = e.trim();
    if (e.indexOf(t) === 0) {
      return e.substring(t.length);
    }
  }
  return null;
};

window.secureHeaders = function() {
  return {
    "Content-Type": "application/json",
    ...window.getCSRFToken() && {
      "X-CSRF-Token": window.getCSRFToken()
    }
  };
};

window.createDebounce = function(e, t) {
  let i;
  return function(...n) {
    clearTimeout(i);
    i = setTimeout(() => e(...n), t);
  };
};

window.addEventListener("load", () => {
  const e = document.querySelector(".input-section");
  const t = document.querySelector(".input-container");
  const i = parseInt(localStorage.getItem("sidebarActiveIndex") || "0");
  if (e && t) {
    if (i === 0) {
      e.classList.add("active");
      t.classList.remove("hidden");
      e.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: all !important; z-index: 1000 !important;";
    } else {
      e.classList.remove("active");
      t.classList.add("hidden");
      e.style.cssText = "display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; z-index: -10000 !important;";
    }
  }
});

window.handleDeleteAllClips = async function() {
  const e = confirm("This will permanently delete every clip in your library. This cannot be undone.");
  if (!e) return;
  const t = confirm("Final confirmation: delete all stored clips?");
  if (!t) return;
  try {
    if (!window.clipsStudio || !window.clipsStudio.libraryItems || window.clipsStudio.libraryItems.length === 0) {
      window.clipsStudio?.showNotification("No clips to delete", "info");
      return;
    }
    const e = window.clipsStudio.libraryItems.length;
    const t = window.clipsStudio.libraryItems.map(e => e.id);
    let i = 0;
    try {
      const n = await fetch("/api/clips/bulk-delete", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...window.getCSRFToken && {
            "X-CSRF-Token": window.getCSRFToken()
          }
        },
        body: JSON.stringify({
          clip_ids: t
        })
      });
      if (!n.ok) {
        const e = await n.json().catch(() => ({}));
        const t = window.getSafeErrorMessage(e);
        console.error("Bulk delete failed:", n.status, e);
        window.clipsStudio?.showNotification("Failed to delete clips: " + t, "error");
        return;
      }
      const o = await n.json();
      i = o.deleted_count || e;
    } catch (e) {
      console.warn("Bulk delete endpoint failed, falling back to individual deletes:", e);
      for (const e of window.clipsStudio.libraryItems) {
        try {
          const t = e.projectId || e.project_id;
          if (!t) continue;
          const n = await fetch(`/api/clips/project/${encodeURIComponent(t)}`, {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...window.getCSRFToken && {
                "X-CSRF-Token": window.getCSRFToken()
              }
            }
          });
          if (n.ok) {
            i++;
          } else {
            console.error(`Failed to delete clip ${t}: ${n.status}`);
          }
          await new Promise(e => setTimeout(e, 100));
        } catch (e) {
          console.error(`Exception deleting clip:`, e);
        }
      }
    }
    window.clipsStudio.libraryItems = [];
    window.clipsStudio.saveLibraryItems();
    window.clipsStudio.updateLibraryView();
    updateStorageBadgeDisplay();
    window.clipsStudio?.showNotification(`Deleted ${i}/${e} clips`, "success");
    setTimeout(() => {
      window.location.reload();
    }, 800);
  } catch (e) {
    console.error("Error deleting all clips:", e);
    window.clipsStudio?.showNotification("Error: Failed to delete clips. Please try again.", "error");
  }
};

window.getStoragePhase = function(e, t, i) {
  const n = Math.max(0, e);
  const o = Math.max(1, t);
  const s = n / o;
  const a = !i || i === "free";
  const r = a ? .5 : .5;
  const l = a ? .75 : .8;
  const c = a ? .5 : .8;
  const d = a ? .5 : .9;
  let u = "ok";
  if (s >= 1) u = "full"; else if (s >= l) u = "high"; else if (s >= r) u = "half";
  return {
    phase: u,
    ratio: s,
    showDeleteAll: s >= c && n > 0,
    showUpgrade: a && s >= d
  };
};

window.isUnlimitedLibrary = function(e, t) {
  const i = (t || document.getElementById("storagePlanBadge")?.textContent || "free").toString().toLowerCase();
  const n = i.replace(/\s+plan\s*$/, "").trim();
  return n === "basic" || n === "prime" || n === "elite" || n.includes("basic") || n.includes("prime") || n.includes("elite");
};

window.formatStorageSpaceTooltip = function(e, t) {
  const i = Math.max(0, Number(e) || 0);
  const n = Math.max(0, Number(t) || 0);
  const fmtGb = e => {
    if (e >= 1024) {
      const t = e / 1024;
      return t >= 10 ? t.toFixed(0) : t.toFixed(1);
    }
    if (e > 0) return (e / 1024).toFixed(2);
    return "0";
  };
  if (n > 0) return `${fmtGb(i)} / ${fmtGb(n)} GB`;
  if (i > 0) {
    if (i >= 1024) return `${fmtGb(i)} GB`;
    return `${Math.max(1, Math.round(i))} MB`;
  }
  return "0 GB";
};

window.buildStorageBadgeTitle = function({used: e, limit: t, plan: i, unlimited: n, phase: o, effectiveLimit: s, spaceUsedMb: a, spaceTotalMb: r}) {
  const l = window.formatStorageSpaceTooltip(a, r);
  if (n) {
    return `${e} clip${e === 1 ? "" : "s"} stored · ${l}`;
  }
  if (o === "full") {
    return `Storage full (${e}/${s} clips) · ${l}`;
  }
  if (o === "high") {
    return `Almost full (${e}/${s} clips) · ${l}`;
  }
  return `${e}/${s} clips · ${l}`;
};

window.applyStorageBadgeUI = function({used: e, limit: t, plan: i, unlimited: n, spaceUsedMb: o, spaceTotalMb: s}) {
  const a = typeof i === "string" && i.length ? i.toLowerCase().replace(/\s+plan\s*$/, "").trim() : "free";
  const r = n === true || window.isUnlimitedLibrary(t, a);
  const l = !r;
  const c = l ? Math.max(1, Number(t) || 10) : null;
  const d = Math.max(0, Number(e) || 0);
  const {phase: u, showDeleteAll: p, showUpgrade: m} = l ? window.getStoragePhase(d, c, a) : {
    phase: "ok",
    showDeleteAll: false,
    showUpgrade: false
  };
  const w = a.charAt(0).toUpperCase() + a.slice(1);
  const f = l && (u === "high" || u === "full");
  const g = document.getElementById("storageBadge");
  const y = document.getElementById("storageUsedBadge");
  const b = document.getElementById("storageTotalBadge");
  const S = document.getElementById("storageLimitGroup");
  const h = document.getElementById("storagePlanBadge");
  const I = document.getElementById("storageWarnIcon");
  const L = document.getElementById("deleteAllClipsBtn");
  const T = document.getElementById("needMoreUpgradeText");
  if (y) {
    y.textContent = String(d);
    y.style.color = "";
    y.classList.toggle("storage-count-warn", f);
  }
  if (S) {
    S.style.display = l ? "" : "none";
    S.hidden = !l;
  } else if (b) {
    b.style.display = l ? "" : "none";
    const e = b.previousSibling;
    if (e && e.nodeType === 3) e.textContent = l ? " / " : "";
  }
  if (b && l) {
    b.textContent = String(c);
    b.style.display = "";
    b.classList.toggle("storage-count-warn", u === "full");
  }
  if (g) g.classList.toggle("is-unlimited", r);
  if (h) h.textContent = w;
  if (g) {
    g.classList.toggle("is-warn", f);
    g.classList.toggle("is-full", l && u === "full");
    g.title = r ? `${d} clip${d === 1 ? "" : "s"} stored` : u === "full" ? "Storage full — delete clips or upgrade your plan" : u === "high" ? `Storage almost full (${d}/${c}) — remove old videos to keep generating` : "Library storage";
  }
  if (I) {
    I.hidden = !f;
    I.setAttribute("aria-hidden", f ? "false" : "true");
  }
  if (L) L.style.display = p ? "inline-flex" : "none";
  if (T) {
    T.hidden = !m;
    T.style.display = m ? "" : "none";
  }
};

window.pulseStorageBadgeWarning = function() {
  const e = document.getElementById("storageBadge");
  if (!e) return;
  e.classList.add("is-warn", "storage-badge-attention");
  const t = document.getElementById("storageWarnIcon");
  if (t) {
    t.hidden = false;
    t.setAttribute("aria-hidden", "false");
  }
  window.clearTimeout(window._storageBadgeAttentionTimer);
  window._storageBadgeAttentionTimer = window.setTimeout(() => {
    e.classList.remove("storage-badge-attention");
  }, 2200);
};

window.updateLibraryStorageWarning = function() {};

window.syncStorageLimitsFromStatus = function(e) {
  if (!e?.storage?.videos) return null;
  const t = e.storage.videos.used ?? 0;
  const i = (e.plan?.name || e.plan || "free").toString().toLowerCase();
  const n = e.storage.videos.unlimited === true || [ "basic", "prime", "elite" ].includes(i);
  const o = n ? null : e.storage.videos.limit ?? 10;
  const s = e.storage?.space_mb || {};
  window.applyStorageBadgeUI({
    used: t,
    limit: o,
    plan: i,
    unlimited: n,
    spaceUsedMb: s.used,
    spaceTotalMb: s.total
  });
  return n ? {
    phase: "ok"
  } : window.getStoragePhase(t, o, i);
};

window.updateStorageBadgeDisplay = function() {
  let originalFunc = async function() {
    try {
      const e = {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      };
      const [t, i] = await Promise.all([ window.apiRequestCache.dedupFetch("/api/auth/subscription", e), window.apiRequestCache.dedupFetch("/api/clips/status", e).catch(() => null) ]);
      if (!t.ok) throw new Error(`Failed to fetch subscription: ${t.status}`);
      const n = await t.json();
      const o = n?.subscription;
      if (!o || typeof o !== "object") throw new Error("Missing subscription");
      let s = null;
      let a = null;
      if (i?.ok) {
        try {
          const e = await i.json();
          const t = e?.storage?.space_mb || {};
          s = t.used;
          a = t.total;
        } catch (e) {}
      }
      if (a == null && o.storage_limit_gb != null) {
        a = Number(o.storage_limit_gb) * 1024;
      }
      let r = window.validateNumber(o.active_videos, 0, VALIDATION.MAX_VIDEOS_LIMIT, 0);
      if (window.clipsStudio?.libraryItems?.length != null) {
        r = window.clipsStudio.libraryItems.length;
      }
      const l = o.plan || "free";
      const c = typeof l === "string" && VALIDATION.ALLOWED_PLANS.includes(l.toLowerCase()) ? l.toLowerCase() : "free";
      const d = o.library_unlimited === true || window.isUnlimitedLibrary?.(null, c);
      window.applyStorageBadgeUI({
        used: r,
        limit: d ? null : window.validateNumber(o.video_limit || o.videos_space_limit, 1, VALIDATION.MAX_VIDEOS_LIMIT, 10),
        plan: c,
        unlimited: d,
        spaceUsedMb: s,
        spaceTotalMb: a
      });
    } catch (e) {
      console.error("Failed to fetch storage info from backend:", e);
    }
  };
  return window.createDebounce(originalFunc, 3e3);
}();

window.addEventListener("DOMContentLoaded", () => {
  const e = document.getElementById("storagePlanBadge");
  const t = (e?.textContent || "free").toLowerCase().replace(/\s+plan\s*$/, "").trim();
  if (typeof window.isUnlimitedLibrary === "function" && window.isUnlimitedLibrary(null, t)) {
    const e = Number(document.getElementById("storageUsedBadge")?.textContent || 0);
    window.applyStorageBadgeUI?.({
      used: e,
      limit: null,
      plan: t,
      unlimited: true
    });
  }
});

window.closeUpgradeModal = function() {
  const e = document.getElementById("upgradeModalOverlay");
  if (e) {
    e.style.display = "none";
  }
};

window.showUpgradeModal = function(e = "Unlock more uploads", t = "Upgrade for more uploads per day, unlimited clips in your library, and more clips per run.") {
  const i = document.getElementById("upgradeModalOverlay");
  const n = document.getElementById("upgradeModalTitle");
  const o = document.getElementById("upgradeModalSubtitle");
  if (i) {
    if (n) n.textContent = window.sanitizeString(e);
    if (o) o.textContent = window.sanitizeString(t);
    i.style.display = "flex";
  }
};

document.addEventListener("DOMContentLoaded", function() {
  try {
    if (window.SolisFirstLanding && typeof window.SolisFirstLanding.needsLanding === "function" && !window.SolisFirstLanding.needsLanding()) {} else {
      const e = document.querySelectorAll(".clips-sub-item");
      e.forEach(e => {
        e.classList.toggle("active", e.getAttribute("data-tab") === "create");
      });
      const t = document.querySelector('.clips-sub-item[data-tab="create"]') || e[0];
      if (t && typeof switchClipsTab === "function") {
        switchClipsTab("create", t);
      }
      try {
        localStorage.setItem("clipsActiveTab", "create");
        localStorage.setItem("clipsStudioCurrentTab", "create");
        localStorage.setItem("currentNavigationTarget", "clips");
      } catch (e) {}
    }
  } catch (e) {
    console.warn("Failed to restore clips tab state:", e);
  }
  const e = sessionStorage.getItem("paymentSuccess");
  if (e) {
    try {
      const t = JSON.parse(e);
      if (!t.plan || typeof t.plan !== "string") {
        console.error("Invalid payment data: plan is missing or not a string");
        sessionStorage.removeItem("paymentSuccess");
        return;
      }
      if (!VALIDATION.ALLOWED_PLANS.includes(t.plan.toLowerCase())) {
        console.error("Invalid payment data: plan not in allowed list");
        sessionStorage.removeItem("paymentSuccess");
        return;
      }
      const i = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (i) {
        i.plan = t.plan.toLowerCase();
        localStorage.setItem("currentUser", JSON.stringify(i));
      }
    } catch (e) {
      console.error("Failed to parse payment success data:", e);
    }
    sessionStorage.removeItem("paymentSuccess");
  }
  async function loadUserTierInfo() {
    try {
      const e = await fetch("/api/tier/info", {
        method: "GET",
        credentials: "include"
      });
      if (e.ok) {
        const t = await e.json();
        if (!t || typeof t !== "object") {
          throw new Error("Invalid response structure");
        }
        const i = t.data;
        if (!i || typeof i !== "object") {
          throw new Error("Missing tier data in response");
        }
        const n = document.getElementById("currentTier");
        const o = document.getElementById("tierInfo");
        const s = document.getElementById("tierInfoCard");
        if (n && i.tier_name && typeof i.tier_name === "string") {
          n.textContent = window.sanitizeString(i.tier_name);
          if (s) {
            s.classList.remove("tier-free", "tier-basic", "tier-prime", "tier-elite");
            const e = String(i.tier_name || "free").toLowerCase();
            s.classList.add(`tier-${e}`);
            s.setAttribute("data-plan", e);
          }
        }
        if (o && i.generations && typeof i.generations.remaining === "number") {
          const e = window.validateNumber(i.generations.remaining, 0, 999999, 0);
          o.textContent = e + " gens left today";
        }
      }
    } catch (e) {}
  }
  loadUserTierInfo();
  async function refreshSubscriptionOnDashboard() {
    try {
      const e = await fetch("/api/auth/subscription", {
        method: "GET",
        credentials: "include"
      });
      if (e.ok) {
        const t = await e.json();
        if (!t || typeof t !== "object") {
          throw new Error("Invalid response structure");
        }
        const i = t.subscription;
        if (!i || typeof i !== "object") {
          throw new Error("Missing subscription in response");
        }
        updateStorageBadgesFromSubscription(i);
      } else {
        console.warn("Could not fetch subscription from backend:", e.status);
      }
    } catch (e) {
      console.error("Dashboard failed to fetch subscription:", e);
    }
  }
  function updateStorageBadgesFromSubscription(e) {
    if (!e || typeof e !== "object") return;
    const t = e.plan || "free";
    const i = typeof t === "string" && VALIDATION.ALLOWED_PLANS.includes(t.toLowerCase()) ? t.toLowerCase() : "free";
    const n = e.library_unlimited === true || window.isUnlimitedLibrary?.(null, i);
    const o = window.clipsStudio?.libraryItems?.length != null ? window.clipsStudio.libraryItems.length : window.validateNumber(e.active_videos, 0, VALIDATION.MAX_VIDEOS_LIMIT, 0);
    const s = n ? null : window.validateNumber(e.video_limit || e.videos_space_limit, 1, VALIDATION.MAX_VIDEOS_LIMIT, 10);
    const a = i.charAt(0).toUpperCase() + i.slice(1);
    if (typeof window.applyStorageBadgeUI === "function") {
      window.applyStorageBadgeUI({
        used: o,
        limit: s,
        plan: i,
        unlimited: n
      });
    }
    const r = document.getElementById("storagePlanBadge");
    const l = document.getElementById("currentPlanDesc");
    if (r) r.textContent = a;
    if (l) l.textContent = a + " Plan";
  }
  refreshSubscriptionOnDashboard();
  updateStorageBadgeDisplay();
  const t = document.getElementById("disclaimerBtn");
  const i = document.querySelector(".url-input-overlay");
  const n = document.querySelector(".url-input");
  const o = document.querySelector(".url-submit-btn");
  const s = document.querySelector(".checkmark-icon");
  const a = "disclaimerAcceptedTime";
  const r = 7 * 24 * 60 * 60 * 1e3;
  if (t && i) {
    const e = localStorage.getItem(a);
    const l = Date.now();
    let c = false;
    if (!e) {
      c = true;
    } else {
      const t = l - parseInt(e);
      if (t > r) {
        c = true;
      }
    }
    if (!c) {
      i.classList.add("hidden");
      t.classList.add("active");
      if (s) s.style.display = "block";
      if (n) n.style.filter = "none";
      if (o) o.style.filter = "none";
      if (n) n.style.pointerEvents = "auto";
      if (o) o.style.pointerEvents = "auto";
    }
    t.addEventListener("click", function() {
      if (!this.classList.contains("active")) {
        this.classList.add("active");
        if (s) s.style.display = "block";
        setTimeout(() => {
          i.classList.add("hidden");
          if (n) n.style.filter = "none";
          if (o) o.style.filter = "none";
          if (n) n.style.pointerEvents = "auto";
          if (o) o.style.pointerEvents = "auto";
          localStorage.setItem(a, Date.now().toString());
        }, 300);
      }
    });
  }
});

function switchClipsTab(e, t) {
  if (window.clipsStudio && typeof window.clipsStudio.switchTab === "function") {
    window.clipsStudio.switchTab(e);
    return;
  }
  const i = document.querySelectorAll(".clips-sub-item");
  i.forEach(e => e.classList.remove("active"));
  if (t) t.classList.add("active");
  const n = document.querySelectorAll(".clips-section");
  n.forEach(e => {
    e.classList.remove("active");
    e.style.display = "none";
  });
  const o = {
    templates: "templatesSection",
    create: "createSection",
    library: "librarySection"
  };
  const s = document.getElementById(o[e]);
  if (s) {
    s.classList.add("active");
    s.style.display = "block";
  }
  if (e === "library") {
    const e = window.clipsStudio;
    if (e) {
      const t = 3e4;
      const i = !e._libraryLastLoaded || Date.now() - e._libraryLastLoaded > t;
      const n = !e.libraryItems || e.libraryItems.length === 0;
      if (i || n) {
        e.showLibrarySkeleton(4);
        e.loadLibraryItems().then(() => {
          e._libraryLastLoaded = Date.now();
        });
      }
    }
  }
  try {
    localStorage.setItem("clipsActiveTab", e);
    localStorage.setItem("clipsStudioCurrentTab", e);
  } catch (e) {
    console.warn("Failed to save clips tab state:", e);
  }
  const a = document.getElementById("clipsSubPane");
  if (a && t) {
    const e = document.querySelector(".clips-sub-pill");
    if (!e) return;
    const i = window.getComputedStyle(e);
    if (i.display === "contents") return;
    const n = e.getBoundingClientRect();
    const o = t.getBoundingClientRect();
    a.style.left = o.left - n.left + "px";
  }
}

window.switchClipsTab = switchClipsTab;

window.goMobileClipsTab = window.goMobileClipsTab || function(e, t) {
  if (typeof window.switchSection === "function") window.switchSection("clips");
  switchClipsTab(e, t || document.querySelector(`.clips-sub-item[data-tab="${e}"]`));
};
