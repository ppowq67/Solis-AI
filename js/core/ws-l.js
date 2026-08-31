(function() {
  let e = 0;
  let t;
  let n;
  const updateIndicator = e => {};
  function initSidebarState() {
    try {
      const t = document.getElementById("navContainer");
      if (!t) return;
      const n = t.querySelectorAll(".nav-item");
      if (window.SolisFirstLanding && typeof window.SolisFirstLanding.needsLanding === "function" && window.SolisFirstLanding.needsLanding() && typeof window.SolisFirstLanding.applyCreateLanding === "function") {
        window.SolisFirstLanding.applyCreateLanding();
      }
      const i = localStorage.getItem("currentNavigationTarget") || "clips";
      const o = t.querySelector(`.nav-item[data-target="${i}"]`) || t.querySelector('.nav-item[data-target="clips"]') || Array.from(n).find(e => !e.classList.contains("disabled"));
      if (!o) return;
      e = Array.from(n).indexOf(o);
      n.forEach(e => e.classList.remove("active"));
      o.classList.add("active");
      setTimeout(() => updateIndicator(o), 0);
      try {
        localStorage.setItem("sidebarActiveIndex", String(e));
      } catch (e) {}
      const a = o.getAttribute("data-target") || "clips";
      switchSection(a);
      if ((a === "clips" || a === "clips-studio" || a === "clipsContainer") && typeof window.switchClipsTab === "function") {
        const e = localStorage.getItem("clipsActiveTab") || localStorage.getItem("clipsStudioCurrentTab") || "templates";
        const t = e === "create" && window.innerWidth <= 768 ? "templates" : e;
        const n = document.querySelector(`.clips-tab[data-tab="${t}"], .clips-sub-item[data-tab="${t}"]`);
        window.switchClipsTab(t, n);
      }
    } catch (e) {
      console.error("Failed to restore sidebar state:", e);
    }
  }
  function initIndicatorTracking() {
    const e = document.getElementById("navContainer");
    if (!e) return;
    const t = e.querySelector(".nav-item.active");
    if (t) {
      updateIndicator(t);
    }
    if (n) n.disconnect();
    n = new MutationObserver(e => {
      e.forEach(e => {
        if (e.type === "attributes" && e.attributeName === "class") {
          const t = e.target;
          if (t.classList.contains("active")) {
            updateIndicator(t);
          }
        }
      });
    });
    e.querySelectorAll(".nav-item").forEach(e => {
      n.observe(e, {
        attributes: true,
        attributeFilter: [ "class" ]
      });
    });
  }
  function showNotification(e, t = "success") {
    if (typeof window.__solisShowNotification === "function") {
      window.__solisShowNotification(e, t);
      return;
    }
    const n = document.getElementById("notificationContainer") || createNotificationContainer();
    const i = document.createElement("div");
    const o = [ "success", "error", "warning", "info" ].includes(t) ? t : "info";
    i.className = `notification notification-${o} ${o}`;
    i.innerHTML = `\n                <div class="notification-content">\n                    <span class="notification-message"></span>\n                </div>\n            `;
    i.querySelector(".notification-message").textContent = String(e || "");
    n.appendChild(i);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => i.classList.add("show"));
    });
    setTimeout(() => {
      i.classList.remove("show");
      i.classList.add("is-leaving");
      setTimeout(() => i.remove(), 320);
    }, 3500);
  }
  function createNotificationContainer() {
    const e = document.createElement("div");
    e.id = "notificationContainer";
    e.setAttribute("aria-live", "polite");
    document.body.appendChild(e);
    return e;
  }
  window.addEventListener("videoGenerated", e => {
    const t = e.detail?.title || "Video";
    showNotification(` ${t} has been generated successfully!`, "success");
  });
  window.addEventListener("videoGenerationError", e => {
    const t = e.detail?.message || "An error occurred";
    showNotification(` ${t}`, "error");
  });
  window.addEventListener("videoGenerationProgress", e => {
    const t = e.detail?.progress || "";
    showNotification(` ${t}`, "info");
  });
  window.notificationAPI = {
    success: e => showNotification(e, "success"),
    error: e => showNotification(e, "error"),
    info: e => showNotification(e, "info"),
    warning: e => showNotification(e, "warning"),
    videoGenerated: e => {
      const t = new CustomEvent("videoGenerated", {
        detail: {
          title: e
        }
      });
      window.dispatchEvent(t);
    },
    videoError: e => {
      const t = new CustomEvent("videoGenerationError", {
        detail: {
          message: e
        }
      });
      window.dispatchEvent(t);
    },
    videoProgress: e => {
      const t = new CustomEvent("videoGenerationProgress", {
        detail: {
          progress: e
        }
      });
      window.dispatchEvent(t);
    }
  };
  if (typeof window.showNotification === "function") {
    window.__solisShowNotification = window.showNotification;
  } else {
    window.showNotification = showNotification;
    window.__solisShowNotification = showNotification;
  }
  function initializeVideoGenerationSocket() {
    try {
      if (typeof io === "undefined") {
        console.warn("Socket.IO not loaded yet, retrying...");
        setTimeout(initializeVideoGenerationSocket, 500);
        return;
      }
      const e = typeof window.getSolisSocketOrigin === "function" ? window.getSolisSocketOrigin() : (window.API_BASE_URL || "https://api.solisai.video/api").toString().replace(/\/api\/?$/, "") || "https://api.solisai.video";
      let t = sessionStorage.getItem("auth_token") || sessionStorage.getItem("jwt_token") || localStorage.getItem("auth_token");
      const n = io(e, {
        transports: [ "websocket", "polling" ],
        reconnectionDelay: 1e3,
        reconnectionAttempts: 10,
        reconnection: true,
        path: "/socket.io/",
        auth: {
          token: t || null,
          timestamp: Date.now()
        },
        withCredentials: true
      });
      n.on("connect", () => {});
      n.on("video_generated", e => {
        try {
          showNotification(` ${e.video_title || "Your video"} has been generated successfully!`, "success");
          window.dispatchEvent(new CustomEvent("videoGenerated", {
            detail: {
              title: e.video_title,
              id: e.video_id
            }
          }));
        } catch (e) {
          console.error("Error handling video_generated event:", e);
        }
      });
      n.on("video_generation_error", e => {
        try {
          showNotification(` ${e.message || "Video generation failed"}`, "error");
          window.dispatchEvent(new CustomEvent("videoGenerationError", {
            detail: {
              message: e.message
            }
          }));
        } catch (e) {
          console.error("Error handling video_generation_error event:", e);
        }
      });
      n.on("video_generation_progress", e => {
        try {
          showNotification(` ${e.message || "Processing..."}`, "info");
          window.dispatchEvent(new CustomEvent("videoGenerationProgress", {
            detail: {
              progress: e.message
            }
          }));
        } catch (e) {
          console.error("Error handling video_generation_progress event:", e);
        }
      });
      let i = 0;
      const o = 5e3;
      n.on("connect_error", e => {
        console.error("Socket.IO connection error:", e);
      });
      n.on("disconnect", () => {});
      window.videoGenerationSocket = n;
    } catch (e) {
      console.error("Failed to initialize video generation socket:", e);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeVideoGenerationSocket);
  } else {
    initializeVideoGenerationSocket();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initSidebarState();
      initIndicatorTracking();
    });
  } else {
    initSidebarState();
    initIndicatorTracking();
  }
  function navigate(t, n) {
    if (t.classList.contains("disabled")) return;
    if (n === e) return;
    const i = document.getElementById("navContainer");
    const o = i.querySelectorAll(".nav-item");
    o.forEach(e => e.classList.remove("active"));
    t.classList.add("active");
    e = n;
    updateIndicator(t);
    try {
      localStorage.setItem("sidebarActiveIndex", n);
    } catch (e) {
      console.error("Failed to save sidebar state:", e);
    }
    const a = t.getAttribute("data-target");
    if (a) {
      try {
        localStorage.setItem("currentNavigationTarget", a);
      } catch (e) {}
      try {
        window.SolisFirstLanding?.markSeen?.();
      } catch (e) {}
      switchSection(a);
    }
  }
  window.navigate = navigate;
  let i = false;
  function switchSection(e, t) {
    const n = t || {};
    const i = n.keepVisible || null;
    try {
      if (e) localStorage.setItem("currentNavigationTarget", e);
    } catch (e) {}
    const o = document.getElementById("dashboardContainer");
    const a = document.getElementById("portalContainer");
    const s = document.getElementById("clipsContainer");
    const r = document.getElementById("customEditorContainer");
    const l = document.querySelector(".input-section");
    [ o, a, s, r ].forEach(e => {
      if (!e) return;
      if (i && e === i) return;
      e.style.display = "none";
      e.classList.remove("active");
    });
    if (l) {
      l.classList.remove("active");
      l.style.cssText = "display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; z-index: -10000 !important;";
    }
    const c = document.getElementById("clipsSubNav");
    const d = window.innerWidth <= 768;
    const u = e === "Portal";
    document.body.classList.toggle("mnav-on-portal", d && u);
    if (e === "dashboard" && o) {
      o.style.display = "block";
      o.classList.add("active");
      if (window.analyticsManager) window.analyticsManager.updateCharts();
      if (c && !d) c.style.display = "none";
    } else if (e === "Portal" && a) {
      a.style.display = "block";
      a.classList.add("active");
      if (c && !d) c.style.display = "none";
    } else if (e === "clips" && s) {
      s.style.display = "block";
      s.classList.add("active");
      if (c) {
        c.style.display = "";
        c.style.removeProperty("display");
      }
      if (window.clipsStudio && !window.clipsStudio.initialized) {
        window.clipsStudio.init();
      }
    }
    if (d && c) {
      c.style.display = "";
      c.style.removeProperty("display");
    }
  }
  function _clearMnavAnimClasses(e) {
    if (!e) return;
    e.classList.remove("mnav-section-anim", "mnav-enter-from-left", "mnav-enter-from-right", "mnav-exit-to-left", "mnav-exit-to-right");
    e.style.removeProperty("transform");
    e.style.removeProperty("opacity");
  }
  function transitionPortalTemplates(e) {
    if (window.innerWidth > 768) {
      if (e) {
        try {
          localStorage.setItem("currentNavigationTarget", "Portal");
        } catch (e) {}
        const e = document.querySelector('.nav-item[data-target="Portal"]');
        document.querySelectorAll(".nav-item[data-target]").forEach(e => e.classList.remove("active"));
        e?.classList.add("active");
        switchSection("Portal");
      } else {
        goMobileClipsTab("templates");
      }
      return;
    }
    if (i) return;
    const t = document.getElementById("portalContainer");
    const n = document.getElementById("clipsContainer");
    if (!t || !n) return;
    const o = e ? t : n;
    const a = e ? n : t;
    const s = e ? document.body.classList.contains("mnav-on-portal") : !document.body.classList.contains("mnav-on-portal") && n.classList.contains("active");
    if (s && !e) {
      goMobileClipsTab("templates");
      return;
    }
    if (s && e) return;
    i = true;
    o.style.display = "block";
    o.classList.add("active", "mnav-section-anim");
    a.classList.add("mnav-section-anim");
    void o.offsetWidth;
    o.classList.add(e ? "mnav-enter-from-left" : "mnav-enter-from-right");
    a.classList.add(e ? "mnav-exit-to-right" : "mnav-exit-to-left");
    document.body.classList.toggle("mnav-on-portal", e);
    if (e) {
      try {
        localStorage.setItem("currentNavigationTarget", "Portal");
      } catch (e) {}
      const e = document.querySelector('.nav-item[data-target="Portal"]');
      document.querySelectorAll(".nav-item[data-target]").forEach(e => e.classList.remove("active"));
      e?.classList.add("active");
      document.querySelectorAll(".clips-sub-item").forEach(e => {
        const t = e.getAttribute("data-tab") === "portal";
        e.classList.toggle("active", t);
        e.setAttribute("aria-selected", t ? "true" : "false");
      });
    } else {
      try {
        localStorage.setItem("currentNavigationTarget", "clips");
      } catch (e) {}
      const e = document.querySelector('.nav-item[data-target="clips"]');
      document.querySelectorAll(".nav-item[data-target]").forEach(e => e.classList.remove("active"));
      e?.classList.add("active");
      if (typeof window.switchClipsTab === "function") {
        const e = document.querySelector('.clips-sub-item[data-tab="templates"]');
        window.switchClipsTab("templates", e);
      }
      requestAnimationFrame(() => updateMobileClipsPillIndicator("templates"));
    }
    const finish = () => {
      _clearMnavAnimClasses(o);
      _clearMnavAnimClasses(a);
      a.style.display = "none";
      a.classList.remove("active");
      o.style.display = "block";
      o.classList.add("active");
      const t = document.getElementById("clipsSubNav");
      if (t) {
        t.style.display = "";
        t.style.removeProperty("display");
      }
      if (!e && window.clipsStudio && !window.clipsStudio.initialized) {
        window.clipsStudio.init();
      }
      i = false;
    };
    clearTimeout(transitionPortalTemplates._t);
    transitionPortalTemplates._t = setTimeout(finish, 420);
    if (window.navigator.vibrate) window.navigator.vibrate(8);
  }
  function goMobilePortal() {
    window.closeMobileNavMenu?.();
    window.closeMobileCreateSheet?.({
      immediate: true
    });
    transitionPortalTemplates(true);
  }
  function goMobileTemplatesFromPortal() {
    window.closeMobileNavMenu?.();
    transitionPortalTemplates(false);
  }
  function updateMobileClipsPillIndicator(e) {
    const t = document.getElementById("clipsSubPane");
    const n = document.querySelector(".clips-sub-pill");
    if (!t || !n || window.innerWidth > 768) return;
    const i = e || document.querySelector(".clips-sub-item.active")?.getAttribute("data-tab") || localStorage.getItem("clipsActiveTab") || "create";
    const o = document.querySelector(`.clips-sub-item[data-tab="${i}"]`);
    if (!o) return;
    const a = n.getBoundingClientRect();
    const s = o.getBoundingClientRect();
    t.style.width = `${s.width}px`;
    t.style.transform = `translateX(${s.left - a.left - 5}px)`;
    t.style.left = "5px";
  }
  function goMobileClipsTab(e, t) {
    try {
      localStorage.setItem("currentNavigationTarget", "clips");
    } catch (e) {}
    window.closeMobileNavMenu?.();
    if (e === "create") {
      if (window.innerWidth <= 768) {
        window.openMobileCreateSheet?.();
        return;
      }
    } else {
      window.closeMobileCreateSheet?.({
        immediate: true
      });
    }
    if (window.innerWidth <= 768 && document.body.classList.contains("mnav-on-portal") && e === "templates") {
      transitionPortalTemplates(false);
      return;
    }
    const n = [ "templates", "library" ];
    const i = document.querySelector(".clips-sub-item.active:not(.clips-sub-create)")?.getAttribute("data-tab") || localStorage.getItem("clipsActiveTab") || "templates";
    const o = n.indexOf(i === "create" ? "templates" : i);
    const a = n.indexOf(e);
    const s = a > o ? "left" : a < o ? "right" : null;
    switchSection("clips");
    const r = t || document.querySelector(`.clips-sub-item[data-tab="${e}"]`);
    if (typeof window.switchClipsTab === "function") {
      window.switchClipsTab(e, r);
    }
    const l = document.getElementById(`${e}Section`);
    if (l && s) {
      l.classList.remove("clips-slide-from-left", "clips-slide-from-right");
      void l.offsetWidth;
      l.classList.add(s === "left" ? "clips-slide-from-right" : "clips-slide-from-left");
      clearTimeout(l._clipsSlideT);
      l._clipsSlideT = setTimeout(() => {
        l.classList.remove("clips-slide-from-left", "clips-slide-from-right");
      }, 400);
    }
    requestAnimationFrame(() => updateMobileClipsPillIndicator(e));
    if (window.navigator.vibrate) window.navigator.vibrate(8);
  }
  function initMobileClipsSwipe() {
    const e = document.getElementById("clipsContainer") || document.querySelector(".main-content");
    if (!e || e.dataset.clipsSwipeBound === "1") return;
    e.dataset.clipsSwipeBound = "1";
    const t = [ "templates", "library" ];
    const n = 12;
    const i = 72;
    const o = .28;
    let a = 0;
    let s = 0;
    let r = 0;
    let l = false;
    let c = null;
    let d = null;
    let u = 0;
    function activeSectionEl() {
      return document.querySelector("#clipsContainer .clips-section.active") || document.querySelector(".clips-section.active");
    }
    function clearDragStyles(e, t) {
      if (!e) return;
      if (t) {
        e.classList.add("clips-drag-snap");
        e.style.transform = "";
        e.style.opacity = "";
        const done = () => {
          e.classList.remove("clips-drag", "clips-drag-snap");
          e.style.transition = "";
          e.removeEventListener("transitionend", done);
        };
        e.addEventListener("transitionend", done);
        setTimeout(done, 320);
      } else {
        e.classList.remove("clips-drag", "clips-drag-snap");
        e.style.transform = "";
        e.style.opacity = "";
        e.style.transition = "";
      }
    }
    function currentTabIndex() {
      const e = document.querySelector(".clips-sub-item.active:not(.clips-sub-create)");
      const n = e?.getAttribute("data-tab") || localStorage.getItem("clipsActiveTab") || "templates";
      const i = n === "create" ? "templates" : n;
      return t.indexOf(i);
    }
    e.addEventListener("touchstart", e => {
      if (window.innerWidth > 768) return;
      if (document.body.classList.contains("mnav-create-open")) return;
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"],' + ".preview-placeholder, .sub-text-block, .url-input-wrapper," + ".preview-timeline-wrap, .template-preview-modal, .stgModal," + ".mobile-clips-bar, .clips-sub-nav")) {
        l = false;
        return;
      }
      a = e.touches[0].clientX;
      s = e.touches[0].clientY;
      r = Date.now();
      l = true;
      c = null;
      u = 0;
      d = activeSectionEl();
    }, {
      passive: true
    });
    e.addEventListener("touchmove", e => {
      if (!l || window.innerWidth > 768) return;
      if (!e.touches || e.touches.length !== 1) return;
      const i = e.touches[0];
      const o = i.clientX - a;
      const r = i.clientY - s;
      if (!c) {
        if (Math.abs(o) < n && Math.abs(r) < n) return;
        if (Math.abs(r) >= Math.abs(o)) {
          c = "y";
          l = false;
          clearDragStyles(d, false);
          d = null;
          return;
        }
        c = "x";
        if (d) {
          d.classList.add("clips-drag");
          d.classList.remove("clips-drag-snap", "clips-slide-from-left", "clips-slide-from-right");
        }
      }
      if (c !== "x") return;
      if (e.cancelable) e.preventDefault();
      const m = currentTabIndex();
      let p = o;
      if (m <= 0 && o > 0) p = o * .62;
      if (m >= t.length - 1 && o < 0) p = o * .28;
      u = p;
      if (d) {
        const e = Math.max(.72, 1 - Math.abs(p) / (window.innerWidth * 1.4));
        d.style.transform = `translate3d(${p}px, 0, 0)`;
        d.style.opacity = String(e);
      }
    }, {
      passive: false
    });
    function finishSwipe(e) {
      if (!l && c !== "x") {
        c = null;
        d = null;
        return;
      }
      const n = c === "x";
      l = false;
      c = null;
      if (!n) {
        clearDragStyles(d, false);
        d = null;
        return;
      }
      const s = e.changedTouches && e.changedTouches[0];
      const m = s ? s.clientX - a : u;
      const p = Math.max(16, Date.now() - r);
      const f = Math.abs(m) / p;
      const v = Math.max(i, window.innerWidth * o);
      const w = Math.abs(m) >= v || Math.abs(m) > 42 && f > .55;
      const g = currentTabIndex();
      let h = g;
      const b = document.body.classList.contains("mnav-on-portal");
      if (w) {
        if (b) {
          if (m < 0) {
            clearDragStyles(d, false);
            d = null;
            goMobileTemplatesFromPortal();
            return;
          }
          clearDragStyles(d, true);
          d = null;
          return;
        }
        if (g === 0 && m > 0) {
          clearDragStyles(d, false);
          d = null;
          goMobilePortal();
          return;
        }
        h = m < 0 ? Math.min(t.length - 1, g + 1) : Math.max(0, g - 1);
      }
      if (h !== g) {
        clearDragStyles(d, false);
        d = null;
        goMobileClipsTab(t[h]);
        return;
      }
      clearDragStyles(d, true);
      d = null;
    }
    e.addEventListener("touchend", finishSwipe, {
      passive: true
    });
    e.addEventListener("touchcancel", finishSwipe, {
      passive: true
    });
  }
  window.updateMobileClipsPillIndicator = updateMobileClipsPillIndicator;
  window.goMobileClipsTab = goMobileClipsTab;
  window.goMobilePortal = goMobilePortal;
  window.goMobileTemplatesFromPortal = goMobileTemplatesFromPortal;
  window.handleNav = function(e, t) {
    if (!e || e.classList.contains("disabled") || e.disabled) return;
    const n = e.getAttribute("data-target");
    if (n === "clips") {
      const e = localStorage.getItem("clipsActiveTab");
      goMobileClipsTab(e && e !== "create" ? e : "templates");
      return;
    }
    localStorage.setItem("activeNavIndex", t);
    document.querySelectorAll(".nav-item[data-target]").forEach(e => e.classList.remove("active"));
    e.classList.add("active");
    if (n) switchSection(n);
  };
  window.closeMobileNavMenu = function() {
    const e = document.getElementById("mnavMenuBtn");
    const t = document.getElementById("mnavMenuSheet");
    const n = document.getElementById("mnavMenuBackdrop");
    if (t) {
      t.hidden = true;
      t.classList.remove("is-open");
      t.style.display = "none";
      t.setAttribute("aria-hidden", "true");
    }
    if (n) {
      n.hidden = true;
      n.classList.remove("is-open");
      n.style.display = "none";
      n.setAttribute("aria-hidden", "true");
    }
    if (e) {
      e.setAttribute("aria-expanded", "false");
      e.setAttribute("aria-label", "Open menu");
    }
  };
  window.openMobileNavMenu = function() {
    const e = document.getElementById("mnavMenuBtn");
    const t = document.getElementById("mnavMenuSheet");
    const n = document.getElementById("mnavMenuBackdrop");
    if (!t) return;
    const i = document.body.classList.contains("mnav-on-portal");
    const o = document.getElementById("clipsContainer")?.classList.contains("active");
    t.querySelectorAll("[data-mnav-go]").forEach(e => {
      const t = e.getAttribute("data-mnav-go");
      const n = t === "Portal" ? i : t === "clips" ? !i && o : false;
      e.classList.toggle("is-active", !!n);
    });
    t.hidden = false;
    t.classList.add("is-open");
    t.style.display = "flex";
    t.setAttribute("aria-hidden", "false");
    if (n) {
      n.hidden = false;
      n.classList.add("is-open");
      n.style.display = "block";
      n.setAttribute("aria-hidden", "false");
    }
    if (e) {
      e.setAttribute("aria-expanded", "true");
      e.setAttribute("aria-label", "Close menu");
    }
  };
  window.toggleMobileNavMenu = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (window.innerWidth > 768) return;
    const t = document.getElementById("mnavMenuSheet");
    if (!t) return;
    if (t.hidden) window.openMobileNavMenu(); else window.closeMobileNavMenu();
  };
  window.toggleNavWrapperCollapse = function() {};
  window.switchSection = switchSection;
  (function initMobileCreateSheetApi() {
    const e = 48;
    const t = 0;
    const n = 78;
    let i = e;
    let o = null;
    let a = false;
    let s = 0;
    let r = e;
    function els() {
      return {
        sheet: document.getElementById("mnavCreateSheet"),
        backdrop: document.getElementById("mnavCreateBackdrop"),
        body: document.getElementById("mnavCreateSheetBody"),
        grab: document.getElementById("mnavCreateGrab"),
        fab: document.getElementById("mnavCreateFab")
      };
    }
    function setSheetY(e) {
      i = Math.max(t, Math.min(110, e));
      const {sheet: n} = els();
      if (n) n.style.setProperty("--mnav-sheet-y", `${i}%`);
    }
    function ensureUrlInSheet() {
      const {body: e} = els();
      if (!e) return;
      const t = document.querySelector("#createSection .create-content") || document.querySelector(".create-content");
      if (t) {
        if (t.parentElement === e) return;
        o = {
          parent: t.parentElement,
          next: t.nextSibling
        };
        e.appendChild(t);
        return;
      }
      const n = document.querySelector(".url-input-container");
      if (!n || n.parentElement === e) return;
      o = {
        parent: n.parentElement,
        next: n.nextSibling
      };
      e.appendChild(n);
    }
    function restoreUrl() {
      const {body: e} = els();
      const t = e?.querySelector(".create-content");
      const n = t || e?.querySelector(".url-input-container");
      if (!n || !o?.parent) return;
      if (o.next && o.next.parentNode === o.parent) {
        o.parent.insertBefore(n, o.next);
      } else {
        o.parent.appendChild(n);
      }
    }
    window.openMobileCreateSheet = function() {
      if (window.innerWidth > 768) return;
      const {sheet: t, backdrop: n, fab: i} = els();
      if (!t) return;
      clearTimeout(t._mnavCloseT);
      window.closeMobileNavMenu?.();
      ensureUrlInSheet();
      t.classList.remove("is-revealed", "is-dragging");
      t.style.transition = "none";
      setSheetY(110);
      t.hidden = false;
      t.removeAttribute("hidden");
      t.classList.add("is-open");
      t.setAttribute("aria-hidden", "false");
      if (n) {
        n.hidden = false;
        n.removeAttribute("hidden");
        n.classList.add("is-open");
        n.setAttribute("aria-hidden", "false");
      }
      i?.classList.add("is-open");
      i?.setAttribute("aria-selected", "true");
      document.body.classList.add("mnav-create-open");
      document.documentElement.style.overflow = "hidden";
      void t.offsetWidth;
      t.style.transition = "";
      requestAnimationFrame(() => {
        setSheetY(e);
        t.classList.add("is-revealed");
      });
      setTimeout(() => {
        try {
          document.getElementById("youtubeUrlInput")?.focus?.({
            preventScroll: true
          });
        } catch (e) {}
      }, 420);
      if (window.navigator.vibrate) window.navigator.vibrate(8);
    };
    window.closeMobileCreateSheet = function(t) {
      const n = !!(t && t.immediate);
      const {sheet: o, backdrop: a, fab: s} = els();
      if (!o || !o.classList.contains("is-open") && o.hidden) {
        s?.classList.remove("is-open");
        document.body.classList.remove("mnav-create-open");
        document.documentElement.style.overflow = "";
        return;
      }
      clearTimeout(o._mnavCloseT);
      o.classList.remove("is-dragging", "is-revealed");
      s?.classList.remove("is-open");
      s?.setAttribute("aria-selected", "false");
      if (a) a.classList.remove("is-open");
      const finish = () => {
        o.classList.remove("is-open", "is-revealed");
        o.setAttribute("aria-hidden", "true");
        o.hidden = true;
        o.style.removeProperty("--mnav-sheet-y");
        o.style.transition = "";
        if (a) {
          a.hidden = true;
          a.setAttribute("aria-hidden", "true");
        }
        document.body.classList.remove("mnav-create-open");
        document.documentElement.style.overflow = "";
        restoreUrl();
        i = e;
      };
      if (n) {
        o.style.transition = "none";
        o.style.setProperty("--mnav-sheet-y", "110%");
        finish();
        return;
      }
      setSheetY(110);
      o._mnavCloseT = setTimeout(finish, 420);
    };
    window.toggleMobileCreateSheet = function(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (window.innerWidth > 768) return;
      const t = document.getElementById("mnavCreateSheet");
      if (t && !t.hidden && t.classList.contains("is-open")) {
        window.closeMobileCreateSheet();
      } else {
        window.openMobileCreateSheet();
      }
    };
    window.bindMobileCreateSheetUi = function() {
      const {sheet: o, backdrop: l, grab: c, fab: d, body: u} = els();
      if (!o || o.dataset.dragBound === "1") return;
      o.dataset.dragBound = "1";
      d?.addEventListener("click", e => window.toggleMobileCreateSheet(e));
      l?.addEventListener("click", () => window.closeMobileCreateSheet());
      let m = 0;
      let p = 0;
      let f = 0;
      let v = false;
      function unbindWin() {
        if (!v) return;
        v = false;
        window.removeEventListener("touchmove", onWinMove);
        window.removeEventListener("touchend", onWinEnd);
        window.removeEventListener("touchcancel", onWinEnd);
      }
      function onWinMove(e) {
        if (!a || !e.touches?.[0]) return;
        onMove(e.touches[0].clientY);
        if (e.cancelable) e.preventDefault();
      }
      function onWinEnd() {
        unbindWin();
        onEnd();
      }
      function onStart(e) {
        a = true;
        s = e;
        r = i;
        m = e;
        p = Date.now();
        f = 0;
        o.classList.add("is-dragging");
        if (!v) {
          v = true;
          window.addEventListener("touchmove", onWinMove, {
            passive: false
          });
          window.addEventListener("touchend", onWinEnd, {
            passive: true
          });
          window.addEventListener("touchcancel", onWinEnd, {
            passive: true
          });
        }
      }
      function onMove(e) {
        if (!a) return;
        const t = Date.now();
        const n = Math.max(16, t - p);
        f = (e - m) / n;
        m = e;
        p = t;
        const i = o.offsetHeight || window.innerHeight;
        const l = (e - s) / i * 100;
        setSheetY(r + l);
      }
      function onEnd() {
        if (!a) return;
        a = false;
        o.classList.remove("is-dragging");
        unbindWin();
        if (i >= n || i > 62 && f > .45) {
          window.closeMobileCreateSheet();
          return;
        }
        if (i <= 26 || f < -.45 && i < 55) {
          setSheetY(t);
        } else {
          setSheetY(e);
        }
      }
      function tryStartFromEvent(e) {
        if (!o.classList.contains("is-open")) return;
        if (!e.touches?.[0]) return;
        onStart(e.touches[0].clientY);
      }
      c?.addEventListener("touchstart", tryStartFromEvent, {
        passive: true
      });
      u?.addEventListener("touchstart", e => {
        if (!o.classList.contains("is-open")) return;
        if (u.scrollTop > 2) return;
        const t = e.target;
        if (t && t.closest && t.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
        tryStartFromEvent(e);
      }, {
        passive: true
      });
      c?.addEventListener("pointerdown", e => {
        if (e.pointerType === "touch") return;
        if (!o.classList.contains("is-open")) return;
        if (e.button !== 0) return;
        e.preventDefault();
        onStart(e.clientY);
        const move = e => onMove(e.clientY);
        const up = () => {
          onEnd();
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      });
    };
  })();
  document.addEventListener("DOMContentLoaded", function() {
    initMobileClipsSwipe();
    window.bindMobileCreateSheetUi?.();
    function syncMobileProfileInNav() {
      const e = document.getElementById("profileActionCluster");
      const t = document.getElementById("profileDropdownWr");
      const n = document.getElementById("notifWrapper") || document.querySelector(".profile-action-cluster > .notif-wrapper") || document.getElementById("bellBtn")?.closest(".notif-wrapper");
      const i = document.getElementById("navWrapper");
      const o = document.querySelector(".profile-notif-wrapper");
      if (!i || !o) return;
      const a = window.innerWidth <= 768;
      const s = i.querySelector(".clips-sub-pill");
      let r = document.getElementById("mnavSideActions") || i.querySelector(".mnav-side-actions");
      if (a) {
        const n = s?.querySelector(".clips-sub-side--right") || s || i;
        if (!r) {
          r = document.createElement("div");
          r.className = "mnav-side-actions";
          r.id = "mnavSideActions";
          n.appendChild(r);
        } else if (r.parentElement !== n) {
          n.appendChild(r);
        }
        document.getElementById("mnavMenuBtn")?.remove();
        if (e && e.parentElement !== r) {
          r.appendChild(e);
          document.getElementById("notificationsDropdown")?.classList.remove("open");
          document.getElementById("profileDropdown")?.classList.remove("open");
        } else {
          if (t && t.parentElement !== r && !e) {
            r.appendChild(t);
            document.getElementById("profileDropdown")?.classList.remove("open");
          }
        }
        r.querySelectorAll(".mnav-profile-label").forEach(e => e.remove());
      } else {
        window.closeMobileNavMenu?.();
        window.closeMobileCreateSheet?.();
        if (e && e.parentElement !== o) {
          o.appendChild(e);
          document.getElementById("profileDropdown")?.classList.remove("open");
          document.getElementById("notificationsDropdown")?.classList.remove("open");
        } else {
          if (n && n.parentElement !== o && !e) {
            const e = o.querySelector(".generation-progress-wrapper");
            if (e && e.nextSibling) o.insertBefore(n, e.nextSibling); else if (t && t.parentElement === o) o.insertBefore(n, t); else o.appendChild(n);
          }
          if (t && t.parentElement !== o && !e) {
            o.appendChild(t);
            document.getElementById("profileDropdown")?.classList.remove("open");
          }
        }
        r?.querySelectorAll(".mnav-profile-label").forEach(e => e.remove());
      }
    }
    syncMobileProfileInNav();
    window.addEventListener("resize", syncMobileProfileInNav);
    window.syncMobileProfileInNav = syncMobileProfileInNav;
    const e = document.getElementById("mnavMenuBtn");
    const t = document.getElementById("mnavMenuBackdrop");
    const n = document.getElementById("mnavMenuSheet");
    if (e) {
      e.addEventListener("click", e => window.toggleMobileNavMenu(e));
    }
    if (t) {
      t.addEventListener("click", () => window.closeMobileNavMenu());
    }
    if (n) {
      n.querySelectorAll("[data-mnav-go]").forEach(e => {
        e.addEventListener("click", () => {
          if (e.disabled || e.classList.contains("is-disabled")) return;
          const t = e.getAttribute("data-mnav-go");
          window.closeMobileNavMenu();
          if (t === "Portal") {
            goMobilePortal();
            return;
          }
          if (t === "clips") {
            const e = localStorage.getItem("clipsActiveTab");
            goMobileClipsTab(e && e !== "create" ? e : "templates");
            return;
          }
          const n = document.querySelector(`.nav-item[data-target="${t}"]`);
          if (n && typeof window.navigate === "function") {
            window.navigate(n, Number(n.dataset.index || 0));
          } else if (t) {
            switchSection(t);
          }
        });
      });
    }
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        window.closeMobileCreateSheet?.();
        window.closeMobileNavMenu?.();
      }
    });
    const wrapSwitchClipsTab = () => {
      if (typeof window.switchClipsTab !== "function" || window.switchClipsTab._mnavCreateWrapped) return;
      const e = window.switchClipsTab;
      const wrapped = function(t, n) {
        if (t === "create" && window.innerWidth <= 768) {
          window.openMobileCreateSheet?.();
          return;
        }
        if (window.innerWidth <= 768 && t !== "create") {
          window.closeMobileCreateSheet?.();
        }
        return e.call(this, t, n);
      };
      wrapped._mnavCreateWrapped = true;
      window.switchClipsTab = wrapped;
    };
    wrapSwitchClipsTab();
    setTimeout(wrapSwitchClipsTab, 0);
    setTimeout(wrapSwitchClipsTab, 400);
    const o = document.getElementById("portalContainer");
    if (o && !o.dataset.portalSwipeBound) {
      o.dataset.portalSwipeBound = "1";
      let e = 0, t = 0, n = 0, a = false, s = null;
      o.addEventListener("touchstart", o => {
        if (window.innerWidth > 768 || !document.body.classList.contains("mnav-on-portal")) return;
        if (i) return;
        if (!o.touches || o.touches.length !== 1) return;
        const r = o.target;
        if (r && r.closest && r.closest('input, textarea, select, [contenteditable="true"],' + ".stgModal, .mobile-clips-bar, .clips-sub-nav, .profile-dropdown-wr," + ".mnav-side-actions, .notif-wrapper")) {
          a = false;
          return;
        }
        e = o.touches[0].clientX;
        t = o.touches[0].clientY;
        n = Date.now();
        a = true;
        s = null;
      }, {
        passive: true
      });
      o.addEventListener("touchmove", n => {
        if (!a) return;
        const i = n.touches[0].clientX - e;
        const o = n.touches[0].clientY - t;
        if (!s) {
          if (Math.abs(i) < 12 && Math.abs(o) < 12) return;
          s = Math.abs(i) >= Math.abs(o) ? "x" : "y";
        }
        if (s === "x" && Math.abs(i) > 16) n.preventDefault();
      }, {
        passive: false
      });
      o.addEventListener("touchend", t => {
        if (!a) return;
        a = false;
        if (s !== "x") return;
        const i = (t.changedTouches?.[0]?.clientX ?? e) - e;
        const o = Math.max(16, Date.now() - n);
        const r = Math.abs(i) / o;
        if (i < -72 || i < -42 && r > .55) {
          goMobileTemplatesFromPortal();
        }
      }, {
        passive: true
      });
    }
    if (window.innerWidth <= 768) {
      const e = localStorage.getItem("clipsActiveTab");
      const t = e && e !== "create" ? e : "templates";
      goMobileClipsTab(t);
      requestAnimationFrame(() => updateMobileClipsPillIndicator(t));
    }
    window.addEventListener("resize", () => {
      if (window.innerWidth <= 768) updateMobileClipsPillIndicator();
    });
  });
})();
