function showPaymentSuccessModal() {
  const n = document.createElement("div");
  n.style.cssText = `\n        position: fixed;\n        top: 0;\n        left: 0;\n        right: 0;\n        bottom: 0;\n        background: rgba(0, 0, 0, 0.85);\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        z-index: 9999999;\n        backdrop-filter: blur(8px);\n    `;
  const t = document.createElement("div");
  t.style.cssText = `\n        background: linear-gradient(135deg, #FF9671 0%, #FF7A50 50%, #FF6B9D 100%);\n        border-radius: 20px;\n        padding: 40px;\n        max-width: 500px;\n        text-align: center;\n        color: white;\n        font-family: 'Poppins', sans-serif;\n        box-shadow: 0 0 40px rgba(255, 107, 157, 0.4), 0 20px 60px rgba(0, 0, 0, 0.3);\n        animation: modalSlideIn 0.6s ease-out;\n        border: 2px solid rgba(255, 255, 255, 0.2);\n    `;
  t.innerHTML = `\n        <div style="font-size: 70px; margin-bottom: 20px; animation: bounce 0.6s ease-out;">🎉</div>\n        <h2 style="font-size: 32px; margin: 0 0 10px 0; font-weight: 800; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);">Thank You!</h2>\n        <p style="font-size: 16px; margin: 0 0 20px 0; opacity: 0.95; line-height: 1.6;">\n            Your plan has been upgraded successfully. Enjoy unlimited access to all features!\n        </p>\n        <div style="font-size: 15px; opacity: 0.9; background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 10px; backdrop-filter: blur(10px);">\n            📊 Your storage and video limits have been updated.\n        </div>\n    `;
  n.appendChild(t);
  document.body.appendChild(n);
  if (!document.getElementById("paymentModalStyles")) {
    const n = document.createElement("style");
    n.id = "paymentModalStyles";
    n.textContent = `\n            @keyframes modalSlideIn {\n                from {\n                    opacity: 0;\n                    transform: scale(0.85) translateY(-30px);\n                }\n                to {\n                    opacity: 1;\n                    transform: scale(1) translateY(0);\n                }\n            }\n\n            @keyframes bounce {\n                0%, 100% {\n                    transform: translateY(0);\n                }\n                50% {\n                    transform: translateY(-20px);\n                }\n            }\n\n            @keyframes confetti-fall {\n                to {\n                    transform: translateY(100vh) rotate(720deg);\n                    opacity: 0;\n                }\n            }\n        `;
    document.head.appendChild(n);
  }
  setTimeout(() => {
    n.style.opacity = "0";
    n.style.transition = "opacity 0.5s ease-out";
    setTimeout(() => n.remove(), 500);
  }, 4e3);
}

function createConfetti() {
  const n = 80;
  const t = [ "#FF9671", "#FFD4C4", "#FF7A50", "#FF6B9D", "#FF8C42", "#FF6B35", "#FFB627", "#FF9671" ];
  for (let e = 0; e < n; e++) {
    const n = document.createElement("div");
    const a = t[Math.floor(Math.random() * t.length)];
    const o = Math.random() * 15 + 8;
    const s = 2.5 + Math.random() * 1.5;
    const r = Math.random() * .8;
    const i = Math.random() * 720;
    const d = Math.random() * 100 - 50;
    n.style.cssText = `\n            position: fixed;\n            width: ${o}px;\n            height: ${o}px;\n            background: ${a};\n            left: ${Math.random() * 100}%;\n            top: -20px;\n            border-radius: ${Math.random() > .5 ? "50%" : "3px"};\n            pointer-events: none;\n            z-index: 9999999;\n            animation: confetti-fall-${e} ${s}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;\n            animation-delay: ${r}s;\n            opacity: 1;\n            box-shadow: 0 0 ${o * .8}px ${a}, 0 0 ${o * 1.2}px ${a}99;\n            filter: drop-shadow(0 0 3px ${a});\n        `;
    document.body.appendChild(n);
    if (!document.getElementById(`confetti-keyframes-${e}`)) {
      const n = document.createElement("style");
      n.id = `confetti-keyframes-${e}`;
      n.textContent = `\n                @keyframes confetti-fall-${e} {\n                    0% {\n                        transform: translateY(0) translateX(0) rotate(0deg) scale(1);\n                        opacity: 1;\n                    }\n                    50% {\n                        opacity: 1;\n                    }\n                    100% {\n                        transform: translateY(100vh) translateX(${d}px) rotate(${i}deg) scale(0);\n                        opacity: 0;\n                    }\n                }\n            `;
      document.head.appendChild(n);
    }
  }
}
