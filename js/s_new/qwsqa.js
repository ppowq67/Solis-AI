const VALIDATION = {
  MAX_STRING_LENGTH: 500,
  MAX_EMAIL_LENGTH: 254,
  MAX_USERNAME_LENGTH: 100,
  MAX_ERROR_MSG_LENGTH: 200,
  ALLOWED_PLANS: [ "free", "basic", "prime", "elite" ],
  MAX_VIDEOS_LIMIT: 1e3,
  MAX_STORAGE_GB: 1e4
};

window.sanitizeString = function(e) {
  if (typeof e !== "string") return "";
  const t = e.substring(0, VALIDATION.MAX_STRING_LENGTH);
  const o = document.createElement("div");
  o.textContent = t;
  return o.innerHTML;
};

window.validateNumber = function(e, t = 0, o = Infinity, n = 0) {
  if (typeof e !== "number" || isNaN(e)) return n;
  return Math.max(t, Math.min(o, e));
};

window.getSafeErrorMessage = function(e) {
  if (!e) return "An error occurred";
  if (e.code === "RATE_LIMIT") return "Too many requests. Please try again later.";
  if (e.code === "AUTH_FAILED") return "Authentication failed. Please log in again.";
  if (e.code === "PERMISSION_DENIED") return "You do not have permission for this action.";
  if (e.code === "SERVER_ERROR") return "Server error. Please try again later.";
  return "Operation failed. Please try again.";
};

window.isValidImageUrl = function(e) {
  if (!e || typeof e !== "string") return false;
  const t = e.trim();
  const o = t.toLowerCase();
  if (o.startsWith("javascript:") || o.startsWith("vbscript:") || o.startsWith("data:")) {
    return false;
  }
  if (t.startsWith("/") && !t.startsWith("//")) {
    return true;
  }
  try {
    const e = new URL(t, window.location.href);
    return e.protocol === "https:" || e.protocol === "http:";
  } catch {
    return false;
  }
};

window.validateUserObject = function(e) {
  if (!e || typeof e !== "object") return null;
  const t = [ "name", "email", "username", "picture", "avatar", "photo", "plan", "id", "tier", "youtube_connected", "bio" ];
  const o = {};
  for (const n of t) {
    if (e.hasOwnProperty(n)) {
      const t = e[n];
      if (n === "email" && typeof t === "string") {
        if (t.length > VALIDATION.MAX_EMAIL_LENGTH) return null;
        o[n] = window.sanitizeString(t);
      } else if (n === "username" && typeof t === "string") {
        if (t.length > VALIDATION.MAX_USERNAME_LENGTH) return null;
        o[n] = window.sanitizeString(t);
      } else if ((n === "name" || n === "picture" || n === "avatar" || n === "photo") && typeof t === "string") {
        if (t.length > VALIDATION.MAX_STRING_LENGTH) return null;
        o[n] = window.sanitizeString(t);
      } else if (n === "plan" && typeof t === "string") {
        if (!VALIDATION.ALLOWED_PLANS.includes(t.toLowerCase())) return null;
        o[n] = t.toLowerCase();
      } else if ((n === "id" || n === "tier") && (typeof t === "string" || typeof t === "number")) {
        o[n] = t;
      } else if (n === "youtube_connected" && typeof t === "boolean") {
        o[n] = t;
      } else if (n === "bio" && typeof t === "string") {
        if (t.length > 120) return null;
        o[n] = window.sanitizeString(t);
      }
    }
  }
  if (!o.id && !o.email) return null;
  return o;
};

window.handleSecureLogout = function() {
  if (typeof window._comprehensiveLogout === "function") {
    window._comprehensiveLogout();
    return;
  }
  if (window._logoutInProgress) return;
  window._logoutInProgress = true;
  sessionStorage.setItem("solis_just_logged_out", "1");
  sessionStorage.setItem("solis_skip_auth_redirect", "1");
  fetch(window.apiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    }
  }).catch(() => {}).finally(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userSubscription");
    window.currentUser = null;
    window.location.replace("/login.html?logout=1");
  });
};

async function updateProfileDropdown(e) {
  if (!e) {
    console.warn("No user provided to updateProfileDropdown");
    return;
  }
  const t = window.validateUserObject(e);
  if (!t) {
    console.warn("User object failed validation, skipping dropdown update");
    return;
  }
  const o = document.getElementById("dropdownUserName");
  const n = document.getElementById("dropdownUserPlan");
  const r = document.getElementById("dropdownUserAvatar");
  if (o) {
    const e = t.name || t.username || t.email || "Guest User";
    let n = o.querySelector(".username-text");
    if (!n) {
      n = document.createElement("span");
      n.className = "username-text";
      o.insertBefore(n, o.firstChild);
    }
    n.textContent = e;
  }
  let i = "Free";
  try {
    const e = await window.apiRequestCache.dedupFetch(window.apiUrl("/api/user/profile"), {
      method: "POST",
      credentials: "include",
      headers: window.secureHeaders(),
      body: JSON.stringify({})
    });
    if (e.ok) {
      const t = await e.json();
      if (t && typeof t === "object" && t.plan && typeof t.plan === "string" && t.plan.length > 0) {
        const e = t.plan.toLowerCase();
        if (VALIDATION.ALLOWED_PLANS.includes(e)) {
          i = e;
        } else {
          console.warn("Invalid plan from backend:", t.plan);
        }
      } else {
        console.warn("Invalid response structure from /api/user/profile");
      }
    } else {
      console.warn("Failed to fetch profile from backend:", e.status);
    }
  } catch (e) {
    console.warn("Could not fetch plan from backend, using safe default:", e);
  }
  if (n && typeof i === "string" && i.length > 0) {
    const e = i.charAt(0).toUpperCase() + i.slice(1).toLowerCase();
    const t = `${e} Plan`;
    n.textContent = t;
  }
  const a = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(t) : t.picture || t.avatar || t.photo || null;
  if (r) {
    if (a && window.isValidImageUrl(a)) {
      r.innerHTML = "";
      const e = document.createElement("img");
      e.src = a;
      e.alt = t.name || "Profile";
      e.style.cssText = "width: 100%; height: 100%; object-fit: cover; border-radius: 50%;";
      e.onerror = () => {
        console.warn("Failed to load profile image");
        r.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
      };
      r.appendChild(e);
    } else {
      r.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
    }
  }
}

window.updateProfileDropdown = updateProfileDropdown;

document.addEventListener("DOMContentLoaded", () => {
  const e = document.getElementById("profileAvatarBtn");
  const t = document.getElementById("profileDropdown");
  const o = document.getElementById("profileDropdownWr");
  if (e) {
    e.addEventListener("click", e => {
      e.stopPropagation();
      const o = document.getElementById("notificationsDropdown");
      if (o) o.classList.remove("open");
      if (t) {
        t.classList.toggle("open");
      }
    });
  } else {
    console.warn("profileAvatarBtn element not found");
  }
  document.addEventListener("click", e => {
    if (o && o.contains(e.target)) {
      return;
    }
    if (t) {
      t.classList.remove("open");
    }
  });
  const n = document.getElementById("dropdownBilling");
  const r = document.getElementById("dropdownPricing");
  const i = document.getElementById("dropdownLogout");
  if (r) {
    r.addEventListener("click", e => {
      e.preventDefault();
      if (t) t.classList.remove("open");
      window.location.href = "/premium.html";
    });
  }
  let a = null;
  try {
    if (window.currentUser) {
      a = window.validateUserObject(window.currentUser);
    }
    if (!a) {
      const e = localStorage.getItem("currentUser");
      if (e) {
        try {
          const t = JSON.parse(e);
          a = window.validateUserObject(t);
        } catch (e) {
          console.error("Failed to parse localStorage currentUser:", e);
        }
      }
    }
    if (a) {
      updateProfileDropdown(a);
    } else {
      console.warn("No valid user data available for dropdown");
    }
  } catch (e) {
    console.error("Error loading user data for dropdown:", e);
  }
});
