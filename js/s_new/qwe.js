window.getCSRFToken = function() {
  const e = document.querySelector('meta[name="csrf-token"]');
  if (e) return e.getAttribute("content");
  const t = "csrf_token=";
  const i = decodeURIComponent(document.cookie);
  const o = i.split(";");
  for (let e of o) {
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
  return function(...o) {
    clearTimeout(i);
    i = setTimeout(() => e(...o), t);
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
      const o = await fetch("/api/clips/bulk-delete", {
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
      if (!o.ok) {
        const e = await o.json().catch(() => ({}));
        const t = window.getSafeErrorMessage(e);
        console.error("Bulk delete failed:", o.status, e);
        window.clipsStudio?.showNotification("Failed to delete clips: " + t, "error");
        return;
      }
      const n = await o.json();
      i = n.deleted_count || e;
    } catch (e) {
      console.warn("Bulk delete endpoint failed, falling back to individual deletes:", e);
      for (const e of window.clipsStudio.libraryItems) {
        try {
          const t = e.projectId || e.project_id;
          if (!t) continue;
          const o = await fetch(`/api/clips/project/${encodeURIComponent(t)}`, {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...window.getCSRFToken && {
                "X-CSRF-Token": window.getCSRFToken()
              }
            }
          });
          if (o.ok) {
            i++;
          } else {
            console.error(`Failed to delete clip ${t}: ${o.status}`);
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
  const o = Math.max(0, e);
  const n = Math.max(1, t);
  const s = o / n;
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
    showDeleteAll: s >= c && o > 0,
    showUpgrade: a && s >= d
  };
};

window.isUnlimitedLibrary = function(e, t) {
  const i = (t || document.getElementById("storagePlanBadge")?.textContent || "free").toString().toLowerCase();
  const o = i.replace(/\s+plan\s*$/, "").trim();
  return o === "basic" || o === "prime" || o === "elite" || o.includes("basic") || o.includes("prime") || o.includes("elite");
};

window.applyStorageBadgeUI = function({used: e, limit: t, plan: i, unlimited: o}) {
  const n = typeof i === "string" && i.length ? i.toLowerCase().replace(/\s+plan\s*$/, "").trim() : "free";
  const s = o === true || window.isUnlimitedLibrary(t, n);
  const a = !s;
  const r = a ? Math.max(1, Number(t) || 10) : null;
  const l = Math.max(0, Number(e) || 0);
  const {phase: c, showDeleteAll: d, showUpgrade: u} = a ? window.getStoragePhase(l, r, n) : {
    phase: "ok",
    showDeleteAll: false,
    showUpgrade: false
  };
  const p = n.charAt(0).toUpperCase() + n.slice(1);
  const w = a && (c === "high" || c === "full");
  const m = document.getElementById("storageBadge");
  const f = document.getElementById("storageUsedBadge");
  const g = document.getElementById("storageTotalBadge");
  const y = document.getElementById("storageLimitGroup");
  const b = document.getElementById("storagePlanBadge");
  const S = document.getElementById("storageWarnIcon");
  const h = document.getElementById("deleteAllClipsBtn");
  const I = document.getElementById("needMoreUpgradeText");
  if (f) {
    f.textContent = String(l);
    f.style.color = "";
    f.classList.toggle("storage-count-warn", w);
  }
  if (y) {
    y.style.display = a ? "" : "none";
    y.hidden = !a;
  } else if (g) {
    g.style.display = a ? "" : "none";
    const e = g.previousSibling;
    if (e && e.nodeType === 3) e.textContent = a ? " / " : "";
  }
  if (g && a) {
    g.textContent = String(r);
    g.style.display = "";
    g.classList.toggle("storage-count-warn", c === "full");
  }
  if (m) m.classList.toggle("is-unlimited", s);
  if (b) b.textContent = p;
  if (m) {
    m.classList.toggle("is-warn", w);
    m.classList.toggle("is-full", a && c === "full");
    m.title = s ? `${l} clip${l === 1 ? "" : "s"} stored` : c === "full" ? "Storage full — delete clips or upgrade your plan" : c === "high" ? `Storage almost full (${l}/${r}) — remove old videos to keep generating` : "Library storage";
  }
  if (S) {
    S.hidden = !w;
    S.setAttribute("aria-hidden", w ? "false" : "true");
  }
  if (h) h.style.display = d ? "inline-flex" : "none";
  if (I) I.style.display = u ? "inline" : "none";
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
  const o = e.storage.videos.unlimited === true || [ "basic", "prime", "elite" ].includes(i);
  const n = o ? null : e.storage.videos.limit ?? 10;
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
      const i = t?.subscription;
      if (!i || typeof i !== "object") throw new Error("Missing subscription");
      let o = window.validateNumber(i.active_videos, 0, VALIDATION.MAX_VIDEOS_LIMIT, 0);
      if (window.clipsStudio?.libraryItems?.length != null) {
        o = window.clipsStudio.libraryItems.length;
      }
      const n = i.library_unlimited ? null : window.validateNumber(i.video_limit, 1, VALIDATION.MAX_VIDEOS_LIMIT, 10);
      const s = i.plan || "free";
      const a = typeof s === "string" && VALIDATION.ALLOWED_PLANS.includes(s.toLowerCase()) ? s.toLowerCase() : "free";
      window.applyStorageBadgeUI({
        used: o,
        limit: n,
        plan: a,
        unlimited: i.library_unlimited === true
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
  const i = document.getElementById("upgradeModalOverlay");
  const o = document.getElementById("upgradeModalTitle");
  const n = document.getElementById("upgradeModalSubtitle");
  if (i) {
    if (o) o.textContent = window.sanitizeString(e);
    if (n) n.textContent = window.sanitizeString(t);
    i.style.display = "flex";
  }
};

document.addEventListener("DOMContentLoaded", function() {
  try {
    const e = localStorage.getItem("clipsActiveTab") || "templates";
    const t = document.querySelectorAll(".clips-sub-item");
    const i = document.querySelectorAll(".clips-sub-item");
    let o = false;
    i.forEach(t => {
      if (t.getAttribute("data-tab") === e) {
        t.classList.add("active");
        switchClipsTab(e, t);
        o = true;
      } else {
        t.classList.remove("active");
      }
    });
    if (!o && i[0]) {
      i[0].classList.add("active");
      switchClipsTab("templates", i[0]);
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
        const o = document.getElementById("currentTier");
        const n = document.getElementById("tierInfo");
        const s = document.getElementById("tierInfoCard");
        if (o && i.tier_name && typeof i.tier_name === "string") {
          o.textContent = window.sanitizeString(i.tier_name);
          if (s) {
            s.classList.remove("tier-free", "tier-basic", "tier-prime", "tier-elite");
            const e = String(i.tier_name || "free").toLowerCase();
            s.classList.add(`tier-${e}`);
            s.setAttribute("data-plan", e);
          }
        }
        if (n && i.generations && typeof i.generations.remaining === "number") {
          const e = window.validateNumber(i.generations.remaining, 0, 999999, 0);
          n.textContent = e + " gens left today";
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
    const o = e.library_unlimited === true || window.isUnlimitedLibrary?.(null, i);
    const n = window.clipsStudio?.libraryItems?.length != null ? window.clipsStudio.libraryItems.length : window.validateNumber(e.active_videos, 0, VALIDATION.MAX_VIDEOS_LIMIT, 0);
    const s = o ? null : window.validateNumber(e.video_limit || e.videos_space_limit, 1, VALIDATION.MAX_VIDEOS_LIMIT, 10);
    const a = i.charAt(0).toUpperCase() + i.slice(1);
    if (typeof window.applyStorageBadgeUI === "function") {
      window.applyStorageBadgeUI({
        used: n,
        limit: s,
        plan: i,
        unlimited: o
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
  const o = document.querySelector(".url-input");
  const n = document.querySelector(".url-submit-btn");
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
      if (o) o.style.filter = "none";
      if (n) n.style.filter = "none";
      if (o) o.style.pointerEvents = "auto";
      if (n) n.style.pointerEvents = "auto";
    }
    t.addEventListener("click", function() {
      if (!this.classList.contains("active")) {
        this.classList.add("active");
        if (s) s.style.display = "block";
        setTimeout(() => {
          i.classList.add("hidden");
          if (o) o.style.filter = "none";
          if (n) n.style.filter = "none";
          if (o) o.style.pointerEvents = "auto";
          if (n) n.style.pointerEvents = "auto";
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
  const o = document.querySelectorAll(".clips-section");
  o.forEach(e => {
    e.classList.remove("active");
    e.style.display = "none";
  });
  const n = {
    templates: "templatesSection",
    create: "createSection",
    library: "librarySection"
  };
  const s = document.getElementById(n[e]);
  if (s) {
    s.classList.add("active");
    s.style.display = "block";
  }
  if (e === "library") {
    const e = window.clipsStudio;
    if (e) {
      const t = 3e4;
      const i = !e._libraryLastLoaded || Date.now() - e._libraryLastLoaded > t;
      const o = !e.libraryItems || e.libraryItems.length === 0;
      if (i || o) {
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
    const o = e.getBoundingClientRect();
    const n = t.getBoundingClientRect();
    a.style.left = n.left - o.left + "px";
  }
}

window.switchClipsTab = switchClipsTab;

window.goMobileClipsTab = window.goMobileClipsTab || function(e, t) {
  if (typeof window.switchSection === "function") window.switchSection("clips");
  switchClipsTab(e, t || document.querySelector(`.clips-sub-item[data-tab="${e}"]`));
};
