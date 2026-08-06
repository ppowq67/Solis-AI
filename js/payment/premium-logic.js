const subscriptionCache = {
  data: null,
  timestamp: 0,
  ttl: 3e4
};

window.addEventListener("message", function(n) {
  if (n.origin !== window.location.origin) return;
  if (n.data && n.data.type === "PAYMENT_SUCCESS") {
    const {plan: t} = n.data;
    handlePaymentSuccessOnDashboard(t);
  }
});

async function handlePaymentSuccessOnDashboard(n) {
  try {
    createConfettiEffect();
    showPaymentSuccessModalOnDashboard(n);
    try {
      const n = await fetch(`${window.API_BASE_URL}/auth/subscription`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (n.ok) {
        const t = await n.json();
        if (!t || typeof t !== "object" || !t.subscription) {
          throw new Error("Invalid subscription response");
        }
        subscriptionCache.data = t.subscription;
        subscriptionCache.timestamp = Date.now();
        if (t.subscription && t.subscription.plan && typeof t.subscription.plan === "string") {
          const n = JSON.parse(localStorage.getItem("currentUser") || "{}");
          n.plan = t.subscription.plan.toLowerCase();
          localStorage.setItem("currentUser", JSON.stringify(n));
        }
        updateStorageDisplayOnDashboard(t.subscription);
      } else {
        throw new Error(`HTTP ${n.status}`);
      }
    } catch (n) {
      console.error("Error handling payment success:", n);
    }
  } catch (n) {
    console.error("Error in payment success handler:", n);
  }
}

function createConfettiEffect() {
  const n = [ "#FF9671", "#FFD4C4", "#FF7A50", "#FF6B9D", "#C44569", "#6DDCCF", "#4ECDC4", "#B8A9E5", "#FFD700", "#FF69B4", "#00CED1", "#FF4500" ];
  const t = [ "circle", "square", "triangle" ];
  const e = 100;
  for (let o = 0; o < e; o++) {
    const e = document.createElement("div");
    e.className = "confetti-particle";
    const o = t[Math.floor(Math.random() * t.length)];
    const a = n[Math.floor(Math.random() * n.length)];
    const i = Math.random() * 12 + 6;
    let r, s, d, c;
    const l = Math.floor(Math.random() * 3);
    if (l === 0) {
      r = Math.random() * 100;
      s = -10;
      d = 45 + Math.random() * 10;
      c = 40 + Math.random() * 20;
    } else if (l === 1) {
      r = -10;
      s = 60 + Math.random() * 40;
      d = 45 + Math.random() * 10;
      c = 40 + Math.random() * 20;
    } else {
      r = 110;
      s = 60 + Math.random() * 40;
      d = 45 + Math.random() * 10;
      c = 40 + Math.random() * 20;
    }
    let p = "";
    if (o === "circle") {
      p = `border-radius: 50%;`;
    } else if (o === "triangle") {
      p = `clip-path: polygon(50% 0%, 0% 100%, 100% 100%);`;
    }
    e.style.cssText = `\n            position: fixed;\n            width: ${i}px;\n            height: ${i}px;\n            background-color: ${a};\n            ${p}\n            left: ${r}%;\n            top: ${s}%;\n            pointer-events: none;\n            z-index: 9999;\n            animation: confetti-explosion 2.5s ease-out forwards;\n            animation-delay: ${Math.random() * .5}s;\n            --end-left: ${d}%;\n            --end-top: ${c}%;\n        `;
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 3e3);
  }
}

function showPaymentSuccessModalOnDashboard(n) {
  if (!n || typeof n !== "string" || n.length === 0) {
    console.warn("Invalid plan name for modal");
    n = "your plan";
  }
  const t = document.getElementById("dashboard-payment-success-modal");
  if (t) {
    t.remove();
  }
  const e = n.charAt(0).toUpperCase() + n.slice(1);
  const o = document.createElement("div");
  o.id = "dashboard-payment-success-modal";
  o.style.cssText = `\n        position: fixed;\n        top: 0;\n        left: 0;\n        right: 0;\n        bottom: 0;\n        background: rgba(0, 0, 0, 0.85);\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        z-index: 999999;\n        animation: fadeIn 0.3s ease;\n        backdrop-filter: blur(8px);\n    `;
  o.innerHTML = `\n        <div style="\n            background: white;\n            border-radius: 24px;\n            padding: 60px 40px;\n            text-align: center;\n            max-width: 550px;\n            max-height: 90vh;\n            overflow-y: auto;\n            animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);\n        ">\n            <button style="\n                position: absolute;\n                top: 15px;\n                right: 15px;\n                z-index: 1000;\n                background: none;\n                border: none;\n                font-size: 1.5rem;\n                color: #718096;\n                cursor: pointer;\n            " onclick="document.getElementById('dashboard-payment-success-modal').remove();">\n                <i class="fas fa-times"></i>\n            </button>\n\n            <div style="\n                width: 100px;\n                height: 100px;\n                border-radius: 50%;\n                background: linear-gradient(135deg, #6DDCCF, #4ECDC4);\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                margin: 0 auto 30px;\n                font-size: 3rem;\n                color: white;\n            ">\n                <i class="fas fa-check"></i>\n            </div>\n\n            <h2 style="\n                font-size: 2rem;\n                font-weight: 900;\n                color: #1A1A2E;\n                margin-bottom: 8px;\n            ">Thank You!</h2>\n\n            <p style="\n                font-size: 1rem;\n                color: #718096;\n                margin-bottom: 24px;\n            ">Your payment was successful</p>\n\n            <div style="\n                text-align: left;\n                padding: 24px;\n                background: #f7f7f7;\n                border-radius: 16px;\n                margin: 24px 0;\n            ">\n                <p style="font-size: 0.9rem; margin-bottom: 12px;">🎉 Congratulations!</p>\n                <p style="font-size: 1.1rem; font-weight: 800; margin-bottom: 8px;">You've upgraded to the</p>\n                <div style="font-size: 1.5rem; margin: 8px 0; font-weight: bold; color: #FF9671;">${e} Plan</div>\n\n                <div style="text-align: left; margin-top: 16px; padding-top: 16px; border-top: 2px solid rgba(255, 150, 113, 0.2);">\n                    <p style="font-size: 0.9rem; font-weight: 700; margin-bottom: 12px;">✨ What's Included:</p>\n                    <ul style="\n                        font-size: 0.85rem;\n                        line-height: 1.8;\n                        margin-left: 0;\n                        list-style: none;\n                        color: #2D3748;\n                    ">\n                        <li>✓ Priority access to new features</li>\n                        <li>✓ Enhanced video generation capabilities</li>\n                        <li>✓ Premium templates and customization</li>\n                        <li>✓ Advanced AI-powered hashtag generation</li>\n                        <li>✓ Priority customer support</li>\n                        <li>✓ Exclusive automation tools</li>\n                        <li>✓ Extended storage capacity</li>\n                    </ul>\n                </div>\n\n                <p style="\n                    font-size: 0.9rem;\n                    margin-top: 16px;\n                    padding-top: 16px;\n                    border-top: 2px solid rgba(255, 150, 113, 0.2);\n                    color: #718096;\n                ">\n                    💡 Your ${e} plan features are now active and ready to use!\n                </p>\n            </div>\n\n            <button onclick="document.getElementById('dashboard-payment-success-modal').remove();" style="\n                background: linear-gradient(135deg, #FF9671, #FF7A50);\n                color: white;\n                border: none;\n                padding: 14px 32px;\n                border-radius: 12px;\n                font-weight: 700;\n                font-size: 1rem;\n                cursor: pointer;\n                transition: all 0.3s ease;\n                margin-top: 24px;\n            " onmouseover="this.style.background = 'linear-gradient(135deg, #FF7A50, #FF5533)'" onmouseout="this.style.background = 'linear-gradient(135deg, #FF9671, #FF7A50)'">\n                Continue to Dashboard\n            </button>\n        </div>\n    `;
  document.body.appendChild(o);
}

function updateStorageDisplayOnDashboard(n) {
  if (!n) return;
  const t = {
    free: {
      videosStorage: 2,
      storage: "2GB",
      uploadDuration: 30,
      videosPerDay: 1
    },
    basic: {
      videosStorage: 10,
      storage: "5GB",
      uploadDuration: 45,
      videosPerDay: 3
    },
    prime: {
      videosStorage: 20,
      storage: "10GB",
      uploadDuration: 120,
      videosPerDay: 5
    },
    elite: {
      videosStorage: 100,
      storage: "50GB",
      uploadDuration: 240,
      videosPerDay: 10
    }
  };
  const e = n.plan || "free";
  const o = t[e] || t.free;
  const a = document.getElementById("i23k");
  const i = document.getElementById("i23j");
  const r = document.getElementById("i23i");
  let s = 0;
  if (window.clipsStudio && window.clipsStudio.libraryItems) {
    s = window.clipsStudio.libraryItems.length;
  }
  const d = n.video_limit || o.videosStorage;
  const c = n.plan_name || e.charAt(0).toUpperCase() + e.slice(1);
  if (typeof window.applyStorageBadgeUI === "function") {
    window.applyStorageBadgeUI({
      used: s,
      limit: d,
      plan: e
    });
  } else {
    if (a) a.textContent = s;
    if (i) i.textContent = d;
    if (r) r.textContent = c;
  }
  updateDashboardStorageInfo(n);
  if (window.clipsStudio && typeof window.clipsStudio.loadAndDisplayStorageInfo === "function") {
    window.clipsStudio.loadAndDisplayStorageInfo();
  }
}

function updateDashboardStorageInfo(n) {}

async function refreshUserSubscriptionInfo() {
  try {
    const n = await fetch(`${window.API_BASE_URL}/auth/subscription`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (n.ok) {
      const t = await n.json();
      if (t && t.subscription && typeof t.subscription.plan === "string") {
        const n = JSON.parse(localStorage.getItem("currentUser") || "{}");
        n.plan = t.subscription.plan;
        localStorage.setItem("currentUser", JSON.stringify(n));
      }
      return t.subscription;
    }
  } catch (n) {
    console.error("Error refreshing subscription:", n);
  }
  return null;
}

if (!document.getElementById("premium-logic-styles")) {
  const n = document.createElement("style");
  n.id = "premium-logic-styles";
  n.textContent = `\n        @keyframes confetti-explosion {\n            0% {\n                transform: translate(0, 0) rotate(0deg) scale(1);\n                opacity: 1;\n            }\n            30% {\n                transform: translate(var(--end-left), var(--end-top)) rotate(180deg) scale(1.2);\n                opacity: 1;\n            }\n            60% {\n                transform: translate(var(--end-left), calc(var(--end-top) + 100px)) rotate(360deg) scale(0.8);\n                opacity: 0.8;\n            }\n            100% {\n                transform: translate(var(--end-left), calc(var(--end-top) + 300px)) rotate(720deg) scale(0.5);\n                opacity: 0;\n            }\n        }\n\n        @keyframes fadeIn {\n            from { opacity: 0; }\n            to { opacity: 1; }\n        }\n\n        @keyframes slideUp {\n            from {\n                opacity: 0;\n                transform: translateY(30px);\n            }\n            to {\n                opacity: 1;\n                transform: translateY(0);\n            }\n        }\n\n        .confetti-particle {\n            animation: confetti-explosion 2.5s ease-out forwards !important;\n        }\n    `;
  document.head.appendChild(n);
}

window.handlePaymentSuccessOnDashboard = handlePaymentSuccessOnDashboard;

window.refreshUserSubscriptionInfo = refreshUserSubscriptionInfo;
