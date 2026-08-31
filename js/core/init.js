(function() {
    'use strict';

    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const BACKEND_PORT = '5500';

    // Quiet UI/debug noise. Keep console.error. Opt-in: localStorage.solis_debug = '1'
    try {
        const debugOn = localStorage.getItem('solis_debug') === '1'
            || /(?:\?|&)solis_debug=1(?:&|$)/.test(location.search || '');

        const _log = console.log.bind(console);
        const _info = console.info.bind(console);
        const _warn = console.warn.bind(console);
        const _error = console.error.bind(console);

        /** Centered Solis-branded console banner (DevTools). */
        window.solisLog = function solisLog(title, detail) {
            const t = String(title || 'Solis');
            const d = detail == null ? '' : String(detail);
            const pad = '          ';
            _log(
                `%c${pad}${t}${pad}\n%c${d ? pad + d + pad : ''}`,
                'display:block;text-align:center;font-family:"Plus Jakarta Sans",system-ui,sans-serif;' +
                'font-size:13px;font-weight:800;letter-spacing:0.04em;color:#fff;' +
                'background:linear-gradient(135deg,#f97316,#ea580c);padding:10px 18px;border-radius:10px 10px 0 0;',
                'display:block;text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;' +
                'font-size:11px;font-weight:500;color:#431407;background:#ffedd5;padding:8px 18px;' +
                'border-radius:0 0 10px 10px;margin-bottom:6px;',
            );
        };

        if (!debugOn) {
            const noop = function () {};
            console.log = noop;
            console.debug = noop;
            console.info = noop;
            const stripEmoji = (v) => (typeof v === 'string'
                ? v.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/^\s+/, '')
                : v);
            console.error = function (...args) {
                _error(...args.map(stripEmoji));
            };
            console.warn = function (...args) {
                _warn(...args.map(stripEmoji));
            };
        } else {
            console.log = _log;
            console.info = _info;
        }
        window.__SOLIS_DEBUG__ = !!debugOn;

        // One centered boot mark (always visible, even when log is muted)
        window.solisLog('Solis AI', isLocal ? 'local' : 'www · api.solisai.video');
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

    /** Flask API origin in dev (port 5500). Page UI may be served from Live Server (:5000). */
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

    /**
     * Resolve API paths to the Flask backend (port 5500 in dev).
     * Use instead of relative `/api/...` which hits whatever port the page is on.
     */
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

    // Rewrite relative /api/* → api.solisai.video (Vercel has no Flask routes → 404)
    // Also track API health so polls don't hammer a restarting backend (quota burn).
    (function patchFetchForApiHost() {
        const nativeFetch = window.fetch.bind(window);
        const apiHost = (() => {
            try { return new URL(window.API_BASE_URL || '', location.href).host; }
            catch (_) { return ''; }
        })();

        const gate = {
            fails: 0,
            openUntil: 0,
            noteOk() {
                this.fails = 0;
                this.openUntil = 0;
            },
            noteFail() {
                this.fails += 1;
                if (this.fails >= 3) {
                    // Pause optional polling 20–45s while backend restarts
                    this.openUntil = Date.now() + Math.min(45000, 15000 + this.fails * 3000);
                }
            },
            /** False while circuit is open — skip non-critical polls */
            allowPoll() {
                return Date.now() >= this.openUntil;
            },
            isApiUrl(url) {
                if (!url) return false;
                if (url.startsWith('/api/') || url === '/api') return true;
                try {
                    const u = new URL(url, location.href);
                    return !!(apiHost && u.host === apiHost);
                } catch (_) {
                    return false;
                }
            },
            isPollPath(url) {
                return /\/clips\/status|\/auth\/check|\/auth\/subscription|\/news\/feed|\/user\/profile/i.test(String(url || ''));
            },
        };
        window.solisApiGate = gate;

        window.fetch = function fetchWithApiHost(input, init) {
            let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input || ''));
            if (url.startsWith('/api/') || url === '/api') {
                const resolved = window.apiUrl(url);
                if (typeof input === 'string') {
                    input = resolved;
                    url = resolved;
                } else if (input instanceof Request) {
                    input = new Request(resolved, input);
                    url = resolved;
                }
            }

            // While API is down, drop duplicate poll traffic (auth/actions still go through)
            const opts = init || {};
            if (gate.isApiUrl(url) && gate.isPollPath(url) && opts.solisOptionalPoll && !gate.allowPoll()) {
                return Promise.reject(new Error('solis_api_backoff'));
            }

            return nativeFetch(input, init).then((resp) => {
                if (gate.isApiUrl(url)) {
                    if (resp && resp.ok) gate.noteOk();
                    else if (resp && resp.status >= 500) gate.noteFail();
                }
                return resp;
            }).catch((err) => {
                if (gate.isApiUrl(url) && String(err?.message || '') !== 'solis_api_backoff') {
                    gate.noteFail();
                }
                throw err;
            });
        };
    })();

    // Prod: strip common debug hooks from the global object so casual F12 poking is harder
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

    /** Socket.IO always targets the Flask API host — never the static www site. */
    window.getSolisSocketOrigin = function getSolisSocketOrigin() {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            const base = window.API_BASE_URL || `http://${host}:5500/api`;
            return String(base).replace(/\/api\/?$/, '') || window.location.origin;
        }
        return 'https://api.solisai.video';
    };
    try {
        Object.defineProperty(window, 'getSolisSocketOrigin', {
            value: window.getSolisSocketOrigin,
            writable: false,
            configurable: false,
            enumerable: false,
        });
    } catch (_) { /* ignore */ }

    window.SOLIS_INITIALIZED = true;

    // Kill double-tap zoom (iOS Safari) without blocking pinch when allowed by UA
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
