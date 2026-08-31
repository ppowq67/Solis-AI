/**
 * 🚀 Fetch Interceptor - Automatically routes all fetch() calls through APIManager
 * 
 * Benefits:
 * - No need to change existing fetch() calls
 * - Automatic deduplication, queuing, and retry logic
 * - Transparent to existing code
 * 
 * ⚠️  DISABLED by default - causes compatibility issues with some requests
 * Enable manually if needed: window.enableFetchInterceptor()
 */

(function() {
    'use strict';
    
    // Save native fetch
    const nativeFetch = window.fetch;
    
    window.enableFetchInterceptor = function() {
        
        // Wait for apiManager
        const checkInterval = setInterval(() => {
            if (window.apiManager) {
                clearInterval(checkInterval);
                
                // Override fetch
                window.fetch = function(resource, config = {}) {
                    const url = typeof resource === 'string' ? resource : resource.url;
                    
                    // Skip non-API and asset requests
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
    
    
    // Do NOT override fetch by default - let native fetch work
    // Users can enable manually if needed
})();
