window.addEventListener("load", () => {
  const e = document.querySelector(".ci4");
  const t = document.querySelector(".chz");
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
  const e = document.getElementById("i1qr");
  const t = document.getElementById("i1qt");
  const i = document.getElementById("i1qs");
  const o = e?.querySelector(".c9u");
  const n = document.getElementById("i1pw");
  if (!e || !i || !n) return;
  const s = window.clipsStudio && window.clipsStudio.libraryItems ? window.clipsStudio.libraryItems : [];
  const c = s.length;
  if (t) t.textContent = "Clear library";
  i.textContent = c > 0 ? `This will permanently remove all ${c} clips from your library.` : "There are no clips in your library to remove.";
  if (o) o.textContent = "Associated files are deleted and cannot be recovered.";
  n.textContent = "Clear library";
  n.disabled = c === 0;
  e.classList.add("show");
  const a = n.cloneNode(true);
  n.parentNode.replaceChild(a, n);
  a.onclick = async function() {
    if (!window.clipsStudio || !window.clipsStudio.libraryItems || window.clipsStudio.libraryItems.length === 0) {
      window.clipsStudio?.showNotification("No clips to delete", "info");
      e.classList.remove("show");
      return;
    }
    a.disabled = true;
    a.textContent = "Clearing…";
    try {
      const t = [ ...window.clipsStudio.libraryItems ];
      const i = t.length;
      let o = 0;
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
          if (e.ok) o++;
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
      window.clipsStudio.showNotification(o > 0 ? `Cleared ${o}/${i} clips from your library` : "Library cleared", "success");
      e.classList.remove("show");
      setTimeout(() => window.location.reload(), 600);
    } catch (t) {
      console.error("Error clearing library:", t);
      window.clipsStudio?.showNotification("Error clearing library. Please try again.", "error");
      e.classList.remove("show");
    } finally {
      a.disabled = false;
      a.textContent = "Clear library";
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
  const e = document.getElementById("i24t");
  if (e) {
    e.style.display = "none";
  }
};

window.showUpgradeModal = function(e = "Video Too Long", t = "Your video exceeds your plan limit. Upgrade to process longer videos and unlock premium features.") {
  const i = document.getElementById("i24t");
  const o = document.getElementById("i24v");
  const n = document.getElementById("i24u");
  if (i) {
    if (o) o.textContent = e;
    if (n) n.textContent = t;
    i.style.display = "flex";
  }
};

document.addEventListener("DOMContentLoaded", function() {
  const e = sessionStorage.getItem("paymentSuccess");
  if (e) {
    try {
      const t = JSON.parse(e);
      const i = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (i) {
        i.plan = t.plan;
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
        const i = t.data;
        const o = document.getElementById("i1q5");
        const n = document.getElementById("tierInfo");
        const s = document.getElementById("i24j");
        if (o) {
          o.textContent = i.tier_name;
          if (s) {
            s.classList.remove("c1fx", "tier-basic", "tier-prime", "tier-elite");
            const e = String(i.tier_name || "free").toLowerCase();
            s.classList.add(`tier-${e}`);
            s.setAttribute("data-plan", e);
          }
        }
        if (n) {
          const e = i.generations.remaining;
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
    const t = document.getElementById("i23j");
    const i = document.getElementById("i23i");
    const o = document.getElementById("currentPlanDesc");
    const n = e.video_limit || e.videos_space_limit || 2;
    const s = e.plan || "free";
    const c = s.charAt(0).toUpperCase() + s.slice(1);
    if (t) {
      t.textContent = n;
    }
    if (i) {
      i.textContent = c;
    }
    if (o) {
      o.textContent = c + " Plan";
    }
  }
  refreshSubscriptionOnDashboard();
  updateStorageBadgeDisplay();
  const t = document.getElementById("i1qv");
  const i = document.querySelector(".c1j0");
  const o = document.querySelector(".c1iw");
  const n = document.querySelector(".c1jf");
  const s = document.querySelector(".c59");
  const c = "disclaimerAcceptedTime";
  const a = 7 * 24 * 60 * 60 * 1e3;
  if (t && i) {
    const e = localStorage.getItem(c);
    const r = Date.now();
    let d = false;
    if (!e) {
      d = true;
    } else {
      const t = r - parseInt(e);
      if (t > a) {
        d = true;
      }
    }
    if (!d) {
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
          localStorage.setItem(c, Date.now().toString());
        }, 300);
      }
    });
  }
});

function switchClipsTab(e, t) {
  const i = document.querySelectorAll(".c69");
  i.forEach(e => e.classList.remove("active"));
  t.classList.add("active");
  const o = document.querySelectorAll(".c67");
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
  const c = document.getElementById("i1pn");
  if (c) {
    const e = Array.from(i).indexOf(t);
    const o = document.querySelector(".c6b");
    const n = o.getBoundingClientRect();
    const s = t.getBoundingClientRect();
    const a = s.left - n.left;
    c.style.left = a + "px";
  }
}
