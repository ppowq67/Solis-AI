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
  const e = document.getElementById("deleteConfirmationModal");
  const t = document.getElementById("deleteModalTitle");
  const o = document.getElementById("deleteConfirmationText");
  const i = e?.querySelector(".delete-modal-warning");
  const n = document.getElementById("confirmDeleteBtn");
  if (!e || !o || !n) return;
  const s = window.clipsStudio && window.clipsStudio.libraryItems ? window.clipsStudio.libraryItems : [];
  const a = s.length;
  if (t) t.textContent = "Clear library";
  o.textContent = a > 0 ? `This will permanently remove all ${a} clips from your library.` : "There are no clips in your library to remove.";
  if (i) i.textContent = "Associated files are deleted and cannot be recovered.";
  n.textContent = "Clear library";
  n.disabled = a === 0;
  e.classList.add("show");
  const r = n.cloneNode(true);
  n.parentNode.replaceChild(r, n);
  r.onclick = async function() {
    if (!window.clipsStudio || !window.clipsStudio.libraryItems || window.clipsStudio.libraryItems.length === 0) {
      window.clipsStudio?.showNotification("No clips to delete", "info");
      e.classList.remove("show");
      return;
    }
    r.disabled = true;
    r.textContent = "Clearing…";
    try {
      const t = [ ...window.clipsStudio.libraryItems ];
      const o = t.length;
      let i = 0;
      const n = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      };
      const s = typeof API_BASE_URL !== "undefined" && API_BASE_URL ? API_BASE_URL : "/api";
      for (const e of t) {
        const t = e.projectId || e.project_id;
        if (!t) continue;
        try {
          const e = await fetch(`${s}/clips/project/${encodeURIComponent(t)}`, {
            method: "DELETE",
            headers: n,
            credentials: "include"
          });
          if (e.ok) i++;
        } catch (e) {
          console.error(`Failed to delete clip ${t}:`, e);
        }
      }
      window.clipsStudio.libraryItems = [];
      window.clipsStudio.processingItems = [];
      window.clipsStudio.saveLibraryItems();
      if (typeof window.clipsStudio.saveProcessingItems === "function") {
        window.clipsStudio.saveProcessingItems();
      }
      window.clipsStudio.updateLibraryView();
      if (typeof window.clipsStudio.updateProcessingView === "function") {
        window.clipsStudio.updateProcessingView();
      }
      if (typeof updateStorageBadgeDisplay === "function") {
        await updateStorageBadgeDisplay();
      }
      window.clipsStudio.showNotification(i > 0 ? `Cleared ${i}/${o} clips from your library` : "Library cleared", "success");
      e.classList.remove("show");
      setTimeout(() => window.location.reload(), 600);
    } catch (t) {
      console.error("Error clearing library:", t);
      window.clipsStudio?.showNotification("Error clearing library. Please try again.", "error");
      e.classList.remove("show");
    } finally {
      r.disabled = false;
      r.textContent = "Clear library";
    }
  };
};

window.addEventListener("load", () => {
  setTimeout(() => {
    if (window.videoGenerationSocket) {
      window.videoGenerationSocket.off("video_generated");
      window.videoGenerationSocket.on("video_generated", () => {
        updateStorageBadgeDisplay();
      });
    }
    if (window.solisWSClient) {
      window.solisWSClient.on("storage_update", () => {
        updateStorageBadgeDisplay();
      });
      window.solisWSClient.on("video_generated", () => {
        updateStorageBadgeDisplay();
      });
    }
    if (window.clipsStudio) {
      const e = window.clipsStudio.loadLibraryItems;
      window.clipsStudio.loadLibraryItems = async function() {
        const t = await e.call(this);
        return t;
      };
    }
  }, 1e3);
});

window.closeUpgradeModal = function() {
  const e = document.getElementById("upgradeModalOverlay");
  if (e) {
    e.style.display = "none";
  }
};

window.showUpgradeModal = function(e = "Video Too Long", t = "Your video exceeds your plan limit. Upgrade to process longer videos and unlock premium features.") {
  const o = document.getElementById("upgradeModalOverlay");
  const i = document.getElementById("upgradeModalTitle");
  const n = document.getElementById("upgradeModalSubtitle");
  if (o) {
    if (i) i.textContent = e;
    if (n) n.textContent = t;
    o.style.display = "flex";
  }
};

document.addEventListener("DOMContentLoaded", function() {
  const e = sessionStorage.getItem("paymentSuccess");
  if (e) {
    try {
      const t = JSON.parse(e);
      const o = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (o) {
        o.plan = t.plan;
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
        const o = t.data;
        const i = document.getElementById("currentTier");
        const n = document.getElementById("tierInfo");
        const s = document.getElementById("tierInfoCard");
        if (i) {
          i.textContent = o.tier_name;
          if (s) {
            s.classList.remove("tier-free", "tier-basic", "tier-prime", "tier-elite");
            const e = String(o.tier_name || "free").toLowerCase();
            s.classList.add(`tier-${e}`);
            s.setAttribute("data-plan", e);
          }
        }
        if (n) {
          const e = o.generations.remaining;
          n.textContent = `${e} gens left today`;
        }
      }
    } catch (e) {}
  }
  loadUserTierInfo();
  async function refreshSubscriptionOnDashboard() {
    try {
      const e = window._subCache ? await window._subCache.get() : await fetch("/api/auth/subscription", {
        credentials: "include"
      }).then(e => e.ok ? e.json().then(e => e.subscription) : null);
      if (e) {
        updateStorageBadgesFromSubscription(e);
      }
    } catch (e) {
      console.error("Dashboard failed to get subscription:", e);
    }
  }
  function updateStorageBadgesFromSubscription(e) {
    if (!e) return;
    const t = document.getElementById("storageTotalBadge");
    const o = document.getElementById("storagePlanBadge");
    const i = document.getElementById("currentPlanDesc");
    const n = e.video_limit || e.videos_space_limit || 2;
    const s = e.plan || "free";
    const a = s.charAt(0).toUpperCase() + s.slice(1);
    if (t) {
      t.textContent = n;
    }
    if (o) {
      o.textContent = a;
    }
    if (i) {
      i.textContent = a + " Plan";
    }
  }
  refreshSubscriptionOnDashboard();
  updateStorageBadgeDisplay();
  const t = document.getElementById("disclaimerBtn");
  const o = document.querySelector(".url-input-overlay");
  const i = document.querySelector(".url-input");
  const n = document.querySelector(".url-submit-btn");
  const s = document.querySelector(".checkmark-icon");
  const a = "disclaimerAcceptedTime";
  const r = 7 * 24 * 60 * 60 * 1e3;
  if (t && o) {
    const e = localStorage.getItem(a);
    const c = Date.now();
    let l = false;
    if (!e) {
      l = true;
    } else {
      const t = c - parseInt(e);
      if (t > r) {
        l = true;
      }
    }
    if (!l) {
      o.classList.add("hidden");
      t.classList.add("active");
      if (s) s.style.display = "block";
      if (i) i.style.filter = "none";
      if (n) n.style.filter = "none";
      if (i) i.style.pointerEvents = "auto";
      if (n) n.style.pointerEvents = "auto";
    }
    t.addEventListener("click", function() {
      if (!this.classList.contains("active")) {
        this.classList.add("active");
        if (s) s.style.display = "block";
        setTimeout(() => {
          o.classList.add("hidden");
          if (i) i.style.filter = "none";
          if (n) n.style.filter = "none";
          if (i) i.style.pointerEvents = "auto";
          if (n) n.style.pointerEvents = "auto";
          localStorage.setItem(a, Date.now().toString());
        }, 300);
      }
    });
  }
});

function switchClipsTab(e, t) {
  const o = document.querySelectorAll(".clips-sub-item");
  o.forEach(e => e.classList.remove("active"));
  t.classList.add("active");
  const i = document.querySelectorAll(".clips-section");
  i.forEach(e => {
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
      const o = !e._libraryLastLoaded || Date.now() - e._libraryLastLoaded > t;
      const i = !e.libraryItems || e.libraryItems.length === 0;
      if (o || i) {
        e.showLibrarySkeleton(4);
        e.loadLibraryItems().then(() => {
          e._libraryLastLoaded = Date.now();
        });
      }
    }
  }
  const a = document.getElementById("clipsSubPane");
  if (a) {
    const e = Array.from(o).indexOf(t);
    const i = document.querySelector(".clips-sub-pill");
    const n = i.getBoundingClientRect();
    const s = t.getBoundingClientRect();
    const r = s.left - n.left;
    a.style.left = r + "px";
  }
}
