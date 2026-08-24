window.SolisFirstLanding = window.SolisFirstLanding || {
  prefix: "solis_seen_create_landing_",
  userId: function() {
    try {
      const t = window.currentUser;
      return t && (t.id || t.user_id) || null;
    } catch (t) {
      return null;
    }
  },
  key: function(t) {
    return this.prefix + String(t || "");
  },
  hasSeen: function() {
    return false;
  },
  markSeen: function() {},
  needsLanding: function() {
    return true;
  },
  applyCreateLanding: function() {
    try {
      localStorage.setItem("currentNavigationTarget", "clips");
      localStorage.setItem("clipsStudioCurrentTab", "create");
      localStorage.setItem("clipsActiveTab", "create");
      localStorage.setItem("sidebarActiveIndex", "2");
      localStorage.setItem("activeNavIndex", "2");
    } catch (t) {}
    if (typeof window.switchSection === "function") {
      try {
        window.switchSection("clips");
      } catch (t) {}
    }
    const t = document.querySelector('.nav-item[data-target="clips"]');
    if (t) {
      document.querySelectorAll(".nav-item[data-target]").forEach(t => t.classList.remove("active"));
      t.classList.add("active");
    }
    if (typeof window.switchClipsTab === "function") {
      const t = document.querySelector('.clips-tab[data-tab="create"], .clips-sub-item[data-tab="create"]');
      try {
        window.switchClipsTab("create", t);
      } catch (t) {}
    }
    if (window.clipsStudio && typeof window.clipsStudio.goToCreateUrlSubmit === "function") {
      window.clipsStudio.goToCreateUrlSubmit();
    } else if (typeof window.goToCreateUrlSubmit === "function") {
      window.goToCreateUrlSubmit();
    }
    if (typeof window.updateMobileClipsPillIndicator === "function") {
      try {
        window.updateMobileClipsPillIndicator("create");
      } catch (t) {}
    }
  }
};

function initNavigation() {
  const t = document.querySelectorAll(".nav-item[data-target]");
  const e = document.getElementById("dashboardContainer");
  const i = document.getElementById("portalContainer");
  const n = document.getElementById("clipsContainer");
  const o = document.getElementById("customEditorContainer");
  const a = document.querySelector(".input-section");
  function hideAll() {
    if (e) {
      e.style.display = "none";
      e.classList.remove("active");
    }
    if (i) {
      i.style.display = "none";
      i.classList.remove("active");
    }
    if (n) {
      n.style.display = "none";
      n.classList.remove("active");
    }
    if (o) {
      o.style.display = "none";
      o.classList.remove("active");
    }
  }
  function updateActiveNav(e) {
    t.forEach(t => {
      t.classList.remove("active");
      if (t.getAttribute("data-target") === e) {
        t.classList.add("active");
      }
    });
  }
  hideAll();
  try {
    localStorage.setItem("currentNavigationTarget", "clips");
    localStorage.setItem("clipsStudioCurrentTab", "create");
    localStorage.setItem("clipsActiveTab", "create");
    localStorage.setItem("sidebarActiveIndex", "2");
    localStorage.setItem("activeNavIndex", "2");
  } catch (t) {}
  if (n) {
    n.style.display = "block";
    n.classList.add("active");
    updateActiveNav("clips");
    if (typeof window.clipsStudio !== "undefined" && window.clipsStudio && !window.clipsStudio.initialized) {
      window.clipsStudio.init();
    }
  } else if (i) {
    i.style.display = "block";
    i.classList.add("active");
    updateActiveNav("Portal");
  }
  try {
    if (window.SolisFirstLanding && typeof window.SolisFirstLanding.applyCreateLanding === "function") {
      window.SolisFirstLanding.applyCreateLanding();
    }
  } catch (t) {}
  if (a) {
    a.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
    a.classList.remove("is-first-prompt");
  }
  t.forEach(t => {
    t.addEventListener("click", s => {
      s.preventDefault();
      if (t.classList.contains("disabled")) return;
      const c = t.getAttribute("data-target") || "";
      const l = String(c).toLowerCase();
      updateActiveNav(c);
      hideAll();
      if (a) {
        a.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
        a.classList.remove("is-first-prompt");
      }
      if (l === "dashboard") {
        localStorage.setItem("currentNavigationTarget", "dashboard");
        if (e) {
          e.style.display = "block";
          e.classList.add("active");
          if (window.analyticsManager) {
            setTimeout(() => {
              window.analyticsManager.updateCharts();
            }, 50);
          }
        }
        if (a) {
          a.style.display = "none";
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (s) {
            console.error("Error docking input:", s);
          }
        }
      } else if (l === "portal") {
        localStorage.setItem("currentNavigationTarget", "portal");
        if (i) {
          i.style.display = "block";
          i.classList.add("active");
        }
        if (a) {
          a.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
          a.classList.remove("is-first-prompt");
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (s) {
            console.error("Error docking input:", s);
          }
        }
      } else if (l === "clips" || l === "clips-studio" || l === "clipscontainer") {
        localStorage.setItem("currentNavigationTarget", "clips");
        if (n) {
          n.style.display = "block";
          n.classList.add("active");
          if (typeof window.clipsStudio !== "undefined" && window.clipsStudio && !window.clipsStudio.initialized) {
            window.clipsStudio.init();
          }
        }
        if (a) {
          a.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
          a.classList.remove("is-first-prompt");
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (s) {
            console.error("Error docking input:", s);
          }
        }
      } else if (l === "custom-edit" || l === "custom") {
        localStorage.setItem("currentNavigationTarget", "custom");
        if (o) {
          o.style.display = "block";
          o.classList.add("active");
        }
        if (a) {
          a.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
          a.classList.remove("is-first-prompt");
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (s) {
            console.error("Error docking input:", s);
          }
        }
      }
    });
  });
  const s = document.getElementById("clips-toggle");
  if (s) {
    s.addEventListener("click", function(t) {
      t.preventDefault();
      t.stopPropagation();
      const e = document.getElementById("clips-submenu");
      const i = this.querySelector(".chevron-icon");
      if (e) e.classList.toggle("open");
      if (i) i.classList.toggle("rotated");
      if (!e || !e.contains(t.target)) {
        const e = document.getElementById("clipsContainer");
        const i = document.querySelector(".input-section");
        document.querySelectorAll(".dashboard-container, .portal-container").forEach(t => {
          t.style.display = "none";
          t.classList.remove("active");
        });
        if (e) {
          e.style.display = "block";
          e.classList.add("active");
          if (typeof window.clipsStudio !== "undefined" && window.clipsStudio && !window.clipsStudio.initialized) {
            window.clipsStudio.init();
          }
        }
        if (i) {
          i.style.display = "none";
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (t) {
            console.error("Error docking input:", t);
          }
        }
        updateActiveNav("clips");
      }
    });
  }
  const c = document.querySelectorAll(".clips-submenu .nav-item");
  c.forEach(t => {
    t.addEventListener("click", function(t) {
      t.preventDefault();
      const e = this.getAttribute("data-target");
      if (e === "clips-studio") {
        const e = document.getElementById("clipsContainer");
        const i = document.querySelector(".input-section");
        document.querySelectorAll(".dashboard-container, .portal-container").forEach(t => {
          t.style.display = "none";
          t.classList.remove("active");
        });
        if (e) {
          e.style.display = "block";
          e.classList.add("active");
          if (typeof window.clipsStudio !== "undefined" && window.clipsStudio && !window.clipsStudio.initialized) {
            window.clipsStudio.init();
          }
        }
        if (i) {
          i.style.display = "none";
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (t) {
            console.error("Error docking input:", t);
          }
        }
        updateActiveNav("clips");
        const n = document.getElementById("clips-submenu");
        const o = document.querySelector("#clips-toggle .chevron-icon");
        if (n) n.classList.remove("open");
        if (o) o.classList.remove("rotated");
      }
    });
  });
  document.addEventListener("click", function(t) {
    const e = document.getElementById("clips-toggle");
    const i = document.getElementById("clips-submenu");
    if (i && e && !e.contains(t.target) && !i.contains(t.target)) {
      i.classList.remove("open");
      const t = e.querySelector(".chevron-icon");
      if (t) t.classList.remove("rotated");
    }
  });
  const l = document.querySelector('.nav-item[data-target="Portal"]');
  if (l) {
    l.addEventListener("click", function(t) {
      t.preventDefault();
      const e = document.getElementById("portalContainer");
      const i = document.getElementById("dashboardContainer");
      const n = document.getElementById("clipsContainer");
      const o = document.querySelector(".input-section");
      if (i) {
        i.style.display = "none";
        i.classList.remove("active");
      }
      if (n) {
        n.style.display = "none";
        n.classList.remove("active");
      }
      if (o) {
        o.style.display = "none";
      }
      if (e) {
        e.style.display = "block";
        e.classList.add("active");
      }
      updateActiveNav("Portal");
    });
  }
  document.addEventListener("keydown", t => {
    if ((t.ctrlKey || t.metaKey) && t.key === "k") {
      t.preventDefault();
      const e = document.querySelector(".sidebar");
      if (e) {
        e.classList.toggle("expanded");
        const t = e.classList.contains("expanded");
        localStorage.setItem("sidebarExpanded", t);
      }
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavigation);
} else {
  initNavigation();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    initNavigation: initNavigation
  };
}
