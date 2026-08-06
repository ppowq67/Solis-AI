let userMenuPanel, userMenuBackdrop;

function isValidImageUrl(e) {
  if (!e || typeof e !== "string") return false;
  const t = e.trim().toLowerCase();
  if (t.startsWith("javascript:") || t.startsWith("data:") || t.startsWith("vbscript:")) return false;
  return t.startsWith("http://") || t.startsWith("https://") || !t.includes(":");
}

function escapeHtml(e) {
  if (typeof e !== "string") return "";
  const t = document.createElement("div");
  t.textContent = e;
  return t.innerHTML;
}

const apiCache = {
  userProfile: null,
  userProfileTime: 0,
  userProfileETag: null,
  CACHE_DURATION: 18e5,
  pendingProfileRequest: null,
  getUserProfile() {
    const e = Date.now();
    if (this.userProfile && e - this.userProfileTime < this.CACHE_DURATION) {
      return this.userProfile;
    }
    return null;
  },
  setUserProfile(e, t) {
    this.userProfile = e;
    this.userProfileTime = Date.now();
    this.userProfileETag = t;
  },
  getETag() {
    return this.userProfileETag;
  },
  getPendingRequest() {
    return this.pendingProfileRequest;
  },
  setPendingRequest(e) {
    this.pendingProfileRequest = e;
  },
  clearPendingRequest() {
    this.pendingProfileRequest = null;
  }
};

async function loadAndSetCurrentUser() {
  try {
    if (window.currentUser && userProfileIsComplete(window.currentUser)) {
      if (!window.currentUser.auth_provider) {
        await fetchAndAddAuthProvider();
      }
      return;
    }
    const e = apiCache.getUserProfile();
    if (e) {
      window.currentUser = e;
      updateMenuUserInfo();
      setTimeout(() => updateProfileButton(), 50);
      return;
    }
    localStorage.removeItem("currentUser");
    const t = apiCache.getPendingRequest();
    if (t) {
      const e = await t;
      if (e) {
        window.currentUser = e;
        updateMenuUserInfo();
        setTimeout(() => updateProfileButton(), 50);
      }
      return;
    }
    let n = {};
    if (typeof getAuthHeaders === "function") {
      n = getAuthHeaders();
    }
    const r = apiCache.getETag();
    if (r) {
      n["If-None-Match"] = r;
    } else {}
    const o = (async () => {
      try {
        const e = await window.apiRequestCache.dedupFetch(window.apiUrl("/api/user/profile"), {
          method: "POST",
          headers: n,
          credentials: "include",
          body: JSON.stringify({})
        });
        if (e.status === 304) {
          const e = apiCache.getUserProfile();
          if (e) {
            return e;
          }
        }
        if (e.status === 401) {
          console.warn("[401] Profile fetch unauthorized after retry");
          apiCache.userProfile = null;
          apiCache.userProfileETag = null;
          window.currentUser = null;
          return null;
        }
        if (e.ok) {
          const t = await e.json();
          const n = e.headers.get("ETag");
          if (n) {
            apiCache.setUserProfile(t, n);
          } else {
            apiCache.setUserProfile(t, null);
          }
          window.currentUser = t;
          localStorage.setItem("currentUser", JSON.stringify(t));
          updateMenuUserInfo();
          setTimeout(() => updateProfileButton(), 100);
          return t;
        } else {
          console.warn("Failed to fetch user profile:", e.status);
          await fetchAndAddAuthProvider();
          updateMenuUserInfo();
          setTimeout(() => updateProfileButton(), 100);
        }
      } catch (e) {
        console.error("Error in profile fetch:", e);
        await fetchAndAddAuthProvider();
        updateMenuUserInfo();
        setTimeout(() => updateProfileButton(), 100);
      } finally {
        apiCache.clearPendingRequest();
      }
    })();
    apiCache.setPendingRequest(o);
    await o;
  } catch (e) {
    console.error("Error loading current user:", e);
    apiCache.clearPendingRequest();
  }
}

async function fetchAndAddAuthProvider() {
  try {
    let e = {};
    if (typeof getAuthHeaders === "function") {
      e = getAuthHeaders();
    }
    const t = await fetch(window.apiUrl("/api/user/auth-provider"), {
      method: "POST",
      credentials: "include",
      headers: e,
      body: JSON.stringify({})
    });
    if (t.ok) {
      const e = await t.json();
      if (window.currentUser) {
        window.currentUser.auth_provider = e.auth_provider;
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        updateProfileButton();
      }
    }
  } catch (e) {
    console.error("Error fetching auth provider:", e);
  }
}

function openUserMenu() {
  if (!userMenuPanel) {
    userMenuPanel = document.getElementById("i259");
  }
  if (!userMenuBackdrop) {
    userMenuBackdrop = document.getElementById("i258");
  }
  if (!userMenuPanel || !userMenuBackdrop) {
    console.error("Menu elements not found");
    return;
  }
  userMenuPanel.classList.add("active");
  userMenuBackdrop.classList.add("active");
  const e = window.innerWidth <= 768 ? "100%" : "420px";
  const t = window.innerWidth <= 768 ? "-100%" : "-420px";
  userMenuPanel.style.cssText = `position: fixed !important; top: 0 !important; right: 0 !important; width: ${e} !important; height: 100vh !important; z-index: 9999 !important; display: flex !important; flex-direction: column !important; background: white !important; opacity: 1 !important; visibility: visible !important;`;
  userMenuBackdrop.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(28, 25, 23, 0.5) !important; z-index: 9998 !important; display: block !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;";
  document.body.style.overflow = "hidden";
  updateMenuUserInfo();
  setTimeout(() => updateProfileButton(), 50);
}

function closeUserMenuPanel() {
  if (!userMenuPanel) userMenuPanel = document.getElementById("i259");
  if (!userMenuBackdrop) userMenuBackdrop = document.getElementById("i258");
  userMenuPanel.classList.remove("active");
  userMenuBackdrop.classList.remove("active");
  const e = window.innerWidth <= 768 ? "100%" : "420px";
  const t = window.innerWidth <= 768 ? "-100%" : "-420px";
  userMenuPanel.style.cssText = `position: fixed !important; top: 0 !important; right: ${t} !important; width: ${e} !important; height: 100vh !important; z-index: 9999 !important; display: flex !important; flex-direction: column !important; background: white !important; opacity: 1 !important; visibility: visible !important;`;
  userMenuBackdrop.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(28, 25, 23, 0.5) !important; z-index: 9998 !important; display: block !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;";
  document.body.style.overflow = "";
}

function updateProfileButton() {
  const e = document.getElementById("i208");
  if (!e) {
    console.warn("profileAvatarBtn element not found");
    return;
  }
  let t = null;
  try {
    if (typeof window !== "undefined" && window.currentUser) {
      t = window.currentUser;
    } else {
      const e = localStorage.getItem("currentUser");
      if (e) t = JSON.parse(e);
    }
  } catch (e) {
    console.error("Failed to read currentUser for profile button", e);
    return;
  }
  const n = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(t) : t?.picture || t?.avatar || t?.photo || t?.profilePicture || null;
  const r = t?.name || t?.displayName || t?.email || "User";
  const o = t?.auth_provider || "email";
  if (o && o.toLowerCase().includes("google")) {
    e.innerHTML = `\n            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">\n                \x3c!-- Gmail/Google icon --\x3e\n                <rect width="24" height="24" fill="none"/>\n                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#EA4335"/>\n            </svg>\n        `;
    return;
  }
  if (t && n && n.trim() !== "" && isValidImageUrl(n)) {
    const t = document.createElement("img");
    t.src = n;
    t.alt = r;
    t.style.cssText = "width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;";
    t.onerror = () => {
      console.warn("Failed to load profile image, keeping SVG");
    };
    t.onload = () => {};
    const o = document.createElement("div");
    o.appendChild(t);
    e.innerHTML = o.innerHTML;
  } else {}
}

async function updateProfileDropdown() {
  const e = document.getElementById("i1rd");
  const t = document.getElementById("i1re");
  const n = document.getElementById("i1rc");
  let r = null;
  try {
    if (typeof window !== "undefined" && window.currentUser) {
      r = window.currentUser;
    } else {
      const e = localStorage.getItem("currentUser");
      if (e) r = JSON.parse(e);
    }
  } catch (e) {
    console.error("Failed to read currentUser for dropdown", e);
    return;
  }
  if (!r) {
    const n = e?.querySelector(".c1kj");
    if (n) n.textContent = "Guest User";
    if (t) t.textContent = "Free Plan";
    return;
  }
  const o = r.name || r.displayName || r.email || "User";
  const i = e?.querySelector(".c1kj");
  if (i) i.textContent = o;
  try {
    const e = await fetch(window.apiUrl("/api/user/profile"), {
      method: "POST",
      credentials: "include",
      headers: typeof getAuthHeaders === "function" ? getAuthHeaders() : {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    if (e.ok) {
      const t = await e.json();
      const n = t.plan || r.plan || "Free";
      const o = n.charAt(0).toUpperCase() + n.slice(1) + " Plan";
      const i = document.getElementById("i1re");
      if (i) {
        i.textContent = o;
      } else {
        console.warn("dropdownUserPlan element not found!");
      }
      if (window.currentUser) window.currentUser.plan = n;
    } else {
      console.warn("Profile API returned non-ok status:", e.status);
      const t = r.plan || "Free";
      const n = t.charAt(0).toUpperCase() + t.slice(1) + " Plan";
      const o = document.getElementById("i1re");
      if (o) {
        o.textContent = n;
      }
    }
  } catch (e) {
    console.error("Failed to fetch plan info:", e);
    const t = r.plan || "Free";
    const n = t.charAt(0).toUpperCase() + t.slice(1) + " Plan";
    const o = document.getElementById("i1re");
    if (o) {
      o.textContent = n;
    }
  }
  const s = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(r) : r?.picture || r?.avatar || r?.photo || null;
  if (n) {
    if (s && s.trim() !== "") {
      const e = document.createElement("img");
      e.src = s;
      e.alt = o;
      e.style.cssText = "width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;";
      e.onerror = () => {
        console.warn("Failed to load dropdown avatar image");
      };
      n.innerHTML = "";
      n.appendChild(e);
    }
  }
}

function updateMenuUserInfo() {
  const e = document.getElementById("menuUserName");
  const t = document.getElementById("menuUserEmail");
  const n = document.getElementById("menuUserAvatar");
  const r = document.getElementById("profileNameDisplay");
  const o = document.getElementById("emailDisplay");
  let i = null;
  try {
    if (typeof window !== "undefined" && window.currentUser) {
      i = window.currentUser;
    } else {
      const e = localStorage.getItem("currentUser");
      if (e) i = JSON.parse(e);
    }
  } catch (e) {
    console.error("menu: failed to read currentUser", e);
    i = null;
  }
  const s = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(i) : i?.picture || i?.avatar || i?.photo || i?.profilePicture || null;
  if (i) {
    const a = i.name || i.displayName || i.first_name || i.firstName || "User";
    const l = i.email || i.username || "";
    if (e) e.textContent = a;
    if (t) t.textContent = l;
    if (r) r.textContent = a;
    if (o) o.textContent = l;
    if (n) {
      if (s && isValidImageUrl(s)) {
        n.innerHTML = "";
        const e = document.createElement("img");
        e.src = s;
        e.alt = a;
        e.style.cssText = "width: 100%; height: 100%; object-fit: cover; border-radius: 50%;";
        e.onerror = () => {
          console.warn("Failed to load menu avatar image");
        };
        n.appendChild(e);
      } else {}
    }
  } else {
    if (e) e.textContent = "Guest User";
    if (t) t.textContent = "unknown@gmail.com";
    if (r) r.textContent = "Guest User";
    if (o) o.textContent = "unknown@gmail.com";
  }
  updateProfileDropdown();
}

function initUserMenu() {
  userMenuPanel = document.getElementById("i259");
  userMenuBackdrop = document.getElementById("i258");
  const e = document.getElementById("closeUserMenu");
  const t = document.getElementById("menuSubscription");
  const n = document.getElementById("menuPreferences");
  const r = document.getElementById("menuHelp");
  const o = document.getElementById("menuFeedback");
  const i = document.getElementById("menuLogout");
  const s = document.getElementById("menuViewProfile");
  const a = document.getElementById("menuMyContent");
  const l = document.getElementById("editProfileNameBtn");
  const u = document.getElementById("editEmailBtn");
  const c = document.getElementById("changePasswordBtn");
  if (!userMenuPanel) {
    console.error("menu: ERROR - userMenuPanel not found!");
    return;
  }
  updateProfileButton();
  updateProfileDropdown();
  loadAndSetCurrentUser();
  if (e) {
    e.addEventListener("click", e => {
      e.stopPropagation();
      closeUserMenuPanel();
    });
  } else {
    console.warn("Close button element not found with ID: closeUserMenu");
  }
  if (userMenuBackdrop) {
    userMenuBackdrop.addEventListener("click", closeUserMenuPanel);
  }
  if (n) {
    n.addEventListener("click", () => {});
  }
  const d = document.getElementById("notificationsToggle");
  if (d) {
    d.addEventListener("click", e => {
      e.stopPropagation();
      d.classList.toggle("active");
      const t = d.querySelector("div");
      if (t) {
        if (d.classList.contains("active")) {
          t.style.right = "3px";
        } else {
          t.style.right = "21px";
        }
      }
    });
  }
  if (d && d.classList.contains("active")) {
    const e = d.querySelector("div");
    if (e) e.style.right = "3px";
  }
  if (l) {
    l.addEventListener("click", e => {
      e.stopPropagation();
    });
  }
  if (u) {
    u.addEventListener("click", e => {
      e.stopPropagation();
    });
  }
  if (c) {
    c.addEventListener("click", e => {
      e.stopPropagation();
    });
  }
  if (r) {
    r.addEventListener("click", () => {
      closeUserMenuPanel();
      window.open("https://discord.gg/vtPJtQhjNy", "_blank");
    });
  }
  if (o) {
    o.addEventListener("click", () => {
      closeUserMenuPanel();
    });
  }
  if (s) {
    s.addEventListener("click", () => {
      closeUserMenuPanel();
      window.location.href = "/dashboard.html";
    });
  }
  if (a) {
    a.addEventListener("click", () => {
      closeUserMenuPanel();
    });
  }
  if (i) {
    i.addEventListener("click", () => {
      if (window._logoutInProgress) return;
      if (typeof window._comprehensiveLogout === "function") {
        window._comprehensiveLogout();
        return;
      }
      closeUserMenuPanel();
      try {
        if (typeof clearUserData === "function") clearUserData();
      } catch (e) {}
      window._logoutInProgress = true;
      localStorage.clear();
      sessionStorage.clear();
      apiCache.userProfile = null;
      apiCache.userProfileETag = null;
      apiCache.userProfileTime = 0;
      window.currentUser = null;
      sessionStorage.setItem("solis_just_logged_out", "1");
      sessionStorage.setItem("solis_skip_auth_redirect", "1");
      const e = window.apiUrl ? window.apiUrl("/api/auth/logout") : (window.API_BASE_URL || window.location.origin + "/api") + "/auth/logout";
      fetch(e, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      }).catch(() => {}).finally(() => {
        window.location.replace("/login.html?logout=1");
      });
    });
  }
  window.addEventListener("storage", e => {
    if (e.key === "currentUser") {
      updateProfileButton();
    }
  });
  document.addEventListener("user-login", () => {
    updateProfileButton();
  });
  document.addEventListener("user-logout", () => {
    updateProfileButton();
  });
  window.solisMenuDebug = {
    openUserMenu: openUserMenu,
    closeUserMenuPanel: closeUserMenuPanel,
    userMenuPanel: userMenuPanel,
    userMenuBackdrop: userMenuBackdrop,
    updateProfileButton: updateProfileButton,
    closeUserMenuBtn: e
  };
}

let menuInitialized = false;

function initializeMenu() {
  if (menuInitialized) {
    return;
  }
  menuInitialized = true;
  initUserMenu();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMenu);
} else {
  initializeMenu();
}

function userProfileIsComplete(e) {
  return Boolean(e && typeof e.plan === "string" && e.id != null && typeof e.email === "string");
}

async function getOrFetchCurrentUser() {
  if (userProfileIsComplete(window.currentUser)) {
    return window.currentUser;
  }
  for (let e = 0; e < 50; e++) {
    await new Promise(e => setTimeout(e, 100));
    if (userProfileIsComplete(window.currentUser)) {
      return window.currentUser;
    }
  }
  const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {
    "Content-Type": "application/json"
  };
  try {
    const t = await (window.apiRequestCache?.dedupFetch("/api/user/profile", {
      method: "POST",
      credentials: "include",
      headers: e,
      body: JSON.stringify({})
    })) || await fetch(window.apiUrl("/api/user/profile"), {
      method: "POST",
      credentials: "include",
      headers: e,
      body: JSON.stringify({})
    });
    if (t.ok) {
      const e = await t.json();
      window.currentUser = e;
      return e;
    }
  } catch (e) {
    console.error("Failed to fetch user profile:", e);
  }
  return null;
}
