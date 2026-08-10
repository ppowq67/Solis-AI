(function initSolisBadges(e) {
  "use strict";
  function apiBase() {
    if (e.API_BASE_URL) return String(e.API_BASE_URL).replace(/\/$/, "");
    const t = e.location?.hostname || "";
    const n = t === "localhost" || t === "127.0.0.1";
    return n ? "https://solisai.video/api" : "https://api.solisai.video/api";
  }
  function badgeTipText(e) {
    const t = e?.badge_info || {};
    const n = t.name || "";
    if (!n) return "";
    const i = [ "official", "verified", "solis_core" ];
    if (i.includes(e.badge_type)) {
      return n.charAt(0).toUpperCase() + n.slice(1);
    }
    const o = e.badge_tier || t.tier || "Special";
    return o !== n ? `${n} • ${o}` : n.charAt(0).toUpperCase() + n.slice(1);
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
      const o = n.offsetWidth;
      n.style.left = `${i.left + i.width / 2 - o / 2}px`;
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
    const o = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    o.setAttribute("width", String(i));
    o.setAttribute("height", String(i));
    o.setAttribute("viewBox", "0 0 24 24");
    o.setAttribute("aria-hidden", "true");
    o.style.display = "block";
    o.style.width = "100%";
    o.style.height = "100%";
    switch (e) {
     case "official":
      o.innerHTML = `<defs>\n                    <linearGradient id="bgGrad-official" x1="0%" y1="0%" x2="100%" y2="100%">\n                        <stop offset="0%" stop-color="#FF8A5C" />\n                        <stop offset="100%" stop-color="#FF5722" />\n                    </linearGradient>\n                    <radialGradient id="outerGlow-official" cx="50%" cy="50%" r="50%">\n                        <stop offset="60%" stop-color="#FF7A42" stop-opacity="0.2" />\n                        <stop offset="100%" stop-color="#FF7A42" stop-opacity="0" />\n                    </radialGradient>\n                    <linearGradient id="edgeHighlight-official" x1="50%" y1="0%" x2="50%" y2="100%">\n                        <stop offset="0%" stop-color="white" stop-opacity="0.8" />\n                        <stop offset="50%" stop-color="white" stop-opacity="0" />\n                        <stop offset="100%" stop-color="white" stop-opacity="0.3" />\n                    </linearGradient>\n                    <radialGradient id="lensShine-official" cx="50%" cy="30%" r="50%" fx="50%" fy="20%">\n                        <stop offset="0%" stop-color="white" stop-opacity="0.5" />\n                        <stop offset="100%" stop-color="white" stop-opacity="0" />\n                    </radialGradient>\n                </defs>\n                <g class="badge-content">\n                    <circle cx="12" cy="12" r="9" fill="url(#outerGlow-official)" stroke="none"/>\n                    <circle cx="12" cy="12" r="7" fill="url(#bgGrad-official)" stroke="none"/>\n                    <circle cx="12" cy="12" r="7" fill="url(#lensShine-official)" stroke="none"/>\n                    <circle cx="12" cy="12" r="6.75" stroke="url(#edgeHighlight-official)" stroke-width="0.8" stroke-opacity="0.6" fill="none"/>\n                    <path d="M8 12L10 14L15 9" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>\n                </g>`;
      break;

     case "support_team":
      o.innerHTML = `\n                    <path d="M12 2L4 5V11C4 16.19 7.41 21.05 12 22C16.59 21.05 20 16.19 20 11V5L12 2Z" fill="${t}"/>\n                    <path d="M12 2L20 5V11C20 13 19 15 17 17L12 2V2Z" fill="white" fill-opacity="0.1"/>\n                    <path d="M9 11L11 13L15 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>\n                `;
      break;

     case "platinum_elite":
      o.innerHTML = `\n                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${t}"/>\n                    <path d="M3 9H21L12 21L3 9Z" fill="black" fill-opacity="0.03"/>\n                    <path d="M6 4L12 9V21L18 4H6Z" fill="black" fill-opacity="0.05"/>\n                    <path d="M12 4V21" stroke="black" stroke-width="0.6" stroke-opacity="0.1"/>\n                    <path d="M3 9H21M6 4L12 21M18 4L12 21M9 9L12 21L15 9" stroke="black" stroke-width="0.5" stroke-linejoin="round"/>\n                `;
      break;

     case "diamond_partner":
      o.innerHTML = `\n                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${t}"/>\n                    <path d="M3 9H21L12 21L3 9Z" fill="black" fill-opacity="0.05"/>\n                    <path d="M12 21L9 9L12 4L15 9L12 21Z" fill="white" fill-opacity="0.2"/>\n                    <path d="M3 9H21M6 4L12 21M18 4L12 21" stroke="#003538" stroke-width="0.6" stroke-opacity="0.8"/>\n                `;
      break;

     case "bronze_partner":
      o.innerHTML = `\n                    <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${t}"/>\n                    <path d="M12 21L9 9L12 4V21Z" fill="black" fill-opacity="0.15"/>\n                    <path d="M12 21L15 9L12 4V21Z" fill="white" fill-opacity="0.1"/>\n                    <path d="M3 9H21M6 4L12 21M18 4L12 21" stroke="#2a1604" stroke-width="0.6" stroke-opacity="0.6"/>\n                `;
      break;

     case "verified":
      o.innerHTML = `\n                    <circle cx="12" cy="12" r="11" fill="${t}"/>\n                    <path d="M9 12.5L11.5 15L17 8.5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>\n                `;
      break;

     case "solis_core":
      o.innerHTML = `<defs>\n                    <linearGradient id="g-solis-core" x1="0%" y1="0%" x2="100%" y2="100%">\n                        <stop offset="0%" stop-color="#ef4444" />\n                        <stop offset="100%" stop-color="#f87171" />\n                    </linearGradient>\n                </defs>\n                <path d="M12 1L14.47 3.94L18.27 3.23L19.33 6.94L23.08 7.73L21.84 11.44L24 14.5L20.92 16.71L20.67 20.52L16.89 21.05L14.93 24L12 22.67L9.07 24L7.11 21.05L3.33 20.52L3.08 16.71L0 14.5L2.16 11.44L0.92 7.73L4.67 6.94L5.73 3.23L9.53 3.94L12 1Z" fill="url(#g-solis-core)" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>\n                <path d="M8.5 12.5L11 15L16.5 9.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
      break;

     default:
      o.innerHTML = `<circle cx="12" cy="12" r="4" fill="${t || "#fbbf24"}"/>`;
    }
    return o;
  }
  function createBadgeEl(e, t) {
    const n = e?.badge_info || {};
    if (!n.name) return null;
    const i = document.createElement("span");
    i.className = "solis-user-badge";
    i.style.cssText = [ "display:inline-flex", "align-items:center", "justify-content:center", `width:${t}px`, `height:${t}px`, "flex-shrink:0", "vertical-align:middle", "cursor:default", "filter:drop-shadow(0 1px 2px rgba(0,0,0,0.25))" ].join(";");
    i.appendChild(createSvg(e.badge_type, n.color || "#fbbf24", t));
    wireTooltip(i, badgeTipText(e));
    return i;
  }
  function renderList(e, t, n) {
    if (!e) return;
    e.innerHTML = "";
    const i = Array.isArray(t) ? t.slice(0, 2) : [];
    if (!i.length) return;
    const o = document.createElement("span");
    o.className = "solis-badge-row";
    o.style.cssText = "display:inline-flex;align-items:center;gap:4px;flex-shrink:0;";
    i.forEach(e => {
      const t = createBadgeEl(e, n);
      if (t) o.appendChild(t);
    });
    if (o.childElementCount) e.appendChild(o);
  }
  async function fetchBadges(t) {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    const i = {
      Accept: "application/json"
    };
    if (typeof e.getAuthHeaders === "function") {
      Object.assign(i, e.getAuthHeaders());
    }
    const o = await fetch(`${apiBase()}/badges/display/${n}`, {
      method: "GET",
      credentials: "include",
      headers: i
    });
    if (!o.ok) return null;
    const r = await o.json();
    if (!r?.success || !r?.badges?.badges?.length) return null;
    return r.badges.badges;
  }
  async function fetchAndRender(e, t, n) {
    const i = Array.isArray(t) ? t : [ t ];
    const o = i.map(e => typeof e === "string" ? document.getElementById(e) : e).filter(Boolean);
    if (!o.length) return;
    o.forEach(e => {
      e.innerHTML = "";
    });
    try {
      const t = await fetchBadges(e);
      if (!t?.length) return;
      o.forEach(e => renderList(e, t, n || 22));
    } catch (e) {}
  }
  async function renderCurrentUser(t, n) {
    const i = e.currentUser?.id;
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
