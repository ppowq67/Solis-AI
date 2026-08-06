(function() {
    'use strict';

    const nativeFetch = window.fetch;

    window.enableFetchInterceptor = function() {

        const checkInterval = setInterval(() => {
            if (window.apiManager) {
                clearInterval(checkInterval);

                window.fetch = function(resource, config = {}) {
                    const url = typeof resource === 'string' ? resource : resource.url;

                    if (!url || typeof url !== 'string' || !url.includes('/api/') ||
                        url.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/i)) {
                        return nativeFetch(resource, config);
                    }

                    const method = (config.method || 'GET').toUpperCase();
                    const requestConfig = { method, ...config };

                    return window.apiManager.request(url, requestConfig);
                };
            }
        }, 100);

        setTimeout(() => clearInterval(checkInterval), 10000);
    };

})();
