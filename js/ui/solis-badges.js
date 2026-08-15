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
    const t = String(e?.badge_type || "").toLowerCase();
    const n = {
      verified: "Verified",
      business: "Business",
      official: "Business",
      team: "Solis Team",
      solis_core: "Solis Team",
      support_team: "Solis Team",
      platinum_elite: "Platinum",
      diamond_partner: "Diamond Partner",
      bronze_partner: "Bronze"
    };
    return n[t] || e?.badge_info?.name || (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
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
      const r = e.getBoundingClientRect();
      const i = n.offsetWidth;
      n.style.left = `${r.left + r.width / 2 - i / 2}px`;
      n.style.top = `${r.top - n.offsetHeight - 6}px`;
      n.style.opacity = "1";
    });
    e.addEventListener("mouseleave", () => {
      const e = document.getElementById("solis-badge-tooltip");
      if (e) e.style.opacity = "0";
    });
  }
  function createSvg(e, t, n) {
    const r = Math.max(14, Number(n) || 24);
    const i = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    i.setAttribute("width", String(r));
    i.setAttribute("height", String(r));
    i.setAttribute("aria-hidden", "true");
    i.setAttribute("overflow", "visible");
    i.style.display = "block";
    i.style.width = "100%";
    i.style.height = "100%";
    i.style.overflow = "visible";
    i.style.stroke = "none";
    i.style.color = "transparent";
    const s = String(e || "").toLowerCase();
    if (s === "business" || s === "official") {
      i.setAttribute("viewBox", "0 0 22 22");
      const e = uid("biz-a");
      const t = uid("biz-b");
      i.innerHTML = `<g>\n              <linearGradient gradientUnits="userSpaceOnUse" id="${e}" x1="4.411" x2="18.083" y1="2.495" y2="21.508">\n                <stop offset="0" stop-color="#f4e72a"/><stop offset=".539" stop-color="#cd8105"/>\n                <stop offset=".68" stop-color="#cb7b00"/><stop offset="1" stop-color="#f4ec26"/>\n                <stop offset="1" stop-color="#f4e72a"/>\n              </linearGradient>\n              <linearGradient gradientUnits="userSpaceOnUse" id="${t}" x1="5.355" x2="16.361" y1="3.395" y2="19.133">\n                <stop offset="0" stop-color="#f9e87f"/><stop offset=".406" stop-color="#e2b719"/>\n                <stop offset=".989" stop-color="#e2b719"/>\n              </linearGradient>\n              <g clip-rule="evenodd" fill-rule="evenodd">\n                <path fill="url(#${e})" stroke="none" d="M13.324 3.848L11 1.6 8.676 3.848l-3.201-.453-.559 3.184L2.06 8.095 3.48 11l-1.42 2.904 2.856 1.516.559 3.184 3.201-.452L11 20.4l2.324-2.248 3.201.452.559-3.184 2.856-1.516L18.52 11l1.42-2.905-2.856-1.516-.559-3.184zm-7.09 7.575l3.428 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z"/>\n                <path fill="url(#${t})" stroke="none" d="M13.101 4.533L11 2.5 8.899 4.533l-2.895-.41-.505 2.88-2.583 1.37L4.2 11l-1.284 2.627 2.583 1.37.505 2.88 2.895-.41L11 19.5l2.101-2.033 2.895.41.505-2.88 2.583-1.37L17.8 11l1.284-2.627-2.583-1.37-.505-2.88zm-6.868 6.89l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z"/>\n                <path fill="#d18800" stroke="none" d="M6.233 11.423l3.429 3.428 5.65-6.17.038-.033-.005 1.398-5.683 6.206-3.429-3.429-.003-1.405.005.003z"/>\n              </g>\n            </g>`;
      return i;
    }
    if (s === "verified") {
      i.setAttribute("viewBox", "0 0 22 22");
      i.innerHTML = `<g>\n              <path fill="#1d9bf0" stroke="none" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>\n            </g>`;
      return i;
    }
    if (s === "team" || s === "support_team" || s === "solis_core") {
      i.style.stroke = "";
      i.setAttribute("viewBox", "6 6 88 88");
      i.setAttribute("fill", "none");
      i.innerHTML = `\n              <circle cx="50" cy="50" r="13" fill="#ea580c" stroke="none"/>\n              <ellipse rx="42" ry="17" cx="50" cy="50" stroke="#ea580c" stroke-width="7" fill="none" transform="rotate(45 50 50)"/>\n              <ellipse rx="42" ry="17" cx="50" cy="50" stroke="#ea580c" stroke-width="7" fill="none" transform="rotate(-45 50 50)"/>\n            `;
      return i;
    }
    if (s === "platinum_elite" || s === "diamond_partner" || s === "bronze_partner") {
      i.setAttribute("viewBox", "0 0 24 24");
      const e = t || "#fbbf24";
      i.innerHTML = `\n              <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${e}" stroke="none"/>\n              <path d="M3 9H21L12 21L3 9Z" fill="#000" fill-opacity="0.06" stroke="none"/>\n            `;
      return i;
    }
    i.setAttribute("viewBox", "0 0 24 24");
    i.innerHTML = `<circle cx="12" cy="12" r="4" fill="${t || "#fbbf24"}" stroke="none"/>`;
    return i;
  }
  function sortBadgesForDisplay(e) {
    const rank = e => {
      const t = String(e || "").toLowerCase();
      if (t === "business" || t === "official") return 0;
      if (t === "verified") return 1;
      if (t === "team" || t === "solis_core" || t === "support_team") return 50;
      return 20;
    };
    return [ ...Array.isArray(e) ? e : [] ].map((e, t) => ({
      b: e,
      i: t
    })).sort((e, t) => {
      const n = rank(e.b?.badge_type) - rank(t.b?.badge_type);
      return n !== 0 ? n : e.i - t.i;
    }).map(e => e.b).slice(0, 2);
  }
  function createBadgeEl(e, t) {
    const n = e?.badge_type;
    if (!n) return null;
    const r = badgeTipText(e);
    const i = Math.max(18, Number(t) || 26);
    const s = document.createElement("span");
    s.className = "solis-user-badge";
    s.style.cssText = [ "display:inline-flex", "align-items:center", "justify-content:center", "width:" + i + "px", "height:" + i + "px", "flex-shrink:0", "line-height:0" ].join(";");
    s.setAttribute("title", r || "Badge");
    s.appendChild(createSvg(n, null, i));
    wireTooltip(s, r);
    return s;
  }
  function renderList(e, t, n) {
    if (!e) return;
    e.innerHTML = "";
    const r = sortBadgesForDisplay(t);
    if (!r.length) return;
    const i = document.createElement("span");
    i.className = "solis-badge-row";
    i.style.cssText = "display:inline-flex;align-items:center;gap:5px;flex-shrink:0;";
    r.forEach(e => {
      const t = createBadgeEl(e, n);
      if (t) i.appendChild(t);
    });
    if (i.childElementCount) e.appendChild(i);
  }
  async function fetchBadges(t) {
    const n = resolveUserRef(t);
    if (!n) return null;
    const r = {
      Accept: "application/json"
    };
    if (typeof e.getAuthHeaders === "function") {
      Object.assign(r, e.getAuthHeaders());
    }
    const i = await fetch(`${apiBase()}/badges/display/${encodeURIComponent(n)}`, {
      method: "GET",
      credentials: "include",
      headers: r
    });
    if (!i.ok) return null;
    const s = await i.json();
    const o = s?.badges?.badges || s?.badges || [];
    if (!s?.success || !Array.isArray(o) || !o.length) return null;
    return o;
  }
  async function fetchAndRender(e, t, n) {
    const r = Array.isArray(t) ? t : [ t ];
    const i = r.map(e => typeof e === "string" ? document.getElementById(e) : e).filter(Boolean);
    if (!i.length) return;
    i.forEach(e => {
      e.innerHTML = "";
    });
    try {
      const t = await fetchBadges(e);
      if (!t?.length) return;
      i.forEach(e => renderList(e, t, n || 26));
    } catch (e) {}
  }
  async function renderCurrentUser(t, n) {
    try {
      const r = {
        Accept: "application/json",
        "Content-Type": "application/json"
      };
      if (typeof e.getAuthHeaders === "function") {
        Object.assign(r, e.getAuthHeaders());
      }
      const i = await fetch(`${apiBase()}/badges/current`, {
        method: "POST",
        credentials: "include",
        headers: r,
        body: "{}"
      });
      if (i.ok) {
        const e = await i.json();
        const r = e?.badges?.badges || [];
        if (r.length) {
          const e = Array.isArray(t) ? t : [ t ];
          const i = e.map(e => typeof e === "string" ? document.getElementById(e) : e).filter(Boolean);
          i.forEach(e => {
            e.innerHTML = "";
            renderList(e, r, n || 26);
          });
          return;
        }
      }
    } catch (e) {}
    const r = e.currentUser?.public_id || e.currentUser?.solis_id || e.currentUser?.id;
    if (!r) return;
    return fetchAndRender(r, t, n);
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
