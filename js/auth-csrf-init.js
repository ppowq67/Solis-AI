const APP_VERSION = '1.0.0';

if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.warn('Warning: Connection is not secure. Use HTTPS in production.');
}

function isNewUser() {
    const hasVisited = sessionStorage.getItem('solis_visited');
    return !hasVisited;
}

function markUserAsVisited() {
    sessionStorage.setItem('solis_visited', 'true');
}

function validateUserObject(userInfo) {
    if (!userInfo || typeof userInfo !== 'object') {
        throw new Error('Invalid user object');
    }

    const allowedProps = ['id', 'email', 'name', 'role', 'picture', 'plan', 'auth_provider'];
    const sanitized = {};

    for (const prop of allowedProps) {
        if (prop in userInfo) {
            const value = userInfo[prop];
            if (typeof value === 'string' || typeof value === 'number') {
                sanitized[prop] = value;
            }
        }
    }
    return sanitized;
}

function checkVersionUpdate() {
    const lastVersion = sessionStorage.getItem('appVersion');
    if (lastVersion && lastVersion !== APP_VERSION) {
        sessionStorage.setItem('showVersionUpdate', 'true');
    }
    sessionStorage.setItem('appVersion', APP_VERSION);
}

async function verifyAndRedirect() {
    try {
        const verifyUrl = `${window.API_BASE_URL}/auth/check`;
        const fetchFn = window.apiFetch || fetch;
        const response = await fetchFn(verifyUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();

        if (response.ok) {
            if (!data || typeof data !== 'object' || !data.user) {
                throw new Error('Invalid API response format');
            }
            const userInfo = validateUserObject(data.user);
            sessionStorage.setItem('userId', String(userInfo.id));

            const newUser = isNewUser();
            markUserAsVisited();
            checkVersionUpdate();

            window.history.replaceState({}, document.title, window.location.pathname);
            const redirectUrl = newUser ? '/welcome.html' : '/dashboard.html';
            setTimeout(() => { window.location.href = redirectUrl; }, 100);
        } else {
            setTimeout(() => { window.location.href = '/login.html'; }, 100);
        }
    } catch (error) {
        console.error('Error during verification:', error.message);
        setTimeout(() => { window.location.href = '/login.html'; }, 100);
    }
}

setTimeout(() => {
    verifyAndRedirect();
}, 500);
