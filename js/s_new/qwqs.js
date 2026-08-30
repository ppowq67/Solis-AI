window.addEventListener("load", function() {
  const e = document.getElementById("loadingOverlay");
  if (!e) return;
  setTimeout(function() {
    e.classList.add("hidden");
  }, 500);
});

let paddleRetryCount = 0;

const MAX_PADDLE_RETRIES = 3;

async function initPaddle() {
  if (window.paddleInitialized) return;
  const e = await window.paddleManager.init();
  if (!e) {
    paddleRetryCount++;
    if (paddleRetryCount >= MAX_PADDLE_RETRIES) {
      console.error("Failed to initialize Paddle after " + MAX_PADDLE_RETRIES + " retries");
      console.error("Please check if backend is running and /api/payment/paddle-config endpoint exists");
      return;
    }
    setTimeout(initPaddle, 2e3);
    return;
  }
  window.addEventListener("paddle:checkoutComplete", async e => {
    window.paymentSucceeded = true;
    history.replaceState({}, document.title, window.location.pathname);
    await handleCheckoutSuccess(e.detail);
  });
  window.addEventListener("paddle:checkoutError", () => {
    alert("Checkout could not be completed. Please try again or use a different card.");
  });
  window.paddleInitialized = true;
}

window.handleCheckoutSuccess = async function(e) {
  const n = window.pendingPlanUpgrade;
  if (!n) {
    console.error("[PAYMENT] No pending plan upgrade found");
    return;
  }
  const t = typeof window.apiUrl === "function" ? window.apiUrl("/api/auth/check") : "/api/auth/check";
  const o = await fetch(t, {
    method: "GET",
    credentials: "include"
  });
  if (!o.ok) {
    if (typeof window.openAuthModal === "function") {
      window.openAuthModal();
    } else {
      window.location.href = "/?login=1";
    }
    return;
  }
  const a = await window.PaymentFlow.completeCheckout(e);
  if (!a.ok) {
    alert(a.error || "Payment activation failed. Check your dashboard shortly.");
    return;
  }
  if (typeof window.showPaymentSuccessModal === "function") {
    window.showPaymentSuccessModal(a.plan || n);
  }
  setTimeout(() => {
    window.location.href = "/premium?payment=success&plan=" + encodeURIComponent(a.plan || n);
  }, 1800);
};

let checkoutRetryCount = 0;

const MAX_CHECKOUT_RETRIES = 24;

window.openPaddleCheckout = async function(e, n, t) {
  const o = currentAuthenticatedUser || window.currentAuthenticatedUser;
  if (!o) {
    if (typeof window.openAuthModal === "function") {
      window.openAuthModal();
    } else {
      window.location.href = "/?login=1";
    }
    return;
  }
  if (!window.paddleInitialized) {
    checkoutRetryCount++;
    if (checkoutRetryCount > MAX_CHECKOUT_RETRIES) {
      alert("Payment system failed to load. Please refresh the page and try again.");
      checkoutRetryCount = 0;
      return;
    }
    if (checkoutRetryCount === 1 || checkoutRetryCount % 4 === 0) {
      initPaddle();
    }
    setTimeout(() => window.openPaddleCheckout(e, n, t), 500);
    return;
  }
  checkoutRetryCount = 0;
  const a = t?.currentTarget || t?.target;
  const i = a?.textContent;
  if (a) {
    a.disabled = true;
    a.textContent = "Opening checkout…";
  }
  try {
    await window.PaymentFlow.openCheckout(e, n, t);
  } catch (e) {
    console.error("Checkout error:", e);
    alert(e.message || "Could not open checkout. Please try again.");
  } finally {
    if (a) {
      a.disabled = false;
      if (i) a.textContent = i;
    }
  }
};

window.showPaymentSuccessModal = function(e) {
  const n = document.getElementById("payment-success-modal");
  if (n) n.remove();
  createConfetti();
  const t = document.createElement("div");
  t.className = "payment-success-modal";
  t.id = "payment-success-modal";
  t.style.cssText = `\n                position: fixed;\n                top: 0;\n                left: 0;\n                right: 0;\n                bottom: 0;\n                background: rgba(0, 0, 0, 0.7);\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                z-index: 999999;\n                backdrop-filter: blur(6px);\n            `;
  const o = e.charAt(0).toUpperCase() + e.slice(1);
  t.innerHTML = `\n                <div style="\n                    background: white;\n                    border-radius: 32px;\n                    padding: 56px 48px;\n                    text-align: center;\n                    max-width: 480px;\n                    box-shadow: 0 25px 50px rgba(0,0,0,0.2);\n                    position: relative;\n                    border: 1px solid rgba(255,255,255,0.4);\n                    animation: modalSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);\n                ">\n                    <button style="\n                        position: absolute;\n                        top: 24px;\n                        right: 24px;\n                        background: transparent;\n                        border: none;\n                        font-size: 1.5rem;\n                        color: #94a3b8;\n                        cursor: pointer;\n                        transition: color 0.2s ease;\n                        padding: 0;\n                        width: 32px;\n                        height: 32px;\n                        display: flex;\n                        align-items: center;\n                        justify-content: center;\n                        font-family: 'Plus Jakarta Sans', sans-serif;\n                    "\n                    onmouseover="this.style.color='#f97316';"\n                    onmouseout="this.style.color='#94a3b8';"\n                    onclick="document.getElementById('payment-success-modal').remove();">✕</button>\n\n                    <div style="\n                        width: 88px;\n                        height: 88px;\n                        border-radius: 50%;\n                        background: linear-gradient(135deg, #f97316, #ea580c);\n                        display: flex;\n                        align-items: center;\n                        justify-content: center;\n                        margin: 0 auto 32px;\n                        font-size: 3rem;\n                        color: white;\n                        box-shadow: 0 12px 32px rgba(249, 115, 22, 0.35);\n                        animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);\n                    ">🎉</div>\n\n                    <h2 style="\n                        font-size: 1.875rem;\n                        font-weight: 800;\n                        color: #0f172a;\n                        margin-bottom: 12px;\n                        font-family: 'Plus Jakarta Sans', sans-serif;\n                        letter-spacing: -0.02em;\n                    ">Welcome aboard!</h2>\n\n                    <p style="\n                        font-size: 1.1rem;\n                        color: #ea580c;\n                        margin-bottom: 28px;\n                        font-weight: 700;\n                        letter-spacing: 0.5px;\n                    ">${o} Plan Unlocked ✨</p>\n\n                    <div style="\n                        padding: 20px;\n                        background: linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(234, 88, 12, 0.05));\n                        border-radius: 20px;\n                        margin-bottom: 28px;\n                        border: 1px solid rgba(249, 115, 22, 0.15);\n                    ">\n                        <p style="\n                            font-size: 0.9rem;\n                            color: #64748b;\n                            margin: 0;\n                            line-height: 1.6;\n                            font-weight: 500;\n                        ">Thank you for supporting Solis! You now have access to premium features and enhanced capabilities.</p>\n                    </div>\n\n                    <p style="\n                        font-size: 0.85rem;\n                        color: #94a3b8;\n                        margin: 0;\n                        font-weight: 500;\n                    ">Redirecting to dashboard...</p>\n                </div>\n                </div>\n            `;
  document.body.appendChild(t);
};

function createConfetti() {
  const e = [ "#FF9671", "#FFD4C4", "#FF7A50", "#FF6B9D", "#C44569", "#6DDCCF", "#4ECDC4", "#B8A9E5", "#EA580C", "#F97316" ];
  const n = 80;
  const t = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };
  for (let o = 0; o < n; o++) {
    const a = document.createElement("div");
    const i = o / n * Math.PI * 2;
    const r = Math.random() * 8 + 6;
    const c = Math.random() * 8 + 4;
    const s = 150;
    const d = Math.cos(i) * s * r;
    const l = Math.sin(i) * s * r + 100;
    a.style.cssText = `\n                    position: fixed;\n                    width: ${c}px;\n                    height: ${c}px;\n                    background-color: ${e[Math.floor(Math.random() * e.length)]};\n                    left: ${t.x}px;\n                    top: ${t.y}px;\n                    pointer-events: none;\n                    z-index: 99999;\n                    border-radius: 50%;\n                    animation: confetti-burst 2.5s ease-out forwards;\n                    --endX: ${d}px;\n                    --endY: ${l}px;\n                    animation-delay: ${Math.random() * .1}s;\n                `;
    document.body.appendChild(a);
    setTimeout(() => a.remove(), 2700);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  checkAuthenticationAndInit();
  setTimeout(initPaddle, 1e3);
});

let currentAuthenticatedUser = null;

let authCheckCache = null;

let authCheckCacheTime = 0;

const AUTH_CHECK_CACHE_DURATION = 6e4;

async function checkAuthenticationAndInit() {
  try {
    const e = Date.now();
    if (authCheckCache !== null && e - authCheckCacheTime < AUTH_CHECK_CACHE_DURATION) {
      if (authCheckCache.authenticated && authCheckCache.user) {
        currentAuthenticatedUser = authCheckCache.user;
        window.currentAuthenticatedUser = authCheckCache.user;
        loadUserProfile(authCheckCache.user);
      } else {
        console.warn("Cache says user NOT authenticated");
        showAuthError();
      }
      return;
    }
    const n = typeof window.apiUrl === "function" ? window.apiUrl("/api/auth/check") : "/api/auth/check";
    const t = await fetch(n, {
      method: "GET",
      credentials: "include"
    });
    if (t.ok) {
      const e = await t.json();
      authCheckCache = e;
      authCheckCacheTime = Date.now();
      if (e.authenticated && e.user) {
        currentAuthenticatedUser = e.user;
        window.currentAuthenticatedUser = e.user;
        loadUserProfile(e.user);
        return;
      } else {
        console.warn("Response OK but not authenticated");
      }
    } else {
      console.error("Auth check failed with status:", t.status);
      const e = await t.text();
      console.error("Response body:", e);
    }
    showAuthError();
  } catch (e) {
    console.error("Auth check exception:", e);
    console.error("Error details:", e.message, e.stack);
    showAuthError();
  }
}

function showAuthError() {
  console.warn("User not authenticated on pricing page");
  document.querySelector(".nav-login")?.style && (document.querySelector(".nav-login").style.display = "block");
}

const DEFAULT_AVATAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

function setProfileAvatar(e, n, t) {
  if (!e) return;
  e.innerHTML = "";
  if (n) {
    const o = document.createElement("img");
    o.src = n;
    o.alt = t || "Profile";
    o.onerror = () => {
      e.innerHTML = DEFAULT_AVATAR_SVG;
    };
    e.appendChild(o);
  } else {
    e.innerHTML = DEFAULT_AVATAR_SVG;
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const e = document.getElementById("profileAvatarBtn");
  const n = document.getElementById("profileDropdown");
  const t = document.getElementById("profileDropdownWr");
  if (e) {
    e.addEventListener("click", function(e) {
      e.stopPropagation();
      n?.classList.toggle("open");
    });
  }
  document.addEventListener("click", function(e) {
    if (t && t.contains(e.target)) return;
    n?.classList.remove("open");
  });
});

function loadUserProfile(e) {
  try {
    const n = document.getElementById("profileDropdownWr");
    const t = document.querySelector(".nav-login");
    const o = document.querySelector(".nav-cta");
    if (e && e.email) {
      if (n) n.style.display = "flex";
      if (t) t.style.display = "none";
      if (o) o.style.display = "none";
      const a = e.username || e.name || e.email.split("@")[0] || "User";
      const i = (e.plan || "free").toString();
      const r = i.charAt(0).toUpperCase() + i.slice(1).toLowerCase() + " Plan";
      const c = typeof resolveAvatarUrl === "function" ? resolveAvatarUrl(e) : e.picture || e.avatar || null;
      const s = c || `https://ui-avatars.com/api/?name=${encodeURIComponent(a)}&background=ea580c&color=fff&bold=true`;
      setProfileAvatar(document.getElementById("profileAvatarBtn"), s, a);
      setProfileAvatar(document.getElementById("dropdownUserAvatar"), s, a);
      const d = document.getElementById("dropdownUserName");
      if (d) {
        const e = d.querySelector(".username-text");
        if (e) e.textContent = a;
      }
      const l = document.getElementById("dropdownUserPlan");
      if (l) l.textContent = r;
      if (typeof window.applyPremiumCurrentPlan === "function") {
        window.applyPremiumCurrentPlan(i);
      }
    } else {
      if (n) n.style.display = "none";
      if (t) t.style.display = "";
      if (o) o.style.display = "";
      console.error("User data not found");
    }
  } catch (e) {
    console.error("Error loading user profile:", e);
  }
}

function handleLogout() {
  if (window._logoutInProgress) return;
  window._logoutInProgress = true;
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  sessionStorage.clear();
  const e = window.API_BASE_URL || "/api";
  const n = typeof window.apiUrl === "function" ? window.apiUrl("/api/auth/logout") : e.endsWith("/api") ? e + "/auth/logout" : e + "/api/auth/logout";
  sessionStorage.setItem("solis_just_logged_out", "1");
  sessionStorage.setItem("solis_skip_auth_redirect", "1");
  fetch(n, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    }
  }).catch(() => {}).finally(() => {
    window.location.replace("/login.html?logout=1");
  });
}

document.addEventListener("DOMContentLoaded", function() {
  const e = document.getElementById("dropdownLogout");
  if (e) {
    e.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      const n = document.getElementById("profileDropdown");
      if (n) n.classList.remove("open");
      handleLogout();
    });
  } else {
    console.error("Logout link not found in DOM");
  }
});
