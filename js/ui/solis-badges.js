/**
 * Client-side badge SVG rendering.
 * Server only stores badge_type + metadata; all icons paint in the browser.
 */
(function initSolisBadges(global) {
    'use strict';

    function apiBase() {
        if (global.API_BASE_URL) return String(global.API_BASE_URL).replace(/\/$/, '');
        const host = global.location?.hostname || '';
        const local = host === 'localhost' || host === '127.0.0.1';
        return local ? `http://${host}:5500/api` : 'https://api.solisai.video/api';
    }

    function resolveUserRef(userId) {
        if (userId == null) return '';
        const raw = String(userId).trim();
        if (!raw) return '';
        if (/^SOL-/i.test(raw)) return raw.toUpperCase();
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
        return '';
    }

    function badgeTipText(badge) {
        const type = String(badge?.badge_type || '').toLowerCase();
        const labels = {
            verified: 'Verified',
            business: 'Business',
            official: 'Business',
            team: 'Solis Team',
            solis_core: 'Solis Team',
            support_team: 'Solis Team',
            platinum_elite: 'Platinum',
            diamond_partner: 'Diamond Partner',
            bronze_partner: 'Bronze',
        };
        return labels[type]
            || badge?.badge_info?.name
            || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '');
    }

    function uid(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function ensureTooltipStyles() {
        if (document.getElementById('solis-badge-tooltip-styles')) return;
        const style = document.createElement('style');
        style.id = 'solis-badge-tooltip-styles';
        style.textContent = `
            #solis-badge-tooltip {
                position: fixed;
                background: #6b7280;
                color: #fff;
                padding: 3px 7px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 500;
                white-space: nowrap;
                z-index: 99999999;
                pointer-events: none;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                opacity: 0;
                transition: opacity 0.15s ease;
                font-family: 'Plus Jakarta Sans', sans-serif;
            }
        `;
        document.head.appendChild(style);
        const tip = document.createElement('div');
        tip.id = 'solis-badge-tooltip';
        document.body.appendChild(tip);
    }

    function wireTooltip(el, text) {
        if (!text) return;
        ensureTooltipStyles();
        el.addEventListener('mouseenter', () => {
            const tip = document.getElementById('solis-badge-tooltip');
            if (!tip) return;
            tip.textContent = text;
            tip.style.opacity = '0';
            tip.style.display = 'block';
            const r = el.getBoundingClientRect();
            const tw = tip.offsetWidth;
            tip.style.left = `${r.left + r.width / 2 - tw / 2}px`;
            tip.style.top = `${r.top - tip.offsetHeight - 6}px`;
            tip.style.opacity = '1';
        });
        el.addEventListener('mouseleave', () => {
            const tip = document.getElementById('solis-badge-tooltip');
            if (tip) tip.style.opacity = '0';
        });
    }

    function createSvg(badgeType, color, sizePx) {
        const px = Math.max(14, Number(sizePx) || 24);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', String(px));
        svg.setAttribute('height', String(px));
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('overflow', 'visible');
        svg.style.display = 'block';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.overflow = 'visible';
        // Kill inherited currentColor strokes that paint fake black outlines
        svg.style.stroke = 'none';
        svg.style.color = 'transparent';

        const type = String(badgeType || '').toLowerCase();

        // Business / official — gold verified (fill-only, no stroke outlines)
        if (type === 'business' || type === 'official') {
            svg.setAttribute('viewBox', '0 0 22 22');
            const a = uid('biz-a');
            const b = uid('biz-b');
            svg.innerHTML = `<g>
              <linearGradient gradientUnits="userSpaceOnUse" id="${a}" x1="4.411" x2="18.083" y1="2.495" y2="21.508">
                <stop offset="0" stop-color="#f4e72a"/><stop offset=".539" stop-color="#cd8105"/>
                <stop offset=".68" stop-color="#cb7b00"/><stop offset="1" stop-color="#f4ec26"/>
                <stop offset="1" stop-color="#f4e72a"/>
              </linearGradient>
              <linearGradient gradientUnits="userSpaceOnUse" id="${b}" x1="5.355" x2="16.361" y1="3.395" y2="19.133">
                <stop offset="0" stop-color="#f9e87f"/><stop offset=".406" stop-color="#e2b719"/>
                <stop offset=".989" stop-color="#e2b719"/>
              </linearGradient>
              <g clip-rule="evenodd" fill-rule="evenodd">
                <path fill="url(#${a})" stroke="none" d="M13.324 3.848L11 1.6 8.676 3.848l-3.201-.453-.559 3.184L2.06 8.095 3.48 11l-1.42 2.904 2.856 1.516.559 3.184 3.201-.452L11 20.4l2.324-2.248 3.201.452.559-3.184 2.856-1.516L18.52 11l1.42-2.905-2.856-1.516-.559-3.184zm-7.09 7.575l3.428 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z"/>
                <path fill="url(#${b})" stroke="none" d="M13.101 4.533L11 2.5 8.899 4.533l-2.895-.41-.505 2.88-2.583 1.37L4.2 11l-1.284 2.627 2.583 1.37.505 2.88 2.895-.41L11 19.5l2.101-2.033 2.895.41.505-2.88 2.583-1.37L17.8 11l1.284-2.627-2.583-1.37-.505-2.88zm-6.868 6.89l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z"/>
                <path fill="#d18800" stroke="none" d="M6.233 11.423l3.429 3.428 5.65-6.17.038-.033-.005 1.398-5.683 6.206-3.429-3.429-.003-1.405.005.003z"/>
              </g>
            </g>`;
            return svg;
        }

        // Verified — solid check badge (client color only)
        if (type === 'verified') {
            svg.setAttribute('viewBox', '0 0 22 22');
            svg.innerHTML = `<g>
              <path fill="#1d9bf0" stroke="none" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>
            </g>`;
            return svg;
        }

        // Team — Solis orbital (tighter crop so it reads as large as the check badges)
        if (type === 'team' || type === 'support_team' || type === 'solis_core') {
            svg.style.stroke = '';
            svg.setAttribute('viewBox', '6 6 88 88');
            svg.setAttribute('fill', 'none');
            svg.innerHTML = `
              <circle cx="50" cy="50" r="13" fill="#ea580c" stroke="none"/>
              <ellipse rx="42" ry="17" cx="50" cy="50" stroke="#ea580c" stroke-width="7" fill="none" transform="rotate(45 50 50)"/>
              <ellipse rx="42" ry="17" cx="50" cy="50" stroke="#ea580c" stroke-width="7" fill="none" transform="rotate(-45 50 50)"/>
            `;
            return svg;
        }

        if (type === 'platinum_elite' || type === 'diamond_partner' || type === 'bronze_partner') {
            svg.setAttribute('viewBox', '0 0 24 24');
            const c = color || '#fbbf24';
            svg.innerHTML = `
              <path d="M6 4L3 9L12 21L21 9L18 4H6Z" fill="${c}" stroke="none"/>
              <path d="M3 9H21L12 21L3 9Z" fill="#000" fill-opacity="0.06" stroke="none"/>
            `;
            return svg;
        }

        svg.setAttribute('viewBox', '0 0 24 24');
        svg.innerHTML = `<circle cx="12" cy="12" r="4" fill="${color || '#fbbf24'}" stroke="none"/>`;
        return svg;
    }

    function sortBadgesForDisplay(badges) {
        const rank = (t) => {
            const type = String(t || '').toLowerCase();
            if (type === 'business' || type === 'official') return 0;
            if (type === 'verified') return 1;
            if (type === 'team' || type === 'solis_core' || type === 'support_team') return 50;
            return 20;
        };
        // Stable: business/verified first, Solis orbital team always second
        return [...(Array.isArray(badges) ? badges : [])]
            .map((b, i) => ({ b, i }))
            .sort((a, c) => {
                const d = rank(a.b?.badge_type) - rank(c.b?.badge_type);
                return d !== 0 ? d : a.i - c.i;
            })
            .map((x) => x.b)
            .slice(0, 2);
    }

    function createBadgeEl(badge, sizePx) {
        const type = badge?.badge_type;
        if (!type) return null;
        const tip = badgeTipText(badge);
        const px = Math.max(18, Number(sizePx) || 26);
        const el = document.createElement('span');
        el.className = 'solis-user-badge';
        const typeKey = String(type || '').toLowerCase();
        if (typeKey === 'team' || typeKey === 'solis_core' || typeKey === 'support_team') {
            el.classList.add('solis-user-badge--team');
        } else if (typeKey === 'business' || typeKey === 'official') {
            el.classList.add('solis-user-badge--business');
        } else if (typeKey === 'verified') {
            el.classList.add('solis-user-badge--verified');
        }
        el.dataset.badge = typeKey;
        el.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'width:' + px + 'px',
            'height:' + px + 'px',
            'flex-shrink:0',
            'line-height:0',
        ].join(';');
        el.setAttribute('title', tip || 'Badge');
        // Colors/SVGs are always client-owned — never trust server color/icon
        el.appendChild(createSvg(type, null, px));
        wireTooltip(el, tip);
        return el;
    }

    function renderList(container, badges, sizePx) {
        if (!container) return;
        container.innerHTML = '';
        const list = sortBadgesForDisplay(badges);
        if (!list.length) return;
        const wrap = document.createElement('span');
        wrap.className = 'solis-badge-row';
        wrap.style.cssText = 'display:inline-flex;align-items:center;gap:5px;flex-shrink:0;';
        list.forEach((badge) => {
            const el = createBadgeEl(badge, sizePx);
            if (el) wrap.appendChild(el);
        });
        if (wrap.childElementCount) container.appendChild(wrap);
    }

    const BADGE_TTL_MS = 5 * 60 * 1000;
    const BADGE_EMPTY_TTL_MS = 45 * 1000;
    /** @type {Map<string, { at: number, list: any[]|null, inflight?: Promise<any> }>} */
    const _badgeCache = new Map();

    function cacheGet(key) {
        const hit = _badgeCache.get(key);
        if (!hit) return null;
        const ttl = (hit.list && hit.list.length) ? BADGE_TTL_MS : BADGE_EMPTY_TTL_MS;
        if (Date.now() - hit.at > ttl) return null;
        return hit;
    }

    function cacheSet(key, list) {
        _badgeCache.set(key, { at: Date.now(), list: Array.isArray(list) ? list : [] });
    }

    async function fetchBadges(userId, { force = false } = {}) {
        const ref = resolveUserRef(userId);
        if (!ref) return null;
        const key = `display:${ref}`;
        if (!force) {
            const hit = cacheGet(key);
            if (hit?.inflight) return hit.inflight;
            if (hit) return hit.list?.length ? hit.list : null;
        }
        const existing = _badgeCache.get(key) || {};
        const inflight = (async () => {
            try {
                const headers = { Accept: 'application/json' };
                if (typeof global.getAuthHeaders === 'function') {
                    Object.assign(headers, global.getAuthHeaders());
                }
                const resp = await fetch(`${apiBase()}/badges/display/${encodeURIComponent(ref)}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers,
                });
                if (!resp.ok) {
                    cacheSet(key, []);
                    return null;
                }
                const data = await resp.json();
                const list = data?.badges?.badges || data?.badges || [];
                if (!data?.success || !Array.isArray(list) || !list.length) {
                    cacheSet(key, []);
                    return null;
                }
                cacheSet(key, list);
                return list;
            } finally {
                const cur = _badgeCache.get(key);
                if (cur) delete cur.inflight;
            }
        })();
        _badgeCache.set(key, { ...existing, inflight, at: existing.at || 0, list: existing.list || null });
        return inflight;
    }

    async function fetchAndRender(userId, containerIds, sizePx) {
        const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
        const containers = ids.map((id) => (
            typeof id === 'string' ? document.getElementById(id) : id
        )).filter(Boolean);
        if (!containers.length) return;
        containers.forEach((c) => { c.innerHTML = ''; });
        try {
            const badges = await fetchBadges(userId);
            if (!badges?.length) return;
            containers.forEach((c) => renderList(c, badges, sizePx || 26));
        } catch (_) { /* ignore */ }
    }

    async function renderCurrentUser(containerIds, sizePx, { force = false } = {}) {
        const key = 'current';
        if (!force) {
            const hit = cacheGet(key);
            if (hit?.list?.length) {
                const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
                const containers = ids.map((id) => (
                    typeof id === 'string' ? document.getElementById(id) : id
                )).filter(Boolean);
                containers.forEach((c) => {
                    c.innerHTML = '';
                    renderList(c, hit.list, sizePx || 26);
                });
                return;
            }
            if (hit?.inflight) {
                const list = await hit.inflight;
                if (!list?.length) return;
                const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
                const containers = ids.map((id) => (
                    typeof id === 'string' ? document.getElementById(id) : id
                )).filter(Boolean);
                containers.forEach((c) => {
                    c.innerHTML = '';
                    renderList(c, list, sizePx || 26);
                });
                return;
            }
        }

        // Prefer authenticated /badges/current (works with SOL- client ids).
        const existing = _badgeCache.get(key) || {};
        const inflight = (async () => {
            try {
                const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
                if (typeof global.getAuthHeaders === 'function') {
                    Object.assign(headers, global.getAuthHeaders());
                }
                const resp = await fetch(`${apiBase()}/badges/current`, {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: '{}',
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const list = data?.badges?.badges || [];
                    if (Array.isArray(list) && list.length) {
                        cacheSet(key, list);
                        return list;
                    }
                }
                cacheSet(key, []);
                return null;
            } catch (_) {
                cacheSet(key, []);
                return null;
            } finally {
                const cur = _badgeCache.get(key);
                if (cur) delete cur.inflight;
            }
        })();
        _badgeCache.set(key, { ...existing, inflight, at: existing.at || 0, list: existing.list || null });

        try {
            const list = await inflight;
            if (list?.length) {
                const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
                const containers = ids.map((id) => (
                    typeof id === 'string' ? document.getElementById(id) : id
                )).filter(Boolean);
                containers.forEach((c) => {
                    c.innerHTML = '';
                    renderList(c, list, sizePx || 26);
                });
                return;
            }
        } catch (_) { /* fall through */ }

        const uid = global.currentUser?.public_id
            || global.currentUser?.solis_id
            || global.currentUser?.id;
        if (!uid) return;
        return fetchAndRender(uid, containerIds, sizePx);
    }

    global.SolisBadges = {
        createSvg,
        createBadgeEl,
        renderList,
        fetchBadges,
        fetchAndRender,
        renderCurrentUser,
        badgeTipText,
        invalidateCache(userId) {
            if (userId == null) {
                _badgeCache.clear();
                return;
            }
            const ref = resolveUserRef(userId);
            if (ref) _badgeCache.delete(`display:${ref}`);
            _badgeCache.delete('current');
        },
    };
})(typeof window !== 'undefined' ? window : globalThis);
