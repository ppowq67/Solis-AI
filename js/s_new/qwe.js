window.getCSRFToken = function() {
  const e = document.querySelector('meta[name="csrf-token"]');
  if (e) return e.getAttribute("content");
  const t = "csrf_token=";
  const o = decodeURIComponent(document.cookie);
  const n = o.split(";");
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
  let o;
  return function(...n) {
    clearTimeout(o);
    o = setTimeout(() => e(...n), t);
  };
};

window.addEventListener("load", () => {
  const e = document.querySelector(".input-section");
  const t = document.querySelector(".input-container");
  const o = parseInt(localStorage.getItem("sidebarActiveIndex") || "0");
  if (e && t) {
    if (o === 0) {
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
    let o = 0;
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
      const i = await n.json();
      o = i.deleted_count || e;
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
            o++;
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
    window.clipsStudio?.showNotification(`Deleted ${o}/${e} clips`, "success");
    setTimeout(() => {
      window.location.reload();
    }, 800);
  } catch (e) {
    console.error("Error deleting all clips:", e);
    window.clipsStudio?.showNotification("Error: Failed to delete clips. Please try again.", "error");
  }
};

window.getStoragePhase = function(e, t, o) {
  const n = Math.max(0, e);
  const i = Math.max(1, t);
  const s = n / i;
  const a = !o || o === "free";
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
  const o = (t || "free").toString().toLowerCase();
  if ([ "basic", "prime", "elite" ].includes(o)) return true;
  return e == null;
};

window.applyStorageBadgeUI = function({used: e, limit: t, plan: o, unlimited: n}) {
  const i = typeof o === "string" && o.length ? o.toLowerCase() : "free";
  const s = n === true || window.isUnlimitedLibrary(t, i);
  const a = s ? null : Math.max(1, Number(t) || 10);
  const {phase: r, showDeleteAll: l, showUpgrade: c} = s ? {
    phase: "ok",
    showDeleteAll: false,
    showUpgrade: false
  } : window.getStoragePhase(e, a, i);
  const d = i.charAt(0).toUpperCase() + i.slice(1);
  const u = r === "high" || r === "full";
  const p = document.getElementById("storageBadge");
  const w = document.getElementById("storageUsedBadge");
  const m = document.getElementById("storageTotalBadge");
  const f = document.getElementById("storageLimitGroup");
  const g = document.getElementById("storagePlanBadge");
  const y = document.getElementById("storageWarnIcon");
  const S = document.getElementById("deleteAllClipsBtn");
  const h = document.getElementById("needMoreUpgradeText");
  if (w) {
    w.textContent = String(e);
    w.style.color = "";
    w.classList.toggle("storage-count-warn", u);
  }
  if (m) {
    if (s) {
      m.textContent = "";
    } else {
      m.textContent = String(a);
    }
    m.style.color = "";
    m.classList.toggle("storage-count-warn", !s && r === "full");
  }
  if (f) f.hidden = s;
  if (p) p.classList.toggle("is-unlimited", s);
  if (g) g.textContent = d;
  if (p) {
    p.classList.toggle("is-warn", u);
    p.classList.toggle("is-full", r === "full");
    p.title = s ? `${e} clip${e === 1 ? "" : "s"} stored — unlimited on your plan` : r === "full" ? "Storage full — delete clips or upgrade your plan" : r === "high" ? `Storage almost full (${e}/${a}) — remove old videos to keep generating` : "Library storage";
  }
  if (y) {
    y.hidden = !u;
    y.setAttribute("aria-hidden", u ? "false" : "true");
  }
  if (S) S.style.display = l ? "inline-flex" : "none";
  if (h) h.style.display = c ? "inline" : "none";
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
  const o = e.storage.videos.unlimited === true;
  const n = o ? null : e.storage.videos.limit ?? 10;
  const i = (e.plan?.name || e.plan || "free").toString().toLowerCase();
  window.applyStorageBadgeUI({
    used: t,
    limit: n,
    plan: i,
    unlimited: o
  });
  return o ? {
    phase: "ok"
  } : window.getStoragePhase(t, n, i);
};

window.updateStorageBadgeDisplay = function() {
  let originalFunc = async function() {
    try {
      const e = await window.apiRequestCache.dedupFetch("/api/auth/subscription", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!e.ok) throw new Error(`Failed to fetch subscription: ${e.status}`);
      const t = await e.json();
      const o = t?.subscription;
      if (!o || typeof o !== "object") throw new Error("Missing subscription");
      let n = window.validateNumber(o.active_videos, 0, VALIDATION.MAX_VIDEOS_LIMIT, 0);
      if (window.clipsStudio?.libraryItems?.length != null) {
        n = window.clipsStudio.libraryItems.length;
      }
      const i = o.library_unlimited ? null : window.validateNumber(o.video_limit, 1, VALIDATION.MAX_VIDEOS_LIMIT, 10);
      const s = o.plan || "free";
      const a = typeof s === "string" && VALIDATION.ALLOWED_PLANS.includes(s.toLowerCase()) ? s.toLowerCase() : "free";
      window.applyStorageBadgeUI({
        used: n,
        limit: i,
        plan: a,
        unlimited: o.library_unlimited === true
      });
    } catch (e) {
      console.error("Failed to fetch storage info from backend:", e);
    }
  };
  return window.createDebounce(originalFunc, 3e3);
}();

window.closeUpgradeModal = function() {
  const e = document.getElementById("upgradeModalOverlay");
  if (e) {
    e.style.display = "none";
  }
};

window.showUpgradeModal = function(e = "Unlock more uploads", t = "Same price for any video length. Upgrade for more uploads per day and more clips per run.") {
  const o = document.getElementById("upgradeModalOverlay");
  const n = document.getElementById("upgradeModalTitle");
  const i = document.getElementById("upgradeModalSubtitle");
  if (o) {
    if (n) n.textContent = window.sanitizeString(e);
    if (i) i.textContent = window.sanitizeString(t);
    o.style.display = "flex";
  }
};

document.addEventListener("DOMContentLoaded", function() {
  try {
    const e = localStorage.getItem("clipsActiveTab") || "templates";
    const t = document.querySelectorAll(".clips-sub-item");
    const o = document.querySelectorAll(".clips-sub-item");
    let n = false;
    o.forEach(t => {
      if (t.getAttribute("data-tab") === e) {
        t.classList.add("active");
        switchClipsTab(e, t);
        n = true;
      } else {
        t.classList.remove("active");
      }
    });
    if (!n && o[0]) {
      o[0].classList.add("active");
      switchClipsTab("templates", o[0]);
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
      const o = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (o) {
        o.plan = t.plan.toLowerCase();
        localStorage.setItem("currentUser", JSON.stringify(o));
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
        const o = t.data;
        if (!o || typeof o !== "object") {
          throw new Error("Missing tier data in response");
        }
        const n = document.getElementById("currentTier");
        const i = document.getElementById("tierInfo");
        const s = document.getElementById("tierInfoCard");
        if (n && o.tier_name && typeof o.tier_name === "string") {
          n.textContent = window.sanitizeString(o.tier_name);
          if (s) {
            s.classList.remove("tier-free", "tier-basic", "tier-prime", "tier-elite");
            const e = String(o.tier_name || "free").toLowerCase();
            s.classList.add(`tier-${e}`);
            s.setAttribute("data-plan", e);
          }
        }
        if (i && o.generations && typeof o.generations.remaining === "number") {
          const e = window.validateNumber(o.generations.remaining, 0, 999999, 0);
          i.textContent = e + " gens left today";
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
        const o = t.subscription;
        if (!o || typeof o !== "object") {
          throw new Error("Missing subscription in response");
        }
        updateStorageBadgesFromSubscription(o);
      } else {
        console.warn("Could not fetch subscription from backend:", e.status);
      }
    } catch (e) {
      console.error("Dashboard failed to fetch subscription:", e);
    }
  }
  function updateStorageBadgesFromSubscription(e) {
    if (!e || typeof e !== "object") return;
    const t = document.getElementById("storageTotalBadge");
    const o = document.getElementById("storagePlanBadge");
    const n = document.getElementById("currentPlanDesc");
    const i = window.validateNumber(e.video_limit || e.videos_space_limit || 2, 1, VALIDATION.MAX_VIDEOS_LIMIT, 2);
    const s = e.plan || "free";
    const a = typeof s === "string" && VALIDATION.ALLOWED_PLANS.includes(s.toLowerCase()) ? s.toLowerCase() : "free";
    const r = a.charAt(0).toUpperCase() + a.slice(1);
    if (t) {
      t.textContent = i.toString();
    }
    if (o) {
      o.textContent = r;
    }
    if (n) {
      n.textContent = r + " Plan";
    }
  }
  refreshSubscriptionOnDashboard();
  updateStorageBadgeDisplay();
  const t = document.getElementById("disclaimerBtn");
  const o = document.querySelector(".url-input-overlay");
  const n = document.querySelector(".url-input");
  const i = document.querySelector(".url-submit-btn");
  const s = document.querySelector(".checkmark-icon");
  const a = "disclaimerAcceptedTime";
  const r = 7 * 24 * 60 * 60 * 1e3;
  if (t && o) {
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
      o.classList.add("hidden");
      t.classList.add("active");
      if (s) s.style.display = "block";
      if (n) n.style.filter = "none";
      if (i) i.style.filter = "none";
      if (n) n.style.pointerEvents = "auto";
      if (i) i.style.pointerEvents = "auto";
    }
    t.addEventListener("click", function() {
      if (!this.classList.contains("active")) {
        this.classList.add("active");
        if (s) s.style.display = "block";
        setTimeout(() => {
          o.classList.add("hidden");
          if (n) n.style.filter = "none";
          if (i) i.style.filter = "none";
          if (n) n.style.pointerEvents = "auto";
          if (i) i.style.pointerEvents = "auto";
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
  const o = document.querySelectorAll(".clips-sub-item");
  o.forEach(e => e.classList.remove("active"));
  if (t) t.classList.add("active");
  const n = document.querySelectorAll(".clips-section");
  n.forEach(e => {
    e.classList.remove("active");
    e.style.display = "none";
  });
  const i = {
    templates: "templatesSection",
    create: "createSection",
    library: "librarySection"
  };
  const s = document.getElementById(i[e]);
  if (s) {
    s.classList.add("active");
    s.style.display = "block";
  }
  if (e === "library") {
    const e = window.clipsStudio;
    if (e) {
      const t = 3e4;
      const o = !e._libraryLastLoaded || Date.now() - e._libraryLastLoaded > t;
      const n = !e.libraryItems || e.libraryItems.length === 0;
      if (o || n) {
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
    const o = window.getComputedStyle(e);
    if (o.display === "contents") return;
    const n = e.getBoundingClientRect();
    const i = t.getBoundingClientRect();
    a.style.left = i.left - n.left + "px";
  }
}

window.switchClipsTab = switchClipsTab;

window.goMobileClipsTab = window.goMobileClipsTab || function(e, t) {
  if (typeof window.switchSection === "function") window.switchSection("clips");
  switchClipsTab(e, t || document.querySelector(`.clips-sub-item[data-tab="${e}"]`));
};
