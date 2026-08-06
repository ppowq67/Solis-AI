(function() {
  let e = 0;
  let t;
  let i;
  const updateIndicator = e => {};
  function initSidebarState() {
    try {
      const t = document.getElementById("navContainer");
      if (!t) return;
      const i = localStorage.getItem("sidebarActiveIndex");
      const n = t.querySelectorAll(".nav-item");
      const o = i !== null ? parseInt(i, 10) : -1;
      const a = o >= 0 ? n[o] : null;
      if (a && !a.classList.contains("disabled")) {
        e = o;
        n.forEach(e => e.classList.remove("active"));
        a.classList.add("active");
        setTimeout(() => updateIndicator(a), 0);
        const t = a.getAttribute("data-target");
        if (t) switchSection(t);
      } else {
        const t = Array.from(n).find(e => !e.classList.contains("disabled"));
        if (t) {
          e = Array.from(n).indexOf(t);
          n.forEach(e => e.classList.remove("active"));
          t.classList.add("active");
          setTimeout(() => updateIndicator(t), 0);
          const i = t.getAttribute("data-target");
          if (i) switchSection(i);
        }
        if (a && a.classList.contains("disabled")) {
          localStorage.removeItem("sidebarActiveIndex");
        }
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
    if (i) i.disconnect();
    i = new MutationObserver(e => {
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
      i.observe(e, {
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
    const i = document.getElementById("notificationContainer") || createNotificationContainer();
    const n = document.createElement("div");
    const o = [ "success", "error", "warning", "info" ].includes(t) ? t : "info";
    n.className = `notification notification-${o} ${o}`;
    n.innerHTML = `\n                <div class="notification-content">\n                    <span class="notification-message"></span>\n                </div>\n            `;
    n.querySelector(".notification-message").textContent = String(e || "");
    i.appendChild(n);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => n.classList.add("show"));
    });
    setTimeout(() => {
      n.classList.remove("show");
      n.classList.add("is-leaving");
      setTimeout(() => n.remove(), 320);
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
      const e = window.location.host;
      const t = window.location.protocol === "https:" ? "wss:" : "ws:";
      const i = `${t}//${e}`;
      let n = sessionStorage.getItem("auth_token") || sessionStorage.getItem("jwt_token") || localStorage.getItem("auth_token");
      const o = io(i, {
        transports: [ "websocket", "polling" ],
        reconnectionDelay: 1e3,
        reconnectionAttempts: 10,
        reconnection: true,
        path: "/socket.io/",
        auth: {
          token: n || null,
          timestamp: Date.now()
        },
        withCredentials: true
      });
      o.on("connect", () => {});
      o.on("video_generated", e => {
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
      o.on("video_generation_error", e => {
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
      o.on("video_generation_progress", e => {
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
      let a = 0;
      const s = 5e3;
      o.on("connect_error", e => {
        console.error("Socket.IO connection error:", e);
      });
      o.on("disconnect", () => {});
      window.videoGenerationSocket = o;
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
  function navigate(t, i) {
    if (t.classList.contains("disabled")) return;
    if (i === e) return;
    const n = document.getElementById("navContainer");
    const o = n.querySelectorAll(".nav-item");
    o.forEach(e => e.classList.remove("active"));
    t.classList.add("active");
    e = i;
    updateIndicator(t);
    try {
      localStorage.setItem("sidebarActiveIndex", i);
    } catch (e) {
      console.error("Failed to save sidebar state:", e);
    }
    const a = t.getAttribute("data-target");
    if (a) {
      switchSection(a);
    }
  }
  window.navigate = navigate;
  let n = false;
  function switchSection(e, t) {
    const i = t || {};
    const n = i.keepVisible || null;
    const o = document.getElementById("dashboardContainer");
    const a = document.getElementById("portalContainer");
    const s = document.getElementById("clipsContainer");
    const r = document.getElementById("customEditorContainer");
    const l = document.querySelector(".input-section");
    [ o, a, s, r ].forEach(e => {
      if (!e) return;
      if (n && e === n) return;
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
    if (n) return;
    const t = document.getElementById("portalContainer");
    const i = document.getElementById("clipsContainer");
    if (!t || !i) return;
    const o = e ? t : i;
    const a = e ? i : t;
    const s = e ? document.body.classList.contains("mnav-on-portal") : !document.body.classList.contains("mnav-on-portal") && i.classList.contains("active");
    if (s && !e) {
      goMobileClipsTab("templates");
      return;
    }
    if (s && e) return;
    n = true;
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
      document.querySelectorAll(".clips-sub-item").forEach(e => e.classList.remove("active"));
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
      n = false;
    };
    clearTimeout(transitionPortalTemplates._t);
    transitionPortalTemplates._t = setTimeout(finish, 420);
    if (window.navigator.vibrate) window.navigator.vibrate(8);
  }
  function goMobilePortal() {
    transitionPortalTemplates(true);
  }
  function goMobileTemplatesFromPortal() {
    transitionPortalTemplates(false);
  }
  function updateMobileClipsPillIndicator(e) {
    const t = document.getElementById("clipsSubPane");
    const i = document.querySelector(".clips-sub-pill");
    if (!t || !i || window.innerWidth > 768) return;
    const n = e || document.querySelector(".clips-sub-item.active")?.getAttribute("data-tab") || localStorage.getItem("clipsActiveTab") || "templates";
    const o = document.querySelector(`.clips-sub-item[data-tab="${n}"]`);
    if (!o) return;
    const a = i.getBoundingClientRect();
    const s = o.getBoundingClientRect();
    t.style.width = `${s.width}px`;
    t.style.transform = `translateX(${s.left - a.left - 5}px)`;
    t.style.left = "5px";
  }
  function goMobileClipsTab(e, t) {
    try {
      localStorage.setItem("currentNavigationTarget", "clips");
    } catch (e) {}
    if (window.innerWidth <= 768 && document.body.classList.contains("mnav-on-portal") && e === "templates") {
      transitionPortalTemplates(false);
      return;
    }
    const i = [ "templates", "create", "library" ];
    const n = document.querySelector(".clips-sub-item.active")?.getAttribute("data-tab") || localStorage.getItem("clipsActiveTab") || "templates";
    const o = i.indexOf(n);
    const a = i.indexOf(e);
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
    const t = [ "templates", "create", "library" ];
    const i = 12;
    const n = 72;
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
      const e = document.querySelector(".clips-sub-item.active");
      const i = e?.getAttribute("data-tab") || localStorage.getItem("clipsActiveTab") || "templates";
      return t.indexOf(i);
    }
    e.addEventListener("touchstart", e => {
      if (window.innerWidth > 768) return;
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
      const n = e.touches[0];
      const o = n.clientX - a;
      const r = n.clientY - s;
      if (!c) {
        if (Math.abs(o) < i && Math.abs(r) < i) return;
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
      const i = c === "x";
      l = false;
      c = null;
      if (!i) {
        clearDragStyles(d, false);
        d = null;
        return;
      }
      const s = e.changedTouches && e.changedTouches[0];
      const m = s ? s.clientX - a : u;
      const p = Math.max(16, Date.now() - r);
      const f = Math.abs(m) / p;
      const v = Math.max(n, window.innerWidth * o);
      const w = Math.abs(m) >= v || Math.abs(m) > 42 && f > .55;
      const g = currentTabIndex();
      let h = g;
      const y = document.body.classList.contains("mnav-on-portal");
      if (w) {
        if (y) {
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
    const i = e.getAttribute("data-target");
    if (i === "clips") {
      goMobileClipsTab(localStorage.getItem("clipsActiveTab") || "templates");
      return;
    }
    localStorage.setItem("activeNavIndex", t);
    document.querySelectorAll(".nav-item[data-target]").forEach(e => e.classList.remove("active"));
    e.classList.add("active");
    if (i) switchSection(i);
  };
  window.closeMobileNavMenu = function() {};
  window.openMobileNavMenu = function() {};
  window.toggleMobileNavMenu = function() {};
  window.toggleNavWrapperCollapse = function() {};
  window.switchSection = switchSection;
  document.addEventListener("DOMContentLoaded", function() {
    initMobileClipsSwipe();
    function syncMobileProfileInNav() {
      const e = document.getElementById("profileActionCluster");
      const t = document.getElementById("profileDropdownWr");
      const i = document.getElementById("notifWrapper") || document.querySelector(".profile-action-cluster > .notif-wrapper") || document.getElementById("bellBtn")?.closest(".notif-wrapper");
      const n = document.getElementById("navWrapper");
      const o = document.querySelector(".profile-notif-wrapper");
      if (!n || !o) return;
      const a = window.innerWidth <= 768;
      let s = document.getElementById("mnavSideActions") || n.querySelector(".mnav-side-actions");
      if (a) {
        if (!s) {
          s = document.createElement("div");
          s.className = "mnav-side-actions";
          s.id = "mnavSideActions";
          n.appendChild(s);
        } else if (s.parentElement !== n) {
          n.appendChild(s);
        }
        if (e && e.parentElement !== s) {
          s.appendChild(e);
          document.getElementById("notificationsDropdown")?.classList.remove("open");
          document.getElementById("profileDropdown")?.classList.remove("open");
        } else {
          if (i && i.parentElement !== s && !e) {
            s.appendChild(i);
            document.getElementById("notificationsDropdown")?.classList.remove("open");
          }
          if (t && t.parentElement !== s && !e) {
            s.appendChild(t);
            document.getElementById("profileDropdown")?.classList.remove("open");
          }
        }
      } else {
        if (e && e.parentElement !== o) {
          o.appendChild(e);
          document.getElementById("profileDropdown")?.classList.remove("open");
          document.getElementById("notificationsDropdown")?.classList.remove("open");
        } else {
          if (i && i.parentElement !== o && !e) {
            const e = o.querySelector(".generation-progress-wrapper");
            if (e && e.nextSibling) o.insertBefore(i, e.nextSibling); else if (t && t.parentElement === o) o.insertBefore(i, t); else o.appendChild(i);
          }
          if (t && t.parentElement !== o && !e) {
            o.appendChild(t);
            document.getElementById("profileDropdown")?.classList.remove("open");
          }
        }
        if (s && !s.children.length) s.remove();
      }
    }
    syncMobileProfileInNav();
    window.addEventListener("resize", syncMobileProfileInNav);
    window.syncMobileProfileInNav = syncMobileProfileInNav;
    const e = document.getElementById("portalContainer");
    if (e && !e.dataset.portalSwipeBound) {
      e.dataset.portalSwipeBound = "1";
      let t = 0, i = 0, o = 0, a = false, s = null;
      e.addEventListener("touchstart", e => {
        if (window.innerWidth > 768 || !document.body.classList.contains("mnav-on-portal")) return;
        if (n) return;
        if (!e.touches || e.touches.length !== 1) return;
        const r = e.target;
        if (r && r.closest && r.closest('input, textarea, select, [contenteditable="true"],' + ".stgModal, .mobile-clips-bar, .clips-sub-nav, .profile-dropdown-wr," + ".mnav-side-actions, .notif-wrapper")) {
          a = false;
          return;
        }
        t = e.touches[0].clientX;
        i = e.touches[0].clientY;
        o = Date.now();
        a = true;
        s = null;
      }, {
        passive: true
      });
      e.addEventListener("touchmove", e => {
        if (!a) return;
        const n = e.touches[0].clientX - t;
        const o = e.touches[0].clientY - i;
        if (!s) {
          if (Math.abs(n) < 12 && Math.abs(o) < 12) return;
          s = Math.abs(n) >= Math.abs(o) ? "x" : "y";
        }
        if (s === "x" && Math.abs(n) > 16) e.preventDefault();
      }, {
        passive: false
      });
      e.addEventListener("touchend", e => {
        if (!a) return;
        a = false;
        if (s !== "x") return;
        const i = (e.changedTouches?.[0]?.clientX ?? t) - t;
        const n = Math.max(16, Date.now() - o);
        const r = Math.abs(i) / n;
        if (i < -72 || i < -42 && r > .55) {
          goMobileTemplatesFromPortal();
        }
      }, {
        passive: true
      });
    }
    if (window.innerWidth <= 768) {
      const e = localStorage.getItem("clipsActiveTab") || "templates";
      goMobileClipsTab(e);
      requestAnimationFrame(() => updateMobileClipsPillIndicator(e));
    }
    window.addEventListener("resize", () => {
      if (window.innerWidth <= 768) updateMobileClipsPillIndicator();
    });
  });
})();
