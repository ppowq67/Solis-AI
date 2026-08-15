(function initSolisBadges(e) {
  "use strict";
  function apiBase() {
    if (e.API_BASE_URL) return String(e.API_BASE_URL).replace(/\/$/, "");
    const t = e.location?.hostname || "";
    const n = t === "localhost" || t === "127.0.0.1";
    return n ? `http://${t}:5500/api` : "https://api.solisai.video/api";
  }
  function resolveUserRef(e) {
    if (e == null) return "";
    const t = String(e).trim();
    if (!t) return "";
    if (/^SOL-/i.test(t)) return t.toUpperCase();
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
    return "";
  }
  function badgeTipText(e) {
    const t = e?.badge_info || {};
    const n = t.name || e?.badge_type || "";
    if (!n) return "";
    const i = [ "official", "verified", "business", "team", "solis_core", "support_team" ];
    if (i.includes(e.badge_type)) {
      return n.charAt(0).toUpperCase() + n.slice(1);
    }
    const r = e.badge_tier || t.tier || "Special";
    return r !== n ? `${n} • ${r}` : n.charAt(0).toUpperCase() + n.slice(1);
  }
  function uid(e) {
    return `${e}-${Math.random().toString(36).slice(2, 9)}`;
  }
  function ensureTooltipStyles() {
    if (document.getElementById("solis-badge-tooltip-styles")) return;
    const e = document.createElement("style");
    e.id = "solis-badge-tooltip-styles";
    e.textContent = `\n            #solis-badge-tooltip {\n                position: fixed;\n                background: #6b7280;\n                color: #fff;\n                padding: 3px 7px;\n                border-radius: 4px;\n                font-size: 10px;\n                font-weight: 500;\n                white-space: nowrap;\n                z-index: 99999999;\n                pointer-events: none;\n                box-shadow: 0 2px 6px rgba(0,0,0,0.2);\n                opacity: 0;\n                transition: opacity 0.15s ease;\n                font-family: 'Plus Jakarta Sans', sans-serif;\n            }\n        `;
    document.head.appendChild(e);
    const t = document.createElement("div");
    t.id = "solis-badge-tooltip";
    document.body.appendChild(t);
  }
  function wireTooltip(e, t) {
    if (!t) return;
    ensureTooltipStyles();
    e.addEventListener("mouseenter", () => {
      const n = document.getElementById("solis-badge-tooltip");
      if (!n) return;
      n.textContent = t;
      n.style.opacity = "0";
      n.style.display = "block";
      const i = e.getBoundingClientRect();
      const r = n.offsetWidth;
      n.style.left = `${i.left + i.width / 2 - r / 2}px`;
      n.style.top = `${i.top - n.offsetHeight - 6}px`;
      n.style.opacity = "1";
    });
    e.addEventListener("mouseleave", () => {
      const e = document.getElementById("solis-badge-tooltip");
      if (e) e.style.opacity = "0";
    });
  }
  function createSvg(e, t, n) {
    const i = Math.max(14, Number(n) || 24);
    const r = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    r.setAttribute("width", String(i));
    r.setAttribute("height", String(i));
    r.setAttribute("aria-hidden", "true");
    r.style.display = "block";
    r.style.width = "100%";
    r.style.height = "100%";
    const o = String(e || "").toLowerCase();
    if (o === "verified" || o === "business" || o === "official") {
      const e = o === "business" || o === "official";
      r.setAttribute("viewBox", "0 0 22 22");
      const t = uid(e ? "gold-fill" : "orange-fill");
      const n = uid(e ? "gold-check" : "orange-check");
      const i = e ? `<stop offset="0" stop-color="#f4e72a"/><stop offset=".5" stop-color="#e0b420"/><stop offset="1" stop-color="#f4e72a"/>` : `<stop offset="0%" stop-color="#ff8a55"/><stop offset="42%" stop-color="#ff6b35"/><stop offset="100%" stop-color="#ff4f1a"/>`;
      const s = e ? `<stop offset="0" stop-color="#fff6d0"/><stop offset="1" stop-color="#fff"/>` : `<stop offset="0" stop-color="#fff6ee"/><stop offset="1" stop-color="#fff"/>`;
      r.innerHTML = `<defs>\n                <linearGradient id="${t}" x1="4.4" y1="2.5" x2="18.1" y2="21.5" gradientUnits="userSpaceOnUse">${i}</linearGradient>\n                <linearGradient id="${n}" x1="6" y1="6" x2="16" y2="16" gradientUnits="userSpaceOnUse">${s}</linearGradient>\n              </defs>\n              <path d="M 19.78 14.64 C 19.01 16.50 18.29 15.44 16.87 16.87 C 15.44 18.29 16.50 19.01 14.64 19.78 C 12.77 20.55 13.02 19.30 11.00 19.30 C 8.98 19.30 9.23 20.55 7.36 19.78 C 5.50 19.01 6.56 18.29 5.13 16.87 C 3.71 15.44 2.99 16.50 2.22 14.64 C 1.45 12.77 2.70 13.02 2.70 11.00 C 2.70 8.98 1.45 9.23 2.22 7.36 C 2.99 5.50 3.71 6.56 5.13 5.13 C 6.56 3.71 5.50 2.99 7.36 2.22 C 9.23 1.45 8.98 2.70 11.00 2.70 C 13.02 2.70 12.77 1.45 14.64 2.22 C 16.50 2.99 15.44 3.71 16.87 5.13 C 18.29 6.56 19.01 5.50 19.78 7.36 C 20.55 9.23 19.30 8.98 19.30 11.00 C 19.30 13.02 20.55 12.77 19.78 14.64 Z" fill="url(#${t})"/>\n              <path d="M6.2 11.4 L9.5 14.7 L15.6 7.9" fill="none" stroke="url(#${n})" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
      return r;
    }
    if (o === "team" || o === "support_team" || o === "solis_core") {
      r.setAttribute("viewBox", "0 0 100 100");
      r.innerHTML = `\n              <circle cx="50" cy="50" r="12" fill="#ea580c"/>\n              <ellipse rx="44" ry="18" cx="50" cy="50" stroke="#ea580c" stroke-width="8" fill="none" transform="rotate(45 50 50)"/>\n              <ellipse rx="44" ry="18" cx="50" cy="50" stroke="#ea580c" stroke-width="8" fill="none" transform="rotate(-45 50 50)"/>\n            `;
      return r;
    }
    if (o === "platinum_elite" || o === "diamond_partner" || o === "bronze_partner") {
      r.setAttribute("viewBox", "0 0 24 24");
      const e = t || "#fbbf24";
      r.innerHTML = `\n              <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${e}"/>\n              <path d="M3 9H21L12 21L3 9Z" fill="black" fill-opacity="0.06"/>\n              <path d="M3 9H21M6 4L12 21M18 4L12 21" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/>\n            `;
      return r;
    }
    r.setAttribute("viewBox", "0 0 24 24");
    r.innerHTML = `<circle cx="12" cy="12" r="4" fill="${t || "#fbbf24"}"/>`;
    return r;
  }
  function createBadgeEl(e, t) {
    const n = e?.badge_info || {};
    const i = e?.badge_type;
    if (!i && !n.name) return null;
    const r = document.createElement("span");
    r.className = "solis-user-badge";
    r.style.cssText = [ "display:inline-flex", "align-items:center", "justify-content:center", "width:" + (t || 20) + "px", "height:" + (t || 20) + "px", "flex-shrink:0", "line-height:0" ].join(";");
    r.setAttribute("title", n.name || i || "Badge");
    r.appendChild(createSvg(i, n.color || "#fbbf24", t));
    wireTooltip(r, badgeTipText(e));
    return r;
  }
  function renderList(e, t, n) {
    if (!e) return;
    e.innerHTML = "";
    const i = Array.isArray(t) ? t.slice(0, 2) : [];
    if (!i.length) return;
    const r = document.createElement("span");
    r.className = "solis-badge-row";
    r.style.cssText = "display:inline-flex;align-items:center;gap:4px;flex-shrink:0;";
    i.forEach(e => {
      const t = createBadgeEl(e, n);
      if (t) r.appendChild(t);
    });
    if (r.childElementCount) e.appendChild(r);
  }
  async function fetchBadges(t) {
    const n = resolveUserRef(t);
    if (!n) return null;
    const i = {
      Accept: "application/json"
    };
    if (typeof e.getAuthHeaders === "function") {
      Object.assign(i, e.getAuthHeaders());
    }
    const r = await fetch(`${apiBase()}/badges/display/${encodeURIComponent(n)}`, {
      method: "GET",
      credentials: "include",
      headers: i
    });
    if (!r.ok) return null;
    const o = await r.json();
    const s = o?.badges?.badges || o?.badges || [];
    if (!o?.success || !Array.isArray(s) || !s.length) return null;
    return s;
  }
  async function fetchAndRender(e, t, n) {
    const i = Array.isArray(t) ? t : [ t ];
    const r = i.map(e => typeof e === "string" ? document.getElementById(e) : e).filter(Boolean);
    if (!r.length) return;
    r.forEach(e => {
      e.innerHTML = "";
    });
    try {
      const t = await fetchBadges(e);
      if (!t?.length) return;
      r.forEach(e => renderList(e, t, n || 22));
    } catch (e) {}
  }
  async function renderCurrentUser(t, n) {
    try {
      const i = {
        Accept: "application/json",
        "Content-Type": "application/json"
      };
      if (typeof e.getAuthHeaders === "function") {
        Object.assign(i, e.getAuthHeaders());
      }
      const r = await fetch(`${apiBase()}/badges/current`, {
        method: "POST",
        credentials: "include",
        headers: i,
        body: "{}"
      });
      if (r.ok) {
        const e = await r.json();
        const i = e?.badges?.badges || [];
        if (i.length) {
          const e = Array.isArray(t) ? t : [ t ];
          const r = e.map(e => typeof e === "string" ? document.getElementById(e) : e).filter(Boolean);
          r.forEach(e => {
            e.innerHTML = "";
            renderList(e, i, n || 22);
          });
          return;
        }
      }
    } catch (e) {}
    const i = e.currentUser?.public_id || e.currentUser?.solis_id || e.currentUser?.id;
    if (!i) return;
    return fetchAndRender(i, t, n);
  }
  e.SolisBadges = {
    createSvg: createSvg,
    createBadgeEl: createBadgeEl,
    renderList: renderList,
    fetchBadges: fetchBadges,
    fetchAndRender: fetchAndRender,
    renderCurrentUser: renderCurrentUser,
    badgeTipText: badgeTipText
  };
})(typeof window !== "undefined" ? window : globalThis);
