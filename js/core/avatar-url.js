/**
 * Resolve profile image URL — never hotlink Google CDN from the browser.
 */
(function (global) {
    function isExternalAvatar(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.startsWith('/')) return false;
        if (url.startsWith('data:')) return false;
        return /^https?:\/\//i.test(url);
    }

    function apiOrigin() {
        const base = (global.API_BASE_URL || '').replace(/\/api\/?$/, '') || '';
        if (base) return base;
        if (typeof global.API_ORIGIN === 'string' && global.API_ORIGIN) return global.API_ORIGIN;
        // Last resort on production pages served from Vercel
        try {
            const host = String(global.location?.hostname || '');
            if (host && host !== 'localhost' && host !== '127.0.0.1') {
                return 'https://api.solisai.video';
            }
        } catch (_) { /* ignore */ }
        return '';
    }

    function absolutizeApiPath(path) {
        if (!path || typeof path !== 'string') return path;
        if (!path.startsWith('/')) return path;
        if (typeof global.apiUrl === 'function' && path.startsWith('/api/')) {
            try {
                const via = global.apiUrl(path);
                if (via && /^https?:\/\//i.test(via)) return via;
            } catch (_) { /* ignore */ }
        }
        const origin = apiOrigin();
        return origin ? `${origin}${path}` : path;
    }

    function resolveAvatarUrl(userOrId, picture) {
        let userId = userOrId;
        let pic = picture;

        if (userOrId && typeof userOrId === 'object') {
            userId = userOrId.public_id || userOrId.solis_id || userOrId.id || userOrId.user_id;
            pic = pic ?? userOrId.picture ?? userOrId.avatar ?? userOrId.photo;
        }

        // Relative proxy paths must hit the API host (Vercel frontend ≠ Railway API)
        if (pic && pic.startsWith('/') && !pic.includes('googleusercontent.com')) {
            return absolutizeApiPath(pic);
        }

        if (userId && (isExternalAvatar(pic) || !pic)) {
            // Stable per-user URL; backend sets private/no-store (never reuse another user's cache)
            return absolutizeApiPath(`/api/avatar/${encodeURIComponent(userId)}`);
        }

        return pic || null;
    }

    global.resolveAvatarUrl = resolveAvatarUrl;
    global.isExternalAvatar = isExternalAvatar;
})(typeof window !== 'undefined' ? window : globalThis);
