/**
 * Solis Style Pack — auth-only caption presets / anim catalog.
 * Lazy: fetch only when Presets (or an explicit ensure) needs it.
 * Session-cached so reopen / refresh within TTL does not re-hit the API.
 */
(function () {
    const ENDPOINT = '/clips/style-pack';
    const SS_KEY = 'solis_style_pack_session';
    const SS_TTL_MS = 12 * 60 * 60 * 1000; // 12h — recipes barely change
    const FAIL_COOLDOWN_MS = 90 * 1000;

    let pack = null;
    let inflight = null;
    let failUntil = 0;

    function apiBase() {
        try {
            if (typeof window.API_BASE_URL === 'string') return window.API_BASE_URL;
        } catch (_) { /* ignore */ }
        return '';
    }

    function authHeaders() {
        try {
            if (typeof getAuthHeaders === 'function') return getAuthHeaders() || {};
        } catch (_) { /* ignore */ }
        return {};
    }

    function emptyPack() {
        return {
            version: 0,
            anims: [],
            presets: {},
            font_weights: {},
            shadows: { none: 'none' },
        };
    }

    function readSession() {
        try {
            const raw = sessionStorage.getItem(SS_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.data || !parsed.t) return null;
            if (Date.now() - Number(parsed.t) > SS_TTL_MS) {
                sessionStorage.removeItem(SS_KEY);
                return null;
            }
            return parsed.data;
        } catch (_) {
            return null;
        }
    }

    function writeSession(data) {
        try {
            sessionStorage.setItem(SS_KEY, JSON.stringify({ t: Date.now(), data }));
        } catch (_) { /* ignore */ }
    }

    function hydrateFromCache() {
        if (pack && pack.version) return pack;
        const cached = readSession();
        if (cached && cached.version) {
            pack = cached;
            return pack;
        }
        return null;
    }

    async function load(opts) {
        const force = !!(opts && opts.force);
        if (!force) {
            const hit = hydrateFromCache();
            if (hit) return hit;
        }
        if (!force && failUntil && Date.now() < failUntil) {
            const err = new Error('style-pack cooldown');
            err.code = 'cooldown';
            throw err;
        }
        if (inflight) return inflight;

        inflight = (async () => {
            const headers = {
                Accept: 'application/json',
                ...authHeaders(),
            };
            const prev = pack || readSession();
            if (prev && prev._etag) headers['If-None-Match'] = prev._etag;

            const res = await fetch(apiBase() + ENDPOINT, {
                method: 'GET',
                credentials: 'include',
                headers,
            });

            if (res.status === 304 && prev && prev.version) {
                pack = prev;
                writeSession(prev); // refresh TTL
                failUntil = 0;
                return pack;
            }
            if (!res.ok) {
                failUntil = Date.now() + FAIL_COOLDOWN_MS;
                throw new Error('style-pack ' + res.status);
            }
            const data = await res.json();
            if (!data || typeof data !== 'object' || !data.version) {
                failUntil = Date.now() + FAIL_COOLDOWN_MS;
                throw new Error('style-pack invalid');
            }
            data._etag = res.headers.get('ETag') || prev?._etag || null;
            pack = data;
            failUntil = 0;
            writeSession({
                version: data.version,
                anims: data.anims,
                presets: data.presets,
                font_weights: data.font_weights,
                shadows: data.shadows,
                _etag: data._etag,
            });
            try {
                window.dispatchEvent(new CustomEvent('solis:style-pack', { detail: pack }));
            } catch (_) { /* ignore */ }
            return pack;
        })();

        try {
            return await inflight;
        } finally {
            inflight = null;
        }
    }

    /** Load only if missing from memory/session. Safe to call often. */
    function ensure(opts) {
        if (hydrateFromCache()) return Promise.resolve(pack);
        return load(opts);
    }

    function get() {
        return hydrateFromCache() || emptyPack();
    }

    function presets() {
        return get().presets || {};
    }

    function anims() {
        const list = get().anims;
        return Array.isArray(list) ? list : [];
    }

    function fontWeights() {
        return get().font_weights || {};
    }

    function shadows() {
        return get().shadows || { none: 'none' };
    }

    function ready() {
        return !!(hydrateFromCache()?.version);
    }

    function preset(id) {
        const key = String(id || '').toLowerCase();
        const bag = presets();
        return bag[key] || bag[id] || null;
    }

    window.SolisStylePack = {
        load,
        ensure,
        get,
        presets,
        anims,
        fontWeights,
        shadows,
        preset,
        ready,
    };
    // No boot fetch — wait until Presets / ensure() needs it
})();
