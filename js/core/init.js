(function() {
    'use strict';

    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const BACKEND_PORT = '5500';

    try {
        const debugOn = localStorage.getItem('solis_debug') === '1'
            || /(?:\?|&)solis_debug=1(?:&|$)/.test(location.search || '');
        if (!debugOn) {
            const noop = function () {};
            console.log = noop;
            console.debug = noop;
            console.info = noop;
            const stripEmoji = (v) => (typeof v === 'string'
                ? v.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/^\s+/, '')
                : v);
            const origError = console.error.bind(console);
            console.error = function (...args) {
                origError(...args.map(stripEmoji));
            };
        }
        window.__SOLIS_DEBUG__ = !!debugOn;
    } catch (_) { /* private mode */ }

    if (!window.API_BASE_URL) {
        if (isLocal) {
            window.API_BASE_URL = `http://${hostname}:${BACKEND_PORT}/api`;
        } else {
            window.API_BASE_URL = 'https://api.solisai.video/api';
        }

        if (!isLocal) {
            Object.defineProperty(window, 'API_BASE_URL', {
                writable: false,
                configurable: false,
                enumerable: false,
            });
        }
    }

    try {
        Object.defineProperty(window, 'API_ORIGIN', {
            value: String(window.API_BASE_URL || '').replace(/\/api\/?$/, ''),
            writable: isLocal,
            configurable: isLocal,
            enumerable: false,
        });
    } catch (_) {
        window.API_ORIGIN = window.API_BASE_URL.replace(/\/api\/?$/, '');
    }

    window.apiUrl = function apiUrl(path) {
        const base = (window.API_BASE_URL || '').replace(/\/$/, '');
        if (!path) return base;
        let p = String(path);
        if (p.startsWith('http://') || p.startsWith('https://')) return p;
        if (p.startsWith('/api/')) p = p.slice(4);
        else if (p.startsWith('/api')) p = p.slice(4);
        if (!p.startsWith('/')) p = '/' + p;
        return base + p;
    };
    try {
        Object.defineProperty(window, 'apiUrl', {
            value: window.apiUrl,
            writable: false,
            configurable: false,
            enumerable: false,
        });
    } catch (_) { /* ignore */ }

    if (!isLocal) {
        try {
            delete window.__SOLIS_DEBUG__;
            Object.defineProperty(window, '__SOLIS_DEBUG__', {
                get() { return false; },
                set() { /* ignore */ },
                enumerable: false,
                configurable: false,
            });
        } catch (_) { /* ignore */ }
    }

    window.SOLIS_INITIALIZED = true;

    try {
        document.documentElement.style.touchAction = 'manipulation';
        if (document.body) document.body.style.touchAction = 'manipulation';
        else document.addEventListener('DOMContentLoaded', function () {
            if (document.body) document.body.style.touchAction = 'manipulation';
        });

        var lastTouchEnd = 0;
        document.addEventListener('touchend', function (e) {
            var now = Date.now();
            if (now - lastTouchEnd <= 280) {
                var t = e.target;
                if (t && (t.closest && t.closest(
                    'input, textarea, select, [contenteditable="true"],' +
                    '.preview-placeholder, .sub-text-block, .overlay-text-block,' +
                    '.sub-resize-handle, #splitscreenDivider, .ss-collapse-handle,' +
                    '[data-template-element-id], .preview-timeline-wrap, .preview-timeline-handle'
                ))) {
                    lastTouchEnd = now;
                    return;
                }
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
    } catch (_) { /* ignore */ }
})();
