(function() {
    'use strict';

    try {
        const waitForManagers = () => {
            return new Promise((resolve) => {
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;

                    const hasAPIManager = typeof window.apiManager !== 'undefined' && window.apiManager !== null;
                    const hasWSManager = typeof window.wsManager !== 'undefined' && window.wsManager !== null;
                    const hasWSHelper = typeof window.ws !== 'undefined' && window.ws !== null;

                    if ((hasAPIManager || attempts > 50) &&
                        (hasWSManager || attempts > 100) &&
                        (hasWSHelper || attempts > 100)) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 50);

                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve();
                }, 5000);
            });
        };

        window.managersReady = waitForManagers().then(() => {

            const status = {
                apiManager: !!window.apiManager,
                wsManager: !!window.wsManager,
                wsHelper: !!window.ws
            };

            return status;
        }).catch(error => {
            console.error('[SafeInit] Error during initialization:', error);
            return {
                apiManager: false,
                wsManager: false,
                wsHelper: false
            };
        });

        window.apiManager = window.apiManager || {
            request: async (url, opts) => {
                console.warn('[SafeInit] Using fallback fetch for:', url);
                return fetch(url, opts);
            },
            get: async (url) => fetch(url),
            post: async (url, data) => fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }),
            getStats: () => ({ note: 'APIManager not ready' })
        };

        window.wsManager = window.wsManager || {
            emit: () => console.warn('[SafeInit] WebSocket not ready'),
            request: async () => Promise.reject('WebSocket not ready'),
            getStatus: () => ({ connected: false })
        };

        window.ws = window.ws || {
            emit: (event, data) => {
                console.warn('[SafeInit] Using fallback WebSocket for:', event);
                if (window.solisWSClient && window.solisWSClient.socket) {
                    window.solisWSClient.socket.emit(event, data);
                }
                return false;
            },
            request: async (event, data) => Promise.reject('WebSocket not ready'),
            getStatus: () => ({ connected: false })
        };

    } catch (error) {
        console.error('[SafeInit] FATAL initialization error:', error);
        console.error(error.stack);
    }
})();
