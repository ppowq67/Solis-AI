(function (global) {
    function isExternalAvatar(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.startsWith('/')) return false;
        if (url.startsWith('data:')) return false;
        return /^https?:\/\//i.test(url);
    }

    function resolveAvatarUrl(userOrId, picture) {
        let userId = userOrId;
        let pic = picture;

        if (userOrId && typeof userOrId === 'object') {
            userId = userOrId.id || userOrId.user_id;
            pic = pic ?? userOrId.picture ?? userOrId.avatar ?? userOrId.photo;
        }

        if (pic && pic.startsWith('/') && !pic.includes('googleusercontent.com')) {
            return pic;
        }

        if (userId && (isExternalAvatar(pic) || !pic)) {
            const base = (global.API_BASE_URL || '').replace(/\/api\/?$/, '') || '';
            return `${base}/api/avatar/${encodeURIComponent(userId)}`;
        }

        return pic || null;
    }

    global.resolveAvatarUrl = resolveAvatarUrl;
    global.isExternalAvatar = isExternalAvatar;
})(typeof window !== 'undefined' ? window : globalThis);
