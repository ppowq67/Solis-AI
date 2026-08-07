function initNavigation() {
  const t = document.querySelectorAll(".nav-item[data-target]");
  const e = document.getElementById("dashboardContainer");
  const i = document.getElementById("portalContainer");
  const n = document.getElementById("clipsContainer");
  const o = document.getElementById("customEditorContainer");
  const s = document.querySelector(".input-section");
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
  const a = localStorage.getItem("currentNavigationTarget");
  if (a === "dashboard") {
    localStorage.removeItem("currentNavigationTarget");
  }
  const c = a && a !== "dashboard" && [ "portal", "Portal", "clips", "custom" ].includes(a) ? a : null;
  const l = window.innerWidth <= 768;
  let d = c || (l ? "clips" : "Portal");
  if (l && (d === "Portal" || d === "portal")) {
    d = "clips";
  }
  if ((d === "Portal" || d === "portal") && i) {
    i.style.display = "block";
    i.classList.add("active");
    updateActiveNav("Portal");
  } else if (d === "clips" && n) {
    n.style.display = "block";
    n.classList.add("active");
    updateActiveNav("clips");
    if (typeof window.clipsStudio !== "undefined" && window.clipsStudio && !window.clipsStudio.initialized) {
      window.clipsStudio.init();
    }
  } else if (d === "custom" && o) {
    o.style.display = "block";
    o.classList.add("active");
    updateActiveNav("Custom");
  } else {
    if (i) {
      i.style.display = "block";
      i.classList.add("active");
    }
    updateActiveNav("Portal");
  }
  if (s) {
    s.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
    s.classList.remove("is-first-prompt");
  }
  t.forEach(t => {
    t.addEventListener("click", a => {
      a.preventDefault();
      if (t.classList.contains("disabled")) return;
      const c = t.getAttribute("data-target") || "";
      const l = String(c).toLowerCase();
      updateActiveNav(c);
      hideAll();
      if (s) {
        s.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
        s.classList.remove("is-first-prompt");
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
        if (s) {
          s.style.display = "none";
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (a) {
            console.error("Error docking input:", a);
          }
        }
      } else if (l === "portal") {
        localStorage.setItem("currentNavigationTarget", "portal");
        if (i) {
          i.style.display = "block";
          i.classList.add("active");
        }
        if (s) {
          s.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
          s.classList.remove("is-first-prompt");
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (a) {
            console.error("Error docking input:", a);
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
        if (s) {
          s.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
          s.classList.remove("is-first-prompt");
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (a) {
            console.error("Error docking input:", a);
          }
        }
      } else if (l === "custom-edit" || l === "custom") {
        localStorage.setItem("currentNavigationTarget", "custom");
        if (o) {
          o.style.display = "block";
          o.classList.add("active");
        }
        if (s) {
          s.style.cssText = "display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;";
          s.classList.remove("is-first-prompt");
          try {
            if (typeof window.dockInputInstantly === "function") window.dockInputInstantly(true);
          } catch (a) {
            console.error("Error docking input:", a);
          }
        }
      }
    });
  });
  const r = document.getElementById("clips-toggle");
  if (r) {
    r.addEventListener("click", function(t) {
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
  const p = document.querySelectorAll(".clips-submenu .nav-item");
  p.forEach(t => {
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
  const u = document.querySelector('.nav-item[data-target="Portal"]');
  if (u) {
    u.addEventListener("click", function(t) {
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
