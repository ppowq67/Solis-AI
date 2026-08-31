/**
 * ðŸ” SECURITY ARCHITECTURE
 * 
 * FRONTEND RESPONSIBILITIES (UI Layer Only):
 * ------------------------------------
 * - Display user interface based on authenticated user status (from backend)
 * - Show/hide UI elements based on user subscription level
 * - Render content based on real-time data fetched from backend
 * 
 * NOT FRONTEND RESPONSIBILITIES (Must be done on Backend):
 * ---------------------------------------------------
 * - Authenticating users (done via httpOnly session cookies)
 * - Authorizing API requests (backend SESSION verification required)
 * - Checking subscription levels for API actions
 * - Enforcing rate limits, storage limits, and feature access
 * - Validating and sanitizing all user input (URLs, text, files)
 * - Verifying project ownership before delete/download/edit (IDOR PREVENTION)
 * - Fetching and returning user data are done via httpOnly cookie
 * 
 * CRITICAL RULES:
 * ===============
 * 1. Do NOT store user data (plan, email, ID) in localStorage
 *    → Use memory-only variables for UI state
 *    → Fetch from backend on every page load via verifyToken()
 * 
 * 2. Do NOT trust any client-side variables for authorization
 *    → Backend MUST check user session and permissions on EVERY API call
 *    → Never accept plan/role/permission info from JavaScript
 *    → Attackers can always modify projectId/userId in frontend network requests
 * 
 * 3. Do NOT perform URL validation or assume safe URLs
 *    → Regex validation is weak and can be bypassed
 *    → Backend MUST validate URLs against strict whitelist (YouTube URLs only)
 *    → Never pass raw URLs to shell commands on backend
 * 
 * 4. Always use safe DOM methods to prevent XSS
 *    → Use textContent instead of innerHTML for user data
 *    → Use createElement() + appendChild() instead of innerHTML injections
 *    → Never inject unsanitized URLs/user data into HTML strings
 * 
 * 5. State-changing API calls use credentials: 'include' (httpOnly cookie auth)
 *    → Backend validates Origin / Sec-Fetch-Site on mutations
 * 
 * 6. Use safeLog() instead of console.log in production
 *    → Disable via CONFIG.SECURITY.MAX_CONSOLE_LOGS = 0
 *    → console.log exposes application structure to attackers
 *    → Only use for development debugging
 */

// Set by init.js when loaded first; fallback for pages that only include s.js
if (!window.API_BASE_URL) {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    window.API_BASE_URL = isLocal
        ? `https://api.solisai.video/api`
        : 'https://api.solisai.video/api';
}

// ✅ GLOBAL 401 HANDLER — refresh/retry before forcing logout (survives brief redeploys)
const originalFetch = window.fetch;
let _authLogoutArmed = false;
window.fetch = async function(...args) {
    const url = String(args[0]);
    const options = args[1] || {};
    let response;
    try {
        response = await originalFetch.apply(this, args);
    } catch (networkErr) {
        // Redeploy / blip — never treat network failure as logout
        throw networkErr;
    }

    if (response.status === 502 || response.status === 503 || response.status === 504) {
        return response; // gateway blip during deploy — keep session
    }
    if (response.status !== 401) return response;
    if (url.includes('/auth/logout') || url.includes('/auth/check') || url.includes('/auth/refresh')) {
        return response;
    }
    if (options._authRetried) return response;

    const retryOptions = { ...options, _authRetried: true };

    try {
        const refreshResp = await originalFetch(`${window.API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        if (refreshResp.ok) {
            response = await originalFetch(url, retryOptions);
            if (response.status !== 401) return response;
        } else if (refreshResp.status >= 500 || refreshResp.status === 0) {
            // API restarting — do not wipe session
            return response;
        }

        // One short retry after deploy race
        await new Promise((r) => setTimeout(r, 1800));
        const refresh2 = await originalFetch(`${window.API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        if (refresh2.ok) {
            response = await originalFetch(url, retryOptions);
            if (response.status !== 401) return response;
        }

        const checkResp = await originalFetch(`${window.API_BASE_URL}/auth/check`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (checkResp.ok) {
            const session = await checkResp.json();
            if (session.authenticated && session.user) {
                response = await originalFetch(url, retryOptions);
                if (response.status !== 401) return response;
            }
        } else if (checkResp.status >= 500) {
            return response;
        }
    } catch (_) {
        return response;
    }

    // Only hard-logout when refresh explicitly rejected the session (not deploy noise)
    if (response.status === 401 && !_authLogoutArmed && !window.location.pathname.includes('login')) {
        _authLogoutArmed = true;
        console.error('[GLOBAL 401 HANDLER] Session unrecoverable — redirecting to login');
        window.currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('auth_token');
        if (typeof stopTokenRefreshInterval === 'function') stopTokenRefreshInterval();
        setTimeout(() => { window.location.href = '/login.html'; }, 100);
    }
    return response;
};

// Cooldown timer state
let cooldownTimer = null;

/**
 * Start countdown timer on submit button
 * Shows remaining seconds and disables button until countdown completes
 */
function startCooldownTimer(remainingSeconds) {
    const submitBtn = document.getElementById('processUrlBtn');
    if (!submitBtn) return;
    
    // Cancel any existing timer
    if (cooldownTimer) {
        clearInterval(cooldownTimer);
    }
    
    let secondsLeft = Math.max(0, remainingSeconds);
    const originalText = '<i class="fas fa-arrow-right"></i>';
    
    // Immediately show first countdown
    submitBtn.disabled = true;
    submitBtn.classList.add('is-generating');
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.innerHTML = `${secondsLeft}s`;
    submitBtn.style.fontSize = '0.85em';
    
    // Decrement timer every second
    cooldownTimer = setInterval(() => {
        secondsLeft--;
        
        if (secondsLeft > 0) {
            // Update button text with remaining seconds
            submitBtn.innerHTML = `${secondsLeft}s`;
        } else {
            // Timer complete - re-enable button
            clearInterval(cooldownTimer);
            cooldownTimer = null;
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-generating');
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.innerHTML = originalText;
            submitBtn.style.fontSize = '1em';
        }
    }, 1000);
}

const workspacePanel = document.getElementById('solisWorkspacePanel');
const closeWorkspaceBtn = workspacePanel?.querySelector('.solis-close-btn');

const appContainer = document.getElementById('appContainer');
const sidebar = document.querySelector('.sidebar');
const userProfile = document.getElementById('userProfile');
const userMenu = document.getElementById('userMenu');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const darkModeSettingsToggle = document.getElementById('darkModeSettingsToggle');

const upgradeModal = document.getElementById('upgradeModal');
const closeUpgrade = document.getElementById('closeUpgrade');
const upgradeSettingsBtn = document.getElementById('upgradeSettingsBtn');

const tokenCount = document.querySelector('.token-count');
const navItems = document.querySelectorAll('.nav-item');
const signInBtn = document.getElementById('signInBtn');
const signInDisplay = document.querySelector('.nav-item.sign-in');

let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let isGenerating = false;
let currentTheme = 'light';
let tokens = 1500;
// âŒ REMOVED: chatHistory - sensitive data should NOT be stored in localStorage
// SECURITY: Use sessionStorage only for non-sensitive temporary data
let currentChatId = null;
let currentAbortController = null;
let uploadedFiles = [];
let currentUser = null;
// ðŸ” SECURITY: Authentication via httpOnly cookies only - NEVER use localStorage for tokens
let promptCount = 0; // Track number of prompts for centering first one
let solisWSClient = null; // WebSocket client for real-time updates

// Splitscreen customization
let selectedGameplayClip = 'minecraft_1';
let availableGameplayClips = [];
let _gameplayClipsFetchedAt = 0;
let _gameplayClipsInflight = null;
const GAMEPLAY_CLIPS_TTL_MS = 10 * 60 * 1000;
let splitscreenInverted = true; // Reframe/secondary on top, content on bottom
let splitscreenSecondaryType = 'face_track'; // face_track | gameplay | blank | blank_blur
let splitscreenCanvasMode = 'blank'; // blank | blank_blur — last Canvas variant (legacy)
let splitscreenContentRatio = 0.5;
let splitscreenSavedRatio = 0.5;
let splitscreenSecondaryCollapsed = false;
const SPLITSCREEN_CONTENT_MIN = 0;
const SPLITSCREEN_COLLAPSE_SNAP = 14;
const SPLITSCREEN_IMMERSIVE_ENTER = 0.97; // only extreme secondary share (drag no longer auto-immersive)
const CLIP_MODE_ORDER = ['face_track', 'blur', 'focus']; // dots (+ soft touch swipe)
/** Remember panel ratio per mode so swipe/dots don't lose the user's drag. */
const _clipModeRatioMemory = {
    face_track: 0.5,
    blur: 0.78,
};
/** Blank / blur canvas: cap the fill at 42% from its edge (top if inverted, bottom if not). */
const SPLITSCREEN_CANVAS_MAX = 0.42;
const SPLITSCREEN_PEEK_EXIT = 0.28;
const SPLITSCREEN_COLLAPSE_ANIM_MS = 180;
let _splitscreenDragRaf = 0;
let _splitscreenDragPending = null;
let gameplayPillInitialized = false;
let gpPill = null;
let gpDdLayout = null;
let gpDdClips = null;
let gpPillAnchor = null;
let gpPillFocusMode = null;
let splitscreenVideoCanPlayHandler = null;
let _gpCommittedSecondary = null;
let _gpCommittedLayout = null;
let _splitscreenScopeEl = null;

function setSplitscreenScope(container) {
    _splitscreenScopeEl = container && container.querySelector ? container : null;
}

function _splitscreenQuery(id) {
    if (_splitscreenScopeEl) {
        const scoped = _splitscreenScopeEl.querySelector(`#${id}`);
        if (scoped) return scoped;
    }
    return document.getElementById(id);
}

function buildSplitscreenPreviewShell() {
    return `
        <div id="splitscreenRoot" style="display:flex;flex-direction:column;height:100%;width:100%;background:#111;overflow:hidden;border-radius:inherit;user-select:none;">
            <div id="splitscreenTop" style="flex:0 0 50%;width:100%;min-height:0;background:#000;position:relative;overflow:hidden;">
                <div class="ss-panel-crop-viewport" id="splitscreenContentViewport">
                    <video id="splitscreenContentVideo" autoplay muted loop playsinline preload="auto"></video>
                </div>
            </div>
                <div id="splitscreenDivider" style="flex:0 0 1px;width:100%;height:1px;min-height:1px;max-height:1px;cursor:var(--solis-preview-cursor-hand);display:flex;align-items:center;justify-content:center;position:relative;z-index:50;background:transparent;flex-shrink:0;overflow:visible;padding:0;margin:0;">
                <div id="dividerLine" class="ss-divider-grip" style="position:absolute;left:0;right:0;top:50%;width:100%;height:1px;background:rgba(148,163,184,0.85);border-radius:0;box-shadow:none;pointer-events:none;transform:translateY(-50%);"></div>
            </div>
            <div id="splitscreenBottom" style="flex:1 1 0;width:100%;min-height:0;background:#000;position:relative;overflow:hidden;" data-no-text-select="true">
                <div class="ss-panel-crop-viewport" id="splitscreenSecondaryViewport">
                    <video id="splitscreenGameplayVideo" autoplay muted loop playsinline preload="auto"></video>
                    <video id="splitscreenReframeVideo" autoplay muted loop playsinline preload="auto" style="display:none;"></video>
                </div>
            </div>
        </div>
    `;
}

let _librarySplitscreenCropState = null;
let _librarySplitscreenCropObserver = null;
let _librarySplitscreenObjectUrls = [];
/** Dedicated blob URL for the blank-panel blur <video> (cannot share content's blob:) */
let _blankBlurObjectUrl = null;
let _libraryPlaybackSyncCleanup = null;
let _libraryCropSyncRaf = null;
let _previewAudioEnabled = false;
// Ignore modal backdrop closes right after an in-preview drag (reframe / divider)
let _ignorePreviewModalBackdropCloseUntil = 0;

function armPreviewModalDragGuard(ms = 500) {
    _ignorePreviewModalBackdropCloseUntil = Date.now() + ms;
}

function shouldIgnorePreviewModalBackdropClose() {
    return Date.now() < _ignorePreviewModalBackdropCloseUntil;
}

window.armPreviewModalDragGuard = armPreviewModalDragGuard;
window.shouldIgnorePreviewModalBackdropClose = shouldIgnorePreviewModalBackdropClose;

// Compact speaker icons (filled cone + simple mute slash) — sits on the phone frame
const PREVIEW_AUDIO_ICON_MUTED = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 9.5v5h3.2L12 19.2V4.8L6.7 9.5H3.5z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M16.2 9.2l4.6 5.6M20.8 9.2l-4.6 5.6"/></svg>`;
const PREVIEW_AUDIO_ICON_ON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.5 9.5v5h3.2L12 19.2V4.8L6.7 9.5H3.5z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.6 9.4a3.2 3.2 0 0 1 0 5.2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18.2 7.2a6.2 6.2 0 0 1 0 9.6"/></svg>`;

function getPreviewAudioVideos(container) {
    const root = container || document.getElementById('templateVideoPreview');
    if (!root) return [];
    const content = root.querySelector('#splitscreenContentVideo');
    const library = root.querySelector('video.library-preview-video');
    // Prefer content panel (has the real track). Avoid unmuting reframe too — same source = double audio.
    if (content?.src || content?.currentSrc) return [content];
    if (library?.src || library?.currentSrc) return [library];
    return Array.from(root.querySelectorAll('video')).filter((v) => {
        if (!v.src && !v.currentSrc) return false;
        if (v.id === 'splitscreenReframeVideo' || v.id === 'splitscreenGameplayVideo') return false;
        if (v.classList.contains('gp-blank-blur-vid')) return false;
        return true;
    });
}

function applyPreviewAudioState(container) {
    const root = container || document.getElementById('templateVideoPreview');
    if (!root) return;
    const audioVideos = new Set(getPreviewAudioVideos(root));
    root.querySelectorAll('video').forEach((v) => {
        if (audioVideos.has(v)) {
            // Only flip mute — never pause/seek/restart (that froze looping)
            v.muted = !_previewAudioEnabled;
            if (_previewAudioEnabled) v.volume = 1;
            // Keep loop flag healthy; only kick play if already supposed to be rolling
            v.loop = true;
            if (_previewAudioEnabled && v.paused && !v.ended) {
                v.play().catch(() => {});
            }
        } else {
            v.muted = true;
        }
    });
    const btn = document.getElementById('previewAudioToggle')
        || root.querySelector('.preview-audio-toggle');
    if (btn) {
        btn.hidden = false;
        btn.classList.toggle('is-unmuted', _previewAudioEnabled);
        btn.setAttribute('aria-pressed', _previewAudioEnabled ? 'true' : 'false');
        btn.title = _previewAudioEnabled ? 'Mute preview' : 'Unmute preview';
        btn.setAttribute('aria-label', _previewAudioEnabled ? 'Mute preview' : 'Unmute preview');
        btn.innerHTML = _previewAudioEnabled ? PREVIEW_AUDIO_ICON_ON : PREVIEW_AUDIO_ICON_MUTED;
    }
}

function ensurePreviewAudioToggle(container) {
    const root = container || document.getElementById('templateVideoPreview');
    if (!root) return null;
    let btn = document.getElementById('previewAudioToggle');
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'previewAudioToggle';
        btn.className = 'preview-audio-toggle';
        root.appendChild(btn);
    } else if (btn.parentElement !== root) {
        // Keep chip on the phone frame — never inside the timeline flex row
        root.appendChild(btn);
    }
    if (!btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            _previewAudioEnabled = !_previewAudioEnabled;
            applyPreviewAudioState(document.getElementById('templateVideoPreview') || root);
        });
    }
    // Reset to muted each time a new preview mounts (autoplay policy + expected default)
    _previewAudioEnabled = false;
    applyPreviewAudioState(root);
    return btn;
}

/** Library preview timeline — cached filmstrip + GPU-smooth drag */
const PreviewTimeline = (() => {
    const MIN_TRIM_GAP = 0.25;
    const FRAME_COUNT = 14;
    const FRAME_W = 56;
    const FRAME_H = 100;
    const SEEK_MIN_INTERVAL_MS = 100;
    const CACHE_MAX = 24;
    const filmstripCache = new Map(); // key -> HTMLCanvasElement[]

    let video = null;
    let bound = false;
    let dragging = null; // 'scrub' | 'start' | 'end' | 'bound' | 'segment'
    let trimStart = 0;
    let trimEnd = 1;
    let duration = 0;
    let previewTime = 0;
    let wasPlaying = false;
    let filmstripGen = 0;
    let captureVideo = null;
    let captureObjectUrl = null; // isolated blob so capture seeks don't blank the playing video
    let dragRaf = 0;
    let chromeRaf = 0;
    let pendingPointerX = null;
    let seekTarget = null;
    let seeking = false;
    let lastSeekAt = 0;
    let seekTimer = 0;
    let filmstripIdleTimer = 0;
    let trackLeft = 0;
    let trackWidth = 1;
    let splitPoints = []; // seconds
    let selectedSegIndex = null; // focused block for silence / improve / edit
    /** Dead-air cuts (source time) — playback seeks over these; filmstrip dims them */
    let skipRegions = [];
    /** Pending cuts — red preview only until user accepts */
    let previewSkipRegions = [];
    /** Queued when timeline not ready yet (duration / metrics missing) */
    let pendingPreviewSkipRegions = null;
    let boundIndex = -1;
    let boundLo = 0;
    let boundHi = 1;
    let boundSplitKey = null;
    let handlesUnlocked = false;
    let pendingSplits = null;
    // Segment pill: click = customize; ranking-edit hold-drag = reorder clips;
    // otherwise drag = slide clip window
    let segHoldTimer = 0;
    let segPending = null; // { index, pointerId, startX, startA, startB, target, hoverIndex }
    let segMoved = false;
    let segHoldReady = false;
    const SEG_HOLD_MS = 220;
    const SEG_MOVE_PX = 14;
    // Physical base ranks left→right on ranking timeline (countdown #5 → #1)
    let clipOrder = [5, 4, 3, 2, 1];
    const cleanups = [];

    // Cached DOM refs (refreshed on attach)
    let $shell; let $wrap; let $current; let $durationEl; let $track;
    let $filmstrip; let $segments; let $dimL; let $dimR; let $selection;
    let $handleL; let $handleR; let $playhead;

    function refreshEls() {
        $shell = document.getElementById('previewTimelineShell');
        $wrap = document.getElementById('previewTimelineWrap');
        $current = document.getElementById('previewTimelineCurrent');
        $durationEl = document.getElementById('previewTimelineDuration');
        // Wrap IS the rail / scrub track
        $track = $wrap;
        $filmstrip = document.getElementById('previewTimelineFilmstrip');
        $segments = document.getElementById('previewTimelineSegments');
        $dimL = document.getElementById('previewTimelineDimLeft');
        $dimR = document.getElementById('previewTimelineDimRight');
        $selection = document.getElementById('previewTimelineSelection');
        $handleL = document.getElementById('previewTimelineHandleL');
        $handleR = document.getElementById('previewTimelineHandleR');
        $playhead = document.getElementById('previewTimelinePlayhead');
    }

    function setHandlesUnlocked(next) {
        handlesUnlocked = !!next;
        if ($shell) $shell.classList.toggle('handles-on', handlesUnlocked);
    }

    function setRankingEditMode(on) {
        refreshEls();
        if ($shell) $shell.classList.toggle('is-ranking-edit', !!on);
        if (on) setHandlesUnlocked(true);
        if (!on) clipOrder = [5, 4, 3, 2, 1];
    }

    function isRankingEdit() {
        return !!$shell?.classList.contains('is-ranking-edit');
    }

    function getClipOrder() {
        const n = Math.max(1, getSegmentBounds().length - 1);
        while (clipOrder.length < n) {
            const next = Math.max(1, 5 - clipOrder.length);
            if (!clipOrder.includes(next)) clipOrder.push(next);
            else clipOrder.push(clipOrder.length + 1);
        }
        return clipOrder.slice(0, n);
    }

    function setClipOrder(order) {
        if (!Array.isArray(order) || !order.length) {
            clipOrder = [5, 4, 3, 2, 1];
            return;
        }
        const cleaned = order.map((r) => Math.max(1, Math.min(5, Number(r) || 0))).filter(Boolean);
        clipOrder = cleaned.length ? cleaned : [5, 4, 3, 2, 1];
    }

    function markRankingTimelineDirty() {
        try { PreviewTimeline._rankingTouched = true; } catch (_) { /* ignore */ }
        try {
            const studio = window.clipsStudio;
            if (studio?.currentTemplateForPreview?.isLibraryPreview && studio._libraryRankingEditable) {
                if (studio._libraryDirtyArmed === false) return;
                studio._libraryRankingDirty = true;
                if (typeof window.syncLibraryConfirmLabel === 'function') window.syncLibraryConfirmLabel();
                else {
                    const btn = document.getElementById('confirmUseTemplateBtn');
                    if (btn) {
                        btn.textContent = 'Apply & Download';
                        btn.classList.add('library-download-mode');
                    }
                    if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
                }
            }
        } catch (_) { /* ignore */ }
        try { markLibrarySplitscreenDirty(); } catch (_) { /* ignore */ }
    }

    function segmentIndexAtClientX(clientX) {
        const bounds = getSegmentBounds();
        if (bounds.length < 2) return -1;
        const t = timeFromClientX(clientX);
        for (let i = 0; i < bounds.length - 1; i++) {
            if (t >= bounds[i] - 0.001 && t <= bounds[i + 1] + 0.001) return i;
        }
        if (t < bounds[0]) return 0;
        return bounds.length - 2;
    }

    function rebuildSplitsFromLengths(lens) {
        if (!lens.length) return;
        let a = trimStart;
        splitPoints = [];
        for (let i = 0; i < lens.length - 1; i++) {
            a += Math.max(MIN_TRIM_GAP, Number(lens[i]) || MIN_TRIM_GAP);
            if (a < trimEnd - 0.04) splitPoints.push(a);
        }
        const totalLens = lens.reduce((s, v) => s + Math.max(MIN_TRIM_GAP, Number(v) || MIN_TRIM_GAP), 0);
        const desiredEnd = trimStart + totalLens;
        if (desiredEnd > trimStart + MIN_TRIM_GAP) {
            trimEnd = Math.min(duration, desiredEnd);
        }
    }

    function applySegmentReorder(fromIdx, toIdx) {
        const bounds = getSegmentBounds();
        const n = bounds.length - 1;
        if (fromIdx < 0 || toIdx < 0 || fromIdx >= n || toIdx >= n || fromIdx === toIdx) return false;

        const order = getClipOrder();
        const [movedRank] = order.splice(fromIdx, 1);
        order.splice(toIdx, 0, movedRank);
        clipOrder = order;

        const lens = [];
        for (let i = 0; i < n; i++) lens.push(Math.max(MIN_TRIM_GAP, bounds[i + 1] - bounds[i]));
        const [movedLen] = lens.splice(fromIdx, 1);
        lens.splice(toIdx, 0, movedLen);
        rebuildSplitsFromLengths(lens);

        try {
            window.clipsStudio?.onRankingClipReorder?.(clipOrder.slice());
        } catch (_) { /* ignore */ }
        return true;
    }

    function paintSegmentReorderGhost(clientX) {
        if (!segPending || !isRankingEdit()) return;
        const over = segmentIndexAtClientX(clientX);
        segPending.hoverIndex = over;
        const kids = Array.from($segments?.children || []);
        kids.forEach((el, i) => {
            el.classList.toggle('is-drop-target', i === over && i !== segPending.index);
            el.classList.toggle('is-dragging', i === segPending.index);
        });
        const dx = clientX - segPending.startX;
        const dragged = kids[segPending.index];
        if (dragged) {
            const baseLeft = (() => {
                const bounds = getSegmentBounds();
                return (bounds[segPending.index] / duration) * trackWidth;
            })();
            dragged.style.transform = `translate3d(${baseLeft + dx}px,0,0)`;
            dragged.style.zIndex = '5';
        }
    }

    function fmt(t) {
        if (!Number.isFinite(t) || t < 0) t = 0;
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function cacheKey(src, dur) {
        return `${src}|${Math.round(dur * 10) / 10}|${FRAME_COUNT}`;
    }

    function rememberCache(key, canvases) {
        if (filmstripCache.has(key)) filmstripCache.delete(key);
        filmstripCache.set(key, canvases);
        while (filmstripCache.size > CACHE_MAX) {
            const oldest = filmstripCache.keys().next().value;
            filmstripCache.delete(oldest);
        }
    }

    function cacheTrackMetrics() {
        if (!$track) return;
        const rect = $track.getBoundingClientRect();
        trackLeft = rect.left;
        trackWidth = Math.max(1, rect.width);
    }

    function timeFromClientX(clientX) {
        if (!duration) return 0;
        const ratio = (clientX - trackLeft) / trackWidth;
        return Math.max(0, Math.min(duration, ratio * duration));
    }

    function paintChrome({ rebuildSegments = false } = {}) {
        // Always keep time chips honest — even before track metrics settle
        const resizing = dragging === 'start' || dragging === 'end' || dragging === 'bound' || dragging === 'segment';
        if (!resizing) {
            if ($current) $current.textContent = fmt(previewTime);
            if ($durationEl) $durationEl.textContent = fmt(duration || 0);
        }
        if (!duration || trackWidth <= 0) return;

        const startX = (trimStart / duration) * trackWidth;
        const endX = (trimEnd / duration) * trackWidth;
        const selW = Math.max(2, endX - startX);

        if ($selection) {
            $selection.style.width = `${selW}px`;
            $selection.style.transform = `translate3d(${startX}px,0,0)`;
        }
        if ($dimL) $dimL.style.width = `${startX}px`;
        if ($dimR) $dimR.style.width = `${Math.max(0, trackWidth - endX)}px`;

        if ($playhead && !resizing) {
            const headT = Math.max(trimStart, Math.min(trimEnd, previewTime));
            const headX = (headT / duration) * trackWidth;
            $playhead.style.transform = `translate3d(${headX}px,0,0) translateX(-50%)`;
        }

        if (!resizing && $track) {
            $track.setAttribute('aria-valuenow', String(Math.round((previewTime / duration) * 100)));
            $track.setAttribute('aria-valuetext', fmt(previewTime));
        }

        // Never rebuild segment DOM on every timeupdate — that clones canvases and
        // stalls the preview phone while the video is playing.
        if (resizing) paintSegmentsFast();
        else if (rebuildSegments) paintSegments();
        paintSilenceCuts();
        paintCutPreview();
    }

    function paintCutPreview() {
        if (!$wrap || !duration || trackWidth <= 0) return;
        let layer = $wrap.querySelector('.preview-timeline-cut-preview');
        if (!previewSkipRegions.length) {
            if (layer) layer.remove();
            if ($wrap) $wrap.classList.remove('has-cut-preview');
            return;
        }
        if (!$wrap.classList.contains('has-cut-preview')) {
            $wrap.classList.add('has-cut-preview');
        }
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'preview-timeline-cut-preview';
            layer.setAttribute('aria-hidden', 'true');
            $wrap.appendChild(layer);
        }
        layer.innerHTML = '';
        const frag = document.createDocumentFragment();
        for (const r of previewSkipRegions) {
            const left = (r.start / duration) * trackWidth;
            const width = Math.max(2, ((r.end - r.start) / duration) * trackWidth);
            const el = document.createElement('i');
            el.style.transform = `translate3d(${left}px,0,0)`;
            el.style.width = `${width}px`;
            frag.appendChild(el);
        }
        layer.appendChild(frag);
    }

    function flushPendingPreviewRegions() {
        if (!pendingPreviewSkipRegions) return;
        if (!bound || !duration || trackWidth <= 0) return;
        previewSkipRegions = pendingPreviewSkipRegions;
        pendingPreviewSkipRegions = null;
        paintCutPreview();
    }

    function paintSilenceCuts() {
        if (!$wrap || !duration || trackWidth <= 0) return;
        let layer = $wrap.querySelector('.preview-timeline-silence-cuts');
        if (!skipRegions.length) {
            if (layer) layer.remove();
            return;
        }
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'preview-timeline-silence-cuts';
            layer.setAttribute('aria-hidden', 'true');
            $wrap.appendChild(layer);
        }
        layer.innerHTML = '';
        const frag = document.createDocumentFragment();
        for (const r of skipRegions) {
            const left = (r.start / duration) * trackWidth;
            const width = Math.max(2, ((r.end - r.start) / duration) * trackWidth);
            const el = document.createElement('i');
            el.style.transform = `translate3d(${left}px,0,0)`;
            el.style.width = `${width}px`;
            frag.appendChild(el);
        }
        layer.appendChild(frag);
    }

    function schedulePaintChrome(opts) {
        if (chromeRaf) return;
        chromeRaf = requestAnimationFrame(() => {
            chromeRaf = 0;
            paintChrome(opts);
        });
    }

    function cloneFilmInto(inner) {
        if (!$filmstrip) return;
        const frames = $filmstrip.querySelectorAll('.preview-timeline-frame');
        if (!frames.length) {
            // placeholder bar
            for (let i = 0; i < FRAME_COUNT; i++) {
                const cell = document.createElement('div');
                cell.className = 'preview-timeline-frame';
                inner.appendChild(cell);
            }
            return;
        }
        frames.forEach((frame) => {
            const cell = document.createElement('div');
            cell.className = 'preview-timeline-frame';
            const srcCanvas = frame.querySelector('canvas');
            if (srcCanvas) {
                const canvas = document.createElement('canvas');
                canvas.width = srcCanvas.width;
                canvas.height = srcCanvas.height;
                canvas.getContext('2d')?.drawImage(srcCanvas, 0, 0);
                cell.appendChild(canvas);
            }
            inner.appendChild(cell);
        });
    }

    const SEGMENT_GAP_PX = 6;

    function getSegmentBounds() {
        const innerSplits = splitPoints.filter((t) => t > trimStart + 0.04 && t < trimEnd - 0.04);
        return [trimStart, ...innerSplits, trimEnd];
    }

    function makeSegHandle(side, boundIdx) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `preview-timeline-handle ${side}`;
        btn.setAttribute('aria-label', side === 'left' ? 'Drag clip start' : 'Drag clip end');
        btn.title = side === 'left' ? 'Drag to adjust start' : 'Drag to adjust end';
        btn.dataset.boundIndex = String(boundIdx);
        btn.addEventListener('pointerdown', (e) => startBoundDrag(boundIdx, e));
        return btn;
    }

    function clearSegHold() {
        if (segHoldTimer) {
            clearTimeout(segHoldTimer);
            segHoldTimer = 0;
        }
        segHoldReady = false;
    }

    function syncSegFocusClass() {
        if (!$shell) return;
        const focus = selectedSegIndex != null && getSegmentBounds().length > 2;
        $shell.classList.toggle('has-seg-focus', focus);
    }

    function getActiveEditRange() {
        const bounds = getSegmentBounds();
        if (selectedSegIndex != null
            && selectedSegIndex >= 0
            && selectedSegIndex < bounds.length - 1) {
            return {
                start: bounds[selectedSegIndex],
                end: bounds[selectedSegIndex + 1],
                segIndex: selectedSegIndex,
            };
        }
        return {
            start: trimStart,
            end: trimEnd > trimStart ? trimEnd : duration,
            segIndex: null,
        };
    }

    function selectSegmentAtTime(t) {
        const bounds = getSegmentBounds();
        if (bounds.length < 2) return null;
        const time = Number(t);
        for (let i = 0; i < bounds.length - 1; i++) {
            const a = bounds[i];
            const b = bounds[i + 1];
            // Last segment includes end
            if (time >= a - 0.02 && (i === bounds.length - 2 ? time <= b + 0.02 : time < b - 0.01)) {
                customizeSegment(i);
                return i;
            }
        }
        return null;
    }

    function customizeSegment(segIndex) {
        // Always select + seek so a tap feels immediate.
        const bounds = getSegmentBounds();
        if (segIndex < 0 || segIndex >= bounds.length - 1) return;
        selectedSegIndex = segIndex;
        const a = bounds[segIndex];
        const b = bounds[segIndex + 1];
        // Land playhead inside the block (not always on the left edge)
        const mid = a + Math.min(0.35, Math.max(0.12, (b - a) * 0.12));
        previewTime = Math.max(a, Math.min(b - 0.05, mid));
        scheduleSeek(previewTime, true);
        paintChrome();
        $segments?.querySelectorAll('.preview-timeline-segment.is-selected')
            .forEach((el) => el.classList.remove('is-selected'));
        $segments?.children?.[segIndex]?.classList.add('is-selected');
        if (!handlesUnlocked) setHandlesUnlocked(true);
        syncSegFocusClass();

        // Soft hint — silence / improve target this block
        try {
            const note = document.getElementById('silencerNote');
            if (note && bounds.length > 2) {
                note.hidden = false;
                note.textContent = `Editing block ${segIndex + 1} of ${bounds.length - 1}`;
                note.classList.add('is-visible');
                if (note._segHintTimer) clearTimeout(note._segHintTimer);
                note._segHintTimer = setTimeout(() => {
                    note.classList.remove('is-visible');
                    setTimeout(() => { if (note.textContent.startsWith('Editing block')) note.hidden = true; }, 180);
                }, 1600);
            }
        } catch (_) { /* ignore */ }

        // Ranking countdown positions #5 → #1 map to segment 0 → 4;
        // physical base may differ after reorder — select the display rank slot.
        const rank = Math.max(1, 5 - segIndex);
        const root = document.querySelector(
            '#templateVideoPreview .ranking-preview-container, .ranking-preview-container'
        );
        const numberEl = root?.querySelector(
            `[data-template-element-id="rank_${rank}_number"]`
        );
        const titleEl = root?.querySelector(
            `[data-template-element-id="rank_${rank}_title"]`
        );
        const target = numberEl || titleEl;
        if (!target) return;

        try {
            const editor = window.rankingTemplateEditor;
            if (editor?.handleTextClick) {
                editor.handleTextClick(target, false, null);
            } else if (window.RankingTextPill?.selectElements) {
                window.RankingTextPill.selectElements([target], 'single', target);
            }
        } catch (_) { /* ignore */ }
    }

    function applySegmentTimes(segIndex, newA, newB) {
        const bounds = getSegmentBounds();
        if (segIndex < 0 || segIndex >= bounds.length - 1) return;
        const lo = segIndex === 0 ? 0 : bounds[segIndex - 1] + MIN_TRIM_GAP;
        const hi = segIndex >= bounds.length - 2
            ? duration
            : bounds[segIndex + 2] - MIN_TRIM_GAP;
        const len = Math.max(MIN_TRIM_GAP, newB - newA);
        let a = Math.max(lo, Math.min(newA, hi - len));
        let b = a + len;
        if (b > hi) {
            b = hi;
            a = Math.max(lo, b - len);
        }

        // Write endpoints back onto trim / splits
        if (segIndex === 0) trimStart = a;
        else {
            const key = bounds[segIndex];
            const si = splitPoints.findIndex((p) => Math.abs(p - key) < 0.05);
            if (si >= 0) splitPoints[si] = a;
            else splitPoints.push(a);
        }
        if (segIndex === bounds.length - 2) trimEnd = b;
        else {
            const key = bounds[segIndex + 1];
            const si = splitPoints.findIndex((p) => Math.abs(p - key) < 0.05);
            if (si >= 0) splitPoints[si] = b;
            else splitPoints.push(b);
        }
        splitPoints = splitPoints
            .filter((t) => t > trimStart + 0.04 && t < trimEnd - 0.04)
            .sort((x, y) => x - y);
    }

    function paintSegmentMove(clientX) {
        if (!segPending || !duration || trackWidth <= 0) return;
        if (isRankingEdit()) {
            paintSegmentReorderGhost(clientX);
            return;
        }
        const { index, startX, startA, startB } = segPending;
        const dt = ((clientX - startX) / trackWidth) * duration;
        applySegmentTimes(index, startA + dt, startB + dt);
        previewTime = Math.max(trimStart, Math.min(trimEnd, startA + dt));
        const startPx = (trimStart / duration) * trackWidth;
        const endPx = (trimEnd / duration) * trackWidth;
        if ($selection) {
            $selection.style.width = `${Math.max(2, endPx - startPx)}px`;
            $selection.style.transform = `translate3d(${startPx}px,0,0)`;
        }
        if ($dimL) $dimL.style.width = `${startPx}px`;
        if ($dimR) $dimR.style.width = `${Math.max(0, trackWidth - endPx)}px`;
        paintSegmentsFast();
    }

    function beginSegmentDrag() {
        if (!segPending || dragging === 'segment') return;
        clearTimeout(segHoldTimer);
        segHoldTimer = 0;
        // Ranking: require hold before reorder so taps still customize
        if (isRankingEdit() && !segHoldReady) return;
        // Do NOT mark segMoved here — only real pointer travel commits a move
        dragging = 'segment';
        wasPlaying = video ? !video.paused : false;
        if (video && !video.paused) video.pause();
        $track?.classList.add('is-dragging', 'is-trimming');
        if (isRankingEdit()) $track?.classList.add('is-reordering');
        segPending.target?.classList.add('is-dragging');
        $segments?.children?.[segPending.index]?.classList.add('is-dragging');
        if (segPending.target?.setPointerCapture && segPending.pointerId != null) {
            try { segPending.target.setPointerCapture(segPending.pointerId); } catch (_) { /* ignore */ }
        }
    }

    function onSegmentPointerDown(segIndex, e) {
        if (e.target?.closest?.('.preview-timeline-handle')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (!handlesUnlocked && !$shell?.classList.contains('is-ranking-edit')) {
            setHandlesUnlocked(true);
        }
        cacheTrackMetrics();
        clearSegHold();
        const bounds = getSegmentBounds();
        if (segIndex < 0 || segIndex >= bounds.length - 1) return;
        segMoved = false;
        segHoldReady = false;
        segPending = {
            index: segIndex,
            pointerId: e.pointerId,
            startX: e.clientX,
            startA: bounds[segIndex],
            startB: bounds[segIndex + 1],
            target: e.currentTarget,
        };
        // Hold only unlocks drag intent — never starts a drag by itself
        segHoldTimer = setTimeout(() => {
            segHoldTimer = 0;
            segHoldReady = true;
            segPending?.target?.classList.add('is-hold-ready');
        }, SEG_HOLD_MS);
    }

    function onSegmentPointerMove(e) {
        if (!segPending) return;
        const dx = Math.abs(e.clientX - segPending.startX);
        if (dragging === 'segment') {
            e.preventDefault();
            if (dx >= SEG_MOVE_PX) segMoved = true;
            // Ignore micro-jitter until we've truly moved
            if (!segMoved) return;
            paintSegmentMove(e.clientX);
            return;
        }
        // Ranking reorder: hold first, then travel
        if (isRankingEdit()) {
            if (segHoldReady && dx >= SEG_MOVE_PX) {
                beginSegmentDrag();
                if (dragging === 'segment') {
                    segMoved = true;
                    paintSegmentMove(e.clientX);
                }
            }
            return;
        }
        // Non-ranking: start drag after intentional travel (hold optional)
        if (dx >= SEG_MOVE_PX) {
            beginSegmentDrag();
            segMoved = true;
            paintSegmentMove(e.clientX);
        }
    }

    function onSegmentPointerUp(e) {
        if (!segPending) return;
        const pending = segPending;
        const didMove = segMoved;
        const hoverIndex = pending.hoverIndex;
        clearSegHold();
        pending.target?.classList.remove('is-dragging', 'is-hold-ready');
        $segments?.children?.[pending.index]?.classList.remove('is-dragging');
        $segments?.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
        $track?.classList.remove('is-reordering');

        // Revert any accidental drag chrome if we never crossed the move threshold
        if (dragging === 'segment' && !didMove) {
            dragging = null;
            segPending = null;
            $track?.classList.remove('is-dragging', 'is-trimming');
            if (wasPlaying) video?.play().catch(() => {});
            wasPlaying = false;
            // Fall through as a click
            customizeSegment(pending.index);
            return;
        }

        if (didMove) {
            const reordered = isRankingEdit()
                && hoverIndex != null
                && hoverIndex !== pending.index
                && applySegmentReorder(pending.index, hoverIndex);
            dragging = null;
            segPending = null;
            markRankingTimelineDirty();
            scheduleSeek(previewTime, true);
            if (wasPlaying) video?.play().catch(() => {});
            wasPlaying = false;
            paintChrome({ rebuildSegments: true });
            if (reordered) {
                try {
                    showNotification?.('Clip order updated — Apply & Download to burn.', 'info');
                } catch (_) { /* ignore */ }
            }
            return;
        }

        // Short tap → customize that ranking clip
        segPending = null;
        dragging = null;
        customizeSegment(pending.index);
    }

    function paintSegments(flashAt) {
        if (!$segments || !duration || trackWidth <= 0) return;
        const bounds = getSegmentBounds();
        $segments.innerHTML = '';

        for (let i = 0; i < bounds.length - 1; i++) {
            const a = bounds[i];
            const b = bounds[i + 1];
            let left = (a / duration) * trackWidth;
            let right = (b / duration) * trackWidth;
            if (i > 0) left += SEGMENT_GAP_PX / 2;
            if (i < bounds.length - 2) right -= SEGMENT_GAP_PX / 2;
            const width = Math.max(8, right - left);

            const seg = document.createElement('div');
            seg.className = 'preview-timeline-segment';
            seg.dataset.segIndex = String(i);
            if (flashAt != null && (Math.abs(a - flashAt) < 0.03 || Math.abs(b - flashAt) < 0.03)) {
                seg.classList.add('is-new');
            }
            seg.style.width = `${width}px`;
            seg.style.transform = `translate3d(${left}px,0,0)`;

            const clip = document.createElement('div');
            clip.className = 'preview-timeline-segment-clip';
            const physical = getClipOrder()[i] || (5 - i);
            clip.title = isRankingEdit()
                ? `Tap to edit · hold & drag to reorder`
                : 'Tap · drag edges to trim';
            clip.setAttribute('role', 'button');
            clip.tabIndex = 0;
            clip.dataset.physicalRank = String(physical);
            if (isRankingEdit()) {
                const badge = document.createElement('span');
                badge.className = 'preview-timeline-seg-rank';
                badge.textContent = `#${5 - i}`;
                clip.appendChild(badge);
            }
            const inner = document.createElement('div');
            inner.className = 'preview-timeline-segment-film';
            inner.style.width = `${trackWidth}px`;
            inner.style.transform = `translate3d(${-left}px,0,0)`;
            cloneFilmInto(inner);
            clip.appendChild(inner);
            clip.addEventListener('pointerdown', (e) => onSegmentPointerDown(i, e));
            clip.addEventListener('pointermove', onSegmentPointerMove);
            clip.addEventListener('pointerup', onSegmentPointerUp);
            clip.addEventListener('pointercancel', onSegmentPointerUp);
            seg.appendChild(clip);

            // One handle per bound — never double-stack left+right on the same split
            if (i === 0) seg.appendChild(makeSegHandle('left', i));
            seg.appendChild(makeSegHandle('right', i + 1));

            $segments.appendChild(seg);
        }
        // Restore focused block after rebuild
        if (selectedSegIndex != null && $segments?.children?.[selectedSegIndex]) {
            $segments.children[selectedSegIndex].classList.add('is-selected');
        }
        syncSegFocusClass();
    }

    /** During trim drag — reposition existing segments without recloning canvases */
    function paintSegmentsFast() {
        if (!$segments || !duration || trackWidth <= 0) return;
        const kids = Array.from($segments.children);
        const bounds = getSegmentBounds();
        if (kids.length !== bounds.length - 1) {
            paintSegments();
            return;
        }
        for (let i = 0; i < bounds.length - 1; i++) {
            const a = bounds[i];
            const b = bounds[i + 1];
            let left = (a / duration) * trackWidth;
            let right = (b / duration) * trackWidth;
            if (i > 0) left += SEGMENT_GAP_PX / 2;
            if (i < bounds.length - 2) right -= SEGMENT_GAP_PX / 2;
            const width = Math.max(6, right - left);
            const seg = kids[i];
            seg.style.width = `${width}px`;
            seg.style.transform = `translate3d(${left}px,0,0)`;
            const inner = seg.querySelector('.preview-timeline-segment-film');
            if (inner) {
                inner.style.width = `${trackWidth}px`;
                inner.style.transform = `translate3d(${-left}px,0,0)`;
            }
            const hL = seg.querySelector('.preview-timeline-handle.left');
            const hR = seg.querySelector('.preview-timeline-handle.right');
            if (hL) hL.dataset.boundIndex = String(i);
            if (hR) hR.dataset.boundIndex = String(i + 1);
        }
    }

    function applyBoundTime(newT) {
        if (boundIndex === 0) {
            trimStart = newT;
            return;
        }
        const bounds = getSegmentBounds();
        if (boundIndex >= bounds.length - 1) {
            trimEnd = newT;
            return;
        }
        // Interior split
        if (boundSplitKey != null) {
            const si = splitPoints.findIndex((p) => Math.abs(p - boundSplitKey) < 0.05);
            if (si >= 0) splitPoints[si] = newT;
            else splitPoints.push(newT);
            boundSplitKey = newT;
        } else {
            splitPoints.push(newT);
        }
        splitPoints.sort((a, b) => a - b);
    }

    function paintBoundFast(clientX) {
        if (!duration || trackWidth <= 0 || boundIndex < 0) return;
        const t = timeFromClientX(clientX);
        const newT = Math.max(boundLo, Math.min(boundHi, t));
        applyBoundTime(newT);
        previewTime = newT;

        const startX = (trimStart / duration) * trackWidth;
        const endX = (trimEnd / duration) * trackWidth;
        if ($selection) {
            $selection.style.width = `${Math.max(2, endX - startX)}px`;
            $selection.style.transform = `translate3d(${startX}px,0,0)`;
        }
        if ($dimL) $dimL.style.width = `${startX}px`;
        if ($dimR) $dimR.style.width = `${Math.max(0, trackWidth - endX)}px`;
        paintSegmentsFast();
    }

    function startBoundDrag(index, e) {
        // Ranking library: always allow bound drags (handles stay visible)
        if (!handlesUnlocked && !$shell?.classList.contains('is-ranking-edit')) return;
        if (!handlesUnlocked) setHandlesUnlocked(true);
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        cacheTrackMetrics();
        const bounds = getSegmentBounds();
        if (index < 0 || index >= bounds.length) return;

        dragging = 'bound';
        boundIndex = index;
        boundLo = index === 0 ? 0 : bounds[index - 1] + MIN_TRIM_GAP;
        boundHi = index === bounds.length - 1 ? duration : bounds[index + 1] - MIN_TRIM_GAP;
        boundSplitKey = (index > 0 && index < bounds.length - 1) ? bounds[index] : null;

        wasPlaying = video ? !video.paused : false;
        if (video && !video.paused) video.pause();

        $track?.classList.add('is-dragging', 'is-trimming');
        e.currentTarget?.classList.add('is-dragging');
        if (e.currentTarget?.setPointerCapture && e.pointerId != null) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        paintBoundFast(e.clientX);
    }

    function paintTrimFast(clientX) {
        if (!duration || trackWidth <= 0) return;
        if (dragging === 'bound') {
            paintBoundFast(clientX);
            return;
        }
        const t = timeFromClientX(clientX);
        if (dragging === 'start') {
            trimStart = Math.max(0, Math.min(t, trimEnd - MIN_TRIM_GAP));
        } else if (dragging === 'end') {
            trimEnd = Math.min(duration, Math.max(t, trimStart + MIN_TRIM_GAP));
        } else {
            return;
        }
        const startX = (trimStart / duration) * trackWidth;
        const endX = (trimEnd / duration) * trackWidth;
        const selW = Math.max(2, endX - startX);
        if ($selection) {
            $selection.style.width = `${selW}px`;
            $selection.style.transform = `translate3d(${startX}px,0,0)`;
        }
        if ($dimL) $dimL.style.width = `${startX}px`;
        if ($dimR) $dimR.style.width = `${Math.max(0, trackWidth - endX)}px`;
        paintSegmentsFast();
    }

    function scheduleSeek(t, force = false) {
        if (!video || !Number.isFinite(t)) return;
        seekTarget = Math.max(0, Math.min(duration || t, t));
        const now = performance.now();
        const wait = force ? 0 : Math.max(0, SEEK_MIN_INTERVAL_MS - (now - lastSeekAt));
        if (seekTimer) {
            clearTimeout(seekTimer);
            seekTimer = 0;
        }
        if (wait === 0) {
            flushSeek();
        } else {
            seekTimer = setTimeout(() => {
                seekTimer = 0;
                flushSeek();
            }, wait);
        }
    }

    function flushSeek() {
        if (!video || seekTarget == null || seeking) return;
        const t = seekTarget;
        seekTarget = null;
        if (Math.abs((video.currentTime || 0) - t) < 0.012) {
            if (!dragging) {
                previewTime = video.currentTime || t;
                paintChrome();
            }
            return;
        }
        seeking = true;
        lastSeekAt = performance.now();
        const onSeeked = () => {
            seeking = false;
            video.removeEventListener('seeked', onSeeked);
            if (!dragging) {
                previewTime = video.currentTime || previewTime;
                paintChrome();
            }
            if (seekTarget != null) flushSeek();
        };
        video.addEventListener('seeked', onSeeked);
        try {
            video.currentTime = t;
        } catch (_) {
            seeking = false;
        }
    }

    function waitEvent(el, event, timeoutMs = 2000) {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                el.removeEventListener(event, finish);
                resolve();
            };
            el.addEventListener(event, finish);
            setTimeout(finish, timeoutMs);
        });
    }

    async function seekCapture(cap, t) {
        if (!cap) return;
        // Always seek — browsers often report "close enough" before a decoded frame lands
        try {
            if (Math.abs((cap.currentTime || 0) - t) > 0.01) {
                cap.currentTime = t;
                await waitEvent(cap, 'seeked', 2000);
            }
        } catch (_) { /* ignore */ }
        // Wait until a real frame is available (seeked alone can still be black)
        await new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                resolve();
            };
            if (typeof cap.requestVideoFrameCallback === 'function') {
                try {
                    cap.requestVideoFrameCallback(() => done());
                    setTimeout(done, 280);
                    return;
                } catch (_) { /* fall through */ }
            }
            setTimeout(done, 60);
        });
    }

    function destroyCaptureVideo() {
        if (captureVideo) {
            try {
                captureVideo.pause();
                captureVideo.removeAttribute('src');
                captureVideo.load();
            } catch (_) { /* ignore */ }
            captureVideo = null;
        }
        if (captureObjectUrl) {
            try { URL.revokeObjectURL(captureObjectUrl); } catch (_) { /* ignore */ }
            captureObjectUrl = null;
        }
    }

    /** Separate media source so filmstrip seeks never blank / stall the playing preview. */
    async function resolveCaptureSrc(src) {
        if (!src) return '';
        // Range-streamed /clips/preview URLs MUST be blob-cloned — a second <video>
        // seeking on the same HTTP connection freezes / glitches the playing preview.
        const shouldClone = src.startsWith('blob:')
            || /\/clips\/preview\//i.test(src)
            || /\/clips\/projects\/[^/]+\/preview/i.test(src)
            || /\/clips\/projects\/[^/]+\/splitscreen-layer\//i.test(src)
            || /library[-_/]?preview/i.test(src);
        if (!shouldClone) return src;

        // Session cache: reuse the same blob for filmstrip + remount (no second API pull)
        try {
            const cached = window.LibraryPreviewMediaCache?.getBySrc?.(src);
            if (cached?.objectUrl) return cached.objectUrl;
        } catch (_) { /* ignore */ }

        try {
            const res = await fetch(src, { credentials: 'include', cache: 'force-cache' });
            if (!res.ok) return src;
            const blob = await res.blob();
            if (!blob.size) return src;
            const typed = blob.type ? blob : new Blob([blob], { type: 'video/mp4' });
            if (captureObjectUrl) {
                try { URL.revokeObjectURL(captureObjectUrl); } catch (_) { /* ignore */ }
            }
            captureObjectUrl = URL.createObjectURL(typed);
            try {
                window.LibraryPreviewMediaCache?.rememberSrc?.(src, typed, captureObjectUrl);
            } catch (_) { /* ignore */ }
            return captureObjectUrl;
        } catch (_) {
            return src;
        }
    }

    function mountFilmstripCanvases(canvases) {
        if (!$filmstrip) return;
        $filmstrip.innerHTML = '';
        const frag = document.createDocumentFragment();
        for (let i = 0; i < FRAME_COUNT; i++) {
            const cell = document.createElement('div');
            cell.className = 'preview-timeline-frame';
            const srcCanvas = canvases?.[i];
            if (srcCanvas) {
                const canvas = document.createElement('canvas');
                canvas.width = srcCanvas.width;
                canvas.height = srcCanvas.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(srcCanvas, 0, 0);
                cell.appendChild(canvas);
            }
            frag.appendChild(cell);
        }
        $filmstrip.appendChild(frag);
        paintSegments();
    }

    function buildPlaceholderFilmstrip() {
        mountFilmstripCanvases(null);
    }

    async function buildFilmstripFromVideo() {
        if (!$filmstrip || !video) return;
        const src = video.currentSrc || video.src;
        if (!src || !duration || duration <= 0) {
            buildPlaceholderFilmstrip();
            return;
        }

        const key = cacheKey(src, duration);
        const cached = filmstripCache.get(key);
        if (cached?.length) {
            mountFilmstripCanvases(cached);
            return;
        }

        const gen = ++filmstripGen;
        // Slate placeholders only — never progressive frame-by-frame reveal
        buildPlaceholderFilmstrip();

        destroyCaptureVideo();
        const cap = document.createElement('video');
        cap.muted = true;
        cap.playsInline = true;
        cap.preload = 'auto';
        cap.setAttribute('playsinline', '');
        // Isolated URL — sharing blob:/stream src with the playing video blanks it
        cap.src = await resolveCaptureSrc(src);
        if (gen !== filmstripGen) {
            destroyCaptureVideo();
            return;
        }
        captureVideo = cap;

        try {
            await Promise.race([
                waitEvent(cap, 'loadeddata', 8000),
                waitEvent(cap, 'loadedmetadata', 8000),
            ]);
            // Wait until dimensions exist so draws aren't blank slate forever
            for (let n = 0; n < 20 && !(cap.videoWidth > 2); n++) {
                await new Promise((r) => setTimeout(r, 50));
            }
            if (gen !== filmstripGen) return;

            const usable = Math.max(0.01, duration - 0.04);
            const frames = [];

            for (let i = 0; i < FRAME_COUNT; i++) {
                if (gen !== filmstripGen) return;
                const t = (i / Math.max(1, FRAME_COUNT - 1)) * usable;
                await seekCapture(cap, t);
                if (gen !== filmstripGen) return;

                const canvas = document.createElement('canvas');
                canvas.width = FRAME_W;
                canvas.height = FRAME_H;
                const ctx = canvas.getContext('2d', { alpha: false });
                if (!ctx) {
                    frames.push(canvas);
                    continue;
                }
                ctx.fillStyle = '#334155';
                ctx.fillRect(0, 0, FRAME_W, FRAME_H);
                const vw = cap.videoWidth || 0;
                const vh = cap.videoHeight || 0;
                if (vw > 2 && vh > 2) {
                    const scale = Math.max(FRAME_W / vw, FRAME_H / vh);
                    const dw = vw * scale;
                    const dh = vh * scale;
                    try {
                        ctx.drawImage(cap, (FRAME_W - dw) / 2, (FRAME_H - dh) / 2, dw, dh);
                    } catch (_) { /* keep slate */ }
                }
                frames.push(canvas);
            }

            // One shot — all frames ready, then paint rail + segment pills together
            if (gen === filmstripGen && frames.length) {
                rememberCache(key, frames);
                mountFilmstripCanvases(frames);
            }
        } catch (_) {
            // keep placeholders
        } finally {
            if (captureVideo === cap) destroyCaptureVideo();
            if (gen === filmstripGen && !$filmstrip?.querySelector('canvas')) {
                paintSegments();
            }
        }
    }

    function resolveSkipTime(t) {
        if (!skipRegions.length || !Number.isFinite(t)) return null;
        for (let i = 0; i < skipRegions.length; i++) {
            const r = skipRegions[i];
            if (t >= r.start - 0.02 && t < r.end - 0.04) {
                return r.end;
            }
        }
        return null;
    }

    function clampPlayback() {
        if (!video || !duration || dragging || seeking) return;
        const t = video.currentTime || 0;
        if (t < trimStart - 0.02) {
            const keepPlaying = !video.paused;
            try { video.currentTime = trimStart; } catch (_) { scheduleSeek(trimStart, true); }
            previewTime = trimStart;
            if (keepPlaying) video.play().catch(() => {});
            return;
        }
        // Silencer: jump over dead-air cuts without pausing
        const skipTo = resolveSkipTime(t);
        if (skipTo != null && skipTo > t + 0.03 && skipTo <= trimEnd + 0.01) {
            const keepPlaying = !video.paused;
            try { video.currentTime = skipTo; } catch (_) { scheduleSeek(skipTo, true); }
            previewTime = skipTo;
            if (keepPlaying) video.play().catch(() => {});
            paintChrome();
            return;
        }
        if (t > trimEnd - 0.05) {
            // Seamless trim loop — NEVER pause here (pause+seek froze the preview)
            const keepPlaying = !video.paused;
            try {
                video.currentTime = trimStart;
            } catch (_) {
                scheduleSeek(trimStart, true);
            }
            previewTime = trimStart;
            if (keepPlaying) {
                video.loop = true;
                video.play().catch(() => {});
            }
            paintChrome();
        }
    }

    function applyPointer(clientX, { seek = true } = {}) {
        if (!dragging || !duration) return;

        if (dragging === 'start' || dragging === 'end' || dragging === 'bound') {
            paintTrimFast(clientX);
            return;
        }

        if (dragging === 'scrub') {
            let t = timeFromClientX(clientX);
            const skipTo = resolveSkipTime(t);
            if (skipTo != null) t = skipTo;
            previewTime = Math.max(trimStart, Math.min(trimEnd, t));
            paintChrome();
            if (seek) scheduleSeek(previewTime);
        }
    }

    function onPointerMove(e) {
        if (segPending && dragging !== 'segment') {
            onSegmentPointerMove(e);
            if (dragging === 'segment') return;
        }
        if (!dragging) return;
        e.preventDefault();
        if (dragging === 'start' || dragging === 'end' || dragging === 'bound') {
            paintTrimFast(e.clientX);
            return;
        }
        if (dragging === 'segment') {
            paintSegmentMove(e.clientX);
            return;
        }
        pendingPointerX = e.clientX;
        if (dragRaf) return;
        dragRaf = requestAnimationFrame(() => {
            dragRaf = 0;
            const x = pendingPointerX;
            pendingPointerX = null;
            if (x == null) return;
            applyPointer(x, { seek: true });
        });
    }

    function endDrag() {
        if (segPending) {
            onSegmentPointerUp();
            return;
        }
        if (!dragging) return;
        const mode = dragging;
        $track?.classList.remove('is-scrubbing', 'is-trimming', 'is-dragging');
        $segments?.querySelectorAll('.preview-timeline-handle.is-dragging')
            .forEach((h) => h.classList.remove('is-dragging'));
        $handleL?.classList.remove('is-dragging');
        $handleR?.classList.remove('is-dragging');

        if (pendingPointerX != null) {
            applyPointer(pendingPointerX, { seek: false });
            pendingPointerX = null;
        }
        if (dragRaf) {
            cancelAnimationFrame(dragRaf);
            dragRaf = 0;
        }

        dragging = null;
        boundIndex = -1;
        boundSplitKey = null;

        if (mode === 'start' || mode === 'end' || mode === 'bound') {
            previewTime = Math.max(trimStart, Math.min(trimEnd, previewTime));
            // Trimming is an edit — Apply must re-cut, not just download the old master
            if (trimStart > 0.05 || trimEnd < duration - 0.05) {
                try { markLibrarySplitscreenDirty(); } catch (_) { /* ignore */ }
            }
            if (mode === 'bound') {
                // Ranking segment handle moves — only then mark ranking dirty
                try { PreviewTimeline._rankingTouched = true; } catch (_) { /* ignore */ }
            }
        }
        const finalT = mode === 'scrub' ? previewTime : previewTime;
        scheduleSeek(finalT, true);

        if (wasPlaying) video?.play().catch(() => {});
        wasPlaying = false;
        // Trim / bound changes need a full segment rebuild once — not every frame
        paintChrome({ rebuildSegments: mode === 'start' || mode === 'end' || mode === 'bound' });
    }

    function startDrag(mode, e) {
        if ((mode === 'start' || mode === 'end' || mode === 'bound')
            && !handlesUnlocked
            && !$shell?.classList.contains('is-ranking-edit')) return;
        if ((mode === 'start' || mode === 'end' || mode === 'bound') && !handlesUnlocked) {
            setHandlesUnlocked(true);
        }
        // Left-click / primary only — right-click is for the context menu
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        cacheTrackMetrics();
        if ($dimR) {
            $dimR.style.left = 'auto';
            $dimR.style.right = '0';
        }
        dragging = mode;
        wasPlaying = video ? !video.paused : false;
        if (video && !video.paused) video.pause();

        $track?.classList.add('is-dragging');
        if (mode === 'scrub') $track?.classList.add('is-scrubbing');
        else $track?.classList.add('is-trimming');
        if (mode === 'start') $handleL?.classList.add('is-dragging');
        if (mode === 'end') $handleR?.classList.add('is-dragging');

        if (e.currentTarget?.setPointerCapture && e.pointerId != null) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        applyPointer(e.clientX, { seek: mode === 'scrub' });
    }

    function bindEvents() {
        if (!$shell || !$wrap || !video) return;

        const onTime = () => {
            if (dragging) return;
            clampPlayback();
            previewTime = video.currentTime || previewTime;
            schedulePaintChrome();
        };
        const onMeta = () => {
            const next = Number.isFinite(video.duration) ? video.duration : 0;
            const changed = Math.abs(next - duration) > 0.05;
            duration = next;
            if (changed || trimEnd <= trimStart) {
                trimStart = 0;
                trimEnd = duration || 1;
            }
            cacheTrackMetrics();
            paintChrome({ rebuildSegments: true });
            if (changed) scheduleFilmstripBuild();
        };
        const onResize = () => {
            cacheTrackMetrics();
            paintChrome({ rebuildSegments: true });
        };

        video.addEventListener('timeupdate', onTime);
        video.addEventListener('loadedmetadata', onMeta);
        video.addEventListener('durationchange', onMeta);
        window.addEventListener('resize', onResize, { passive: true });
        cleanups.push(() => {
            video.removeEventListener('timeupdate', onTime);
            video.removeEventListener('loadedmetadata', onMeta);
            video.removeEventListener('durationchange', onMeta);
            window.removeEventListener('resize', onResize);
        });

        const onTrackDown = (e) => {
            if (e.target?.closest?.('.preview-timeline-handle')) return;
            if (e.target?.closest?.('.preview-timeline-segment-clip')) return;
            if (e.target?.closest?.('.preview-timeline-playhead-grip')) return;
            startDrag('scrub', e);
        };
        const onStartDown = (e) => startDrag('start', e);
        const onEndDown = (e) => startDrag('end', e);

        $track?.addEventListener('pointerdown', onTrackDown);
        $handleL?.addEventListener('pointerdown', onStartDown);
        $handleR?.addEventListener('pointerdown', onEndDown);
        const $playheadGrip = document.getElementById('previewTimelinePlayheadGrip');
        const onPlayheadDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startDrag('scrub', e);
        };
        $playheadGrip?.addEventListener('pointerdown', onPlayheadDown);
        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
        cleanups.push(() => {
            $track?.removeEventListener('pointerdown', onTrackDown);
            $handleL?.removeEventListener('pointerdown', onStartDown);
            $handleR?.removeEventListener('pointerdown', onEndDown);
            $playheadGrip?.removeEventListener('pointerdown', onPlayheadDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', endDrag);
            window.removeEventListener('pointercancel', endDrag);
        });

        const onTimeChipDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setHandlesUnlocked(true);
            $wrap?.focus?.({ preventScroll: true });
        };
        $current?.addEventListener('pointerdown', onTimeChipDown);
        $durationEl?.addEventListener('pointerdown', onTimeChipDown);
        cleanups.push(() => {
            $current?.removeEventListener('pointerdown', onTimeChipDown);
            $durationEl?.removeEventListener('pointerdown', onTimeChipDown);
        });

        const onKey = (e) => {
            if (!video || !duration) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const delta = e.key === 'ArrowLeft' ? -0.5 : 0.5;
                previewTime = Math.max(trimStart, Math.min(trimEnd, (video.currentTime || 0) + delta));
                paintChrome();
                scheduleSeek(previewTime, true);
            }
        };
        $track?.addEventListener('keydown', onKey);
        cleanups.push(() => $track?.removeEventListener('keydown', onKey));

        const splitBtn = document.getElementById('previewTimelineSplitBtn');
        const onSplitClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const t = Number.isFinite(video?.currentTime) ? video.currentTime : previewTime;
            const ok = splitAt(t);
            if (!ok && splitPoints.length >= 4) {
                // Soft feedback — ranking caps at 5 segments
                splitBtn?.classList.remove('is-flash');
                void splitBtn?.offsetWidth;
                splitBtn?.classList.add('is-flash');
            }
        };
        splitBtn?.addEventListener('click', onSplitClick);
        cleanups.push(() => splitBtn?.removeEventListener('click', onSplitClick));
    }

    function show() {
        const row = document.getElementById('previewTimelineRow');
        if (row) row.hidden = false;
        if ($shell) $shell.hidden = false;
        const mute = document.getElementById('previewAudioToggle');
        if (mute) mute.hidden = false;
        try {
            if (typeof window.syncPreviewTimelineHookLane === 'function') {
                window.syncPreviewTimelineHookLane();
            }
        } catch (_) { /* ignore */ }
    }

    function hide() {
        const row = document.getElementById('previewTimelineRow');
        if (row) row.hidden = true;
        if ($shell) $shell.hidden = true;
        const mute = document.getElementById('previewAudioToggle');
        if (mute) mute.hidden = true;
        const lane = document.getElementById('previewTimelineHookLane');
        if (lane) lane.hidden = true;
        if (typeof PreviewCtxMenu !== 'undefined') PreviewCtxMenu.close();
    }

    function detach() {
        filmstripGen += 1;
        destroyCaptureVideo();
        if (seekTimer) {
            clearTimeout(seekTimer);
            seekTimer = 0;
        }
        if (filmstripIdleTimer) {
            clearTimeout(filmstripIdleTimer);
            filmstripIdleTimer = 0;
        }
        if (dragRaf) {
            cancelAnimationFrame(dragRaf);
            dragRaf = 0;
        }
        if (chromeRaf) {
            cancelAnimationFrame(chromeRaf);
            chromeRaf = 0;
        }
        while (cleanups.length) {
            try { cleanups.pop()(); } catch (_) { /* ignore */ }
        }
        pendingPointerX = null;
        seekTarget = null;
        seeking = false;
        dragging = null;
        clearSegHold();
        segPending = null;
        segMoved = false;
        wasPlaying = false;
        splitPoints = [];
        selectedSegIndex = null;
        pendingSplits = null;
        skipRegions = [];
        previewSkipRegions = [];
        handlesUnlocked = false;
        if ($shell) {
            $shell.classList.remove('handles-on');
            $shell.classList.remove('is-ranking-edit');
            $shell.classList.remove('has-silence-cuts');
            $shell.classList.remove('has-seg-focus');
        }
        if ($wrap) $wrap.classList.remove('has-cut-preview');
        if ($segments) $segments.innerHTML = '';
        video = null;
        bound = false;
        duration = 0;
        previewTime = 0;
        trimStart = 0;
        trimEnd = 1;
        hide();
    }

    function scheduleFilmstripBuild(delayMs = 450) {
        if (filmstripIdleTimer) {
            clearTimeout(filmstripIdleTimer);
            filmstripIdleTimer = 0;
        }
        // Let the phone preview start playing before filmstrip decode work
        const run = () => {
            filmstripIdleTimer = 0;
            buildFilmstripFromVideo();
        };
        if (typeof requestIdleCallback === 'function') {
            filmstripIdleTimer = setTimeout(() => {
                requestIdleCallback(() => run(), { timeout: 1200 });
            }, delayMs);
        } else {
            filmstripIdleTimer = setTimeout(run, delayMs);
        }
    }

    function attach(targetVideo) {
        detach();
        if (!targetVideo) return;
        refreshEls();
        video = targetVideo;
        // Custom PreviewTimeline owns scrubbing — never show native browser controls
        // (timestamps / volume / fullscreen overlay on the video itself).
        video.controls = false;
        video.removeAttribute('controls');
        video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback noplaybackrate');
        video.disablePictureInPicture = true;
        duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        trimStart = 0;
        trimEnd = duration || 1;
        previewTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        // Library preview: show trim handles immediately for easy customize
        const isLib = !!document.querySelector('.template-preview-content.is-library-preview');
        setHandlesUnlocked(isLib);

        // Reset layout styles used by transform chrome
        if ($selection) {
            $selection.style.left = '0';
            $selection.style.right = 'auto';
        }
        if ($playhead) $playhead.style.left = '0';
        if ($dimR) {
            $dimR.style.left = 'auto';
            $dimR.style.right = '0';
        }

        buildPlaceholderFilmstrip();
        bindEvents();
        bound = true;
        show();
        cacheTrackMetrics();
        paintChrome({ rebuildSegments: true });
        flushPendingPreviewRegions();

        const kickFilmstrip = () => {
            if (!video || video !== targetVideo) return;
            duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
            trimEnd = Math.max(trimEnd, duration || 1);
            if (trimStart >= trimEnd) {
                trimStart = 0;
                trimEnd = duration || 1;
            }
            cacheTrackMetrics();
            paintChrome({ rebuildSegments: true });
            flushPendingPreviewRegions();
            if (pendingSplits && pendingSplits.length) {
                const queued = pendingSplits.slice();
                pendingSplits = null;
                setSplits(queued);
            }
            scheduleFilmstripBuild();
        };

        if (duration > 0 && video.readyState >= 2) {
            kickFilmstrip();
        } else {
            video.addEventListener('loadedmetadata', kickFilmstrip, { once: true });
            video.addEventListener('loadeddata', kickFilmstrip, { once: true });
            setTimeout(() => {
                if (!bound || video !== targetVideo) return;
                if (Number.isFinite(video.duration) && video.duration > 0) kickFilmstrip();
            }, 350);
        }
    }

    function getTrim() {
        return { start: trimStart, end: trimEnd, duration };
    }

    function getSegmentBoundsPublic() {
        if (!duration) return [];
        return getSegmentBounds().slice();
    }

    /** Seed interior split points (e.g. 4 cuts → 5 ranking clips). */
    function setSplits(points) {
        const arr = Array.isArray(points) ? points : [];
        if (!duration || duration <= 0) {
            pendingSplits = arr.slice();
            return false;
        }
        const cleaned = [];
        for (const raw of arr) {
            const t = Number(raw);
            if (!Number.isFinite(t)) continue;
            const clamped = Math.max(trimStart + 0.05, Math.min(trimEnd - 0.05, t));
            if (cleaned.some((p) => Math.abs(p - clamped) < 0.08)) continue;
            cleaned.push(clamped);
        }
        cleaned.sort((a, b) => a - b);
        // Cap at 4 interior splits → 5 segments
        splitPoints = cleaned.slice(0, 4);
        pendingSplits = null;
        cacheTrackMetrics();
        paintChrome({ rebuildSegments: true });
        return true;
    }

    function clearSplits() {
        splitPoints = [];
        selectedSegIndex = null;
        syncSegFocusClass();
        if (bound) {
            cacheTrackMetrics();
            paintChrome({ rebuildSegments: true });
        }
    }

    /** Highlight trim handles; optionally seed a range around `atTime` */
    function focusTrim(atTime) {
        if (!bound || !duration) {
            const l = document.getElementById('previewTimelineHandleL');
            const r = document.getElementById('previewTimelineHandleR');
            [l, r].forEach((h) => {
                if (!h) return;
                h.classList.remove('is-pulse');
                void h.offsetWidth;
                h.classList.add('is-pulse');
            });
            return;
        }
        cacheTrackMetrics();
        const t = Number.isFinite(atTime) ? atTime : previewTime;
        const win = Math.min(2.5, Math.max(0.8, duration * 0.12));
        // If already trimmed tightly, just pulse. Else seed around click/playhead.
        const span = trimEnd - trimStart;
        if (span >= duration * 0.95) {
            trimStart = Math.max(0, t - win * 0.35);
            trimEnd = Math.min(duration, Math.max(trimStart + MIN_TRIM_GAP, t + win * 0.65));
        }
        previewTime = Math.max(trimStart, Math.min(trimEnd, t));
        paintChrome({ rebuildSegments: true });
        scheduleSeek(previewTime, true);

        [$handleL, $handleR].forEach((h) => {
            if (!h) return;
            h.classList.remove('is-pulse');
            void h.offsetWidth;
            h.classList.add('is-pulse');
            const done = () => {
                h.classList.remove('is-pulse');
                h.removeEventListener('animationend', done);
            };
            h.addEventListener('animationend', done);
        });
        $wrap?.focus?.({ preventScroll: true });
    }

    function splitAt(atTime) {
        if (!duration || duration <= 0) return false;
        cacheTrackMetrics();
        let t = Number.isFinite(atTime) ? atTime : previewTime;
        t = Math.max(trimStart + 0.05, Math.min(trimEnd - 0.05, t));

        // Already on a cut — flash that segment, don't no-op silently
        const nearIdx = splitPoints.findIndex((p) => Math.abs(p - t) < 0.08);
        if (nearIdx >= 0) {
            previewTime = splitPoints[nearIdx];
            paintChrome();
            paintSegments(previewTime);
            scheduleSeek(previewTime, true);
            selectSegmentAtTime(previewTime + 0.04) ?? selectSegmentAtTime(previewTime - 0.04);
            return true;
        }

        // Ranking caps at 5 segments (4 interior splits). At cap: move nearest
        // cut to the click/playhead instead of failing (felt broken before).
        if (splitPoints.length >= 4) {
            let nearest = 0;
            let best = Infinity;
            for (let i = 0; i < splitPoints.length; i++) {
                const d = Math.abs(splitPoints[i] - t);
                if (d < best) {
                    best = d;
                    nearest = i;
                }
            }
            const lo = nearest > 0
                ? splitPoints[nearest - 1] + MIN_TRIM_GAP
                : trimStart + MIN_TRIM_GAP;
            const hi = nearest < splitPoints.length - 1
                ? splitPoints[nearest + 1] - MIN_TRIM_GAP
                : trimEnd - MIN_TRIM_GAP;
            if (hi - lo < MIN_TRIM_GAP) {
                paintSegments(t);
                return false;
            }
            splitPoints[nearest] = Math.max(lo, Math.min(hi, t));
            const moved = splitPoints[nearest];
            splitPoints.sort((a, b) => a - b);
            previewTime = moved;
            setHandlesUnlocked(true);
            paintChrome({ rebuildSegments: true });
            paintSegments(previewTime);
            scheduleSeek(previewTime, true);
            selectSegmentAtTime(moved + 0.04) ?? selectSegmentAtTime(moved - 0.04);
            return true;
        }

        splitPoints.push(t);
        splitPoints.sort((a, b) => a - b);
        previewTime = t;
        setHandlesUnlocked(true);
        paintChrome({ rebuildSegments: true });
        paintSegments(t);
        scheduleSeek(t, true);
        // Focus the block under the cut so silence / improve target it
        selectSegmentAtTime(t + 0.04) ?? selectSegmentAtTime(t - 0.04);
        return true;
    }

    function getSplits() {
        return splitPoints.slice();
    }

    function setSkipRegions(regions) {
        const arr = Array.isArray(regions) ? regions : [];
        const cleaned = [];
        for (const raw of arr) {
            const start = Number(raw?.start);
            const end = Number(raw?.end);
            if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.12) continue;
            cleaned.push({
                start: Math.max(0, start),
                end: duration > 0 ? Math.min(duration, end) : end,
            });
        }
        cleaned.sort((a, b) => a.start - b.start);
        skipRegions = cleaned;
        if ($shell) $shell.classList.toggle('has-silence-cuts', skipRegions.length > 0);
        paintChrome({ rebuildSegments: true });
        return skipRegions.slice();
    }

    function getSkipRegions() {
        return skipRegions.map((r) => ({ start: r.start, end: r.end }));
    }

    function clearSkipRegions() {
        skipRegions = [];
        if ($shell) $shell.classList.remove('has-silence-cuts');
        if (bound) paintChrome({ rebuildSegments: true });
    }

    function setSkipRegionsPreview(regions) {
        const arr = Array.isArray(regions) ? regions : [];
        const cleaned = [];
        for (const raw of arr) {
            const start = Number(raw?.start);
            const end = Number(raw?.end);
            if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.12) continue;
            cleaned.push({
                start: Math.max(0, start),
                end: duration > 0 ? Math.min(duration, end) : end,
            });
        }
        cleaned.sort((a, b) => a.start - b.start);
        previewSkipRegions = cleaned;
        if (!bound || !duration || trackWidth <= 0) {
            pendingPreviewSkipRegions = cleaned;
            if (video && Number.isFinite(video.duration) && video.duration > 0) {
                duration = video.duration;
                trimEnd = Math.max(trimEnd, duration);
            }
            if (bound) {
                cacheTrackMetrics();
                flushPendingPreviewRegions();
            } else {
                paintCutPreview();
            }
            return previewSkipRegions.slice();
        }
        pendingPreviewSkipRegions = null;
        if (bound) paintChrome();
        else paintCutPreview();
        return previewSkipRegions.slice();
    }

    function getSkipRegionsPreview() {
        return previewSkipRegions.map((r) => ({ start: r.start, end: r.end }));
    }

    function clearSkipRegionsPreview() {
        previewSkipRegions = [];
        pendingPreviewSkipRegions = null;
        if ($wrap) $wrap.classList.remove('has-cut-preview');
        const layer = $wrap?.querySelector('.preview-timeline-cut-preview');
        if (layer) layer.remove();
    }

    return {
        attach,
        detach,
        show,
        hide,
        getTrim,
        focusTrim,
        splitAt,
        getSplits,
        setSplits,
        clearSplits,
        setSkipRegions,
        getSkipRegions,
        clearSkipRegions,
        setSkipRegionsPreview,
        getSkipRegionsPreview,
        clearSkipRegionsPreview,
        resolveSkipTime,
        getSegmentBounds: getSegmentBoundsPublic,
        getActiveEditRange,
        selectSegmentAtTime,
        getSelectedSegIndex: () => selectedSegIndex,
        getClipOrder,
        setClipOrder,
        scheduleFilmstripBuild,
        setHandlesUnlocked,
        setRankingEditMode,
        isBound: () => bound,
    };
})();

window.PreviewTimeline = PreviewTimeline;

/** Right-click menu on library preview / timeline */
const PreviewCtxMenu = (() => {
    let menu = null;
    let clickTime = 0;
    let openedAt = 0;
    let bound = false;

    function ensure() {
        menu = document.getElementById('previewCtxMenu');
        if (menu && menu.parentElement !== document.body) {
            document.body.appendChild(menu);
        }
        return menu;
    }

    function close() {
        const el = ensure();
        if (!el) return;
        el.hidden = true;
    }

    function isLibraryPreview() {
        return Boolean(document.querySelector('.template-preview-content.is-library-preview'));
    }

    function placeAt(clientX, clientY) {
        const el = ensure();
        if (!el) return;
        el.hidden = false;
        // Measure off-screen first
        el.style.left = '0px';
        el.style.top = '0px';
        const pad = 8;
        const gap = 8;
        const rect = el.getBoundingClientRect();
        // Above cursor, a bit to the right
        let x = clientX + 10;
        let y = clientY - rect.height - gap;
        if (x + rect.width > window.innerWidth - pad) {
            x = Math.max(pad, window.innerWidth - rect.width - pad);
        }
        if (y < pad) {
            // Not enough room above — keep slightly above if possible, else just pad
            y = Math.max(pad, clientY - rect.height - 4);
        }
        el.style.left = `${Math.round(Math.max(pad, x))}px`;
        el.style.top = `${Math.round(y)}px`;
        openedAt = performance.now();

        // Retrigger icon intro animations every open
        el.classList.remove('is-icon-anim');
        void el.offsetWidth;
        el.classList.add('is-icon-anim');
    }

    function timeAtEvent(e, wrap) {
        const trim = typeof PreviewTimeline !== 'undefined' ? PreviewTimeline.getTrim?.() : null;
        const dur = trim?.duration || 0;
        if (!wrap || !dur) return trim ? (document.querySelector('#templateVideoPreview video')?.currentTime || 0) : 0;
        const rect = wrap.getBoundingClientRect();
        const ratio = rect.width ? (e.clientX - rect.left) / rect.width : 0;
        return Math.max(0, Math.min(dur, ratio * dur));
    }

    function openFromEvent(e) {
        if (!isLibraryPreview()) return false;
        const t = e.target;
        if (!(t instanceof Element)) return false;

        const wrap = t.closest('#previewTimelineWrap, #previewTimelineShell');
        const preview = t.closest('#templateVideoPreview');
        if (!wrap && !preview) return false;

        e.preventDefault();
        e.stopPropagation();

        const timelineWrap = document.getElementById('previewTimelineWrap');
        clickTime = wrap
            ? timeAtEvent(e, timelineWrap)
            : (document.querySelector('#templateVideoPreview video')?.currentTime || 0);

        // Right-click on a block → focus it so silence / improve target that range
        if (wrap && typeof PreviewTimeline !== 'undefined') {
            try { PreviewTimeline.selectSegmentAtTime?.(clickTime); } catch (_) { /* ignore */ }
        }

        placeAt(e.clientX, e.clientY);
        return true;
    }

    function onSplit() {
        close();
        if (typeof PreviewTimeline === 'undefined' || !PreviewTimeline.splitAt) return;
        const video = document.querySelector('#templateVideoPreview video');
        const head = Number.isFinite(video?.currentTime) ? video.currentTime : null;
        const t = Number.isFinite(clickTime) ? clickTime : head;
        const ok = PreviewTimeline.splitAt(t);
        if (!ok) {
            try {
                const note = document.getElementById('silencerNote');
                if (note) {
                    note.hidden = false;
                    note.textContent = 'Move the playhead, then Split again';
                    note.classList.add('is-visible');
                    setTimeout(() => {
                        note.classList.remove('is-visible');
                        setTimeout(() => { note.hidden = true; }, 200);
                    }, 2200);
                }
            } catch (_) { /* ignore */ }
        }
    }

    function onSilence() {
        close();
        try {
            if (window.SolisSilencer?.apply) window.SolisSilencer.apply();
            else if (window.SolisSilencer?.toggle) window.SolisSilencer.toggle();
        } catch (_) { /* ignore */ }
    }

    function onImprove() {
        close();
        try {
            if (window.SolisImproveClip?.apply) window.SolisImproveClip.apply();
            else if (window.SolisImproveClip?.toggle) window.SolisImproveClip.toggle();
        } catch (_) { /* ignore */ }
    }

    function onMenuPointerDown(e) {
        const btn = e.target?.closest?.('[data-ctx-action]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const action = btn.getAttribute('data-ctx-action');
        if (action === 'split' || action === 'trim') onSplit();
        else if (action === 'silence') onSilence();
        else if (action === 'improve') onImprove();
    }

    function onDocPointerDown(e) {
        const el = ensure();
        if (!el || el.hidden) return;
        // Ignore the right-click that opened us / immediate follow-up
        if (e.button === 2) return;
        if (performance.now() - openedAt < 180) return;
        if (el.contains(e.target)) return;
        close();
    }

    function onKey(e) {
        if (e.key === 'Escape') close();
    }

    function bindTargets() {
        if (bound) return;
        bound = true;
        ensure();

        // Delegate — survives modal reflows / late DOM
        document.addEventListener('contextmenu', (e) => {
            openFromEvent(e);
        }, true);

        document.addEventListener('pointerdown', onDocPointerDown, true);
        document.addEventListener('keydown', onKey);

        const el = ensure();
        // pointerdown is more reliable than click for menu actions
        el?.addEventListener('pointerdown', onMenuPointerDown);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindTargets, { once: true });
    } else {
        bindTargets();
    }
    // Also bind after a tick in case dashboard HTML lands late relative to head script
    setTimeout(bindTargets, 0);

    return { open: openFromEvent, close, bindTargets };
})();

window.PreviewCtxMenu = PreviewCtxMenu;

function scheduleLibrarySplitscreenCropSync() {
    if (_libraryCropSyncRaf) return;
    _libraryCropSyncRaf = requestAnimationFrame(() => {
        _libraryCropSyncRaf = null;
        syncLibrarySplitscreenCropPreview();
    });
}

function revokeLibrarySplitscreenObjectUrls() {
    _librarySplitscreenObjectUrls.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
    });
    _librarySplitscreenObjectUrls = [];
    _blankBlurObjectUrl = null;
}

/** Clone a blob: URL so a second <video> can paint (Chromium blacks out shared blob src). */
async function cloneBlobUrlForSecondVideo(src) {
    if (!src || !String(src).startsWith('blob:')) return src;
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Blur blob clone failed (${res.status})`);
    const blob = await res.blob();
    if (!blob.size) throw new Error('Empty blur blob clone');
    const typed = blob.type ? blob : new Blob([blob], { type: 'video/mp4' });
    const url = URL.createObjectURL(typed);
    _librarySplitscreenObjectUrls.push(url);
    return url;
}

function revokeBlankBlurObjectUrl() {
    if (!_blankBlurObjectUrl) return;
    const stale = _blankBlurObjectUrl;
    _blankBlurObjectUrl = null;
    _librarySplitscreenObjectUrls = _librarySplitscreenObjectUrls.filter((u) => u !== stale);
    try { URL.revokeObjectURL(stale); } catch (_) { /* ignore */ }
}

async function fetchSecureVideoObjectUrl(url) {
    const response = await fetch(url, {
        credentials: 'include',
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {},
    });
    if (!response.ok) {
        throw new Error(`Media fetch failed (${response.status})`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        throw new Error('Media endpoint returned JSON instead of video');
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error('Empty media response');
    const objectUrl = URL.createObjectURL(
        blob.type ? blob : new Blob([blob], { type: 'video/mp4' }),
    );
    _librarySplitscreenObjectUrls.push(objectUrl);
    return objectUrl;
}

/** Two <video> elements cannot reliably share one blob URL — clone for twins. */
async function fetchSecureVideoObjectUrlPair(url) {
    const response = await fetch(url, {
        credentials: 'include',
        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {},
    });
    if (!response.ok) {
        throw new Error(`Media fetch failed (${response.status})`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        throw new Error('Media endpoint returned JSON instead of video');
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error('Empty media response');
    const typed = blob.type ? blob : new Blob([blob], { type: 'video/mp4' });
    const a = URL.createObjectURL(typed);
    const b = URL.createObjectURL(typed);
    _librarySplitscreenObjectUrls.push(a, b);
    return [a, b];
}

function bindLibrarySplitscreenPlaybackSync(master, slave) {
    if (_libraryPlaybackSyncCleanup) {
        _libraryPlaybackSyncCleanup();
        _libraryPlaybackSyncCleanup = null;
    }
    if (!master || !slave || master === slave) return;

    // Keep native looping — disabling it + seeking was freezing both panels
    master.loop = true;
    slave.loop = true;
    // Don't force-mute here — preview audio toggle owns mute state
    if (!_previewAudioEnabled) {
        master.muted = true;
        slave.muted = true;
    } else {
        master.muted = false;
        slave.muted = true; // avoid doubled audio from the twin face panel
    }

    let lastSeekAt = 0;
    let watchdogId = null;
    let syncing = false;

    const playBoth = () => {
        if (master.paused) master.play().catch(() => {});
        if (slave.paused) slave.play().catch(() => {});
    };

    const syncSlaveTime = (force = false) => {
        if (syncing || master.seeking || slave.seeking) return;
        if (!Number.isFinite(master.currentTime)) return;
        const drift = Math.abs((slave.currentTime || 0) - (master.currentTime || 0));
        const now = performance.now();
        // Correct only real desync — small drift is normal and seeking makes it worse
        if (!force && drift < 0.45) return;
        if (!force && now - lastSeekAt < 1800) return;
        lastSeekAt = now;
        syncing = true;
        try {
            slave.currentTime = master.currentTime;
        } catch (_) { /* ignore */ }
        finally {
            // Release after the seek settles a bit
            setTimeout(() => { syncing = false; }, 120);
        }
        playBoth();
    };

    const onMasterPlay = () => {
        playBoth();
        syncSlaveTime(true);
    };
    const onSlavePause = () => {
        // Don't leave reframe paused while content is still rolling
        if (!master.paused) {
            setTimeout(() => {
                if (!master.paused && slave.paused) slave.play().catch(() => {});
            }, 100);
        }
    };
    const onTimeUpdate = () => syncSlaveTime(false);

    master.addEventListener('play', onMasterPlay);
    master.addEventListener('playing', onMasterPlay);
    master.addEventListener('timeupdate', onTimeUpdate);
    slave.addEventListener('pause', onSlavePause);

    playBoth();
    setTimeout(() => syncSlaveTime(true), 200);

    watchdogId = window.setInterval(() => {
        if (!master.isConnected || !slave.isConnected) return;
        playBoth();
        syncSlaveTime(false);
    }, 2500);

    _libraryPlaybackSyncCleanup = () => {
        if (watchdogId) {
            clearInterval(watchdogId);
            watchdogId = null;
        }
        master.removeEventListener('play', onMasterPlay);
        master.removeEventListener('playing', onMasterPlay);
        master.removeEventListener('timeupdate', onTimeUpdate);
        slave.removeEventListener('pause', onSlavePause);
    };
}

function playBothLibraryPanels(container) {
    const root = container || _splitscreenScopeEl || document;
    const audioTargets = new Set(getPreviewAudioVideos(root));
    ['splitscreenContentVideo', 'splitscreenReframeVideo'].forEach((id) => {
        const v = (root.querySelector && root.querySelector(`#${id}`)) || document.getElementById(id);
        if (!v?.src) return;
        if (audioTargets.has(v)) {
            v.muted = !_previewAudioEnabled;
        } else {
            v.muted = true;
        }
        v.loop = true;
        v.play().catch(() => {});
    });
}

function setLibrarySplitscreenCropState(state) {
    if (!state || typeof state !== 'object') {
        _librarySplitscreenCropState = null;
        return;
    }
    const safeCropX = Number.isFinite(Number(state.cropX)) ? Number(state.cropX) : null;
    let safeFace = null;
    const rawFace = state.faceCrop;
    if (Array.isArray(rawFace) && rawFace.length >= 4 && rawFace.every((v) => Number.isFinite(Number(v)))) {
        safeFace = rawFace.slice(0, 4).map((v) => Number(v));
    } else if (rawFace && typeof rawFace === 'object' && Number.isFinite(Number(rawFace.w))) {
        safeFace = [
            Number(rawFace.x) || 0,
            Number(rawFace.y) || 0,
            Number(rawFace.w) || 0,
            Number(rawFace.h) || 0,
        ];
    }
    _librarySplitscreenCropState = {
        cropX: safeCropX,
        faceCrop: safeFace,
        srcW: Number.isFinite(Number(state.srcW)) ? Number(state.srcW) : 0,
        srcH: Number.isFinite(Number(state.srcH)) ? Number(state.srcH) : 0,
        faceSrcW: Number.isFinite(Number(state.faceSrcW)) ? Number(state.faceSrcW) : 0,
        faceSrcH: Number.isFinite(Number(state.faceSrcH)) ? Number(state.faceSrcH) : 0,
        useLayers: Boolean(state.useLayers),
        secondaryFromLayer: Boolean(state.useLayers) && !state.liveFaceEdit,
        liveFaceEdit: Boolean(state.liveFaceEdit),
        // 'baked' = layer_secondary cover; 'live' = segment + CSS face_crop (pannable)
        faceDisplayMode: state.faceDisplayMode === 'live' ? 'live' : (state.faceDisplayMode === 'baked' ? 'baked' : null),
    };
}

function forceLibraryPanelVideoFill(video) {
    if (!video) return;
    video.classList.remove('ss-live-face-crop');
    video.style.setProperty('display', 'block', 'important');
    video.style.setProperty('visibility', 'visible', 'important');
    video.style.setProperty('opacity', '1', 'important');
    video.style.setProperty('position', 'absolute', 'important');
    video.style.setProperty('left', '0', 'important');
    video.style.setProperty('top', '0', 'important');
    video.style.setProperty('right', '0', 'important');
    video.style.setProperty('bottom', '0', 'important');
    video.style.setProperty('width', '100%', 'important');
    video.style.setProperty('height', '100%', 'important');
    video.style.setProperty('min-height', '0', 'important');
    video.style.setProperty('max-height', 'none', 'important');
    video.style.setProperty('max-width', 'none', 'important');
    video.style.setProperty('object-fit', 'cover', 'important');
    video.style.setProperty('z-index', '2', 'important');
    video.style.setProperty('transform', 'none', 'important');
    video.style.setProperty('pointer-events', video.id === 'splitscreenReframeVideo' ? 'auto' : 'none', 'important');
}

function applyPanelCropPreviewBox(video, panel, box, srcW, srcH) {
    if (!video || !panel || !box || !srcW || !srcH) return;
    const x = Number(box[0]) || 0;
    const y = Number(box[1]) || 0;
    const w = Math.max(1, Number(box[2]) || srcW);
    const h = Math.max(1, Number(box[3]) || srcH);
    const viewport = video.closest('.ss-panel-crop-viewport') || panel;
    const panelW = viewport.clientWidth || panel.clientWidth || 1;
    const panelH = viewport.clientHeight || panel.clientHeight || 1;
    if (panelW < 2 || panelH < 2) {
        forceLibraryPanelVideoFill(video);
        return;
    }
    const scale = Math.max(panelW / w, panelH / h);
    video.classList.add('ss-live-face-crop');
    video.style.setProperty('position', 'absolute', 'important');
    video.style.setProperty('left', `${-x * scale}px`, 'important');
    video.style.setProperty('top', `${-y * scale}px`, 'important');
    video.style.setProperty('right', 'auto', 'important');
    video.style.setProperty('bottom', 'auto', 'important');
    video.style.setProperty('width', `${srcW * scale}px`, 'important');
    video.style.setProperty('height', `${srcH * scale}px`, 'important');
    video.style.setProperty('max-width', 'none', 'important');
    video.style.setProperty('object-fit', 'fill', 'important');
    video.style.setProperty('transform', 'none', 'important');
    video.style.setProperty('display', 'block', 'important');
    video.style.setProperty('visibility', 'visible', 'important');
    video.style.setProperty('opacity', '1', 'important');
}

function applyContentCropPreview(video, panel, cropX, srcW, srcH) {
    if (!video || !panel || !srcW || !srcH) return;
    const viewport = video.closest('.ss-panel-crop-viewport') || panel;
    const panelW = viewport.clientWidth || panel.clientWidth || 1;
    const panelH = viewport.clientHeight || panel.clientHeight || 1;
    if (panelW < 2 || panelH < 2) {
        forceLibraryPanelVideoFill(video);
        return;
    }
    const aspect = panelW / panelH;
    let cropH = srcH;
    let cropW = cropH * aspect;
    if (cropW > srcW) {
        cropW = srcW;
        cropH = cropW / aspect;
    }
    const x = cropX != null && Number(cropX) >= 0
        ? Number(cropX)
        : Math.max(0, (srcW - cropW) / 2);
    const y = Math.max(0, (srcH - cropH) / 2);
    applyPanelCropPreviewBox(video, panel, [x, y, cropW, cropH], srcW, srcH);
}

function syncLibrarySplitscreenCropPreview() {
    if (!_librarySplitscreenCropState || !window.clipsStudio?._librarySplitscreenCustomize) return;
    const state = _librarySplitscreenCropState;
    const contentVideo = _splitscreenQuery('splitscreenContentVideo');
    const contentPanel = _splitscreenQuery('splitscreenTop');
    const reframeVideo = _splitscreenQuery('splitscreenReframeVideo');
    const secondaryPanel = _splitscreenQuery('splitscreenBottom');
    const gameplayVideo = _splitscreenQuery('splitscreenGameplayVideo');

    if (state.useLayers && contentVideo) {
        forceLibraryPanelVideoFill(contentVideo);
    } else if (contentVideo && contentPanel && state.srcW && state.srcH) {
        applyContentCropPreview(contentVideo, contentPanel, state.cropX, state.srcW, state.srcH);
    } else if (contentVideo) {
        forceLibraryPanelVideoFill(contentVideo);
    }

    if (splitscreenSecondaryType === 'face_track' && reframeVideo) {
        if (gameplayVideo) {
            gameplayVideo.style.setProperty('display', 'none', 'important');
        }

        if (state.faceDisplayMode === 'baked' || (!state.liveFaceEdit && state.secondaryFromLayer)) {
            forceLibraryPanelVideoFill(reframeVideo);
            return;
        }

        const faceW = state.faceSrcW || state.srcW;
        const faceH = state.faceSrcH || state.srcH;
        if (faceW && faceH && secondaryPanel && state.faceCrop && state.faceCrop.length === 4) {
            applyPanelCropPreviewBox(reframeVideo, secondaryPanel, state.faceCrop, faceW, faceH);
            if (state.liveFaceEdit) {
                reframeVideo.style.setProperty('pointer-events', 'auto', 'important');
                reframeVideo.style.cursor = 'grab';
            }
        } else {
            forceLibraryPanelVideoFill(reframeVideo);
        }
        return;
    }

    if (state.secondaryFromLayer && gameplayVideo) {
        forceLibraryPanelVideoFill(gameplayVideo);
    }
}

function bindFaceReframePanHandlers() {
    const reframeVideo = _splitscreenQuery('splitscreenReframeVideo');
    const secondaryPanel = _splitscreenQuery('splitscreenBottom')
        || _splitscreenQuery('splitscreenSecondaryViewport');
    if (!reframeVideo || !secondaryPanel) return;
    if (reframeVideo.dataset.facePanBound === 'true') return;
    reframeVideo.dataset.facePanBound = 'true';

    let startX = 0;
    let startY = 0;
    let originCrop = null;
    let tracking = false;
    let gesture = null; // 'pan' | 'resize' once past threshold
    let suppressClick = false;
    let activePointerId = null;
    let promoting = false;
    let resizeRootRect = null;
    let resizeLastY = 0;
    const DRAG_THRESHOLD_PX = 6;

    const onMove = (clientX, clientY) => {
        if (!tracking) return;
        const st = _librarySplitscreenCropState;
        const dx0 = clientX - startX;
        const dy0 = clientY - startY;
        const dist = Math.hypot(dx0, dy0);

        if (!gesture) {
            if (dist < DRAG_THRESHOLD_PX) return;
            // Vertical → resize split; horizontal → pan face crop (when live)
            const canPan = !!(st?.liveFaceEdit && originCrop && (st.faceSrcW || st.srcW));
            gesture = (!canPan || Math.abs(dy0) >= Math.abs(dx0) * 0.85) ? 'resize' : 'pan';
            suppressClick = true;
            armPreviewModalDragGuard(800);
            const root = _splitscreenQuery('splitscreenRoot');
            if (gesture === 'resize') {
                if (root) {
                    root.classList.add('is-dragging');
                    root.dataset._didPanelDrag = '1';
                }
                notifySubtitleLayoutEdit();
                resizeRootRect = root?.getBoundingClientRect() || null;
                resizeLastY = clientY;
                reframeVideo.style.cursor = 'ns-resize';
                if (resizeRootRect) {
                    applySplitscreenDrag(clientY, resizeRootRect, 1);
                }
                return;
            }
            reframeVideo.style.cursor = 'grabbing';
        }

        if (gesture === 'resize') {
            if (!resizeRootRect) {
                const root = _splitscreenQuery('splitscreenRoot');
                resizeRootRect = root?.getBoundingClientRect() || null;
            }
            if (!resizeRootRect) return;
            resizeLastY = clientY;
            applySplitscreenDrag(clientY, resizeRootRect, 1);
            armPreviewModalDragGuard(1200);
            return;
        }

        if (!st?.liveFaceEdit || !originCrop) return;
        const srcW = st.faceSrcW || st.srcW;
        const srcH = st.faceSrcH || st.srcH;
        if (!srcW || !srcH) return;

        const panel = _splitscreenQuery('splitscreenBottom') || secondaryPanel;
        const viewport = reframeVideo.closest('.ss-panel-crop-viewport') || panel;
        const panelW = viewport.clientWidth || panel.clientWidth || 1;
        const panelH = viewport.clientHeight || panel.clientHeight || 1;
        const cw = originCrop[2];
        const ch = originCrop[3];
        const scale = Math.max(panelW / Math.max(1, cw), panelH / Math.max(1, ch));
        const dx = (clientX - startX) / scale;
        const dy = (clientY - startY) / scale;
        let nx = originCrop[0] - dx;
        let ny = originCrop[1] - dy;
        nx = Math.max(0, Math.min(srcW - cw, nx));
        ny = Math.max(0, Math.min(srcH - ch, ny));
        st.faceCrop = [nx, ny, cw, ch];
        syncLibrarySplitscreenCropPreview();
    };

    const endPan = (pointerId = null) => {
        if (!tracking) return;
        const didGesture = !!gesture;
        const wasResize = gesture === 'resize';
        const finishY = resizeLastY;
        const finishRect = resizeRootRect;
        tracking = false;
        gesture = null;
        resizeRootRect = null;
        reframeVideo.style.cursor = 'grab';
        if (pointerId != null && reframeVideo.hasPointerCapture?.(pointerId)) {
            try { reframeVideo.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
        }
        activePointerId = null;
        if (wasResize && finishRect) {
            finishSplitscreenDrag(finishY, finishRect, 1);
            armPreviewModalDragGuard(800);
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 50);
            return;
        }
        if (didGesture) {
            markLibrarySplitscreenDirty();
            armPreviewModalDragGuard(800);
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 50);
        }
    };

    const beginTrack = (clientX, clientY, pointerId = null) => {
        if (splitscreenSecondaryType !== 'face_track') return;
        const st = _librarySplitscreenCropState;
        originCrop = null;
        if (st?.liveFaceEdit) {
            const srcW = st.faceSrcW || st.srcW;
            const srcH = st.faceSrcH || st.srcH;
            if (srcW && srcH) {
                if (!st.faceCrop || st.faceCrop.length < 4) {
                    const panel = _splitscreenQuery('splitscreenBottom') || secondaryPanel;
                    const aspect = (panel.clientWidth || 9) / Math.max(1, panel.clientHeight || 16);
                    let h = srcH * 0.55;
                    let w = h * aspect;
                    if (w > srcW) {
                        w = srcW * 0.7;
                        h = w / aspect;
                    }
                    st.faceCrop = [
                        Math.max(0, (srcW - w) / 2),
                        Math.max(0, (srcH - h) / 2),
                        w,
                        h,
                    ];
                }
                if (st.faceDisplayMode !== 'live') {
                    st.faceDisplayMode = 'live';
                    syncLibrarySplitscreenCropPreview();
                }
                originCrop = st.faceCrop.slice();
            }
        }
        tracking = true;
        gesture = null;
        resizeRootRect = null;
        resizeLastY = clientY;
        startX = clientX;
        startY = clientY;
        activePointerId = pointerId;
        // Keep receiving moves even when the cursor leaves the phone frame
        armPreviewModalDragGuard(800);
    };

    reframeVideo.addEventListener('pointerdown', async (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        // Baked reframe is smooth; upgrade to live segment crop only when user starts adjusting
        if (!promoting
            && _librarySplitscreenCropState
            && (_librarySplitscreenCropState.faceDisplayMode === 'baked'
                || _librarySplitscreenCropState.secondaryFromLayer)) {
            promoting = true;
            try {
                await promoteReframeToLiveEdit();
            } finally {
                promoting = false;
            }
        }
        try { reframeVideo.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        beginTrack(e.clientX, e.clientY, e.pointerId);
    });

    reframeVideo.addEventListener('pointermove', (e) => {
        if (!tracking) return;
        if (activePointerId != null && e.pointerId !== activePointerId) return;
        e.preventDefault();
        onMove(e.clientX, e.clientY);
    });

    const onPointerEnd = (e) => {
        if (!tracking) return;
        if (activePointerId != null && e.pointerId !== activePointerId) return;
        e.preventDefault();
        e.stopPropagation();
        endPan(e.pointerId);
    };
    reframeVideo.addEventListener('pointerup', onPointerEnd);
    reframeVideo.addEventListener('pointercancel', onPointerEnd);
    reframeVideo.addEventListener('lostpointercapture', () => {
        if (tracking) endPan(activePointerId);
    });

    // Click (no drag) toggles the panel editor; drag does not
    reframeVideo.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (suppressClick || gesture) {
            suppressClick = false;
            return;
        }
        if (typeof hideGameplayPillMenu === 'function' && gpPill?.classList.contains('active')) {
            hideGameplayPillMenu();
            return;
        }
        if (typeof showSplitscreenCustomizer === 'function') {
            showSplitscreenCustomizer(e, 'fill');
        }
    });
}

/**
 * Swap baked secondary → live segment + CSS face crop so the user can pan.
 * Content stays on the light baked layer to avoid dual full-decode lag.
 */
async function promoteReframeToLiveEdit() {
    const st = _librarySplitscreenCropState;
    const projectId = getLibraryPreviewProjectId();
    const reframeVideo = _splitscreenQuery('splitscreenReframeVideo');
    const contentVideo = _splitscreenQuery('splitscreenContentVideo');
    if (!st || !projectId || !reframeVideo) return;
    if (st.faceDisplayMode === 'live' && !st.secondaryFromLayer) return;

    const segmentApiUrl = `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/splitscreen-segment`;
    const t = contentVideo?.currentTime || 0;
    try {
        const objectUrl = await fetchSecureVideoObjectUrl(segmentApiUrl);
        await new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            reframeVideo.addEventListener('loadeddata', finish, { once: true });
            reframeVideo.addEventListener('error', finish, { once: true });
            reframeVideo.src = objectUrl;
            reframeVideo.load();
            setTimeout(finish, 6000);
        });
        if (reframeVideo.videoWidth) {
            st.faceSrcW = reframeVideo.videoWidth;
            st.faceSrcH = reframeVideo.videoHeight;
        }
        st.secondaryFromLayer = false;
        st.faceDisplayMode = 'live';
        st.liveFaceEdit = true;
        try {
            if (Number.isFinite(t)) reframeVideo.currentTime = t;
        } catch (_) { /* ignore */ }
        reframeVideo.play().catch(() => {});
        syncLibrarySplitscreenCropPreview();
        if (contentVideo) bindLibrarySplitscreenPlaybackSync(contentVideo, reframeVideo);
    } catch (err) {
        safeLog('promoteReframeToLiveEdit failed:', err);
    }
}

function bindLibrarySplitscreenCropObserver(root) {
    if (_librarySplitscreenCropObserver) {
        _librarySplitscreenCropObserver.disconnect();
        _librarySplitscreenCropObserver = null;
    }
    if (!root || typeof ResizeObserver === 'undefined') return;
    _librarySplitscreenCropObserver = new ResizeObserver(() => {
        syncLibrarySplitscreenCropPreview();
    });
    _librarySplitscreenCropObserver.observe(root);
    // Panel flex-basis changes don't resize the root — observe panels too
    const top = root.querySelector('#splitscreenTop');
    const bottom = root.querySelector('#splitscreenBottom');
    if (top) _librarySplitscreenCropObserver.observe(top);
    if (bottom) _librarySplitscreenCropObserver.observe(bottom);
}

function teardownLibrarySplitscreenCropObserver() {
    if (_librarySplitscreenCropObserver) {
        _librarySplitscreenCropObserver.disconnect();
        _librarySplitscreenCropObserver = null;
    }
    if (_libraryPlaybackSyncCleanup) {
        _libraryPlaybackSyncCleanup();
        _libraryPlaybackSyncCleanup = null;
    }
    if (_libraryCropSyncRaf) {
        cancelAnimationFrame(_libraryCropSyncRaf);
        _libraryCropSyncRaf = null;
    }
    revokeLibrarySplitscreenObjectUrls();
    setLibrarySplitscreenCropState(null);
}

function applySplitscreenConfigFromServer(config = {}) {
    const ratio = Number(config.splitscreen_content_ratio);
    splitscreenContentRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0.5;
    splitscreenSavedRatio = splitscreenContentRatio;
    // Default: reframe/secondary on top when server omits the flag
    splitscreenInverted = config.splitscreen_inverted != null
        ? Boolean(config.splitscreen_inverted)
        : true;
    splitscreenSecondaryCollapsed = Boolean(
        config.splitscreen_secondary_collapsed
        || config.layers?.collapsed
        || config.state?.secondary_collapsed
    );
    if (splitscreenSecondaryCollapsed) {
        splitscreenContentRatio = 1;
    }
    let secType = config.splitscreen_secondary_type || 'face_track';
    // Gameplay retired — map legacy projects to Focus
    if (secType === 'gameplay') {
        secType = 'face_track';
        splitscreenSecondaryCollapsed = true;
    }
    // Dual speakers is automatic at encode time — never a Modes UI option
    if (secType === 'dual_speaker' || secType === 'dual') {
        secType = 'face_track';
    }
    if (secType === 'face_track') {
        splitscreenSecondaryType = 'face_track';
    } else if (secType === 'blank' || secType === 'blank_blur' || secType === 'blur') {
        splitscreenSecondaryType = 'blank_blur';
        splitscreenCanvasMode = 'blank_blur';
        splitscreenInverted = true;
    } else {
        splitscreenSecondaryType = 'face_track';
    }
    // Wire AI suggestion badge for Modes UI
    setSuggestedClipMode(splitscreenSecondaryType, splitscreenSecondaryCollapsed);
    if (config.gameplay_clip_id && !['face_track', 'blank', 'blank_blur', 'blur'].includes(String(config.gameplay_clip_id))) {
        selectedGameplayClip = config.gameplay_clip_id;
    }
}

function markLibrarySplitscreenDirty() {
    const studio = window.clipsStudio;
    if (studio?.currentTemplateForPreview?.isLibraryPreview && studio._librarySplitscreenCustomize) {
        // Ignore seed/layout sync until the library UI is armed for real edits
        if (studio._libraryDirtyArmed === false) return;
        studio._librarySplitscreenDirty = true;
        syncLibraryConfirmLabel();
    }
}

/** User moved layout (divider / invert / fill) — stop karaoke → static "Subtitles". */
function notifySubtitleLayoutEdit() {
    try {
        if (typeof window.settleSubtitlesForLayoutEdit === 'function') {
            window.settleSubtitlesForLayoutEdit();
        }
    } catch (_) { /* ignore */ }
}

/** Divider released / layout settled — resume caption animation if we paused it. */
function notifySubtitleLayoutIdle() {
    try {
        if (typeof window.resumeSubtitlesAfterLayoutEdit === 'function') {
            window.resumeSubtitlesAfterLayoutEdit();
        }
    } catch (_) { /* ignore */ }
}
window.notifySubtitleLayoutIdle = notifySubtitleLayoutIdle;

function markLibraryOverlayDirty() {
    const studio = window.clipsStudio;
    if (!studio?.currentTemplateForPreview?.isLibraryPreview) return;
    if (studio._libraryDirtyArmed === false) return;
    studio._libraryOverlayDirty = true;
    syncLibraryConfirmLabel();
}
window.markLibraryOverlayDirty = markLibraryOverlayDirty;

/** Download vs Apply & Download + keyhint only for true “Use Template”. */
function syncLibraryConfirmLabel() {
    const studio = window.clipsStudio;
    const main = document.getElementById('confirmUseTemplateBtn');
    const fab = document.getElementById('confirmUseTemplateFab');
    if (!main) return;
    const isLibrary = !!studio?.currentTemplateForPreview?.isLibraryPreview;
    if (isLibrary) {
        const dirty = !!(
            studio._librarySplitscreenDirty
            || studio._libraryOverlayDirty
            || studio._libraryRankingDirty
            || studio._librarySilenceDirty
        );
        main.textContent = dirty ? 'Apply & Download' : 'Download';
        main.classList.add('library-download-mode');
        main.removeAttribute('data-solis-keyhint');
        main.removeAttribute('aria-keyshortcuts');
    } else if (!main.classList.contains('library-download-mode')) {
        if (!main.getAttribute('data-solis-keyhint')) {
            main.setAttribute('data-solis-keyhint', 'Use template|Enter');
            main.setAttribute('aria-keyshortcuts', 'Enter');
        }
    }
    if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
    else if (fab) {
        const label = fab.querySelector('.template-use-fab-label');
        const text = (main.textContent || '').trim() || 'Use Template';
        if (label) label.textContent = text;
        fab.setAttribute('aria-label', text);
        fab.title = text;
        fab.classList.toggle('library-download-mode', main.classList.contains('library-download-mode'));
        if (main.classList.contains('library-download-mode')) {
            fab.removeAttribute('data-solis-keyhint');
            fab.removeAttribute('aria-keyshortcuts');
        } else {
            fab.setAttribute('data-solis-keyhint', 'Use template|Enter');
            fab.setAttribute('aria-keyshortcuts', 'Enter');
        }
    }
}
window.syncLibraryConfirmLabel = syncLibraryConfirmLabel;

function syncUseTemplateFab() {
    const main = document.getElementById('confirmUseTemplateBtn');
    const fab = document.getElementById('confirmUseTemplateFab');
    if (!main || !fab) return;
    const mobileFabPrimary = typeof window !== 'undefined' && window.innerWidth <= 900;
    // Mobile hides the sidebar CTA via CSS — that must NOT hide the FAB
    const mainHidden = main.hidden
        || main.style.display === 'none'
        || main.getAttribute('data-pro-locked') === '1'
        || (!mobileFabPrimary && window.getComputedStyle(main).display === 'none');
    if (mainHidden) {
        fab.style.display = 'none';
        fab.hidden = true;
    } else {
        fab.style.removeProperty('display');
        fab.hidden = false;
    }
    fab.disabled = !!main.disabled || mainHidden;
    fab.classList.toggle('library-download-mode', main.classList.contains('library-download-mode'));
    const label = fab.querySelector('.template-use-fab-label');
    const text = (main.textContent || '').trim() || 'Use Template';
    if (label) label.textContent = text;
    fab.setAttribute('aria-label', text);
    fab.title = text;
    // Keyhint is Use Template only — never on Download / Apply & Download
    if (main.classList.contains('library-download-mode') || !/^use template$/i.test(text)) {
        fab.removeAttribute('data-solis-keyhint');
        fab.removeAttribute('aria-keyshortcuts');
        main.removeAttribute('data-solis-keyhint');
        main.removeAttribute('aria-keyshortcuts');
    } else {
        fab.setAttribute('data-solis-keyhint', 'Use template|Enter');
        fab.setAttribute('aria-keyshortcuts', 'Enter');
        main.setAttribute('data-solis-keyhint', 'Use template|Enter');
        main.setAttribute('aria-keyshortcuts', 'Enter');
    }
}
window.syncUseTemplateFab = syncUseTemplateFab;

function isClipIntentEnabled() {
    return window.solisClipIntentEnabled === true;
}

function syncClipIntentFeatureUi() {
    const toggle = document.getElementById('clipIntentToggleBtn');
    const cluster = document.getElementById('templateUseCtaCluster');
    const enabled = isClipIntentEnabled();
    if (toggle) {
        toggle.hidden = !enabled;
        toggle.style.display = enabled ? '' : 'none';
    }
    if (!enabled) resetClipIntentMode();
    if (cluster) cluster.classList.toggle('clip-intent-disabled', !enabled);
}
window.isClipIntentEnabled = isClipIntentEnabled;
window.syncClipIntentFeatureUi = syncClipIntentFeatureUi;

function getClipIntentText() {
    if (!isClipIntentEnabled()) return '';
    const input = document.getElementById('clipIntentInput');
    const raw = (input?.value || '').trim();
    return raw.slice(0, 200);
}

function resetClipIntentMode() {
    const cluster = document.getElementById('templateUseCtaCluster');
    const toggle = document.getElementById('clipIntentToggleBtn');
    const row = document.getElementById('clipIntentRow');
    const input = document.getElementById('clipIntentInput');
    if (cluster) cluster.classList.remove('is-intent-mode');
    if (toggle) toggle.setAttribute('aria-pressed', 'false');
    if (row) row.hidden = true;
    if (input) input.value = '';
}

function toggleClipIntentMode(forceOpen) {
    if (!isClipIntentEnabled()) return false;
    const cluster = document.getElementById('templateUseCtaCluster');
    const toggle = document.getElementById('clipIntentToggleBtn');
    const row = document.getElementById('clipIntentRow');
    const input = document.getElementById('clipIntentInput');
    if (!cluster || !toggle || !row) return false;
    const open = typeof forceOpen === 'boolean'
        ? forceOpen
        : !cluster.classList.contains('is-intent-mode');
    cluster.classList.toggle('is-intent-mode', open);
    toggle.setAttribute('aria-pressed', open ? 'true' : 'false');
    row.hidden = !open;
    if (open && input) {
        requestAnimationFrame(() => {
            try { input.focus(); } catch (_) { /* ignore */ }
        });
    }
    return open;
}
window.getClipIntentText = getClipIntentText;
window.resetClipIntentMode = resetClipIntentMode;
window.toggleClipIntentMode = toggleClipIntentMode;

function bindClipIntentControls(studio) {
    syncClipIntentFeatureUi();
    if (!isClipIntentEnabled()) return;
    const toggle = document.getElementById('clipIntentToggleBtn');
    const submit = document.getElementById('clipIntentSubmitBtn');
    const input = document.getElementById('clipIntentInput');
    if (!toggle || toggle.dataset.bound === '1') return;
    toggle.dataset.bound = '1';

    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleClipIntentMode();
    });

    const submitIntent = (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        const main = document.getElementById('confirmUseTemplateBtn');
        if (main?.disabled || main?.getAttribute('data-pro-locked') === '1') return;
        if (studio && typeof studio.confirmTemplateUse === 'function') {
            studio.confirmTemplateUse();
        } else {
            main?.click();
        }
    };

    if (submit) submit.addEventListener('click', submitIntent);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitIntent(e);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                resetClipIntentMode();
            }
        });
    }
}
window.bindClipIntentControls = bindClipIntentControls;

function bindUseTemplateFabIdleHint() {
    const fab = document.getElementById('confirmUseTemplateFab');
    const modal = document.getElementById('templatePreviewModal');
    if (!fab || fab.dataset.idleHintBound === '1') return;
    fab.dataset.idleHintBound = '1';

    const IDLE_MS = 2600;
    const HINT_MS = 3200;
    let idleTimer = null;
    let hideTimer = null;

    const clearTimers = () => {
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    };

    const collapse = () => {
        fab.classList.remove('is-hinting');
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    };

    const showHint = () => {
        if (fab.disabled) return;
        if (window.innerWidth > 768) return;
        if (modal && (modal.style.display === 'none' || modal.style.visibility === 'hidden')) return;
        fab.classList.add('is-hinting');
        hideTimer = setTimeout(collapse, HINT_MS);
    };

    const bump = () => {
        collapse();
        clearTimers();
        if (window.innerWidth > 768) return;
        idleTimer = setTimeout(showHint, IDLE_MS);
    };

    ['pointerdown', 'touchstart', 'keydown'].forEach((evt) => {
        document.addEventListener(evt, bump, { passive: true, capture: true });
    });
    fab.addEventListener('mouseenter', collapse);
    bump();
    window._bumpUseTemplateFabIdle = bump;
}
window.bindUseTemplateFabIdleHint = bindUseTemplateFabIdleHint;

function collectLibraryOverlayTexts() {
    const cont = document.getElementById('templateVideoPreview');
    if (!cont) return [];
    const cR = cont.getBoundingClientRect();
    const w = Math.max(1, cR.width);
    const h = Math.max(1, cR.height);
    const overlays = [];

    cont.querySelectorAll('.overlay-text-block').forEach((block) => {
        if (block.dataset.placeholder === '1') return;
        if (block.dataset.aiHook === '1') return; // AI hook → splitscreen recompose, not overlay-text
        const inner = block.querySelector('.sub-text-inner');
        let text = (inner?.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (!text || text.toLowerCase() === 'text') return;

        const bR = block.getBoundingClientRect();
        const x = (bR.left + bR.width / 2 - cR.left) / w;
        const y = (bR.top + bR.height / 2 - cR.top) / h;
        const cs = getComputedStyle(block);
        const fontSize = parseFloat(block.style.fontSize) || parseFloat(cs.fontSize) || 28;
        const fontFamily = (block.style.fontFamily || cs.fontFamily || 'Luckiest Guy')
            .split(',')[0]
            .replace(/['"]/g, '')
            .trim();
        const color = block.style.color || cs.color || '#ffffff';
        const ts = (block.style.textShadow || cs.textShadow || '').trim();
        let shadow = 'outline';
        if (!ts || ts === 'none') shadow = 'none';
        else if (ts.includes('3px')) shadow = 'thick-outline';

        overlays.push({
            text: text.slice(0, 200),
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
            font_size_ratio: fontSize / h,
            font: fontFamily || 'Luckiest Guy',
            color,
            shadow,
        });
    });
    return overlays;
}
window.collectLibraryOverlayTexts = collectLibraryOverlayTexts;

const GP_ICON_FORMAT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="8" rx="1.5"/><rect x="3" y="13" width="18" height="8" rx="1.5"/></svg>';
const GP_ICON_SECONDARY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"/></svg>';
const GP_ICON_GAMEPLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4M8 10v4"/><circle cx="15.5" cy="10.5" r="1"/><circle cx="17.5" cy="13.5" r="1"/></svg>';
const GP_ICON_REFRAME = '<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="16" height="16" rx="0.9" stroke="currentColor" stroke-width="1.75"/><path d="M2 9V2H9M19 2H26V9M9 26H2V19M26 19V26H19" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const GP_ICON_BLANK = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" opacity=".35"/><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.75"/></svg>';
const GP_ICON_BLANK_BLUR = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.75"/><circle cx="9" cy="10" r="1.4" fill="currentColor" opacity=".55"/><circle cx="14" cy="11" r="2.1" fill="currentColor" opacity=".35"/><circle cx="11.5" cy="15" r="1.7" fill="currentColor" opacity=".45"/><path d="M5 17.5c2-2.4 4.2-3.6 7-3.6s5 1.2 7 3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".7"/></svg>';

const SPLITSCREEN_FORMATS = [
    { id: 'inverted', label: 'AI Reframe on Top', desc: 'Face panel above your clip' },
    { id: 'normal', label: 'Content on Top', desc: 'Your clip above the secondary panel' },
];


// Load available gameplay clips for splitscreen template
function toggleNavWrapperCollapse(event) {
    if (typeof window.toggleMobileNavMenu === 'function') {
        return window.toggleMobileNavMenu(event);
    }
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const panel = document.getElementById('mobileMenuPanel');
    const backdrop = document.getElementById('mobileMenuBackdrop');
    const fab = document.getElementById('mobileMenuFab');
    if (!panel) return;
    const opening = !!panel.hidden;
    panel.hidden = !opening;
    if (backdrop) backdrop.hidden = !opening;
    if (fab) fab.setAttribute('aria-expanded', opening ? 'true' : 'false');
}

// Clips Expansion Functions
function toggleClipsExpansion(event) {
    event.preventDefault();
    event.stopPropagation();
    const clipsExpansion = document.getElementById('clipsExpansionActions');
    if (clipsExpansion) {
        clipsExpansion.classList.toggle('expanded');
    }
}

function closeClipsExpansion() {
    const clipsExpansion = document.getElementById('clipsExpansionActions');
    if (clipsExpansion) {
        clipsExpansion.classList.remove('expanded');
    }
}

function navigateToClipsTemplates() {
    closeClipsExpansion();
    const templatesTab = document.querySelector('[data-tab="templates"]');
    if (templatesTab) {
        templatesTab.click();
    } else {
        // Navigate to templates
    }
}

function navigateToClipsCreate() {
    closeClipsExpansion();
    // Navigate to clips creation section
    const clipsNav = document.querySelector('.chips-nav-item');
    if (clipsNav) {
        handleNav(clipsNav, 3);
    }
}

function navigateToClipsLibrary() {
    closeClipsExpansion();
    const libraryTab = document.querySelector('[data-tab="library"]');
    if (libraryTab) {
        libraryTab.click();
    }
}

// Ensure multiple modules can request the input to be docked
function dockInputInstantly() {
    const inputSection = document.querySelector('.input-section');
    const inputContainer = inputSection ? inputSection.querySelector('.input-container') : null;
    const currentIndex = parseInt(localStorage.getItem('sidebarActiveIndex') || '0');
    
    if (inputContainer) {
        inputContainer.classList.remove('first-prompt', 'animate-down', 'animate-up');
    }
    if (inputSection) {
        inputSection.classList.remove('is-first-prompt');
        
        // Only keep visible if on chat tab
        if (currentIndex === 0) {
            inputSection.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: all !important; z-index: 1000 !important;';
        } else {
            inputSection.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; z-index: -10000 !important;';
        }
    }
}
// expose for other scripts to call safely
window.dockInputInstantly = dockInputInstantly;

/**
 * Initialize authentication on page load
 * Call this on dashboard and other authenticated pages
 */
function initAuth() {
    safeLog('[Auth] Initializing authentication...');
    
    // Verify token with backend - this will fetch and set currentUser from verified server data
    verifyToken().then((success) => {
        // Token verified (whether successful or fallback mode)
        if (currentUser) {
            safeLog('[Auth] User authenticated:', currentUser.email);
            // Start token refresh interval (refresh every 50 minutes to beat 1-hour expiry)
            startTokenRefreshInterval();
            if (typeof updateProfileButton === 'function') {
                updateProfileButton();
            }
        } else {
            safeLog('[Auth] User not authenticated, showing guest UI');
            updateUIForGuest();
        }
    }).catch(error => {
        // verifyToken already handles errors, this catch is for unexpected issues
        safeLog('[Auth] Unexpected error during initialization:', error);
        updateUIForGuest();
    });
    
    safeLog('[Auth] Initialization started');
}

// ðŸ” SECURITY: Sanitize error messages to prevent info leakage
// Never expose error.message, stack traces, or file paths to users
function sanitizeErrorMessage(error) {
    if (!error) return 'Unknown error';
    
    // Extract only safe parts of error
    const message = String(error.message || error).trim();
    const allowedKeywords = ['timeout', 'network', 'failed', 'unauthorized', 'not found', 'invalid', 'error'];
    
    // Check if message contains only safe words (case-insensitive)
    const lowerMsg = message.toLowerCase();
    if (allowedKeywords.some(kw => lowerMsg.includes(kw))) {
        // Limit length to prevent DoS via error message
        return message.substring(0, 100);
    }
    
    // Default safe message - don't expose implementation details
    return 'An error occurred';
}

// ðŸ” SECURITY: Input validation helper - enforce length limits to prevent DoS attacks
function validateInputLength(input, maxLength = 1000, fieldName = 'input') {
    if (typeof input !== 'string') {
        return { valid: false, error: `${fieldName} must be a string` };
    }
    if (input.length > maxLength) {
        return { valid: false, error: `${fieldName} exceeds ${maxLength} character limit` };
    }
    if (input.length === 0) {
        return { valid: false, error: `${fieldName} cannot be empty` };
    }
    return { valid: true, value: input.trim() };
}

// ðŸ” SECURITY: Safe URL validation with length limits to prevent DoS
function validateURLInput(urlString, maxLength = 512) {
    const validation = validateInputLength(urlString, maxLength, 'URL');
    if (!validation.valid) {
        return validation;
    }
    
    try {
        const urlToValidate = validation.value.startsWith('http') ? validation.value : 'https://' + validation.value;
        const url = new URL(urlToValidate);
        // URL is syntactically valid
        return { valid: true, value: validation.value };
    } catch (e) {
        return { valid: false, error: 'Invalid URL format' };
    }
}

// Auth headers — httpOnly cookies carry the session; no CSRF token needed.
function getCSRFToken() {
    return null;
}

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) headers['X-Timezone'] = tz;
    } catch (_) { /* ignore */ }
    return headers;
}

async function initializeCSRFToken() {
    return true;
}

async function verifyToken() {
    try {
        let response = await fetch(`${API_BASE_URL}/auth/check`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const refreshed = await refreshAuthToken();
            if (refreshed) {
                response = await fetch(`${API_BASE_URL}/auth/check`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
            }
        }
        
        if (!response.ok) {
            safeLog('Auth verification error:', response.status);
            throw new Error('Authentication verification failed');
        }
        
        const data = await response.json();
        // SECURITY: Set user data from backend ONLY — never trust stale localStorage
        currentUser = data.user;
        window.currentUser = currentUser;
        try {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        } catch (_) { /* ignore */ }
        
        // Update UI with authenticated user
        updateUIForLoggedInUser();
        if (currentUser && currentUser.plan && typeof applyPortalTierUI === 'function') {
            applyPortalTierUI(currentUser.plan);
        }
        
        // Update profile button with fresh user data from server
        if (typeof updateProfileButton === 'function') {
            setTimeout(() => updateProfileButton(), 0);
        }
        // Update menu user info (name, email, avatar)
        if (typeof updateMenuUserInfo === 'function') {
            updateMenuUserInfo();
        }
        // Update profile dropdown with fresh user data
        if (typeof updateProfileDropdown === 'function') {
            updateProfileDropdown(currentUser).catch(e => console.warn('Profile dropdown update error:', e));
        }
        // YouTube connect disabled — skip status API
        checkYouTubeConnection();
        // Per-user Solis Memory — scope localStorage to this account
        const memUid = currentUser?.id ?? currentUser?.user_id;
        // Do NOT re-apply Create landing here — auth finishes after the user may
        // already have navigated away (Portal / Library / etc.).
        if (window.SolisMemory?.setUserId) {
            window.SolisMemory.setUserId(memUid);
        }
        if (window.SolisMemory?.pullServerMemory) {
            await window.SolisMemory.pullServerMemory();
        }
        // ✅ IMPORTANT: Await loadTierInfo() so subscription data is available before dashboard loads
        await loadTierInfo();
    } catch (error) {
        safeLog('[Auth] Verification error:', error.message);
        
        // If token is definitively invalid (401/403), redirect to login
        if (error.message && (error.message.includes('Token invalid') || error.message.includes('401') || error.message.includes('403'))) {
            safeLog('[Auth] Token is invalid, redirecting to login in 2 seconds');
            // Clear memory ONLY (not localStorage)
            currentUser = null;
            window.currentUser = null;
            try { localStorage.removeItem('currentUser'); } catch (_) { /* ignore */ }
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        } else {

            safeLog('[Auth] Network error, allowing guest access:', error.message);
            updateUIForGuest();
            if (typeof showNotification === 'function') {
                showNotification('Could not verify session.', 'warning');
            }
        }
        throw error;
    }
}
// 🔄 Auto-refresh auth token to prevent 401 errors
let tokenRefreshIntervalId = null;

async function refreshAuthToken() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: '{}',
        });
        
        if (response.ok) {
            safeLog('[Auth] Token refreshed successfully');
            return true;
        }
        safeLog('[Auth] Token refresh failed:', response.status);
        return false;
    } catch (error) {
        safeLog('[Auth] Token refresh error:', error.message);
        return false;
    }
}

function startTokenRefreshInterval() {
    // Clear any existing interval
    if (tokenRefreshIntervalId) {
        clearInterval(tokenRefreshIntervalId);
    }

    // Refresh once on startup in case the tab was idle past the 1-hour access expiry
    refreshAuthToken();
    
    // Refresh token every 50 minutes (before 1-hour expiry)
    const REFRESH_INTERVAL_MS = 50 * 60 * 1000;
    
    tokenRefreshIntervalId = setInterval(() => {
        if (currentUser) {
            safeLog('[Auth] Refreshing auth token...');
            refreshAuthToken();
        }
    }, REFRESH_INTERVAL_MS);

    if (!window._authVisibilityRefreshBound) {
        window._authVisibilityRefreshBound = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && currentUser) {
                refreshAuthToken();
            }
        });
    }
    
    safeLog('[Auth] Token refresh interval started (every 50 minutes)');
}

function stopTokenRefreshInterval() {
    if (tokenRefreshIntervalId) {
        clearInterval(tokenRefreshIntervalId);
        tokenRefreshIntervalId = null;
        safeLog('[Auth] Token refresh interval stopped');
    }
}

function updateUIForLoggedInUser() {
    const userName = document.querySelector('.user-name');
    const userEmail = document.querySelector('.user-email');
    const userAvatar = document.querySelector('.user-avatar');
    
    if (userName) userName.textContent = currentUser.name;
    if (userEmail) userEmail.textContent = currentUser.email;
    
    // Update user avatar with cached proxy URL (avoids Google CDN 429)
    if (userAvatar) {
        const avatarSrc = typeof resolveAvatarUrl === 'function'
            ? resolveAvatarUrl(currentUser)
            : currentUser.picture;
        if (avatarSrc) {
            const img = document.createElement('img');
            img.src = avatarSrc;
            img.alt = currentUser.name;
            img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
            userAvatar.innerHTML = '';  // Clear any existing content
            userAvatar.appendChild(img);
        } else {
            userAvatar.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 21a8 8 0 0 1 11.873-7"/>
                    <circle cx="10" cy="8" r="5"/>
                    <path d="m17 17 5 5"/>
                    <path d="m22 17-5 5"/>
                </svg>
            `;
        }
    }
    
    if (signInDisplay) signInDisplay.style.display = 'none';
    
    if (signInBtn) {
        signInBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Sign out</span>';
        signInBtn.onclick = logout;
    }
    
    updateSettingsForLoggedInUser();
}

function updateUIForGuest() {
    const userName = document.querySelector('.user-name');
    const userEmail = document.querySelector('.user-email');
    const userAvatar = document.querySelector('.user-avatar');
    
    if (userName) userName.textContent = 'Guest User';
    if (userEmail) userEmail.textContent = 'Sign in to continue';
    if (userAvatar) {
        userAvatar.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 21a8 8 0 0 1 11.873-7"/>
                <circle cx="10" cy="8" r="5"/>
                <path d="m17 17 5 5"/>
                <path d="m22 17-5 5"/>
            </svg>
        `;
    }
    
    if (signInDisplay) signInDisplay.style.display = 'flex';
    
    if (signInBtn) {
        signInBtn.innerHTML = '<i class="fas fa-sign-in"></i><span>Sign in</span>';
        signInBtn.onclick = redirectToLogin;
    }
    
    updateSettingsForGuest();
}

function updateSettingsForLoggedInUser() {
    const accountOption = document.querySelector('.settings-option .option-name');
    const accountDescription = document.querySelector('.settings-option .option-description');
    
    if (accountOption) accountOption.textContent = 'Account Settings';
    if (accountDescription) accountDescription.textContent = `Signed in as ${currentUser.email}`;
    
    // Fetch and update subscription status
    fetchAndUpdateSubscriptionStatus();
}

async function fetchAndUpdateSubscriptionStatus(forceRefresh = false) {
    try {
        const subscription = await window._subCache.get(forceRefresh);
        if (!subscription) throw new Error('No subscription data');

        // ⚠ï¸ SECURITY: Update UI only, do NOT persist plan to localStorage
        window.tier = subscription.plan;

        document.querySelectorAll('.settings-option').forEach((option) => {
            const optionName = option.querySelector('.option-name');
            if (!optionName) return;
            if (optionName.textContent === 'Subscription Status') {
                const desc = option.querySelector('.option-description');
                if (desc) {
                    desc.textContent = `${subscription.plan_name} Plan - ${subscription.videos_per_day_limit} videos/day, ${subscription.storage_limit_gb}GB storage`;
                }
            }
            if (optionName.textContent === 'Current Plan') {
                const desc = option.querySelector('.option-description');
                if (desc) desc.textContent = subscription.plan_name;
            }
        });
    } catch (error) {
        document.querySelectorAll('.settings-option').forEach((option) => {
            const optionName = option.querySelector('.option-name');
            if (optionName && optionName.textContent === 'Subscription Status') {
                const desc = option.querySelector('.option-description');
                if (desc) desc.textContent = 'Free Plan - Limited access';
            }
        });
    }
}

function updateSettingsForGuest() {
    const accountOption = document.querySelector('.settings-option .option-name');
    const accountDescription = document.querySelector('.settings-option .option-description');
    
    if (accountOption) accountOption.textContent = 'Sign in?';
    if (accountDescription) accountDescription.textContent = 'Want to unlock full feature access? Sign in today';
}

function redirectToLogin() {
    window.location.href = '/login.html';
}

function logout() {
    // Defer to the comprehensive logout defined later in this file
    // to avoid duplicate logic. If that isn't defined yet, fall through.
    if (typeof window._comprehensiveLogout === 'function') {
        window._comprehensiveLogout();
    }
}

// ⚠ï¸ DEPRECATED: Use getAuthHeaders() instead
// This function exists for backward compatibility only
function getHeaders() {
    // ðŸ” SECURITY: No longer need to add Authorization header
    // httpOnly cookie is sent automatically by browser with each request
    // NOTE: This doesn't include CSRF token - use getAuthHeaders() for safety
    console.warn('DEPRECATED: getHeaders() called - use getAuthHeaders() instead for CSRF protection');
    return getAuthHeaders(true);
}

// Load available gameplay clips for splitscreen template
async function loadAvailableGameplayClips(forceRefresh = false) {
    if (!forceRefresh
        && availableGameplayClips.length
        && (Date.now() - _gameplayClipsFetchedAt) < GAMEPLAY_CLIPS_TTL_MS) {
        return availableGameplayClips;
    }
    if (_gameplayClipsInflight) return _gameplayClipsInflight;

    _gameplayClipsInflight = (async () => {
        try {
            const url = `${API_BASE_URL}/gameplay/available`;
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: typeof getAuthHeaders === 'function' ? getAuthHeaders(true) : {},
            });

            if (response.ok) {
                const data = await response.json();
                availableGameplayClips = Array.isArray(data.clips) ? data.clips : [];
                _gameplayClipsFetchedAt = Date.now();
                return availableGameplayClips;
            }
            safeLog('Failed to load gameplay clips from backend');
            if (!availableGameplayClips.length) availableGameplayClips = [];
            return availableGameplayClips;
        } catch (error) {
            safeLog('Error loading gameplay clips:', error);
            if (!availableGameplayClips.length) availableGameplayClips = [];
            return availableGameplayClips;
        } finally {
            _gameplayClipsInflight = null;
        }
    })();

    return _gameplayClipsInflight;
}

// ─── Subscription data cache ─────────────────────────────────────────────────
// Single source of truth for /auth/subscription data.
// All callers (loadTierInfo, fetchAndUpdateSubscriptionStatus, canUseShortFormUpload,
// updateWatermarkToggleState, loadAndDisplayStorageInfo, store.js, etc.) share this
// so the endpoint is fetched AT MOST once per TTL instead of 3-5 times on load.
window._subCache = (() => {
    let _data = null;
    let _fetchedAt = 0;
    let _inflightPromise = null;
    const TTL = 60_000; // 60 s

    async function _doFetch() {
        const resp = await fetch(`${API_BASE_URL}/auth/subscription`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        if (!resp.ok) throw new Error(`subscription fetch failed: ${resp.status}`);
        const json = await resp.json();
        _data = json.subscription || null;
        _fetchedAt = Date.now();
        _inflightPromise = null;
        return _data;
    }

    return {
        async get(forceRefresh = false) {
            const now = Date.now();
            if (!forceRefresh && _data && (now - _fetchedAt) < TTL) return _data;
            if (_inflightPromise) return _inflightPromise;
            _inflightPromise = _doFetch().catch(err => { _inflightPromise = null; throw err; });
            return _inflightPromise;
        },
        peek() { return _data; },
        set(data) { _data = data; _fetchedAt = Date.now(); },
        invalidate() { _data = null; _fetchedAt = 0; }
    };
})();
// ─────────────────────────────────────────────────────────────────────────────

// Apply plan to portal tier card (and related UI bits)
function applyPortalTierUI(planRaw) {
    const planKey = String(planRaw || 'free').toLowerCase().trim();
    const display = planKey.charAt(0).toUpperCase() + planKey.slice(1);
    const tierElement = document.getElementById('currentTier');
    const tierInfoCard = document.getElementById('tierInfoCard');
    if (tierElement) tierElement.textContent = display;
    if (tierInfoCard) {
        tierInfoCard.classList.remove('tier-free', 'tier-basic', 'tier-prime', 'tier-elite');
        const cssKey = ['free', 'basic', 'prime', 'elite'].includes(planKey) ? planKey : 'free';
        tierInfoCard.classList.add(`tier-${cssKey}`);
        tierInfoCard.setAttribute('data-plan', cssKey);
    }
    try {
        if (window.currentUser) window.currentUser.plan = planKey;
        if (typeof currentUser !== 'undefined' && currentUser) currentUser.plan = planKey;
    } catch (_) { /* ignore */ }
}
window.applyPortalTierUI = applyPortalTierUI;

// Load tier info and display in portal card
async function loadTierInfo() {
    try {
        // Paint from auth/check user immediately if we already have it
        const known = (window.currentUser && window.currentUser.plan)
            || (typeof currentUser !== 'undefined' && currentUser && currentUser.plan);
        if (known) applyPortalTierUI(known);

        const subscription = await window._subCache.get();
        if (!subscription) {
            safeLog('⚠ï¸ Could not load tier info');
            return;
        }

        // ⚠ï¸ SECURITY: Do NOT store subscription in localStorage.
        // Backend enforces plan on every API request. Frontend only displays UI.

        const planKey = String(subscription.plan || known || 'free').toLowerCase();
        applyPortalTierUI(subscription.plan_name || planKey);

        const expiryElement = document.getElementById('currentTierExpiry');
        if (expiryElement) {
            if (planKey === 'free') {
                expiryElement.textContent = '';
            } else if (subscription.plan_expires_at) {
                const daysUntilExpiry = Math.ceil(
                    (new Date(subscription.plan_expires_at) - new Date()) / (1000 * 60 * 60 * 24)
                );
                if (daysUntilExpiry < 0) expiryElement.textContent = 'Expired';
                else if (daysUntilExpiry === 0) expiryElement.textContent = 'Expires today';
                else if (daysUntilExpiry === 1) expiryElement.textContent = 'Expires tomorrow';
                else expiryElement.textContent = `Expires in ${daysUntilExpiry} days`;
            } else {
                expiryElement.textContent = '';
            }
        }

        if (typeof updateStorageDisplayOnDashboard === 'function') {
            updateStorageDisplayOnDashboard(subscription);
        }

        return subscription;
    } catch (error) {
        safeLog('âŒ Error loading tier info:', error);
    }
}

// ─── Clip modes pill (AI Reframe / Blur / Blank / Focus) ───────────────────────
function initGameplayPillUI() {
    if (gameplayPillInitialized) return;
    gameplayPillInitialized = true;

    gpPill = document.createElement('div');
    gpPill.className = 'gp-pill-menu gp-pill-menu--modes';
    gpPill.id = 'gpPillMenu';
    gpPill.innerHTML = `
        <button type="button" class="gp-pill-btn" id="gpBtnClips" title="Modes" aria-label="Clip modes">
            <span class="gp-pill-ico">${GP_ICON_SECONDARY}</span>
            <span class="gp-pill-label">Modes</span>
        </button>
    `;
    document.body.appendChild(gpPill);

    gpDdLayout = document.createElement('div');
    gpDdLayout.className = 'gp-dropdown gp-layout-dd';
    gpDdLayout.id = 'gpDdLayout';
    gpDdLayout.hidden = true;
    document.body.appendChild(gpDdLayout);

    gpDdClips = document.createElement('div');
    gpDdClips.className = 'gp-dropdown gp-clips-dd';
    gpDdClips.id = 'gpDdClips';
    document.body.appendChild(gpDdClips);

    rebuildGameplayClipsDropdown();

    gpPill.addEventListener('click', (e) => e.stopPropagation());

    const openModesPanel = (btn) => {
        const alreadyOpen = gpDdClips.classList.contains('open')
            && btn.classList.contains('gp-active');
        closeGameplayDropdowns();
        if (alreadyOpen) return;
        gpDdClips.dataset.panelMode = 'fill';
        rebuildGameplayClipsDropdown();
        openGameplayDropdown(gpDdClips, btn);
        btn.classList.add('gp-active');
    };

    document.getElementById('gpBtnClips').addEventListener('click', (e) => {
        e.stopPropagation();
        openModesPanel(e.currentTarget);
    });

    document.addEventListener('click', (e) => {
        if (!gpPill?.classList.contains('active')) return;
        if (gpPill.contains(e.target) || gpDdClips.contains(e.target)) return;
        if (e.target.closest('#previewEditorPill')) return;
        if (e.target.closest('#templatePreviewLoading')) return;
        // Phone click toggles via root handler; other outside clicks dismiss.
        if (e.target.closest('#splitscreenRoot')) return;
        hideGameplayPillMenu();
    });

    window.addEventListener('resize', () => {
        if (gpPill?.classList.contains('active')) positionGameplayPill();
    });
    window.addEventListener('scroll', () => {
        if (gpPill?.classList.contains('active')) positionGameplayPill();
    }, true);
}

function formatIconSvg(formatId) {
    if (formatId === 'inverted') {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 7h4M7 17h10"/></svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 7h10M7 17h4"/></svg>';
}

function buildSplitscreenFormatDropdown() {
    if (!gpDdLayout) return;
    gpDdLayout.innerHTML = '<div class="gp-dd-title">Stack order</div>';
    SPLITSCREEN_FORMATS.forEach((fmt) => {
        const active = (fmt.id === 'inverted') === splitscreenInverted;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'gp-layout-item' + (active ? ' on' : '');
        const previewClass = fmt.id === 'inverted' ? 'gp-lp--reframe-top' : 'gp-lp--content-top';
        const topLabel = fmt.id === 'inverted' ? 'AI Reframe' : 'Content';
        const botLabel = fmt.id === 'inverted' ? 'Content' : 'AI Reframe';
        item.innerHTML = `
            <div class="gp-layout-preview ${previewClass}" aria-hidden="true">
                <span class="gp-lp-a">${topLabel}</span>
                <span class="gp-lp-b">${botLabel}</span>
            </div>
            <div class="gp-layout-text">
                <span class="gp-layout-label">${fmt.label}</span>
                <span class="gp-layout-desc">${fmt.desc}</span>
            </div>
            <span class="gp-layout-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>
            </span>
        `;
        item.addEventListener('pointerenter', () => previewGpLayoutOption(fmt.id === 'inverted'));
        item.addEventListener('pointerleave', () => endGpLayoutPreview());
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            // Commit hover preview as the new layout
            if (_gpCommittedLayout != null) _gpCommittedLayout = null;
            splitscreenInverted = fmt.id === 'inverted';
            document.getElementById('templateVideoPreview')?.classList.remove('gp-hover-preview');
            notifySubtitleLayoutEdit();
            applySplitscreenPreview();
            markLibrarySplitscreenDirty();
            buildSplitscreenFormatDropdown();
            closeGameplayDropdowns();
            document.getElementById('gpBtnLayout')?.classList.remove('gp-active');
        });
        gpDdLayout.appendChild(item);
    });
}

function getGameplayClipsForUI() {
    if (availableGameplayClips.length) return availableGameplayClips;
    return [{
        id: 'minecraft_1',
        title: 'Minecraft 1',
        filename: 'Minecraft_1.mp4',
        group: 'minecraft',
        group_label: 'Minecraft',
        preview_url: '/api/gameplay/preview/minecraft_1',
    }];
}

/** API host without /api — gameplay mp4s live on the backend, not Vercel. */
function apiOriginBase() {
    return String(window.API_BASE_URL || '').replace(/\/api\/?$/, '');
}

/** Turn /assets/… or /api/… paths into absolute backend URLs in production. */
function resolveGameplayMediaUrl(pathOrUrl) {
    const raw = String(pathOrUrl || '').trim();
    if (!raw) return '';
    if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
    const origin = apiOriginBase();
    if (raw.startsWith('/')) {
        return origin ? `${origin}${raw}` : raw;
    }
    return origin ? `${origin}/assets/${raw.replace(/^\/+/, '')}` : `/assets/${raw.replace(/^\/+/, '')}`;
}

function resolveGameplayClipMeta(clipId) {
    const id = String(clipId || selectedGameplayClip || 'minecraft_1');
    const found = getGameplayClipsForUI().find((c) => c.id === id);
    if (found) return found;
    const m = id.match(/^([a-z][a-z0-9]*)_(\d+)$/i);
    if (m) {
        const prefix = m[1];
        const num = m[2];
        const filename = `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}_${num}.mp4`;
        return {
            id,
            title: `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)} ${num}`,
            filename,
            group: prefix.toLowerCase(),
            group_label: prefix.charAt(0).toUpperCase() + prefix.slice(1),
            preview_url: `/api/gameplay/preview/${id}`,
        };
    }
    return {
        id: 'minecraft_1',
        title: 'Minecraft 1',
        filename: 'Minecraft_1.mp4',
        group: 'minecraft',
        group_label: 'Minecraft',
        preview_url: '/api/gameplay/preview/minecraft_1',
    };
}

function gameplayGroupMeta(clip) {
    const id = String(clip?.group || String(clip?.id || '').split('_')[0] || 'gameplay').toLowerCase();
    const label = clip?.group_label
        || ({ minecraft: 'Minecraft', roblox: 'Roblox', subway: 'Subway Surfers', gta: 'GTA', fortnite: 'Fortnite' }[id])
        || (id.charAt(0).toUpperCase() + id.slice(1));
    return { id, label };
}

function gameplayClipPreviewSrc(clip) {
    if (clip?.preview_url) return resolveGameplayMediaUrl(clip.preview_url);
    if (clip?.thumbnail) return resolveGameplayMediaUrl(clip.thumbnail);
    if (clip?.id) return resolveGameplayMediaUrl(`/api/gameplay/preview/${clip.id}`);
    return '';
}

function buildGameplayClipCard(clip) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gp-clip-card' + (isGameplayOptionSelected(clip.id) ? ' on' : '');
    card.dataset.clipId = clip.id;
    card.dataset.group = gameplayGroupMeta(clip).id;

    const label = clip.title || clip.id;
    // Preview API serves a GIF — must use <img>, not <video>
    const gifSrc = gameplayClipPreviewSrc(clip);
    const mp4Fallback = clip.filename ? resolveGameplayMediaUrl(`/assets/${clip.filename}`) : '';
    card.innerHTML = `
        <span class="gp-clip-media">
            <span class="gp-clip-skel" aria-hidden="true">
                <span class="gp-clip-skel-shine"></span>
                <span class="gp-clip-skel-grid">
                    <i></i><i></i><i></i><i></i><i></i><i></i>
                    <i></i><i></i><i></i><i></i><i></i><i></i>
                </span>
            </span>
            <img class="gp-clip-thumb" alt="" decoding="async" draggable="false" />
        </span>
        <span class="gp-clip-label">${label}</span>
        <span class="gp-clip-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 13l4 4L19 7"/></svg>
        </span>
    `;

    const img = card.querySelector('img.gp-clip-thumb');
    const media = card.querySelector('.gp-clip-media');
    const reveal = () => card.classList.add('is-ready');

    if (img && gifSrc) {
        img.addEventListener('load', reveal, { once: true });
        img.addEventListener('error', () => {
            if (!mp4Fallback || !media) {
                card.classList.add('is-failed');
                return;
            }
            // GIF missing/failed — fall back to muted looping mp4
            img.remove();
            const vid = document.createElement('video');
            vid.className = 'gp-clip-thumb';
            vid.muted = true;
            vid.loop = true;
            vid.playsInline = true;
            vid.preload = 'metadata';
            vid.disablePictureInPicture = true;
            vid.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback noplaybackrate');
            vid.addEventListener('loadeddata', () => {
                reveal();
                vid.play().catch(() => {});
            }, { once: true });
            vid.src = mp4Fallback;
            media.appendChild(vid);
        }, { once: true });
        img.src = gifSrc;
    } else if (img && mp4Fallback) {
        img.remove();
        const vid = document.createElement('video');
        vid.className = 'gp-clip-thumb';
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = 'metadata';
        vid.addEventListener('loadeddata', () => {
            reveal();
            vid.play().catch(() => {});
        }, { once: true });
        vid.src = mp4Fallback;
        media.appendChild(vid);
    }

    card.addEventListener('pointerenter', () => previewGpSecondaryOption(clip.id));
    card.addEventListener('pointerleave', () => endGpHoverPreview());

    card.addEventListener('click', (e) => {
        e.stopPropagation();
        _gpCommittedSecondary = null;
        selectSecondaryGameplay(clip.id);
        rebuildGameplayClipsDropdown();
    });
    return card;
}

function buildModeTile({ id, title, hint, previewClass, previewHtml, suggested }) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'gp-mode-tile' + (isGameplayOptionSelected(id) ? ' on' : '') + (suggested ? ' gp-mode-suggested' : '');
    tile.setAttribute('data-mode', id);
    tile.innerHTML = `
        <span class="gp-mode-preview ${previewClass}" aria-hidden="true">${previewHtml || ''}</span>
        <span class="gp-mode-meta">
            <span class="gp-mode-label">${title}${suggested ? '<em class="gp-ai-tag">AI</em>' : ''}</span>
            ${hint ? `<span class="gp-mode-hint">${hint}</span>` : ''}
        </span>
        <span class="gp-mode-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M5 13l4 4L19 7"/></svg>
        </span>
    `;
    tile.addEventListener('pointerenter', () => {
        if (id === 'focus') return;
        previewGpSecondaryOption(id === 'blur' ? 'blank_blur' : id);
    });
    tile.addEventListener('pointerleave', () => endGpHoverPreview());
    tile.addEventListener('click', (e) => {
        e.stopPropagation();
        _gpCommittedSecondary = null;
        selectClipMode(id);
        rebuildGameplayClipsDropdown();
    });
    return tile;
}

function getSuggestedClipMode() {
    if (window.solisAutoModesEnabled === false) return null;
    const s = window._solisClipModeSuggestion;
    if (!s || typeof s !== 'object') return null;
    if (s.collapsed) return 'focus';
    const t = String(s.secondary || s.splitscreen_secondary_type || '');
    // dual_speaker is encode-time auto — surface as AI Reframe in Modes
    if (t === 'dual_speaker' || t === 'dual') return 'face_track';
    if (t === 'blank_blur' || t === 'blur' || t === 'blank') return 'blur';
    if (t === 'face_track') return 'face_track';
    return null;
}

function setSuggestedClipMode(secondary, collapsed) {
    let sec = secondary || 'face_track';
    if (sec === 'blank') sec = 'blank_blur'; // blank merged into blur
    if (sec === 'dual' || sec === 'dual_speaker') sec = 'face_track';
    window._solisClipModeSuggestion = {
        secondary: sec,
        collapsed: !!collapsed,
        splitscreen_secondary_type: sec,
    };
}

function currentClipModeId() {
    if (splitscreenSecondaryCollapsed) return 'focus';
    if (splitscreenSecondaryType === 'blank' || splitscreenSecondaryType === 'blank_blur') return 'blur';
    return 'face_track';
}

function buildModesRow() {
    // Legacy menu tiles — kept for rare fallback; primary UX is swipe + dots
    const suggested = getSuggestedClipMode();
    const row = document.createElement('div');
    row.className = 'gp-mode-row gp-mode-row--3';
    [
        {
            id: 'face_track',
            title: 'AI Reframe',
            hint: 'Face panel',
            previewClass: 'gp-prev-reframe',
            previewHtml: `<span class="gp-prev-phone"><span class="gp-prev-face"></span></span>`,
        },
        {
            id: 'blur',
            title: 'Blur',
            hint: 'Soft letterbox',
            previewClass: 'gp-prev-blur',
            previewHtml: `<span class="gp-prev-letterbox" aria-hidden="true"><i class="gp-lb-top"></i><i class="gp-lb-mid"></i><i class="gp-lb-bot"></i></span>`,
        },
        {
            id: 'focus',
            title: 'Focus',
            hint: 'Content first',
            previewClass: 'gp-prev-focus',
            previewHtml: `<span class="gp-prev-focus-frame" aria-hidden="true"></span>`,
        },
    ].forEach((m) => {
        row.appendChild(buildModeTile({ ...m, suggested: suggested === m.id }));
    });
    return row;
}

function isCanvasSelected() {
    // Blank merged into blur — both are canvas fills
    return splitscreenSecondaryType === 'blank' || splitscreenSecondaryType === 'blank_blur';
}

/** Keep blur as a modest strip — never a fullscreen empty panel.
 *  Letterbox: secondaryH = ONE bar; content sits between top+bottom bars. */
function clampCanvasPanelHeights(contentH, secondaryH, avail) {
    const a = Math.max(1, Number(avail) || 1);
    let cH = Number(contentH) || 0;
    let sH = Number(secondaryH) || 0;
    if (!isCanvasSelected()) {
        return { contentH: cH, secondaryH: sH, avail: a };
    }
    const maxBar = Math.round(a * (SPLITSCREEN_CANVAS_MAX / 2));
    sH = Math.max(0, Math.min(maxBar, sH));
    cH = Math.max(0, a - sH * 2);
    return { contentH: cH, secondaryH: sH, avail: a };
}

function clampCanvasContentRatio(ratio) {
    const r = Number(ratio);
    if (!Number.isFinite(r)) return 0.5;
    if (!isCanvasSelected()) return Math.max(0.02, Math.min(0.98, r));
    return Math.max(1 - SPLITSCREEN_CANVAS_MAX / 2, Math.min(0.98, r));
}

function isGameplayOptionSelected(id) {
    if (id === 'focus') return !!splitscreenSecondaryCollapsed;
    if (splitscreenSecondaryCollapsed) return false;
    if (id === 'face_track') return splitscreenSecondaryType === 'face_track';
    if (id === 'blank' || id === 'blur' || id === 'blank_blur') {
        return splitscreenSecondaryType === 'blank' || splitscreenSecondaryType === 'blank_blur';
    }
    return false;
}

function fillSelectionLabel() {
    if (splitscreenSecondaryCollapsed) return 'Focus';
    if (splitscreenSecondaryType === 'face_track') return 'AI Reframe';
    if (splitscreenSecondaryType === 'blank' || splitscreenSecondaryType === 'blank_blur') return 'Blur';
    return 'Modes';
}

function selectClipMode(id, opts) {
    _gpCommittedSecondary = null;
    document.getElementById('templateVideoPreview')?.classList.remove('gp-hover-preview');
    if (_reframeImmersive) {
        try { exitReframeImmersive(); } catch (_) {}
    }

    // Merge blank → blur
    if (id === 'blank') id = 'blur';
    // Dual is automatic at encode — never selectable here
    if (id === 'dual' || id === 'dual_speaker') id = 'face_track';

    // Persist current ratio under the mode we're leaving
    const prevMode = currentClipModeId();
    if (prevMode === id) {
        syncClipModeDots();
        return;
    }
    if (prevMode === 'face_track' || prevMode === 'blur') {
        const r = Number(splitscreenContentRatio);
        if (Number.isFinite(r) && r > 0.05 && r < 0.98) {
            _clipModeRatioMemory[prevMode] = r;
        }
    }

    const animate = !opts || opts.animate !== false;
    const root = _splitscreenQuery('splitscreenRoot');
    if (animate && root) {
        root.classList.add('ss-mode-fade');
        clearTimeout(root._modeFadeT);
        root._modeFadeT = setTimeout(() => root.classList.remove('ss-mode-fade'), 220);
    }

    if (id === 'focus') {
        if (!splitscreenSecondaryCollapsed) {
            collapseSplitscreenSecondary();
        }
        syncClipModeDots();
        try {
            if (window.SolisMemory && !window.SolisMemory._applying
                && typeof window.SolisMemory.recordLayout === 'function') {
                window.SolisMemory.recordLayout('splitscreen');
            }
        } catch (_) { /* ignore */ }
        return;
    }

    const typeId = id === 'blur' ? 'blank_blur' : id;
    if (typeId === 'face_track') {
        splitscreenSecondaryType = 'face_track';
        splitscreenInverted = true;
        const mem = Number(_clipModeRatioMemory.face_track);
        if (Number.isFinite(mem) && mem > 0.05 && mem < 0.98) {
            splitscreenContentRatio = mem;
            splitscreenSavedRatio = mem;
        }
    } else if (typeId === 'blank_blur') {
        splitscreenSecondaryType = 'blank_blur';
        splitscreenCanvasMode = 'blank_blur';
        splitscreenInverted = true;
        const mem = Number(_clipModeRatioMemory.blur);
        const next = Number.isFinite(mem) && mem > 0.05
            ? mem
            : Math.max(Number(splitscreenContentRatio) || 0.72, 0.72);
        splitscreenContentRatio = clampCanvasContentRatio(next);
        splitscreenSavedRatio = splitscreenContentRatio;
        _clipModeRatioMemory.blur = splitscreenContentRatio;
    }

    if (splitscreenSecondaryCollapsed) {
        expandSplitscreenSecondary();
    } else {
        notifySubtitleLayoutEdit();
        applySplitscreenPreview();
        markLibrarySplitscreenDirty();
    }
    // Keep captions inside the phone after panel heights flip
    try {
        const cont = getSplitscreenPreviewContainer();
        if (cont && typeof window.clampAllPreviewSubtitles === 'function') {
            window.clampAllPreviewSubtitles(cont);
        } else {
            syncSplitscreenSubtitles(cont);
        }
    } catch (_) { /* ignore */ }
    syncClipModeDots();
    try {
        if (window.SolisMemory && !window.SolisMemory._applying
            && typeof window.SolisMemory.recordLayout === 'function') {
            window.SolisMemory.recordLayout('splitscreen');
        }
    } catch (_) { /* ignore */ }
}

function cycleClipMode(dir) {
    const cur = currentClipModeId();
    const idx = Math.max(0, CLIP_MODE_ORDER.indexOf(cur));
    const next = CLIP_MODE_ORDER[(idx + (dir < 0 ? -1 : 1) + CLIP_MODE_ORDER.length) % CLIP_MODE_ORDER.length];
    selectClipMode(next, { animate: true });
}

function ensureClipModeDots() {
    /* Dots removed — Modes are switched from the pill / tools only */
    const preview = document.getElementById('templateVideoPreview');
    const existing = preview?.querySelector('#ssModeDots');
    if (existing) existing.remove();
    return null;
}

function syncClipModeDots() {
    const preview = document.getElementById('templateVideoPreview');
    const existing = preview?.querySelector('#ssModeDots');
    if (existing) existing.remove();
}

function bindClipModeSwipe(root) {
    /* Horizontal mode swipe removed — keep divider drag only */
    if (!root) return;
    root.dataset.modeSwipeBound = '0';
}

function gameplaySelectionLabel() {
    if (splitscreenSecondaryType !== 'gameplay') return 'Pick a clip';
    const clips = getGameplayClipsForUI();
    const selectedClip = clips.find((c) => c.id === selectedGameplayClip);
    return selectedClip?.title || 'Gameplay';
}

function snapshotGpSecondaryState() {
    return {
        splitscreenSecondaryType,
        selectedGameplayClip,
        splitscreenCanvasMode,
    };
}

function applyGpSecondaryState(state) {
    splitscreenSecondaryType = state.splitscreenSecondaryType;
    selectedGameplayClip = state.selectedGameplayClip;
    splitscreenCanvasMode = state.splitscreenCanvasMode;
}

function setSecondaryTypeVisual(id) {
    if (id === 'face_track') {
        splitscreenSecondaryType = 'face_track';
    } else if (id === 'blank' || id === 'blank_blur') {
        splitscreenSecondaryType = id;
        splitscreenCanvasMode = id;
    } else {
        splitscreenSecondaryType = 'gameplay';
        selectedGameplayClip = id;
        if (_librarySplitscreenCropState) {
            _librarySplitscreenCropState.secondaryFromLayer = false;
        }
    }
}

/** Hover preview — updates #templateVideoPreview without committing edits */
function previewGpSecondaryOption(id) {
    endGpLayoutPreview();
    if (!_gpCommittedSecondary) {
        _gpCommittedSecondary = snapshotGpSecondaryState();
    }
    setSecondaryTypeVisual(id);
    const preview = document.getElementById('templateVideoPreview');
    preview?.classList.add('gp-hover-preview');
    if (splitscreenSecondaryCollapsed) {
        expandSplitscreenSecondary();
    } else {
        applySplitscreenPreview();
    }
}

function endGpHoverPreview() {
    if (!_gpCommittedSecondary) return;
    const saved = _gpCommittedSecondary;
    _gpCommittedSecondary = null;
    applyGpSecondaryState(saved);
    document.getElementById('templateVideoPreview')?.classList.remove('gp-hover-preview');
    applySplitscreenPreview();
}

/** Stack-order hover — flip panels live in #templateVideoPreview */
function previewGpLayoutOption(inverted) {
    endGpHoverPreview();
    if (_gpCommittedLayout == null) {
        _gpCommittedLayout = !!splitscreenInverted;
    }
    splitscreenInverted = !!inverted;
    document.getElementById('templateVideoPreview')?.classList.add('gp-hover-preview');
    applySplitscreenPreview();
}

function endGpLayoutPreview() {
    if (_gpCommittedLayout == null) return;
    splitscreenInverted = _gpCommittedLayout;
    _gpCommittedLayout = null;
    document.getElementById('templateVideoPreview')?.classList.remove('gp-hover-preview');
    applySplitscreenPreview();
}

function pauseGpClipPreviews() {
    gpDdClips?.querySelectorAll('video.gp-clip-thumb').forEach((vid) => {
        try { vid.pause(); } catch (_) {}
    });
}

function selectSecondaryGameplay(id) {
    // Legacy entry — mode ids go through selectClipMode
    if (id === 'face_track' || id === 'blank' || id === 'blank_blur' || id === 'blur' || id === 'focus') {
        selectClipMode(id === 'blank_blur' ? 'blur' : id);
        return;
    }
    // Gameplay packs retired from Clip modes UI — ignore stale calls
    if (typeof id === 'string' && id && !['face_track', 'blank', 'blank_blur', 'blur', 'focus'].includes(id)) {
        selectClipMode('face_track');
    }
}

function rebuildGameplayClipsDropdown() {
    if (!gpDdClips) return;
    gpDdClips.innerHTML = '';
    gpDdClips.classList.add('gp-clips-dd--v2', 'gp-clips-dd--fill', 'gp-clips-dd--modes');
    gpDdClips.classList.remove('gp-clips-dd--play');
    gpDdClips.dataset.panelMode = 'fill';

    const head = document.createElement('div');
    head.className = 'gp-clips-head';
    const suggest = getSuggestedClipMode();
    head.innerHTML = `
        <div class="gp-clips-head-text">
            <span class="gp-clips-kicker">Modes</span>
            <span class="gp-clips-current">${fillSelectionLabel()}</span>
        </div>
        ${suggest ? `<span class="gp-clips-ai-hint">Solis suggests ${
            suggest === 'face_track' ? 'AI Reframe'
            : suggest === 'blur' ? 'Blur'
            : suggest === 'blank' ? 'Blank'
            : 'Focus'
        }</span>` : ''}
    `;
    gpDdClips.appendChild(head);

    const faceSec = document.createElement('div');
    faceSec.className = 'gp-dd-section gp-clips-face';
    faceSec.appendChild(buildModesRow());
    gpDdClips.appendChild(faceSec);
}
window.rebuildGameplayClipsDropdown = rebuildGameplayClipsDropdown;

function openGameplayDropdown(dd, btn) {
    closeGameplayDropdowns(dd);
    positionGameplayPill();
    dd.classList.add('open');

    const place = () => {
        const mR = gpPill.getBoundingClientRect();
        const isClips = dd.classList.contains('gp-clips-dd');
        const dW = dd.offsetWidth || (isClips ? 360 : 280);
        const dH = dd.offsetHeight || (isClips ? 360 : 220);
        const vp = { w: window.innerWidth, h: window.innerHeight };
        const gap = 10;
        const preview = document.getElementById('templateVideoPreview');
        const pR = preview?.getBoundingClientRect();

        const spaceBelow = vp.h - (mR.bottom + gap) - 12;
        const spaceAbove = mR.top - gap - 12;

        // Prefer below the pill; only flip up if below is cramped
        let top;
        if (spaceBelow >= Math.min(dH, 220) || spaceBelow >= spaceAbove) {
            top = mR.bottom + gap;
            if (top + dH > vp.h - 12) top = Math.max(12, vp.h - dH - 12);
            if (top + 20 < mR.bottom && spaceBelow > 120) top = mR.bottom + gap;
        } else {
            top = Math.max(12, mR.top - dH - gap);
        }

        // Keep clear of the preview: park to the RIGHT of the phone frame
        let left;
        if (pR) {
            left = pR.right + gap;
            // Not enough room on the right → hug the viewport edge, still past preview if possible
            if (left + dW > vp.w - 12) {
                left = Math.max(pR.right + 6, vp.w - dW - 12);
            }
            // Absolute last resort: if viewport is tiny, still prefer right of preview over overlapping it
            if (left < pR.right) left = Math.min(pR.right + gap, Math.max(12, vp.w - dW - 12));
        } else {
            left = mR.right + gap;
            if (left + dW > vp.w - 12) left = Math.max(12, vp.w - dW - 12);
        }

        dd.style.top = Math.round(top) + 'px';
        dd.style.left = Math.round(left) + 'px';
    };

    place();
    requestAnimationFrame(place);
}

function closeGameplayDropdowns(except) {
    endGpHoverPreview();
    endGpLayoutPreview();
    [gpDdLayout, gpDdClips].forEach((d) => {
        if (!d || d === except) return;
        if (d === gpDdClips && d.classList.contains('open')) pauseGpClipPreviews();
        d.classList.remove('open');
    });
    gpPill?.querySelectorAll('.gp-pill-btn').forEach((b) => b.classList.remove('gp-active'));
}

function positionGameplayPill() {
    if (!gpPill) return;
    const gap = 22;
    const biasRight = 28;
    const mW = gpPill.offsetWidth || 88;
    const mH = gpPill.offsetHeight || 46;
    const vp = { w: window.innerWidth, h: window.innerHeight };
    let left;
    let top;

    if (gpPillAnchor) {
        // Prefer right of click — less cramped against the preview edge
        left = gpPillAnchor.x + gap + biasRight;
        top = gpPillAnchor.y - mH / 2;
        if (left + mW > vp.w - 8) {
            left = gpPillAnchor.x - mW - gap;
        }
    } else {
        const root = document.getElementById('splitscreenRoot')
            || document.getElementById('templateVideoPreview');
        const secondary = document.getElementById('splitscreenBottom');
        const anchorRect = (secondary || root)?.getBoundingClientRect();
        if (!anchorRect) return;
        // Sit toward the right side of the preview, not dead-center
        left = anchorRect.left + anchorRect.width * 0.62 - mW / 2;
        top = anchorRect.top + Math.min(56, anchorRect.height * 0.12);
    }

    left = Math.max(8, Math.min(left, vp.w - mW - 8));
    top = Math.max(8, Math.min(top, vp.h - mH - 8));
    gpPill.style.left = left + 'px';
    gpPill.style.top = top + 'px';
}

function showGameplayPillMenu(event, focusMode) {
    if (!_splitscreenQuery('splitscreenRoot')) return;
    try { window.solisClosePeerPreviewChrome?.('gp'); } catch (_) {}
    syncClipModeDots();
    if (event) {
        event.stopPropagation();
        if (event.clientX != null && event.clientY != null) {
            gpPillAnchor = { x: event.clientX, y: event.clientY };
        }
    }
    initGameplayPillUI();
    positionGameplayPill();
    gpPill.classList.add('active');
    gpPillFocusMode = focusMode || null;
    // Keep Modes open — no extra click on the Modes button
    openModesPanelForUsers();
}

/** Open the Modes dropdown whenever the gameplay pill is shown. */
function openModesPanelForUsers() {
    if (!gpPill || !gpDdClips) return;
    const btn = document.getElementById('gpBtnClips');
    if (!btn) return;
    gpDdClips.dataset.panelMode = 'fill';
    rebuildGameplayClipsDropdown();
    openGameplayDropdown(gpDdClips, btn);
    btn.classList.add('gp-active');
}

function showSplitscreenCustomizer(event, focus) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    gpPillFocusMode = focus || null;
    showGameplayPillMenu(event, focus);
}

window.showSplitscreenCustomizer = showSplitscreenCustomizer;
window.hideGameplayPillMenu = hideGameplayPillMenu;

function hideGameplayPillMenu() {
    if (!gpPill) return;
    endGpHoverPreview();
    gpPill.classList.remove('active');
    closeGameplayDropdowns();
}

/** Close peer preview chrome so only one menu is open (sub / gp / rk). */
window.solisClosePeerPreviewChrome = function solisClosePeerPreviewChrome(keep) {
    keep = String(keep || '');
    if (keep !== 'gp') {
        try { hideGameplayPillMenu(); } catch (_) {}
    }
    if (keep !== 'sub') {
        try {
            const subPill = document.getElementById('subPillMenu');
            if (subPill?.classList.contains('active')) {
                if (typeof window.hideSubtitlePillMenu === 'function') {
                    window.hideSubtitlePillMenu();
                } else {
                    subPill.classList.remove('active');
                    ['subDdFont', 'subDdColor', 'subDdAnim'].forEach((id) => {
                        document.getElementById(id)?.classList.remove(
                            'open', 'is-dragging', 'is-swap-out', 'is-swap-in',
                        );
                    });
                    subPill.querySelectorAll('.sub-pill-btn').forEach((b) => b.classList.remove('sub-active'));
                }
            }
        } catch (_) {}
    }
    if (keep !== 'rk') {
        try {
            if (typeof window.hideRankingTextPill === 'function') {
                window.hideRankingTextPill();
            } else {
                const rk = document.getElementById('rkPillMenu');
                rk?.classList.remove('active');
                document.querySelectorAll('#rkDdFont,#rkDdColor,#rkDdStyle').forEach((d) => {
                    d?.classList.remove('open');
                });
            }
        } catch (_) {}
    }
};

function ensureSplitscreenSecondaryPanels() {
    const bottom = _splitscreenQuery('splitscreenBottom');
    if (!bottom) return;

    if (!bottom.querySelector('#splitscreenFacePanel')) {
        const face = document.createElement('div');
        face.id = 'splitscreenFacePanel';
        face.className = 'gp-secondary-panel';
        face.innerHTML = `
            <div class="gp-face-panel-content">
                <div class="gp-reframe-icon">${GP_ICON_REFRAME}</div>
                <span class="gp-panel-label">AI Reframe</span>
            </div>
        `;
        bottom.appendChild(face);
    }

    if (!bottom.querySelector('#splitscreenBlankPanel')) {
        const blank = document.createElement('div');
        blank.id = 'splitscreenBlankPanel';
        blank.innerHTML = `<video class="gp-blank-blur-vid" muted loop playsinline preload="auto"></video>`;
        bottom.appendChild(blank);
    }

    ensureBlurLetterboxBar();
}

/** Bottom letterbox blur bar — mirrors the top blank/blur strip height. */
function ensureBlurLetterboxBar() {
    const root = _splitscreenQuery('splitscreenRoot');
    if (!root) return null;
    let bar = _splitscreenQuery('splitscreenBlurBottom');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'splitscreenBlurBottom';
        bar.className = 'ss-blur-letterbox-bar';
        bar.innerHTML = `<video class="gp-blank-blur-vid gp-blank-blur-vid--mirror" muted loop playsinline preload="auto"></video>`;
        root.appendChild(bar);
    }
    return bar;
}

function syncBlurLetterboxBar(secondaryH) {
    const root = _splitscreenQuery('splitscreenRoot');
    const bar = ensureBlurLetterboxBar();
    if (!root || !bar) return;

    const active = splitscreenSecondaryType === 'blank_blur' && !splitscreenSecondaryCollapsed;
    root.classList.toggle('ss-letterbox-blur', active);
    bar.classList.toggle('visible', active);

    if (!active) {
        bar.style.flex = '0 0 0px';
        bar.style.display = 'none';
        const mirror = bar.querySelector('.gp-blank-blur-vid');
        if (mirror) {
            try { mirror.pause(); } catch (_) {}
        }
        return;
    }

    const h = Math.max(0, Math.round(Number(secondaryH) || 0));
    bar.style.display = '';
    bar.style.flex = `0 0 ${h}px`;
    bar.style.minHeight = '0';
    bar.style.overflow = 'hidden';
    bar.classList.add('mode-blur');

    // Clone / sync blur video into the bottom bar
    const srcBlank = _splitscreenQuery('splitscreenBlankPanel');
    const srcVid = srcBlank?.querySelector('.gp-blank-blur-vid');
    const mirror = bar.querySelector('.gp-blank-blur-vid');
    if (srcVid && mirror) {
        const src = srcVid.currentSrc || srcVid.src || '';
        if (src && mirror.dataset.currentSrc !== src) {
            mirror.dataset.currentSrc = src;
            mirror.src = src;
            mirror.load();
        }
        mirror.muted = true;
        mirror.loop = true;
        const kick = () => { mirror.play().catch(() => {}); };
        if (mirror.readyState >= 2) kick();
        else mirror.addEventListener('canplay', kick, { once: true });
        try {
            if (Math.abs((mirror.currentTime || 0) - (srcVid.currentTime || 0)) > 0.4) {
                mirror.currentTime = srcVid.currentTime || 0;
            }
        } catch (_) {}
    }
}

function _resolveBlankBlurSourceVideo() {
    const cont = (typeof getSplitscreenPreviewContainer === 'function'
        ? getSplitscreenPreviewContainer()
        : null) || document.getElementById('templateVideoPreview');
    const candidates = [
        _splitscreenQuery('splitscreenContentVideo'),
        cont?.querySelector?.('video.library-preview-video'),
        _splitscreenQuery('splitscreenReframeVideo'),
        _splitscreenQuery('splitscreenGameplayVideo'),
    ].filter(Boolean);
    for (const v of candidates) {
        if (v.currentSrc || v.src) return v;
    }
    return null;
}

function syncBlankBlurVideo() {
    const blank = _splitscreenQuery('splitscreenBlankPanel');
    const blurVid = blank?.querySelector('.gp-blank-blur-vid');
    if (!blank || !blurVid) return;

    const content = _resolveBlankBlurSourceVideo();
    const src = content ? (content.currentSrc || content.src || '') : '';
    if (!src) {
        // Content may still be wiring — retry once source appears
        if (!blurVid._blankSrcRetry) {
            blurVid._blankSrcRetry = () => {
                blurVid._blankSrcRetry = null;
                syncBlankBlurVideo();
            };
            const cont = _splitscreenQuery('splitscreenContentVideo');
            cont?.addEventListener('loadeddata', blurVid._blankSrcRetry, { once: true });
            cont?.addEventListener('loadedmetadata', blurVid._blankSrcRetry, { once: true });
            setTimeout(() => {
                if (blurVid._blankSrcRetry) {
                    const fn = blurVid._blankSrcRetry;
                    blurVid._blankSrcRetry = null;
                    fn();
                }
            }, 600);
        }
        return;
    }

    blurVid.muted = true;
    blurVid.loop = true;
    blurVid.playsInline = true;
    blurVid.setAttribute('playsinline', '');
    blurVid.setAttribute('muted', '');
    // Never paint as a black rectangle while decoding
    blurVid.style.setProperty('background', 'transparent', 'important');
    blurVid.style.setProperty('opacity', '1', 'important');
    blurVid.style.setProperty('visibility', 'visible', 'important');
    blank.classList.add('mode-blur');
    blank.classList.remove('mode-black');

    const wireSyncAndPlay = () => {
        const sync = () => {
            if (!content) return;
            try {
                if (Math.abs((blurVid.currentTime || 0) - (content.currentTime || 0)) > 0.35) {
                    blurVid.currentTime = content.currentTime || 0;
                }
            } catch (_) {}
        };
        if (blurVid._blankSync && blurVid._blankSyncTarget) {
            try { blurVid._blankSyncTarget.removeEventListener('timeupdate', blurVid._blankSync); } catch (_) {}
        }
        blurVid._blankSync = sync;
        blurVid._blankSyncTarget = content;
        content.addEventListener('timeupdate', sync);
        const kick = () => { blurVid.play().catch(() => {}); };
        if (blurVid.readyState >= 2) kick();
        else blurVid.addEventListener('canplay', kick, { once: true });
        kick();
    };

    // Logical content src already wired onto blur (and for blob: we hold a clone)
    if (blurVid.dataset.currentSrc === src && blurVid.src) {
        wireSyncAndPlay();
        return;
    }

    blurVid.dataset.currentSrc = src;
    const loadToken = `${src}|${Date.now()}`;
    blurVid._blurLoadToken = loadToken;

    const assignSrc = (playUrl) => {
        if (blurVid._blurLoadToken !== loadToken) return;
        if (blurVid.dataset.currentSrc !== src) return;
        blurVid.src = playUrl;
        blurVid.load();
        wireSyncAndPlay();
    };

    // HTTP(S)/relative: fine to share. blob: must be cloned — shared blob URL → second video stays black.
    if (String(src).startsWith('blob:')) {
        cloneBlobUrlForSecondVideo(src).then((cloned) => {
            if (blurVid._blurLoadToken !== loadToken) {
                // Stale request — drop orphan clone unless it became the active blur url
                if (cloned && cloned !== _blankBlurObjectUrl) {
                    _librarySplitscreenObjectUrls = _librarySplitscreenObjectUrls.filter((u) => u !== cloned);
                    try { URL.revokeObjectURL(cloned); } catch (_) {}
                }
                return;
            }
            revokeBlankBlurObjectUrl();
            _blankBlurObjectUrl = cloned;
            assignSrc(cloned);
        }).catch(() => {
            // Last resort: try shared src (may stay black on Chromium, better than nothing)
            if (blurVid._blurLoadToken === loadToken) assignSrc(src);
        });
        return;
    }

    revokeBlankBlurObjectUrl();
    assignSrc(src);
}

function reorderSplitscreenPanels() {
    const root = _splitscreenQuery('splitscreenRoot');
    const top = _splitscreenQuery('splitscreenTop');
    const divider = _splitscreenQuery('splitscreenDivider');
    const bottom = _splitscreenQuery('splitscreenBottom');
    if (!root || !top || !divider || !bottom) return;

    if (splitscreenInverted) {
        root.appendChild(bottom);
        root.appendChild(divider);
        root.appendChild(top);
    } else {
        root.appendChild(top);
        root.appendChild(divider);
        root.appendChild(bottom);
    }
    // Letterbox bottom bar always stays last
    const blurBot = _splitscreenQuery('splitscreenBlurBottom');
    if (blurBot) root.appendChild(blurBot);
}

function getSplitscreenLayout() {
    const root = _splitscreenQuery('splitscreenRoot');
    const top = _splitscreenQuery('splitscreenTop');
    const bottom = _splitscreenQuery('splitscreenBottom');
    return {
        root,
        divider: _splitscreenQuery('splitscreenDivider'),
        dividerLine: _splitscreenQuery('dividerLine'),
        top,
        bottom,
        content: top,
        secondary: bottom,
    };
}

function calcSplitscreenHeights(clientY, rootRect, dividerH) {
    // Visual seam is 1px; hit strip is CSS-expanded and must not eat panel space
    const divH = Math.max(0, Math.min(2, Number(dividerH) || 1));
    const avail = Math.max(1, rootRect.height - divH);
    const midY = clientY - rootRect.top;
    const seam = Math.max(0, Math.min(avail, midY - divH / 2));
    let contentH;
    let secondaryH;

    if (splitscreenSecondaryType === 'blank_blur' && !splitscreenSecondaryCollapsed) {
        // Letterbox: drag sets top bar; bottom mirrors; content is the middle
        secondaryH = Math.max(0, Math.min(avail * (SPLITSCREEN_CANVAS_MAX / 2), seam));
        contentH = Math.max(0, avail - secondaryH * 2);
        return clampCanvasPanelHeights(contentH, secondaryH, avail);
    }

    if (splitscreenInverted) {
        secondaryH = seam;
        contentH = avail - secondaryH;
    } else {
        contentH = seam;
        secondaryH = avail - contentH;
    }

    return clampCanvasPanelHeights(contentH, secondaryH, avail);
}

function setSplitscreenPanelHeights(contentH, secondaryH, availOverride) {
    const { root, divider, content, secondary } = getSplitscreenLayout();
    if (!root || !divider || !content || !secondary || splitscreenSecondaryCollapsed) return;
    if (_reframeImmersive) return;

    const isLetterbox = splitscreenSecondaryType === 'blank_blur';
    const divH = 1;
    const rootH = root.clientHeight || root.getBoundingClientRect().height || root.offsetHeight;
    const avail = Math.max(1, Number(availOverride) > 0 ? Number(availOverride) : (rootH - divH));

    let topBarH;
    let midH;

    if (isLetterbox) {
        // secondaryH = ONE letterbox bar; bottom bar mirrors via syncBlurLetterboxBar
        const clamped = clampCanvasPanelHeights(
            Number(contentH) || 0,
            Number(secondaryH) || 0,
            avail,
        );
        topBarH = clamped.secondaryH;
        midH = clamped.contentH;
        splitscreenContentRatio = avail > 0 ? midH / avail : 0.78;
    } else {
        midH = Math.max(0, Math.min(avail, Number(contentH) || 0));
        topBarH = Math.max(0, avail - midH);
        splitscreenContentRatio = avail > 0 ? midH / avail : 0.5;
    }

    divider.style.display = '';
    divider.style.flex = '0 0 1px';
    divider.style.minHeight = '1px';
    divider.style.maxHeight = '1px';
    divider.style.height = '1px';
    divider.style.overflow = 'visible';
    divider.style.padding = '0';
    divider.style.margin = '0';
    divider.style.opacity = '1';
    divider.style.pointerEvents = '';
    secondary.style.display = '';
    secondary.style.opacity = '1';
    content.style.display = '';
    content.style.opacity = '1';
    content.style.flex = '';
    secondary.style.flex = '';

    // Lock AI Reframe / Blur with secondary on top — drag divider (or panel edge) to resize
    if (splitscreenSecondaryType === 'face_track' || isCanvasSelected()) {
        splitscreenInverted = true;
    }

    if (splitscreenInverted) {
        secondary.style.flex = `0 0 ${topBarH}px`;
        content.style.flex = `0 0 ${midH}px`;
    } else {
        content.style.flex = `0 0 ${midH}px`;
        secondary.style.flex = `0 0 ${topBarH}px`;
    }

    syncBlurLetterboxBar(isLetterbox ? topBarH : 0);
}

let _reframeImmersive = false;
let _reframeImmersiveMode = null; // 'face' | 'peek' | null
let _reframeFaceProbeCache = new Map(); // projectId -> { has_face, face_crop }
let _reframePeekBound = false;
let _reframePeekOffsetY = 0;

function getLibraryPreviewProjectId() {
    return window.clipsStudio?.currentTemplateForPreview?.projectId || null;
}

function isReframeImmersive() {
    return Boolean(_reframeImmersive);
}

async function probeProjectFaces(projectId, panelW, panelH) {
    if (!projectId) return { has_face: false, face_crop: null };
    if (_reframeFaceProbeCache.has(projectId)) {
        return _reframeFaceProbeCache.get(projectId);
    }
    // Prefer already-known crop from library state
    const existing = _librarySplitscreenCropState?.faceCrop;
    if (Array.isArray(existing) && existing.length === 4 && existing[2] > 1) {
        const cached = { has_face: true, face_crop: existing.slice(0, 4) };
        _reframeFaceProbeCache.set(projectId, cached);
        return cached;
    }
    try {
        const response = await fetch(
            `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/splitscreen-face-probe`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ panel_w: panelW || 1080, panel_h: panelH || 1920 }),
            },
        );
        if (!response.ok) throw new Error(`face-probe ${response.status}`);
        const data = await response.json();
        const result = {
            has_face: Boolean(data.has_face && data.face_crop),
            face_crop: Array.isArray(data.face_crop) ? data.face_crop.slice(0, 4).map(Number) : null,
        };
        _reframeFaceProbeCache.set(projectId, result);
        return result;
    } catch (err) {
        safeLog('Face probe failed:', err);
        const fallback = { has_face: false, face_crop: null };
        _reframeFaceProbeCache.set(projectId, fallback);
        return fallback;
    }
}

function applyImmersiveOverlayLayout(peekOffsetY = 0) {
    const root = _splitscreenQuery('splitscreenRoot');
    const content = _splitscreenQuery('splitscreenTop');
    const secondary = _splitscreenQuery('splitscreenBottom');
    const divider = _splitscreenQuery('splitscreenDivider');
    if (!root || !content || !secondary) return;

    root.classList.add('reframe-immersive');
    root.classList.toggle('reframe-immersive-peek', _reframeImmersiveMode === 'peek');
    root.classList.toggle('reframe-immersive-face', _reframeImmersiveMode === 'face');

    if (divider) {
        divider.style.display = 'none';
        divider.style.opacity = '0';
        divider.style.pointerEvents = 'none';
    }

    content.style.display = '';
    content.style.opacity = '1';
    content.style.position = 'absolute';
    content.style.inset = '0';
    content.style.flex = 'none';
    content.style.width = '100%';
    content.style.height = '100%';
    content.style.zIndex = '1';

    secondary.style.display = '';
    secondary.style.opacity = '1';
    secondary.style.position = 'absolute';
    secondary.style.left = '0';
    secondary.style.right = '0';
    secondary.style.top = '0';
    secondary.style.bottom = '0';
    secondary.style.flex = 'none';
    secondary.style.width = '100%';
    secondary.style.height = '100%';
    secondary.style.zIndex = '3';
    secondary.style.transition = peekOffsetY ? 'none' : 'transform 0.22s cubic-bezier(.2,.9,.4,1)';
    secondary.style.transform = peekOffsetY
        ? `translateY(${Math.max(0, peekOffsetY)}px)`
        : '';
    secondary.style.pointerEvents = 'auto';
}

function clearImmersiveOverlayLayout() {
    const root = _splitscreenQuery('splitscreenRoot');
    const content = _splitscreenQuery('splitscreenTop');
    const secondary = _splitscreenQuery('splitscreenBottom');
    if (root) {
        root.classList.remove('reframe-immersive', 'reframe-immersive-peek', 'reframe-immersive-face');
    }
    [content, secondary].forEach((el) => {
        if (!el) return;
        el.style.position = '';
        el.style.inset = '';
        el.style.left = '';
        el.style.right = '';
        el.style.top = '';
        el.style.bottom = '';
        el.style.width = '';
        el.style.height = '';
        el.style.zIndex = '';
        el.style.transform = '';
        el.style.transition = '';
        el.style.flex = '';
    });
}

async function enterReframeImmersive() {
    if (splitscreenSecondaryType !== 'face_track') return;
    if (_reframeImmersive) return;

    const root = _splitscreenQuery('splitscreenRoot');
    const secondary = _splitscreenQuery('splitscreenBottom');
    if (!root || !secondary) return;

    _reframeImmersive = true;
    _reframePeekOffsetY = 0;
    splitscreenSecondaryCollapsed = false;
    removeSplitscreenCollapseHandle();

    // Fullscreen preview of the already-created clip — do NOT re-probe / live-zoom reframe.
    // Live face crop stays for normal split layouts only.
    _reframeImmersiveMode = 'peek';
    if (_librarySplitscreenCropState) {
        _librarySplitscreenCropState.liveFaceEdit = false;
        _librarySplitscreenCropState.faceDisplayMode = 'baked';
    }
    applyImmersiveOverlayLayout(0);
    armPreviewModalDragGuard(600);

    const reframeVideo = _splitscreenQuery('splitscreenReframeVideo');
    forceLibraryPanelVideoFill(reframeVideo);
    if (reframeVideo) {
        reframeVideo.style.setProperty('pointer-events', 'none', 'important');
        reframeVideo.style.cursor = 'grab';
    }
    syncLibrarySplitscreenCropPreview();
    bindReframePeekHandlers();
    ensureImmersiveExitGrip();

    root.classList.toggle('reframe-immersive-peek', true);
    root.classList.toggle('reframe-immersive-face', false);
    markLibrarySplitscreenDirty();
}

function exitReframeImmersive(restoreRatio) {
    if (!_reframeImmersive) return;
    _reframeImmersive = false;
    _reframeImmersiveMode = null;
    _reframePeekOffsetY = 0;
    unbindReframePeekHandlers();
    removeImmersiveExitGrip();
    clearImmersiveOverlayLayout();

    const saved = Number.isFinite(splitscreenSavedRatio) ? splitscreenSavedRatio : 0.5;
    splitscreenContentRatio = Math.max(0.02, Math.min(0.98, restoreRatio ?? saved));
    splitscreenSecondaryCollapsed = false;
    applySplitscreenRatio();
    if (_librarySplitscreenCropState && splitscreenSecondaryType === 'face_track') {
        _librarySplitscreenCropState.liveFaceEdit = true;
        _librarySplitscreenCropState.faceDisplayMode = 'live';
        syncLibrarySplitscreenCropPreview();
        bindFaceReframePanHandlers();
    }
    markLibrarySplitscreenDirty();
}

function removeImmersiveExitGrip() {
    _splitscreenQuery('splitscreenImmersiveExitGrip')?.remove();
}

function ensureImmersiveExitGrip() {
    const root = _splitscreenQuery('splitscreenRoot');
    if (!root || !_reframeImmersive) return;
    let grip = _splitscreenQuery('splitscreenImmersiveExitGrip');
    if (!grip) {
        grip = document.createElement('div');
        grip.id = 'splitscreenImmersiveExitGrip';
        grip.className = 'ss-immersive-exit-grip';
        grip.innerHTML = `<div class="ss-immersive-exit-bar" title="Drag down to exit"></div>`;
        root.appendChild(grip);
    }

    if (grip.dataset.bound === 'true') return;
    grip.dataset.bound = 'true';

    let startY = 0;
    let dragging = false;
    let pointerId = null;

    const onMove = (clientY) => {
        if (!dragging || !_reframeImmersive) return;
        const dy = Math.max(0, clientY - startY);
        _reframePeekOffsetY = dy;
        applyImmersiveOverlayLayout(dy);
        armPreviewModalDragGuard(600);
    };

    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        const rootEl = _splitscreenQuery('splitscreenRoot');
        const h = rootEl?.clientHeight || 1;
        const frac = _reframePeekOffsetY / h;
        if (pointerId != null && grip.hasPointerCapture?.(pointerId)) {
            try { grip.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
        }
        pointerId = null;
        if (frac >= SPLITSCREEN_PEEK_EXIT) {
            exitReframeImmersive();
            return;
        }
        _reframePeekOffsetY = 0;
        applyImmersiveOverlayLayout(0);
    };

    grip.addEventListener('pointerdown', (e) => {
        if (!_reframeImmersive) return;
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        startY = e.clientY;
        pointerId = e.pointerId;
        try { grip.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        armPreviewModalDragGuard(600);
    });
    grip.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        e.preventDefault();
        onMove(e.clientY);
    });
    grip.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        e.preventDefault();
        e.stopPropagation();
        onUp();
    });
    grip.addEventListener('pointercancel', () => onUp());
}

function bindReframePeekHandlers() {
    const secondary = _splitscreenQuery('splitscreenBottom');
    if (!secondary || _reframePeekBound) return;
    _reframePeekBound = true;

    let startY = 0;
    let dragging = false;
    let pointerId = null;

    const onMove = (clientY) => {
        if (!dragging || !_reframeImmersive || _reframeImmersiveMode !== 'peek') return;
        const dy = Math.max(0, clientY - startY);
        _reframePeekOffsetY = dy;
        applyImmersiveOverlayLayout(dy);
        armPreviewModalDragGuard(600);
    };

    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        const root = _splitscreenQuery('splitscreenRoot');
        const h = root?.clientHeight || 1;
        const frac = _reframePeekOffsetY / h;
        if (pointerId != null && secondary.hasPointerCapture?.(pointerId)) {
            try { secondary.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
        }
        pointerId = null;
        if (frac >= SPLITSCREEN_PEEK_EXIT) {
            exitReframeImmersive();
            return;
        }
        _reframePeekOffsetY = 0;
        applyImmersiveOverlayLayout(0);
    };

    secondary._peekPointerDown = (e) => {
        if (!_reframeImmersive || _reframeImmersiveMode !== 'peek') return;
        if (e.button != null && e.button !== 0) return;
        // Don't steal face-pan style clicks on empty — whole panel is the video
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        startY = e.clientY;
        pointerId = e.pointerId;
        try { secondary.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        armPreviewModalDragGuard(600);
    };
    secondary._peekPointerMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        onMove(e.clientY);
    };
    secondary._peekPointerUp = (e) => {
        if (!dragging) return;
        e.preventDefault();
        e.stopPropagation();
        onUp();
    };

    secondary.addEventListener('pointerdown', secondary._peekPointerDown);
    secondary.addEventListener('pointermove', secondary._peekPointerMove);
    secondary.addEventListener('pointerup', secondary._peekPointerUp);
    secondary.addEventListener('pointercancel', secondary._peekPointerUp);
}

function unbindReframePeekHandlers() {
    const secondary = _splitscreenQuery('splitscreenBottom');
    _reframePeekBound = false;
    if (!secondary) return;
    if (secondary._peekPointerDown) {
        secondary.removeEventListener('pointerdown', secondary._peekPointerDown);
        secondary.removeEventListener('pointermove', secondary._peekPointerMove);
        secondary.removeEventListener('pointerup', secondary._peekPointerUp);
        secondary.removeEventListener('pointercancel', secondary._peekPointerUp);
        delete secondary._peekPointerDown;
        delete secondary._peekPointerMove;
        delete secondary._peekPointerUp;
    }
}

function maybeEnterReframeImmersiveFromDrag(contentH, secondaryH, avail) {
    // Disabled: dragging AI Reframe larger must keep the panel — not jump to immersive.
    // Immersive is Focus mode (or explicit user action), not a drag side-effect.
    return false;
}

function collapseSplitscreenSecondary() {
    if (_reframeImmersive) {
        resetReframeImmersiveState();
    }
    const already = splitscreenSecondaryCollapsed && Number(splitscreenContentRatio) >= 0.97;
    if (!splitscreenSecondaryCollapsed && splitscreenContentRatio < 0.98) {
        splitscreenSavedRatio = Math.max(0.02, Math.min(0.98, splitscreenContentRatio));
        const mode = splitscreenSecondaryType === 'blank_blur' || splitscreenSecondaryType === 'blank'
            ? 'blur'
            : 'face_track';
        _clipModeRatioMemory[mode] = splitscreenSavedRatio;
    }
    splitscreenSecondaryCollapsed = true;
    splitscreenContentRatio = 1;
    try { syncBlurLetterboxBar(0); } catch (_) {}
    applySplitscreenRatio();
    if (!already) markLibrarySplitscreenDirty();
}

function resetReframeImmersiveState() {
    _reframeImmersive = false;
    _reframeImmersiveMode = null;
    _reframePeekOffsetY = 0;
    unbindReframePeekHandlers();
    removeImmersiveExitGrip();
    clearImmersiveOverlayLayout();
}

function smoothCollapseSplitscreenSecondary() {
    const { root, divider, content, secondary } = getSplitscreenLayout();
    if (!root || !divider || !content || !secondary) return;

    notifySubtitleLayoutEdit();
    const divH = 1;
    const rootH = root.getBoundingClientRect().height || root.offsetHeight;
    const avail = Math.max(1, rootH - divH);
    const contentH = avail;

    root.classList.remove('is-dragging');
    setSplitscreenPanelHeights(contentH, 0);

    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        secondary.removeEventListener('transitionend', onTransitionEnd);
        collapseSplitscreenSecondary();
    };
    const onTransitionEnd = (e) => {
        if (e.target !== secondary || e.propertyName !== 'flex-basis') return;
        finish();
    };

    secondary.addEventListener('transitionend', onTransitionEnd);
    window.setTimeout(finish, SPLITSCREEN_COLLAPSE_ANIM_MS + 40);
}

function expandSplitscreenSecondary(ratio) {
    const { root } = getSplitscreenLayout();
    const saved = Number.isFinite(splitscreenSavedRatio) ? splitscreenSavedRatio : 0.5;
    const targetRatio = ratio ?? (Number.isFinite(saved) ? saved : 0.5);

    notifySubtitleLayoutEdit();
    splitscreenSecondaryCollapsed = false;
    splitscreenContentRatio = targetRatio;
    removeSplitscreenCollapseHandle();
    applySplitscreenRatio();
    markLibrarySplitscreenDirty();

    // Instant restore: kept reframe layer may already be wired; refill if empty
    ensureKeptReframePanelLoaded();

    if (!root) return;
    const { contentH, secondaryH } = (() => {
        const divH = 1;
        const rootH = root.getBoundingClientRect().height || root.offsetHeight;
        const avail = Math.max(1, rootH - divH);
        const cH = Math.round(avail * targetRatio);
        return { contentH: cH, secondaryH: avail - cH };
    })();

    // Animate open from fully collapsed
    setSplitscreenPanelHeights(contentH, 0);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setSplitscreenPanelHeights(contentH, secondaryH);
            playBothLibraryPanels(root);
        });
    });
}

/** Reload baked reframe/gameplay if expand finds an empty secondary panel. */
function ensureKeptReframePanelLoaded() {
    try {
        const projectId = window.clipsStudio?.currentTemplateForPreview?.projectId
            || window.clipsStudio?._libraryPreviewProjectId;
        if (!projectId || typeof API_BASE_URL === 'undefined') return;

        const reframeVideo = _splitscreenQuery('splitscreenReframeVideo');
        const gameplayVideo = _splitscreenQuery('splitscreenGameplayVideo');
        const layerUrl = `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/splitscreen-layer/secondary`;

        if (splitscreenSecondaryType === 'face_track' && reframeVideo) {
            const hasSrc = Boolean(reframeVideo.currentSrc || reframeVideo.src);
            if (!hasSrc || reframeVideo.error) {
                reframeVideo.style.setProperty('display', 'block', 'important');
                reframeVideo.src = layerUrl;
                reframeVideo.load();
                reframeVideo.play().catch(() => {});
            }
            const contentVideo = _splitscreenQuery('splitscreenContentVideo');
            if (contentVideo) bindLibrarySplitscreenPlaybackSync(contentVideo, reframeVideo);
            syncLibrarySplitscreenCropPreview();
            return;
        }

        if (splitscreenSecondaryType === 'gameplay' && gameplayVideo) {
            const hasSrc = Boolean(gameplayVideo.currentSrc || gameplayVideo.src);
            if (!hasSrc || gameplayVideo.error) {
                gameplayVideo.style.setProperty('display', 'block', 'important');
                gameplayVideo.src = layerUrl;
                gameplayVideo.load();
                gameplayVideo.play().catch(() => {});
            }
        }
    } catch (_) { /* non-fatal */ }
}

function removeSplitscreenCollapseHandle() {
    _splitscreenQuery('splitscreenCollapseHandle')?.remove();
}

function ensureSplitscreenCollapseHandle() {
    const { root } = getSplitscreenLayout();
    if (!root || !splitscreenSecondaryCollapsed) return;

    let handle = _splitscreenQuery('splitscreenCollapseHandle');
    if (!handle) {
        handle = document.createElement('div');
        handle.id = 'splitscreenCollapseHandle';
        handle.className = 'ss-collapse-handle';
        handle.innerHTML = `<div class="ss-collapse-grip" title="Drag to restore reframe"></div>`;
        root.appendChild(handle);
        initSplitscreenCollapseHandle(handle);
    }
}

function initSplitscreenCollapseHandle(handle) {
    if (handle.dataset.collapseInit === 'true') return;
    handle.dataset.collapseInit = 'true';

    const startExpandDrag = (clientY) => {
        const { root } = getSplitscreenLayout();
        if (!root) return;

        root.classList.add('is-dragging');
        notifySubtitleLayoutEdit();
        const rootRect = root.getBoundingClientRect();
        const dividerH = 1;
        const avail = rootRect.height - dividerH;
        let expanded = false;

        const onMove = (mv) => {
            const relY = mv.clientY - rootRect.top;
            let contentH;
            let secondaryH;

            if (splitscreenInverted) {
                secondaryH = Math.max(0, Math.min(avail, relY));
                if (secondaryH <= 1) return;
                contentH = avail - secondaryH;
            } else {
                contentH = Math.max(0, Math.min(avail, relY));
                secondaryH = avail - contentH;
                if (secondaryH <= 1) return;
            }

            expanded = true;
            splitscreenSecondaryCollapsed = false;
            removeSplitscreenCollapseHandle();
            splitscreenContentRatio = contentH / avail;
            setSplitscreenPanelHeights(contentH, secondaryH, avail);
        };

        const onUp = () => {
            root.classList.remove('is-dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onUp);
            if (!expanded) {
                expandSplitscreenSecondary();
            } else {
                syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
                syncLibrarySplitscreenCropPreview();
                markLibrarySplitscreenDirty();
            }
            notifySubtitleLayoutIdle();
        };

        const onTouchMove = (e) => {
            if (e.touches[0]) onMove(e.touches[0]);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onUp);
    };

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startExpandDrag(e.clientY);
    });
    handle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.touches[0]) startExpandDrag(e.touches[0].clientY);
    }, { passive: false });
    handle.addEventListener('click', (e) => {
        e.stopPropagation();
        expandSplitscreenSecondary();
    });
}

function applySplitscreenDrag(clientY, rootRect, dividerH) {
    const { root } = getSplitscreenLayout();
    if (!root) return null;

    _splitscreenDragPending = { clientY, rootRect, dividerH };
    if (_splitscreenDragRaf) return null;

    _splitscreenDragRaf = requestAnimationFrame(() => {
        _splitscreenDragRaf = 0;
        const pending = _splitscreenDragPending;
        _splitscreenDragPending = null;
        if (!pending) return;
        const { contentH, secondaryH, avail } = calcSplitscreenHeights(
            pending.clientY, pending.rootRect, pending.dividerH,
        );
        splitscreenSecondaryCollapsed = false;
        setSplitscreenPanelHeights(contentH, secondaryH, avail);
        // Keep captions glued using computed seam Y (rect can lag mid-drag)
        syncSplitscreenSubtitles(
            getSplitscreenPreviewContainer(),
            getDividerCenterYFromHeights(contentH, secondaryH),
        );
    });
    return null;
}

function finishSplitscreenDrag(clientY, rootRect, dividerH) {
    const { root } = getSplitscreenLayout();
    if (_splitscreenDragRaf) {
        cancelAnimationFrame(_splitscreenDragRaf);
        _splitscreenDragRaf = 0;
    }
    _splitscreenDragPending = null;

    const { contentH, secondaryH, avail } = calcSplitscreenHeights(clientY, rootRect, dividerH);

    if (secondaryH <= SPLITSCREEN_COLLAPSE_SNAP && !isCanvasSelected()) {
        root?.classList.remove('is-dragging');
        collapseSplitscreenSecondary();
        notifySubtitleLayoutIdle();
        return;
    }

    // Gameplay: near-100% content → true fullscreen. Blank/blur stays a 35% strip.
    const contentShare = contentH / Math.max(1, avail);
    if (
        splitscreenSecondaryType !== 'face_track'
        && !isCanvasSelected()
        && contentShare >= SPLITSCREEN_IMMERSIVE_ENTER
    ) {
        root?.classList.remove('is-dragging');
        collapseSplitscreenSecondary();
        notifySubtitleLayoutIdle();
        return;
    }

    // Drag reframe nearly fullscreen → face probe / peek-underneath mode
    if (maybeEnterReframeImmersiveFromDrag(contentH, secondaryH, avail)) {
        root?.classList.remove('is-dragging');
        notifySubtitleLayoutIdle();
        return;
    }

    // Letterbox: keep bar height as secondaryH. Reframe: secondary + content fill avail.
    let settledContentH = Math.max(0, Math.min(avail, contentH));
    let settledSecondaryH = isCanvasSelected()
        ? Math.max(0, secondaryH)
        : Math.max(0, avail - settledContentH);

    if (isCanvasSelected()) {
        const clamped = clampCanvasPanelHeights(settledContentH, settledSecondaryH, avail);
        settledContentH = clamped.contentH;
        settledSecondaryH = clamped.secondaryH;
    }

    splitscreenContentRatio = avail > 0 ? settledContentH / avail : 0.5;
    if (splitscreenContentRatio > 0.01 && splitscreenContentRatio < 0.99) {
        splitscreenSavedRatio = splitscreenContentRatio;
        const mode = currentClipModeId();
        if (mode === 'face_track' || mode === 'blur') {
            _clipModeRatioMemory[mode] = splitscreenContentRatio;
        }
    }

    // Apply while still is-dragging so CSS transitions don't rubber-band
    setSplitscreenPanelHeights(settledContentH, settledSecondaryH, avail);
    requestAnimationFrame(() => {
        root?.classList.remove('is-dragging');
        syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
        syncLibrarySplitscreenCropPreview();
        markLibrarySplitscreenDirty();
        notifySubtitleLayoutIdle();
        try {
            if (window.SolisMemory && !window.SolisMemory._applying
                && typeof window.SolisMemory.recordLayout === 'function') {
                window.SolisMemory.recordLayout('splitscreen');
            }
        } catch (_) { /* ignore */ }
    });
}

function applySplitscreenRatio() {
    const { root, divider, content, secondary } = getSplitscreenLayout();
    if (!root || !divider || !content || !secondary) return;

    if (_reframeImmersive) {
        applyImmersiveOverlayLayout(_reframePeekOffsetY);
        return;
    }

    root.classList.toggle('secondary-at-top', splitscreenInverted);
    root.classList.toggle('secondary-collapsed', splitscreenSecondaryCollapsed);

    if (splitscreenSecondaryCollapsed) {
        divider.style.display = 'none';
        secondary.style.display = 'none';
        secondary.style.flex = '0 0 0px';
        secondary.style.opacity = '0';
        content.style.flex = '1 1 100%';
        content.style.minHeight = '0';
        ensureSplitscreenCollapseHandle();
        syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
        syncLibrarySplitscreenCropPreview();
        return;
    }

    removeSplitscreenCollapseHandle();
    divider.style.display = '';
    divider.style.opacity = '1';
    divider.style.pointerEvents = '';
    secondary.style.display = '';
    secondary.style.opacity = '1';
    content.style.display = '';
    content.style.opacity = '1';
    content.style.flex = '';
    content.style.minHeight = '';
    secondary.style.flex = '';

    const rootH = root.clientHeight || root.getBoundingClientRect().height || root.offsetHeight;
    // 1px layout seam — hit target is CSS ::before, not flex space
    divider.style.flex = '0 0 1px';
    divider.style.minHeight = '1px';
    divider.style.maxHeight = '1px';
    divider.style.height = '1px';
    divider.style.overflow = 'visible';
    divider.style.padding = '0';
    divider.style.margin = '0';
    const stripH = 1;
    const avail = Math.max(1, rootH - stripH);
    // Default / unset → true mid-frame (0.5). Don't leave a top-biased seam.
    let ratio = Number(splitscreenContentRatio);
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) ratio = 0.5;
    ratio = clampCanvasContentRatio(ratio);
    splitscreenContentRatio = ratio;

    if (isCanvasSelected()) {
        const midH = Math.round(avail * ratio);
        const barH = Math.max(0, Math.floor((avail - midH) / 2));
        setSplitscreenPanelHeights(midH, barH, avail);
    } else {
        const contentH = Math.round(avail * ratio);
        const secondaryH = Math.max(0, avail - contentH);
        setSplitscreenPanelHeights(contentH, secondaryH, avail);
    }
    syncLibrarySplitscreenCropPreview();
}

function applySecondaryVisual() {
    ensureSplitscreenSecondaryPanels();
    const video = _splitscreenQuery('splitscreenGameplayVideo');
    const reframeVideo = _splitscreenQuery('splitscreenReframeVideo');
    const face = _splitscreenQuery('splitscreenFacePanel');
    const blank = _splitscreenQuery('splitscreenBlankPanel');
    const inLibraryCrop = Boolean(window.clipsStudio?._librarySplitscreenCustomize);

    const hideGameplay = () => {
        if (video) video.style.setProperty('display', 'none', 'important');
    };
    const hideReframe = () => {
        if (reframeVideo) {
            reframeVideo.style.setProperty('display', 'none', 'important');
            reframeVideo.style.visibility = 'hidden';
            reframeVideo.style.opacity = '0';
        }
    };
    const hideFace = () => { if (face) face.classList.remove('visible'); };
    const hideBlank = () => {
        if (!blank) return;
        blank.classList.remove('visible');
        const bottom = _splitscreenQuery('splitscreenBottom');
        if (bottom) bottom.classList.remove('ss-blank-fill', 'ss-reframe-fill');
        const secondaryVp = _splitscreenQuery('splitscreenSecondaryViewport');
        if (secondaryVp) {
            secondaryVp.style.removeProperty('opacity');
            secondaryVp.style.removeProperty('visibility');
            secondaryVp.style.removeProperty('pointer-events');
        }
        // Keep mode classes briefly so opacity can fade; clear after transition
        clearTimeout(blank._modeClearT);
        blank._modeClearT = setTimeout(() => {
            if (!blank.classList.contains('visible')) {
                blank.classList.remove('mode-black', 'mode-blur');
                const blurVid = blank.querySelector('.gp-blank-blur-vid');
                if (blurVid) {
                    try { blurVid.pause(); } catch (_) {}
                }
            }
        }, 420);
    };

        if (splitscreenSecondaryType === 'blank' || splitscreenSecondaryType === 'blank_blur') {
        // Blank merged into Blur — always soft letterbox blur (never solid black)
        if (splitscreenSecondaryType === 'blank') {
            splitscreenSecondaryType = 'blank_blur';
            splitscreenCanvasMode = 'blank_blur';
        }
        hideGameplay();
        hideReframe();
        hideFace();
        if (video) {
            video.style.setProperty('display', 'none', 'important');
            video.style.setProperty('visibility', 'hidden', 'important');
            video.style.setProperty('opacity', '0', 'important');
        }
        if (reframeVideo) {
            reframeVideo.style.setProperty('display', 'none', 'important');
            reframeVideo.style.setProperty('visibility', 'hidden', 'important');
            reframeVideo.style.setProperty('opacity', '0', 'important');
        }
        const bottom = _splitscreenQuery('splitscreenBottom');
        if (bottom) {
            bottom.classList.remove('ss-reframe-fill');
            bottom.classList.add('ss-blank-fill');
        }
        if (blank) {
            clearTimeout(blank._modeClearT);
            blank.classList.add('visible', 'mode-blur');
            blank.classList.remove('mode-black');
            syncBlankBlurVideo();
            const blurVid = blank.querySelector('.gp-blank-blur-vid');
            if (blurVid) {
                blurVid.style.setProperty('opacity', '1', 'important');
                blurVid.style.setProperty('visibility', 'visible', 'important');
            }
            const secondaryVp = _splitscreenQuery('splitscreenSecondaryViewport');
            if (secondaryVp) {
                secondaryVp.style.setProperty('opacity', '0', 'important');
                secondaryVp.style.setProperty('visibility', 'hidden', 'important');
                secondaryVp.style.setProperty('pointer-events', 'none', 'important');
            }
        }
    } else if (splitscreenSecondaryType === 'face_track') {
        const bottom = _splitscreenQuery('splitscreenBottom');
        if (bottom) {
            bottom.classList.remove('ss-blank-fill');
            bottom.classList.add('ss-reframe-fill');
        }
        hideBlank();
        hideFace();
        // Never leave gameplay under reframe (library CSS forces videos visible)
        if (video) {
            video.style.setProperty('display', 'none', 'important');
            video.style.setProperty('visibility', 'hidden', 'important');
            video.style.setProperty('opacity', '0', 'important');
            try { video.pause(); } catch (_) { /* ignore */ }
        }
        if (reframeVideo) {
            reframeVideo.style.removeProperty('display');
            reframeVideo.style.setProperty('display', 'block', 'important');
            reframeVideo.style.setProperty('visibility', 'visible', 'important');
            reframeVideo.style.setProperty('opacity', '1', 'important');
        }
        // Library preview: always show reframe video (never the REFRAME placeholder)
        if (inLibraryCrop && reframeVideo) {
            forceLibraryPanelVideoFill(reframeVideo);
            syncLibrarySplitscreenCropPreview();
        } else if (face) {
            hideReframe();
            face.classList.add('visible');
        } else if (reframeVideo) {
            // Template preview without library crop state — still show reframe layer
            reframeVideo.style.visibility = 'visible';
            reframeVideo.style.opacity = '1';
        }
    } else {
        const bottomClear = _splitscreenQuery('splitscreenBottom');
        if (bottomClear) {
            bottomClear.classList.remove('ss-blank-fill');
            bottomClear.classList.remove('ss-reframe-fill');
        }
        hideBlank();
        hideFace();
        if (video) {
            video.style.display = 'block';
            video.style.removeProperty('visibility');
            video.style.removeProperty('opacity');
        }
        hideReframe();
        // Don't overwrite baked secondary layer with /assets gameplay on first paint
        const bakedLayer = inLibraryCrop
            && _librarySplitscreenCropState?.secondaryFromLayer
            && video?.src
            && String(video.src).includes('/splitscreen-layer/');
        if (bakedLayer) {
            syncLibrarySplitscreenCropPreview();
        } else {
            applyGameplayClip(selectedGameplayClip);
        }
    }
    if (splitscreenSecondaryCollapsed) {
        ensureSplitscreenCollapseHandle();
    }
}

function applySplitscreenPreview() {
    // Normalize legacy blank → blur
    if (splitscreenSecondaryType === 'blank') {
        splitscreenSecondaryType = 'blank_blur';
        splitscreenCanvasMode = 'blank_blur';
    }
    reorderSplitscreenPanels();
    applySplitscreenRatio();
    applySecondaryVisual();
    syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
    wireSplitscreenPanelHoverHints();
    const root = _splitscreenQuery('splitscreenRoot');
    if (root) {
        bindClipModeSwipe(root);
        if (typeof window.startSplitscreenDividerDrag === 'function') {
            bindSeamHoldDrag(root, window.startSplitscreenDividerDrag);
        }
    }
    syncClipModeDots();
}

/** Corner label for the secondary half of the phone */
function secondaryPanelHintLabel() {
    if (splitscreenSecondaryCollapsed) return 'Focus';
    if (splitscreenSecondaryType === 'face_track') return 'AI Reframe';
    if (splitscreenSecondaryType === 'blank' || splitscreenSecondaryType === 'blank_blur') return 'Blur';
    return 'Modes';
}

function ensureSplitscreenPanelHint(panel, text) {
    if (!panel) return null;
    let hint = panel.querySelector(':scope > .ss-panel-hover-hint');
    if (!hint) {
        hint = document.createElement('span');
        hint.className = 'ss-panel-hover-hint';
        hint.setAttribute('aria-hidden', 'true');
        panel.appendChild(hint);
    }
    hint.textContent = text || '';
    return hint;
}

/** Hover a panel → outline + small corner hint (AI Reframe, Your content, …) */
function wireSplitscreenPanelHoverHints() {
    const root = _splitscreenQuery('splitscreenRoot');
    const content = _splitscreenQuery('splitscreenTop');
    const secondary = _splitscreenQuery('splitscreenBottom');
    if (!root || !content || !secondary) return;

    ensureSplitscreenPanelHint(content, 'Your content');
    ensureSplitscreenPanelHint(secondary, secondaryPanelHintLabel());

    if (root.dataset.hoverHintsWired === '1') return;
    root.dataset.hoverHintsWired = '1';

    const clearAll = () => {
        root.querySelectorAll('.ss-hover-panel').forEach((p) => {
            p.classList.remove('ss-panel-outlined', 'ss-panel-hint-visible');
        });
    };

    const bind = (panel, role) => {
        panel.classList.add('ss-hover-panel');
        panel.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'touch') return;
            clearAll();
            const label = role === 'content' ? 'Your content' : secondaryPanelHintLabel();
            ensureSplitscreenPanelHint(panel, label);
            panel.classList.add('ss-panel-outlined', 'ss-panel-hint-visible');
        });
        panel.addEventListener('pointerleave', () => {
            panel.classList.remove('ss-panel-outlined', 'ss-panel-hint-visible');
        });
    };

    bind(content, 'content');
    bind(secondary, 'secondary');
}

function applyGameplayClip(clipId) {
    selectedGameplayClip = clipId || selectedGameplayClip || 'minecraft_1';
    const clip = resolveGameplayClipMeta(selectedGameplayClip);
    const video = _splitscreenQuery('splitscreenGameplayVideo');
    if (!video || !clip?.filename) return;

    video.style.position = '';
    video.style.left = '';
    video.style.top = '';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.maxWidth = '';
    video.style.transform = '';
    video.style.transition = 'opacity .28s cubic-bezier(.22,.8,.28,1)';
    video.style.setProperty('display', 'block', 'important');
    video.style.removeProperty('visibility');
    video.style.removeProperty('opacity');

    const src = resolveGameplayMediaUrl(`/assets/${clip.filename}`);
    if (video.dataset.currentSrc === src && !video.paused && video.readyState >= 2) {
        video.style.opacity = '1';
        return;
    }

    video.dataset.currentSrc = src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.style.opacity = '0';

    const sourceEl = video.querySelector('source');
    if (sourceEl) sourceEl.remove();

    if (splitscreenVideoCanPlayHandler) {
        video.removeEventListener('canplay', splitscreenVideoCanPlayHandler);
    }
    splitscreenVideoCanPlayHandler = () => {
        video.play().catch(() => {});
        requestAnimationFrame(() => { video.style.opacity = '1'; });
        video.removeEventListener('canplay', splitscreenVideoCanPlayHandler);
        splitscreenVideoCanPlayHandler = null;
    };
    video.addEventListener('canplay', splitscreenVideoCanPlayHandler);
    video.addEventListener('error', () => {
        // One retry via alternate /frontend path is not needed — log quietly
        safeLog('Gameplay clip failed to load:', src);
    }, { once: true });
    video.src = src;
    video.load();
}

window.getSplitscreenConfig = function () {
    return {
        gameplay_clip_id: splitscreenSecondaryType === 'gameplay' ? selectedGameplayClip : splitscreenSecondaryType,
        splitscreen_inverted: splitscreenInverted,
        splitscreen_secondary_type: splitscreenSecondaryType,
        splitscreen_secondary_collapsed: splitscreenSecondaryCollapsed,
        splitscreen_content_ratio: splitscreenContentRatio,
    };
};

/** Apply remembered splitscreen layout (secondary type, ratio, stack order). */
window.applySplitscreenMemoryLayout = function (layout, opts) {
    if (!layout || typeof layout !== 'object') return false;
    const commit = !opts || opts.commit !== false;
    try {
        // Geometry FIRST — so fill switch / preview lands on the remembered seam
        if (layout.splitscreen_inverted != null) {
            splitscreenInverted = !!layout.splitscreen_inverted;
        }
        if (Number.isFinite(Number(layout.splitscreen_content_ratio))) {
            splitscreenContentRatio = Number(layout.splitscreen_content_ratio);
        }
        const typeHint = String(layout.splitscreen_secondary_type || splitscreenSecondaryType || '').toLowerCase();
        // Legacy gameplay → Focus
        const type = typeHint === 'gameplay' ? 'face_track' : typeHint;
        const wantFocus = !!layout.splitscreen_secondary_collapsed || typeHint === 'gameplay';

        if (type === 'blank' || type === 'blank_blur' || type === 'blur') {
            splitscreenSecondaryType = type === 'blur' ? 'blank_blur' : type;
            splitscreenContentRatio = clampCanvasContentRatio(splitscreenContentRatio);
        } else {
            splitscreenContentRatio = Math.max(0.02, Math.min(0.98, Number(splitscreenContentRatio) || 0.5));
        }
        splitscreenSavedRatio = splitscreenContentRatio;

        if (wantFocus) {
            splitscreenSecondaryType = (type === 'blank' || type === 'blank_blur') ? type : 'face_track';
            setSuggestedClipMode(splitscreenSecondaryType, true);
            selectClipMode('focus');
        } else if (type === 'face_track' || type === 'blank' || type === 'blank_blur' || type === 'blur') {
            const modeId = (type === 'blank_blur' || type === 'blur') ? 'blur' : type;
            setSuggestedClipMode(type === 'blur' ? 'blank_blur' : type, false);
            selectClipMode(modeId);
        } else {
            setSuggestedClipMode('face_track', false);
            selectClipMode('face_track');
        }

        if (!wantFocus) {
            splitscreenSecondaryCollapsed = false;
            removeSplitscreenCollapseHandle();
            applySplitscreenRatio();
            applySplitscreenPreview();
            syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
        }
        if (commit) {
            markLibrarySplitscreenDirty();
            try {
                rebuildGameplayClipsDropdown();
            } catch (_) { /* ignore */ }
            try {
                if (typeof closeGameplayDropdowns === 'function') closeGameplayDropdowns();
            } catch (_) { /* ignore */ }
            window.__solisSsMemPreview = null;
        }
        return true;
    } catch (err) {
        safeLog('applySplitscreenMemoryLayout failed:', err);
        return false;
    }
};

/**
 * Soft-preview remembered fill + divider so Accept matches what you see.
 * Reject restores via __solisSsMemPreview.
 */
window.offerSplitscreenMemorySuggest = function (layout, templateId) {
    if (!layout || typeof layout !== 'object') return false;
    const modal = document.getElementById('templatePreviewModal');
    if (!modal || !modal.classList.contains('active')) return false;

    const live = typeof window.getSplitscreenConfig === 'function' ? window.getSplitscreenConfig() : {};
    // Snapshot so Reject can undo soft type + divider preview
    window.__solisSsMemPreview = {
        ratio: Number(live.splitscreen_content_ratio),
        inverted: !!live.splitscreen_inverted,
        collapsed: !!live.splitscreen_secondary_collapsed,
        secondary_type: live.splitscreen_secondary_type,
        gameplay_clip_id: live.gameplay_clip_id,
    };

    const type = String(layout.splitscreen_secondary_type || '').toLowerCase();
    const typeDiffers = type && (
        String(live.splitscreen_secondary_type || '') !== type
        || (type === 'gameplay' && live.gameplay_clip_id !== layout.gameplay_clip_id)
    );
    const memRatio = Number(layout.splitscreen_content_ratio);
    const liveRatio = Number(live.splitscreen_content_ratio);
    const ratioDiffers = Number.isFinite(memRatio)
        && (!Number.isFinite(liveRatio) || Math.abs(memRatio - liveRatio) > 0.015);
    const invertDiffers = layout.splitscreen_inverted != null
        && !!layout.splitscreen_inverted !== !!live.splitscreen_inverted;

    // Soft-preview only — never open the gameplay/format pill (clutters the phone)
    try { hideGameplayPillMenu(); } catch (_) { /* ignore */ }
    document.querySelectorAll('.gp-mem-pick').forEach((el) => el.classList.remove('gp-mem-pick'));
    try {
        document.getElementById('subPillMenu')?.classList.remove('active');
        document.getElementById('previewEditorPill')?.querySelectorAll('.tool-btn.active')
            .forEach((b) => b.classList.remove('active'));
    } catch (_) { /* ignore */ }

    if (!typeDiffers && !ratioDiffers && !invertDiffers) return true;

    try {
        window.SolisMemory && (window.SolisMemory._applying = true);

        // Divider / stack first, then fill — blur + seam move together
        if (invertDiffers) {
            splitscreenInverted = !!layout.splitscreen_inverted;
        }
        if (ratioDiffers) {
            splitscreenContentRatio = Math.max(0.02, Math.min(0.98, memRatio));
            splitscreenSavedRatio = splitscreenContentRatio;
        }

        if (typeDiffers && type) {
            if (type === 'face_track' || type === 'blank' || type === 'blank_blur') {
                selectSecondaryGameplay(type);
            } else if (type === 'gameplay' || layout.gameplay_clip_id) {
                const id = (layout.gameplay_clip_id
                    && !['face_track', 'blank', 'blank_blur'].includes(String(layout.gameplay_clip_id)))
                    ? layout.gameplay_clip_id
                    : (selectedGameplayClip || 'minecraft_1');
                selectSecondaryGameplay(id);
            }
        } else {
            applySplitscreenRatio();
            applySplitscreenPreview();
        }
        applySecondaryVisual();
        syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
        if (window.SolisMemory) window.SolisMemory._applying = false;
    } catch (_) {
        if (window.SolisMemory) window.SolisMemory._applying = false;
    }

    return true;
};

window.revertSplitscreenMemorySuggestPreview = function () {
    const snap = window.__solisSsMemPreview;
    window.__solisSsMemPreview = null;
    if (!snap || typeof snap !== 'object') return false;
    try {
        window.SolisMemory && (window.SolisMemory._applying = true);
        if (Number.isFinite(Number(snap.ratio))) {
            splitscreenContentRatio = Math.max(0.02, Math.min(0.98, Number(snap.ratio)));
            splitscreenSavedRatio = splitscreenContentRatio;
        }
        splitscreenInverted = !!snap.inverted;
        const t = String(snap.secondary_type || '').toLowerCase();
        if (t === 'face_track' || t === 'blank' || t === 'blank_blur') {
            selectSecondaryGameplay(t);
        } else if (t === 'gameplay' || snap.gameplay_clip_id) {
            selectSecondaryGameplay(snap.gameplay_clip_id || selectedGameplayClip || 'minecraft_1');
        }
        if (snap.collapsed) {
            collapseSplitscreenSecondary();
        } else {
            splitscreenSecondaryCollapsed = false;
            removeSplitscreenCollapseHandle();
            applySplitscreenRatio();
            applySplitscreenPreview();
        }
        syncSplitscreenSubtitles(getSplitscreenPreviewContainer());
        if (window.SolisMemory) window.SolisMemory._applying = false;
        return true;
    } catch (_) {
        if (window.SolisMemory) window.SolisMemory._applying = false;
        return false;
    }
};

window.clearSplitscreenMemorySuggestChrome = function () {
    document.querySelectorAll('.gp-mem-pick').forEach((el) => el.classList.remove('gp-mem-pick'));
};

function showGameplayClipSelector(event) {
    showSplitscreenCustomizer(event, 'fill');
}

function selectGameplayClip(clipId) {
    selectSecondaryGameplay(clipId);
}
window.selectGameplayClip = selectGameplayClip;

// ─── Splitscreen subtitle sync ───────────────────────────────────────────────
function getSplitscreenPreviewContainer() {
    if (_splitscreenScopeEl) return _splitscreenScopeEl;
    return document.getElementById('templateVideoPreview');
}

function getDividerCenterY(cont) {
    const divider = cont?.querySelector('#splitscreenDivider');
    if (!divider || !cont) return null;
    const cR = cont.getBoundingClientRect();
    const dR = divider.getBoundingClientRect();
    return dR.top + dR.height / 2 - cR.top;
}

/** Prefer flex heights over getBoundingClientRect during drag (avoids stale layout). */
function getDividerCenterYFromHeights(contentH, secondaryH) {
    const divH = 1;
    if (typeof splitscreenInverted !== 'undefined' && splitscreenInverted) {
        return (Number(secondaryH) || 0) + divH / 2;
    }
    return (Number(contentH) || 0) + divH / 2;
}

function storeSubtitleDividerOffset(block, cont) {
    if (!block || !cont) return;
    // Only update glue math when the user explicitly pinned to the seam
    if (block.dataset.dividerPinned !== '1') return;
    const dividerY = getDividerCenterY(cont);
    if (dividerY === null) return;
    const cR = cont.getBoundingClientRect();
    const bR = block.getBoundingClientRect();
    const blockCenterY = (bR.top + bR.height / 2) - cR.top;
    if (!Number.isFinite(blockCenterY)) return;
    block.dataset.dividerOffsetY = String(blockCenterY - dividerY);
}

function syncSplitscreenSubtitles(cont, dividerYOverride) {
    cont = cont || getSplitscreenPreviewContainer();
    if (!cont || !cont.querySelector('#splitscreenDivider')) return;
    const dividerY = Number.isFinite(dividerYOverride) ? dividerYOverride : getDividerCenterY(cont);
    if (dividerY === null || !Number.isFinite(dividerY)) return;
    const cH = cont.getBoundingClientRect().height;
    const rootDragging = !!cont.querySelector('#splitscreenRoot.is-dragging');
    cont.querySelectorAll('.sub-text-block').forEach(block => {
        // Don't fight an active resize / drag — that caused release position jumps
        if (block.classList.contains('is-resizing') || block.classList.contains('is-dragging')) {
            return;
        }
        // While the seam is dragged, keep captions UNDER the divider (z + hit target).
        if (rootDragging) {
            block.style.setProperty('z-index', '90', 'important');
        } else {
            const z = block.classList.contains('selected')
                || block.classList.contains('is-resizing')
                || block.classList.contains('is-dragging')
                ? '220'
                : '120';
            block.style.setProperty('z-index', z, 'important');
        }
        // AI hook sits on the splitscreen divider — re-pin when the seam moves
        if (block.dataset.aiHook === '1') {
            if (typeof window.placeAiHookInLayout === 'function') {
                try { window.placeAiHookInLayout(block, cont); } catch (_) { /* ignore */ }
            }
            return;
        }
        if (block.classList.contains('overlay-text-block')) return;

        // Only honor an explicit pin — never auto-glue nearby captions (jumpy)
        let pinned = block.dataset.dividerPinned === '1';
        const bH = block.offsetHeight || 0;
        const topNow = parseFloat(block.style.top);

        const yPct = Number(block.dataset.yPct);
        if (!pinned) {
            if (Number.isFinite(yPct)) {
                if (typeof window.placeCaptionAtYPct === 'function') {
                    try { window.placeCaptionAtYPct(block, cont, yPct); } catch (_) { /* ignore */ }
                } else {
                    const top = Math.round(yPct * cH - bH / 2);
                    block.style.top = `${Math.max(0, Math.min(Math.max(0, cH - bH), top))}px`;
                }
            } else if (Number.isFinite(topNow) && cH > 0) {
                const mid = (topNow + bH / 2) / cH;
                block.dataset.yPct = String(Math.max(0.02, Math.min(0.98, mid)).toFixed(3));
            }
            return;
        }
        if (block.dataset.dividerOffsetY == null || block.dataset.dividerOffsetY === '') {
            storeSubtitleDividerOffset(block, cont);
            if (block.dataset.dividerOffsetY == null || block.dataset.dividerOffsetY === '') {
                // Default: sit just above the seam
                block.dataset.dividerOffsetY = String(-(bH / 2 + 6));
            }
        }
        const offset = parseFloat(block.dataset.dividerOffsetY || '0');
        if (!Number.isFinite(offset)) return;
        const top = Math.max(0, Math.min(Math.max(0, cH - bH), Math.round(dividerY + offset - bH / 2)));
        block.style.top = `${top}px`;
        if (typeof window.lockSubtitleCenterX === 'function') {
            window.lockSubtitleCenterX(block);
        }
    });
    if (typeof window._repositionSubtitleMenu === 'function') {
        window._repositionSubtitleMenu();
    }
}

window.storeSubtitleDividerOffset = storeSubtitleDividerOffset;
window.syncSplitscreenSubtitles = syncSplitscreenSubtitles;

// Initialize draggable divider for split screen
function initializeSplitscreenDivider() {
    const { divider, dividerLine, root, top: topSection } = getSplitscreenLayout();

    if (!divider || !dividerLine || !root || !topSection) {
        safeLog('⚠ï¸ Missing splitscreen elements');
        return;
    }

    if (divider.dataset.splitscreenInit === 'true') return;
    divider.dataset.splitscreenInit = 'true';

    divider.addEventListener('mousedown', (e) => e.stopPropagation());
    divider.addEventListener('click', (e) => e.stopPropagation());

    root.addEventListener('click', (e) => {
        if (e.target.closest('#splitscreenDivider')) return;
        if (e.target.closest('#splitscreenCollapseHandle')) {
            if (splitscreenSecondaryCollapsed) expandSplitscreenSecondary();
            return;
        }
        if (e.target.closest('.sub-text-block')) return;
        if (e.target.closest('#ssModeDots')) return;
        if (e.target.closest('.gp-pill-menu') || e.target.closest('.gp-dropdown')) return;
        if (e.target.closest('#splitscreenReframeVideo') && e.detail > 0 && root.dataset._didPanelDrag === '1') {
            root.dataset._didPanelDrag = '0';
            return;
        }
        if (e.target.closest('.preview-audio-toggle')) return;

        const isTop = e.target.closest('#splitscreenTop');
        const isBottom = e.target.closest('#splitscreenBottom');
        if (isTop || isBottom || e.target.closest('.ss-content-placeholder')) {
            // Toggle: second click on the phone closes Modes / pill instead of reopening.
            if (gpPill?.classList.contains('active')) {
                hideGameplayPillMenu();
            } else {
                showSplitscreenCustomizer(e, 'fill');
            }
        }
    });

    const setDividerHover = (active) => {
        divider.classList.toggle('is-divider-hot', !!active);
        if (!dividerLine) return;
        dividerLine.style.width = '100%';
        dividerLine.style.maxWidth = 'none';
        dividerLine.style.borderRadius = '0';
        dividerLine.style.height = '';
        dividerLine.style.background = '';
        dividerLine.style.boxShadow = '';
        dividerLine.style.transform = 'none';
    };

    divider.addEventListener('mouseenter', () => setDividerHover(true));
    divider.addEventListener('mouseleave', () => setDividerHover(false));

    const startDividerDrag = (clientY) => {
        setDividerHover(true);
        root.classList.add('is-dragging');
        armPreviewModalDragGuard(1200);
        notifySubtitleLayoutEdit();

        // Re-pin any captions sitting on the seam before the first move
        const cont = getSplitscreenPreviewContainer();
        if (cont) {
            const dY = getDividerCenterY(cont);
            if (dY != null) {
                cont.querySelectorAll('.sub-text-block:not(.overlay-text-block)').forEach((block) => {
                    if (block.dataset.aiHook === '1') return;
                    const bH = block.offsetHeight || 0;
                    const top = parseFloat(block.style.top);
                    if (!Number.isFinite(top)) return;
                    const center = top + bH / 2;
                    if (block.dataset.dividerPinned === '1' || Math.abs(center - dY) < 100) {
                        block.dataset.dividerPinned = '1';
                        block.dataset.dividerOffsetY = String(center - dY);
                        delete block.dataset.yPct;
                    }
                });
            }
        }

        const rootRect = root.getBoundingClientRect();
        const dividerH = 1;
        let lastY = clientY;

        // Immediate first paint so the grip doesn't lag the pointer
        applySplitscreenDrag(lastY, rootRect, dividerH);
        // Force the pending RAF to flush now
        if (_splitscreenDragRaf) {
            cancelAnimationFrame(_splitscreenDragRaf);
            _splitscreenDragRaf = 0;
        }
        if (_splitscreenDragPending) {
            const p = _splitscreenDragPending;
            _splitscreenDragPending = null;
            const { contentH, secondaryH, avail } = calcSplitscreenHeights(p.clientY, p.rootRect, p.dividerH);
            splitscreenSecondaryCollapsed = false;
            setSplitscreenPanelHeights(contentH, secondaryH, avail);
            syncSplitscreenSubtitles(
                getSplitscreenPreviewContainer(),
                getDividerCenterYFromHeights(contentH, secondaryH),
            );
        }

        const onMove = (mv) => {
            lastY = mv.clientY;
            applySplitscreenDrag(lastY, rootRect, dividerH);
            armPreviewModalDragGuard(1200);
        };

        const onUp = () => {
            setDividerHover(false);
            finishSplitscreenDrag(lastY, rootRect, dividerH);
            armPreviewModalDragGuard(800);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onUp);
        };

        const onTouchMove = (e) => {
            e.preventDefault();
            if (e.touches[0]) onMove(e.touches[0]);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onUp);
    };

    // Captions sit on the divider — expose so subtitle pointerdown can hand off
    window.startSplitscreenDividerDrag = (clientY) => {
        if (splitscreenSecondaryCollapsed) {
            expandSplitscreenSecondary();
            return;
        }
        startDividerDrag(clientY);
    };

    divider.addEventListener('mousedown', (e) => {
        // Prefer caption / resize handle under the seam hit pad
        const prevPe = divider.style.pointerEvents;
        divider.style.pointerEvents = 'none';
        const under = document.elementFromPoint(e.clientX, e.clientY);
        divider.style.pointerEvents = prevPe;
        if (under?.closest?.('.sub-text-block, .sub-resize-handle, .overlay-text-block, .sub-pill-menu')) {
            return;
        }
        e.preventDefault();
        if (splitscreenSecondaryCollapsed) {
            expandSplitscreenSecondary();
            return;
        }
        startDividerDrag(e.clientY);
    });

    divider.addEventListener('touchstart', (e) => {
        const t = e.touches?.[0];
        if (t) {
            const prevPe = divider.style.pointerEvents;
            divider.style.pointerEvents = 'none';
            const under = document.elementFromPoint(t.clientX, t.clientY);
            divider.style.pointerEvents = prevPe;
            if (under?.closest?.('.sub-text-block, .sub-resize-handle, .overlay-text-block, .sub-pill-menu')) {
                return;
            }
        }
        e.preventDefault();
        if (splitscreenSecondaryCollapsed) {
            expandSplitscreenSecondary();
            return;
        }
        if (e.touches[0]) startDividerDrag(e.touches[0].clientY);
    }, { passive: false });

    // Hold near the seam and drag vertically to resize (clicks still open Modes)
    bindSeamHoldDrag(root, startDividerDrag);
}

/** Hold near divider, move vertically → resize. Short click still opens Modes. */
function bindSeamHoldDrag(root, startDividerDrag) {
    if (!root || root.dataset.seamHoldBound === '1') return;
    root.dataset.seamHoldBound = '1';
    const EDGE = 10;
    let pending = null;

    const clear = () => {
        if (!pending) return;
        window.removeEventListener('pointermove', pending.onMove, true);
        window.removeEventListener('pointerup', pending.onUp, true);
        window.removeEventListener('pointercancel', pending.onUp, true);
        pending = null;
    };

    root.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (splitscreenSecondaryCollapsed || _reframeImmersive) return;
        if (e.target.closest('#splitscreenDivider')) return; // native divider handlers
        if (e.target.closest('#ssModeDots') || e.target.closest('.sub-text-block') || e.target.closest('.sub-resize-handle') || e.target.closest('.sub-pill-menu') || e.target.closest('.overlay-text-block')) return;
        const secondary = _splitscreenQuery('splitscreenBottom');
        const content = _splitscreenQuery('splitscreenTop');
        if (!secondary || !content) return;
        const sR = secondary.getBoundingClientRect();
        const cR = content.getBoundingClientRect();
        const y = e.clientY;
        const nearSeam = splitscreenInverted
            ? (y >= sR.bottom - EDGE && y <= cR.top + EDGE)
            : (y >= cR.bottom - EDGE && y <= sR.top + EDGE);
        if (!nearSeam) return;

        const startY = e.clientY;
        const startX = e.clientX;
        const onMove = (mv) => {
            if (!pending) return;
            const dy = mv.clientY - startY;
            const dx = mv.clientX - startX;
            if (!pending.started) {
                if (Math.abs(dy) < 10) return;
                if (Math.abs(dx) > Math.abs(dy) * 1.1) {
                    clear();
                    return;
                }
                pending.started = true;
                root.dataset._didPanelDrag = '1';
                startDividerDrag(mv.clientY);
            }
        };
        const onUp = () => clear();
        pending = { onMove, onUp, started: false };
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onUp, true);
    }, true);
}

// One-shot retry for dynamically injected splitscreen (was a 10Hz forever poll)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initializeSplitscreenDivider();
    }, 500);
});

let _dividerInitTries = 0;
const dividerInitCheck = setInterval(() => {
    _dividerInitTries += 1;
    const divider = _splitscreenQuery('splitscreenDivider');
    if (divider && divider.dataset.splitscreenInit !== 'true') {
        initializeSplitscreenDivider();
    }
    if ((divider && divider.dataset.splitscreenInit === 'true') || _dividerInitTries > 20) {
        clearInterval(dividerInitCheck);
    }
}, 250);

function closeGameplayClipSelector() {
    // Just close the panel
}

function confirmGameplayClip() {
    // Gameplay clip updated
    closeGameplayClipSelector();
    showNotification(`Selected: ${availableGameplayClips.find(c => c.id === selectedGameplayClip)?.title}`, 'success');
}

function showNotification(message, type = 'info') {
    const duration = (typeof CONFIG !== 'undefined' && CONFIG.UI?.NOTIFICATION_DURATION_MS) || 4000;
    const exitMs = 320;

    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    // Replace any existing toast so timers don't fight (instant vanish + fade)
    container.querySelectorAll('.notification').forEach((el) => {
        if (el._hideTimer) clearTimeout(el._hideTimer);
        if (el._removeTimer) clearTimeout(el._removeTimer);
        el.remove();
    });

    const notification = document.createElement('div');
    const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    notification.className = `notification notification-${safeType} ${safeType}`;
    notification.setAttribute('role', 'status');

    const iconType = safeType === 'success' ? 'check' : safeType === 'error' ? 'exclamation' : safeType === 'warning' ? 'exclamation-triangle' : 'info';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${iconType}-circle notification-icon" aria-hidden="true"></i>
            <span class="notification-message"></span>
        </div>
    `;
    notification.querySelector('.notification-message').textContent = String(message || '');
    container.appendChild(notification);

    // Double rAF so the browser applies the base (hidden) styles before .show
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
    });

    const dismiss = () => {
        if (notification._leaving) return;
        notification._leaving = true;
        notification.classList.remove('show');
        notification.classList.add('is-leaving');
        notification._removeTimer = setTimeout(() => {
            notification.remove();
        }, exitMs);
    };

    notification._hideTimer = setTimeout(dismiss, duration);
    notification.addEventListener('click', dismiss);
}

window.showNotification = showNotification;
window.__solisShowNotification = showNotification;

// Handle Google OAuth callback
function handleGoogleCallback() {
    // ðŸ” SECURITY: Token is now set as httpOnly cookie by backend
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if we have auth error
    const error = urlParams.get('error');
    if (error) {
        safeLog('OAuth error:', error);
        showNotification('Authentication failed: ' + error, 'error');
        setTimeout(() => window.location.href = '/login.html', 2000);
        return;
    }
    
    // ðŸ” SECURITY: Extract JWT token from URL and save to sessionStorage for WebSocket authentication
    // Backend sends token in URL after successful OAuth: dashboard.html?token=jwt...
    const token = urlParams.get('token');
    if (token) {
        try {
            // Save token to sessionStorage for WebSocket authentication
            sessionStorage.setItem('auth_token', token);
            safeLog('✅ Auth token saved for WebSocket connection');
        } catch (e) {
            safeLog('⚠ï¸ Failed to save auth token to sessionStorage:', e.message);
        }
    }
    
    // Server has already set httpOnly cookie - verify it and get user info
    verifyToken().then(() => {
        // Dispatch user connected event for feature gatekeepers
        window.dispatchEvent(new CustomEvent('userConnected', { detail: { user: currentUser } }));
        
        // Clear URL params and go to dashboard
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.href = '/dashboard.html';
    }).catch(() => {
        safeLog('âŒ Authentication verification failed');
        showNotification('Authentication failed. Please try again.', 'error');
        setTimeout(() => window.location.href = '/login.html', 2000);
    });
}

function parseMarkdown(text) {
    // ðŸ” SECURITY: Sanitize input before markdown parsing to prevent HTML injection
    // Escape HTML special characters first, then apply markdown formatting
    const sanitized = sanitizeHTML(text);
    return sanitized
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// Initialize the application
function init() {
    // Initialize theme immediately before anything else
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    currentTheme = savedTheme;
    
    // Check if we're handling a Google callback
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        handleGoogleCallback();
        return;
    }
    
    initAuth();
    
    // Ensure profile button is updated after auth is initialized
    setTimeout(() => {
        if (typeof updateProfileButton === 'function') {
            updateProfileButton();
        }
    }, 100);

    // âŒ REMOVED: Never load chat history from localStorage
    // SECURITY: Chat history contains user prompts, URLs, and sensitive info
    // localStorage is accessible to any script on the domain (XSS vulnerability)
    // Solution: Store sensitive data server-side only, use httpOnly cookies for auth
    chatHistory = []; // Always initialize empty

    setupEventListeners();
    updateTokenDisplay();

    const savedSidebarState = localStorage.getItem('sidebarExpanded');
    if (savedSidebarState === 'true') {
        sidebar.classList.add('expanded');
    }
    
    // Ensure input container IS centered on page load (for first prompt)
    const inputSection = document.querySelector('.input-section');
    const inputContainer = inputSection ? inputSection.querySelector('.input-container') : null;
    if (inputContainer) {
        inputContainer.classList.add('first-prompt');
    }
    if (inputSection) {
        inputSection.classList.add('is-first-prompt');
    }
    
    // Initialize Clips Studio
    initClipsStudio();

    // Setup Plus Features Button Handler
    const plusFeaturesBtn = document.getElementById('plusFeaturesBtn');
    if (plusFeaturesBtn) {
        plusFeaturesBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const featuresTabContainer = document.getElementById('featuresTabContainer');
            if (featuresTabContainer) {
                featuresTabContainer.classList.toggle('active');
                this.classList.toggle('active');
            }
        });
    }

    // Close features tab when clicking outside
    document.addEventListener('click', function(e) {
        const featuresTabContainer = document.getElementById('featuresTabContainer');
        const plusFeaturesBtn = document.getElementById('plusFeaturesBtn');
        if (featuresTabContainer && !e.target.closest('#featuresTabContainer') && !e.target.closest('#plusFeaturesBtn')) {
            featuresTabContainer.classList.remove('active');
            if (plusFeaturesBtn) plusFeaturesBtn.classList.remove('active');
        }
    });

    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

}

// =====================================================
// CONFIGURATION AND HELPER FUNCTIONS (Security & Performance)
// =====================================================

// Global configuration for magic numbers and constants
const CONFIG = {
    PROCESSING: {
        MAX_TIME_MS: 6 * 60 * 60 * 1000, // 6 hours
        POLL_INTERVAL_MS: 3000, // 3 seconds
        COMPLETED_REMOVE_DELAY_MS: 5000, // 5 seconds
        CLEANUP_INTERVAL_MS: 60000 // 1 minute
    },
    UI: {
        NOTIFICATION_DURATION_MS: 4000,
        ANIMATION_DELAY_MS: 100,
        MODAL_TRANSITION_MS: 250,
        TYPING_INDICATOR_DELAY_MS: 1500
    },
    RATE_LIMITING: {
        YOUTUBE_PROCESS_MIN_MS: 2000, // 2 seconds minimum between requests
        POLLING_INTERVAL_MS: 5000 // 5 seconds for library polling
    },
    SECURITY: {
        MAX_CONSOLE_LOGS: 0 // Production: 0 (no logs), Development: -1 (all logs)
    }
};

// =====================================================
// STORAGE USAGE GUIDELINES (sessionStorage vs localStorage)
// =====================================================
// 
// sessionStorage: Cleared when tab closes
// - CSRF tokens (temporary, per-session)
// - Processing state (temporary work-in-progress)
// - Temporary UI state (not needed across sessions)
//
// localStorage: Persists indefinitely (until cleared)
// - Theme preferences (non-sensitive UI state)
// - Application configuration (non-sensitive)
// - ⚠ï¸ NEVER store: user tokens, auth data, PII, sensitive preferences
// 
// Note: Chat history is currently stored in localStorage but contains user prompts
// and URLs. Consider implementing a "Clear history" button or using sessionStorage.
//

// XSS Prevention: Sanitize HTML strings to prevent script injection
function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ðŸ” SECURITY: Validate and sanitize URLs to prevent javascript: and data: URIs
function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        // Block javascript: and data: URLs
        if (url.startsWith('javascript:') || url.startsWith('data:')) {
            safeLog('🔒 Blocked invalid URL scheme:', url.substring(0, 20));
            return false;
        }
        // Require https:// or http:// (or relative paths for development)
        const parsed = new URL(url, window.location.href);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (e) {
        safeLog('Invalid URL format:', url);
        return false;
    }
}

// Rate limiting: Debounce function
function debounce(func, delayMs) {
    let timeoutId;
    let lastCallTime = 0;
    
    return function debounced(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;
        
        clearTimeout(timeoutId);
        
        if (timeSinceLastCall >= delayMs) {
            lastCallTime = now;
            func.apply(this, args);
        } else {
            timeoutId = setTimeout(() => {
                lastCallTime = Date.now();
                func.apply(this, args);
            }, delayMs - timeSinceLastCall);
        }
    };
}

// Debug UI logs are silenced (see init.js). Prefer console.error for real failures.
function safeLog() { /* no-op */ }

// ðŸ” SECURITY: Fetch with timeout to prevent hanging requests
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
    }
}

// Clip Slot System class
class ClipSlotSystem {
    constructor() {
        this.slots = {
            1: null,
            2: null,
            3: null,
            4: null,
            5: null
        };
        this.totalClips = 0;
    }

    addClip(clipData) {
        // Count filled slots
        const filledSlots = Object.values(this.slots).filter(slot => slot !== null).length;
        
        if (filledSlots < 5) {
            // Fill from bottom (5) to top (1)
            const targetSlot = 5 - filledSlots;
            this.slots[targetSlot] = {
                ...clipData,
                slotNumber: targetSlot,
                addedAt: new Date().toISOString()
            };
        } else {
            // Shift all clips up
            for (let i = 1; i < 5; i++) {
                this.slots[i] = this.slots[i + 1];
                if (this.slots[i]) {
                    this.slots[i].slotNumber = i;
                }
            }
            // Add new clip to slot 5
            this.slots[5] = {
                ...clipData,
                slotNumber: 5,
                addedAt: new Date().toISOString()
            };
        }
        
        this.totalClips++;
        return this.slots;
    }

    getSlots() {
        return this.slots;
    }

    getSlot(slotNumber) {
        return this.slots[slotNumber];
    }

    clearSlot(slotNumber) {
        this.slots[slotNumber] = null;
        return this.slots;
    }

    getFilledSlots() {
        return Object.entries(this.slots)
            .filter(([_, value]) => value !== null)
            .map(([slotNum, data]) => ({ slotNum: parseInt(slotNum), data }));
    }
}

/** Session cache for library preview media — stops re-fetching the same clip. */
const LibraryPreviewMediaCache = (() => {
    const byProject = new Map(); // `${pid}|clean` -> { blob, objectUrl, srcKey, ts, size }
    const bySrc = new Map(); // normalized src -> same entry
    const MAX_ENTRIES = 6;
    const MAX_BYTES = 180 * 1024 * 1024;

    function normalizeSrc(src) {
        try {
            const u = new URL(src, window.location.origin);
            u.searchParams.delete('_');
            return u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '');
        } catch (_) {
            return String(src || '').replace(/([?&])_=\d+/g, '').replace(/[?&]$/, '');
        }
    }

    function projectKey(projectId, clean) {
        return `${projectId}|${clean ? '1' : '0'}`;
    }

    function touch(entry) {
        entry.ts = Date.now();
    }

    function totalBytes() {
        let n = 0;
        byProject.forEach((e) => { n += e.size || 0; });
        return n;
    }

    function evictIfNeeded(extra = 0) {
        while (
            (byProject.size >= MAX_ENTRIES || totalBytes() + extra > MAX_BYTES)
            && byProject.size > 0
        ) {
            let oldestKey = null;
            let oldestTs = Infinity;
            byProject.forEach((e, k) => {
                if (e.ts < oldestTs) {
                    oldestTs = e.ts;
                    oldestKey = k;
                }
            });
            if (!oldestKey) break;
            const entry = byProject.get(oldestKey);
            byProject.delete(oldestKey);
            if (entry?.srcKey) bySrc.delete(entry.srcKey);
            // Keep objectUrl alive briefly if still on a video; revoke after grace
            const url = entry?.objectUrl;
            if (url) {
                setTimeout(() => {
                    try {
                        const stillUsed = Array.from(document.querySelectorAll('video'))
                            .some((v) => (v.src || v.currentSrc) === url);
                        if (!stillUsed) URL.revokeObjectURL(url);
                    } catch (_) {
                        try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
                    }
                }, 8000);
            }
        }
    }

    function put(projectId, clean, blob, objectUrl, src) {
        if (!blob || !objectUrl) return null;
        const key = projectKey(projectId, clean);
        const srcKey = normalizeSrc(src || objectUrl);
        evictIfNeeded(blob.size || 0);
        const prev = byProject.get(key);
        if (prev?.objectUrl && prev.objectUrl !== objectUrl) {
            try { URL.revokeObjectURL(prev.objectUrl); } catch (_) { /* ignore */ }
            if (prev.srcKey) bySrc.delete(prev.srcKey);
        }
        const entry = {
            blob,
            objectUrl,
            srcKey,
            ts: Date.now(),
            size: blob.size || 0,
            projectId: String(projectId),
            clean: !!clean,
        };
        byProject.set(key, entry);
        bySrc.set(srcKey, entry);
        return entry;
    }

    function get(projectId, clean = false) {
        const entry = byProject.get(projectKey(projectId, clean));
        if (!entry) return null;
        touch(entry);
        return entry;
    }

    function getBySrc(src) {
        const entry = bySrc.get(normalizeSrc(src));
        if (!entry) return null;
        touch(entry);
        return entry;
    }

    function rememberSrc(src, blob, objectUrl) {
        if (!blob || !objectUrl) return null;
        const srcKey = normalizeSrc(src);
        const existing = bySrc.get(srcKey);
        if (existing) {
            touch(existing);
            return existing;
        }
        evictIfNeeded(blob.size || 0);
        const entry = {
            blob,
            objectUrl,
            srcKey,
            ts: Date.now(),
            size: blob.size || 0,
            projectId: null,
            clean: false,
        };
        bySrc.set(srcKey, entry);
        return entry;
    }

    function rememberProject(projectId, clean, blob, objectUrl, src) {
        return put(projectId, clean, blob, objectUrl, src);
    }

    function invalidateProject(projectId) {
        if (!projectId) return;
        for (const clean of [false, true]) {
            const key = projectKey(projectId, clean);
            const entry = byProject.get(key);
            if (!entry) continue;
            byProject.delete(key);
            if (entry.srcKey) bySrc.delete(entry.srcKey);
            const url = entry.objectUrl;
            if (url) {
                setTimeout(() => {
                    try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
                }, 2000);
            }
        }
    }

    return {
        get,
        getBySrc,
        rememberSrc,
        rememberProject,
        invalidateProject,
        normalizeSrc,
        has: (projectId, clean = false) => byProject.has(projectKey(projectId, clean)),
    };
})();
window.LibraryPreviewMediaCache = LibraryPreviewMediaCache;

// Enhanced Clips Studio with Slot System
class ClipsStudio {
    constructor() {
        this.currentTab = 'templates';
        this.processingItems = [];
        this.libraryItems = [];
        this.libraryCollections = [];
        this.openCollectionId = null;
        this._libraryNavStack = [null];
        this._libraryNavIndex = 0;
        this._dragClipId = null;
        this.librarySortMode = this._readLibrarySortMode();
        this.librarySelectMode = false;
        this._librarySelectedIds = new Set();
        this.initialized = false;
        this.currentProjectId = null;
        this.selectedTemplate = null;
        this._awaitingUrlForTemplate = false;
        this._autoOpenedPreview = false; // true | 'suggest' | false
        this._pasteAutoSubmitT = null;
        this._lastAutoSubmittedUrl = '';
        this._lastAutoSubmittedAt = 0;
        this.templates = {};
        this.isMonitoring = false;
        this.monitoringIntervals = new Map(); // Track monitoring intervals
        this.currentEditingProject = null;
        this.slotSystem = new ClipSlotSystem();
        this.currentSlotState = null;
        this.useSlotSystem = true; // Enable slot system by default
        this.subscriptionCache = null; // Cache for subscription info to reduce API calls
        this.libraryPollingInterval = null; // Auto-refresh polls library every 5 seconds
        this.lastYouTubeProcessTime = 0; // Rate limiting: prevent spam requests
        this.libraryPreviewModalOpen = false; // 🎬 Track if library preview modal is open to prevent status-pill disappearing
        this._libraryPreviewObjectUrl = null;
        this._libraryPreviewFetchController = null;
        this._libraryPreviewLoadGen = 0;
        this._libraryPreviewRetryTimer = null;
        this._libraryPreviewFailedId = null;
        this._libraryEditingEnabled = false;
        this._librarySplitscreenCustomize = false;
        this._librarySplitscreenDirty = false;
        this._libraryOverlayDirty = false;
        this._libraryEditHintShown = false;
        
        // ✅ PREVENT DUPLICATE EVENT HANDLERS (memory leak prevention)
        this._webSocketHandlersSetup = false;  // Flag: are WebSocket handlers already registered?
        this._webSocketRetryScheduled = false; // Flag: is a retry already scheduled?
        this._generationStartInFlight = false;
    }

    async init() {
        if (this.initialized) return;
        try {
            this.bindEvents();
            this.loadTemplates();
            await this.loadLibraryItems();
            await this.loadProcessingItems();
            this.initialized = true;
            
            // ✅ SECURITY FIX: Check for persistent rate limit state on page load
            // This prevents users from refreshing the page to bypass button lock
            this.enforceUrlButtonRateLimitOnLoad();
            
            // 🧹 AUTO-CLEAR: Smart clearing of URLs only if processing already happened
            // Keep URL if nothing has been processed yet
            this.clearUrlIfProcessingDone();

            // Landing hero paste → login/dashboard handoff
            this.consumeLandingPendingUrl();
            
            // Initialize WebSocket for real-time updates
            this.initializeWebSocket();
            
            // ⚡ SMART POLLING: Only start if there are processing items from previous session
            if (this.processingItems.length > 0) {
                this.startLibraryPolling();
            } else {
                safeLog('ðŸ“ No processing items from previous session - polling idle');
            }
            
            // Default Create on desktop; Templates on mobile (Create is a sheet)
            const existingTab = (() => {
                try {
                    return localStorage.getItem('clipsActiveTab')
                        || localStorage.getItem('clipsStudioCurrentTab')
                        || '';
                } catch (_) { return ''; }
            })();
            const landingPending = !(window.SolisFirstLanding && window.SolisFirstLanding.hasSeen
                && window.SolisFirstLanding.hasSeen());
            const mobile = typeof window !== 'undefined' && window.innerWidth <= 768;
            if (landingPending || !existingTab || existingTab === 'create') {
                if (mobile) {
                    this.switchTab('templates');
                    try {
                        localStorage.setItem('clipsStudioCurrentTab', 'templates');
                        localStorage.setItem('clipsActiveTab', 'templates');
                        localStorage.setItem('currentNavigationTarget', 'clips');
                    } catch (_) {}
                } else {
                    this.switchTab('create');
                    try {
                        localStorage.setItem('clipsStudioCurrentTab', 'create');
                        localStorage.setItem('clipsActiveTab', 'create');
                        localStorage.setItem('currentNavigationTarget', 'clips');
                    } catch (_) {}
                }
            } else {
                try {
                    this.switchTab(existingTab === 'create' && mobile ? 'templates' : existingTab);
                } catch (_) {
                    this.switchTab(mobile ? 'templates' : 'create');
                }
            }
            
            // Initialize slider position for active tab
            this.moveSlider();
            
            // Reposition slider on window resize
            window.addEventListener('resize', () => this.moveSlider());
            
            // Clips Studio initialized with Slot System
        } catch (error) {
            safeLog('Failed to initialize Clips Studio:', error);
        }
    }

    initializeWebSocket() {
        /**
         * Initialize WebSocket client for real-time video processing updates
         * This enables live progress tracking without page refreshes
         * ðŸ” SECURITY: Authentication via httpOnly cookies only
         */
        try {
            if (!window.SolisAIWebSocketClient) {
                safeLog('⚠ï¸ WebSocket client class not available');
                return;
            }

            // ðŸ” SECURITY FIX: Do NOT use localStorage for any user identification
            // Backend validates auth via httpOnly cookies on WebSocket upgrade
            // Do not pass any user ID or sensitive info in WebSocket message
            
            if (!currentUser) {
                safeLog('⚠ï¸ User not authenticated - WebSocket skipped');
                return;
            }

            // Initialize WebSocket - backend MUST validate connection via httpOnly auth cookie
            // Pass userId for server-side identification
            // The WebSocket server uses the same httpOnly cookie as regular API calls
            solisWSClient = new SolisAIWebSocketClient();
            solisWSClient.connect(currentUser.id); // Pass userId for identification
            safeLog('✅ WebSocket client initialized with userId:', currentUser.id);

            // Set up handlers after a brief delay to ensure connection
            setTimeout(() => {
                this.setupWebSocketHandlers();
            }, 500);
        } catch (error) {
            safeLog('âŒ Failed to initialize WebSocket:', error);
        }
    }

    updateRecentActivity() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        // Keep the welcome message
        const welcomeItem = activityList.querySelector('.activity-item');
        
        // Get recent clips (last 3)
        const recentClips = this.libraryItems
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 3);

        // Add clip activities
        recentClips.forEach(clip => {
            const timeAgo = this.getTimeAgo(clip.timestamp);
            const activityHTML = `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-video"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">Created a clip</div>
                        <div class="activity-description">${clip.name || 'Untitled Clip'}</div>
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            `;
            activityList.insertAdjacentHTML('beforeend', activityHTML);
        });
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const diffMs = now - new Date(timestamp);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '0 minutes ago';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return timestamp.toLocaleDateString();
    }

    async loadTemplates() {
        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/clips/templates`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify({}),
            });
            
            if (response.ok) {
                const data = await response.json();
                // Server returns allowed IDs only — catalog copy stays client-side
                const ids = Array.isArray(data.ids)
                    ? data.ids
                    : Object.keys(data.templates || data || {});
                const catalog = this.getTemplateCatalog();
                this.templates = {};
                ids.forEach((id) => {
                    if (catalog[id]) this.templates[id] = { ...catalog[id] };
                });
                safeLog('✅ Templates loaded:', Object.keys(this.templates));
            } else if (response.status === 401) {
                safeLog('Not authenticated for templates, using defaults');
                this.setDefaultTemplates();
            } else {
                safeLog('Failed to load templates, status:', response.status);
                this.setDefaultTemplates();
            }
        } catch (error) {
            safeLog('Failed to load templates:', error);
            this.setDefaultTemplates();
        }
    }

    getTemplateCatalog() {
        return {
            ranked_compilation: {
                name: 'Ranking Compilation',
                description: 'Top 5 moments ranked compilation',
                duration: '15-60s',
                type: 'ranking',
                supportsSlotSystem: true,
            },
            splitscreen: {
                name: 'Clip',
                description: 'Side-by-side video comparison',
                duration: '15-30s',
                type: 'splitscreen',
                supportsSlotSystem: true,
            },
        };
    }

    setDefaultTemplates() {
        this.templates = this.getTemplateCatalog();
    }

    bindEvents() {
        // Tab navigation - only bind once
        this.safeAddEventListener('.clips-tab', 'click', (e) => {
            this.switchTab(e.currentTarget.dataset.tab);
        });

        // Template selection - check access for PRO templates
        this.safeAddEventListener('.template-card', 'click', (e) => {
            const templateCard = e.currentTarget;
            const templateId = templateCard.dataset.template;
            
            // Check if it's a PRO template (splitscreen)
            if (templateId === 'splitscreen') {
                e.preventDefault();
                e.stopPropagation();
                this.checkTemplateAccess(templateId);
            } else {
                // Free templates can be accessed directly
                this.openTemplatePreviewModal(templateId, templateCard);
            }
        });
        
        // PRO feature modal buttons
        this.safeAddEventListenerById('closeProFeatureModal', 'click', () => {
            this.closeProFeatureModal();
        });

        // Template preview modal close button
        this.safeAddEventListenerById('closeTemplatePreviewBtn', 'click', () => {
            this.closeTemplatePreviewModal();
        });

        // Template sheet — drag up to expand (mobile)
        this._bindTemplateSheetDrag();
        
        // Template preview modal confirm button
        // mousedown preventDefault: while editing overlay text, the first click would
        // only blur the field and never fire click — Apply felt broken.
        this.safeAddEventListenerById('confirmUseTemplateBtn', 'mousedown', (e) => {
            e.preventDefault();
        });
        this.safeAddEventListenerById('confirmUseTemplateBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.currentTarget;
            if (btn?.disabled) return;
            this.confirmTemplateUse();
        });
        this.safeAddEventListenerById('confirmUseTemplateFab', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const main = document.getElementById('confirmUseTemplateBtn');
            if (!main || main.disabled) return;
            main.click();
        });
        // Enter → Use Template while preview modal is open
        if (!this._useTemplateEnterBound) {
            this._useTemplateEnterBound = true;
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
                if (e.isComposing || e.repeat) return;
                const modal = document.getElementById('templatePreviewModal');
                if (!modal?.classList.contains('active')) return;
                const t = e.target;
                if (t) {
                    const tag = (t.tagName || '').toUpperCase();
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                    if (t.isContentEditable || t.closest?.('[contenteditable="true"]')) return;
                }
                const btn = document.getElementById('confirmUseTemplateBtn');
                if (!btn || btn.disabled || btn.dataset.applying === '1') return;
                if (btn.getAttribute('data-pro-locked') === '1') return;
                e.preventDefault();
                e.stopPropagation();
                this.confirmTemplateUse();
            }, true);
        }
        bindClipIntentControls(this);
        const sharePreview = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const projectId = this.currentTemplateForPreview?.projectId
                || this._libraryPreviewProjectId
                || null;
            if (projectId) this.copyPublicPreviewLink(projectId);
            else showNotification('Share link unavailable for this clip', 'warning');
        };
        this.safeAddEventListenerById('libraryPreviewShareBtn', 'click', sharePreview);
        this.safeAddEventListenerById('libraryPreviewShareFab', 'click', sharePreview);
        this._bindUseTemplateFabSync();
        if (typeof window.bindUseTemplateFabIdleHint === 'function') {
            window.bindUseTemplateFabIdleHint();
        }
        
        // AI Prompt input with char count

        // URL processing — locked while generating (no cancel); Upgrade CTA when quota exhausted
        this.safeAddEventListenerById('processUrlBtn', 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.currentTarget || document.getElementById('processUrlBtn');
            if (btn?.classList.contains('is-upgrade-cta')) {
                this.openUrlSubmitUpgrade();
                return;
            }
            // Generating — ignore clicks (stop/cancel removed)
            if (btn?.classList.contains('is-generating') || btn?.disabled) {
                return;
            }
            this.processYouTubeUrl();
        });

        const youtubeInput = document.getElementById('youtubeUrlInput');
        if (youtubeInput) {
            youtubeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const btn = document.getElementById('processUrlBtn');
                    if (btn?.classList.contains('is-upgrade-cta')) {
                        this.openUrlSubmitUpgrade();
                        return;
                    }
                    this.processYouTubeUrl();
                }
            });

            // Eagerly warm up duration + limit cache while user is still looking at the URL
            let _eagerDebounce;
            const _eagerWarm = (url) => {
                if (url && this.isValidMediaUrl(url)) {
                    this._getCachedDurationCheck(url);
                    this._getCachedLimitCheck();
                    try { window.SolisInstantRecipe?.prefetch?.(url); } catch (_) {}
                }
            };
            // Paste into the URL field: auto-continue (no click). Don't select-all (blue).
            youtubeInput.addEventListener('paste', () => {
                setTimeout(() => {
                    try {
                        const len = youtubeInput.value.length;
                        youtubeInput.setSelectionRange(len, len);
                    } catch (_) { /* ignore */ }
                    _eagerWarm(youtubeInput.value.trim());
                    this.syncTemplateConfirmButton();
                    this._scheduleAutoSubmitFromPaste();
                }, 50);
            });
            // Typing: debounce so we don't hammer on every keystroke
            youtubeInput.addEventListener('input', () => {
                this.clearUrlSubmitUpgradeCta();
                clearTimeout(_eagerDebounce);
                const url = youtubeInput.value.trim();
                this.syncTemplateConfirmButton();
                if (url && this.isValidMediaUrl(url)) {
                    _eagerDebounce = setTimeout(() => _eagerWarm(url), 300);
                }
            });
        }

        // Ctrl/Cmd+V anywhere → fill URL field when clipboard is a media link
        this._bindGlobalUrlPaste();

        // Template confirmation
        this.safeAddEventListenerById('confirmTemplateBtn', 'click', () => {
            this.confirmTemplateSelection();
        });

        this.safeAddEventListenerById('cancelTemplateBtn', 'click', () => {
            this.cancelTemplateSelection();
        });

        // Generate clip
        this.safeAddEventListenerById('generateClipBtn', 'click', () => {
            this.generateClipWithSlotSystem();
        });

        // Library actions - manual refresh only
        this.safeAddEventListenerById('refreshProcessingBtn', 'click', () => {
            this.manualRefresh();
        });

        this.safeAddEventListenerById('libraryFilter', 'change', (e) => {
            this.filterLibrary(e.target.value);
        });

        this._initLibrarySortControls();
        this._initLibrarySelectMode();

        // Portal "Create Content" + clips header "New Clip" → Create URL submit
        const goCreate = () => this.goToCreateUrlSubmit();
        document.querySelectorAll('.quick-action-create, #newClipBtn').forEach((el) => {
            if (el.dataset.createBound === '1') return;
            el.dataset.createBound = '1';
            el.addEventListener('click', (e) => {
                e.preventDefault();
                goCreate();
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goCreate();
                }
            });
        });
        // Header New Clip — single binding (no inline onclick; avoid double-fire)
        const headerNew = document.getElementById('headerNewClipBtn');
        if (headerNew && headerNew.dataset.createBound !== '1') {
            headerNew.dataset.createBound = '1';
            headerNew.addEventListener('click', (e) => {
                e.preventDefault();
                goCreate();
            });
        }

        this.safeAddEventListenerById('createFirstClipBtn', 'click', () => {
            this.goToCreateUrlSubmit();
        });

        // Editor functionality

        this.safeAddEventListenerById('renderFinalBtn', 'click', () => {
            this.renderFinalVideo();
        });

        // Recent Activity View All button
        this.safeAddEventListenerById('viewAllActivityBtn', 'click', () => {
            this.switchTab('library');
        });

        // Stop monitoring when leaving clips tab
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAllMonitoring();
            }
        });
    }

    /**
     * Global paste: Ctrl/Cmd+V fills #youtubeUrlInput when clipboard holds a media URL,
     * without needing to click the field first. Skips other editable fields / modals.
     */
    _bindGlobalUrlPaste() {
        if (this._globalUrlPasteBound) return;
        this._globalUrlPasteBound = true;

        const isOtherEditable = (el) => {
            if (!el || el === document.body || el === document.documentElement) return false;
            const urlInput = document.getElementById('youtubeUrlInput');
            if (el === urlInput) return false;
            const tag = (el.tagName || '').toUpperCase();
            if (el.isContentEditable) return true;
            if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
            if (tag === 'INPUT') {
                const type = String(el.type || 'text').toLowerCase();
                return !['button', 'submit', 'checkbox', 'radio', 'file', 'hidden', 'reset', 'image'].includes(type);
            }
            return false;
        };

        const shouldSkipPasteSteal = () => {
            const modal = document.getElementById('templatePreviewModal');
            if (modal?.classList.contains('active')) return true;
            if (document.querySelector('.stgModal.open, .stgModal.active, .upgrade-modal.active')) return true;
            if (document.getElementById('customEditorContainer')?.classList.contains('active')) return true;
            return false;
        };

        const applyPastedUrl = (raw) => {
            const text = String(raw || '').trim();
            if (!text || !this.isValidMediaUrl(text)) return false;
            const urlInput = document.getElementById('youtubeUrlInput');
            if (!urlInput) return false;

            const createSection = document.getElementById('createSection');
            const onCreate = !!createSection?.classList.contains('active');
            if (!onCreate) {
                try { this.goToCreateUrlSubmit(); } catch (_) {
                    try { this.switchTab('create'); } catch (__) {}
                }
            }

            urlInput.value = text;
            try {
                urlInput.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (_) {}
            // Don't .select() — blue highlight looks like the field is "locked"
            try {
                urlInput.focus({ preventScroll: true });
                const len = urlInput.value.length;
                urlInput.setSelectionRange(len, len);
            } catch (_) { /* ignore */ }
            // Zero-click: paste → auto continue (same as clicking url-submit)
            this._scheduleAutoSubmitFromPaste();
            return true;
        };

        document.addEventListener('paste', (e) => {
            try {
                if (shouldSkipPasteSteal()) return;
                const urlInput = document.getElementById('youtubeUrlInput');
                if (document.activeElement === urlInput) return; // native paste
                if (isOtherEditable(document.activeElement)) return;
                const text = e.clipboardData?.getData('text/plain') || '';
                if (!applyPastedUrl(text)) return;
                e.preventDefault();
            } catch (_) { /* ignore */ }
        });
    }

    /** Portal Create Content / New Clip → Clips Create tab + URL submit focus */
    goToCreateUrlSubmit() {
        try {
            this._awaitingUrlForTemplate = false;
            const portal = document.getElementById('portalContainer');
            const clips = document.getElementById('clipsContainer');
            const dashboard = document.getElementById('dashboardContainer');
            const custom = document.getElementById('customEditorContainer');

            [portal, dashboard, custom].forEach((el) => {
                if (!el) return;
                el.style.display = 'none';
                el.classList.remove('active');
            });
            if (clips) {
                clips.style.display = 'block';
                clips.classList.add('active');
            }

            document.querySelectorAll('.nav-item[data-target]').forEach((item) => {
                const t = item.getAttribute('data-target') || '';
                item.classList.toggle('active', t === 'clips' || t.toLowerCase() === 'clips');
            });
            try { localStorage.setItem('currentNavigationTarget', 'clips'); } catch (_) {}

            const submenu = document.getElementById('clips-submenu');
            if (submenu) submenu.classList.add('open');
            const chevron = document.querySelector('#clips-toggle .chevron-icon');
            if (chevron) chevron.classList.add('rotated');

            if (!this.initialized) {
                try { this.init(); } catch (_) {}
            }
            this.switchTab('create');

            const focusUrl = () => {
                const target = document.getElementById('urlInputStack')
                    || document.querySelector('#createSection .url-input-container')
                    || document.getElementById('createSection');
                if (target?.scrollIntoView) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                // Do not focus/select the URL field or pulse the submit button —
                // wait for Ctrl+V or an explicit click + paste in the url wrapper.
            };
            requestAnimationFrame(() => setTimeout(focusUrl, 60));
        } catch (err) {
            safeLog('goToCreateUrlSubmit failed:', err);
            try { this.switchTab('create'); } catch (_) {}
        }
    }

    switchTab(tabName) {
        // Mobile: Create is a bottom sheet — never blank the page by showing #createSection
        if (tabName === 'create' && typeof window !== 'undefined' && window.innerWidth <= 768) {
            const hasContent = document.querySelector('#templatesSection.active, #librarySection.active');
            if (!hasContent) {
                document.querySelectorAll('.clips-section').forEach((section) => {
                    const on = section.id === 'templatesSection';
                    section.classList.toggle('active', on);
                    section.style.display = on ? 'block' : 'none';
                });
                document.querySelectorAll('.clips-tab, .clips-sub-item').forEach((el) => {
                    const t = el.getAttribute('data-tab');
                    el.classList.toggle('active', t === 'templates');
                });
                this.currentTab = 'templates';
                try {
                    localStorage.setItem('clipsStudioCurrentTab', 'templates');
                    localStorage.setItem('clipsActiveTab', 'templates');
                } catch (_) {}
            }
            window.openMobileCreateSheet?.();
            return;
        }

        // Plan popover is portaled to body — always dismiss when leaving Create
        if (tabName !== 'create' && typeof window.closePlanSelectorPopover === 'function') {
            window.closePlanSelectorPopover(true);
        }

        if (tabName !== 'create' && typeof window.closeMobileCreateSheet === 'function' && window.innerWidth <= 768) {
            window.closeMobileCreateSheet({ immediate: true });
        }

        // Stop monitoring if we're leaving processing tab
        if (this.currentTab === 'processing' && tabName !== 'processing') {
            this.stopAllMonitoring();
        }

        document.querySelectorAll('.clips-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Keep sidebar sub-nav in sync (separate from .clips-tab)
        document.querySelectorAll('.clips-sub-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.clips-section').forEach(section => {
            const isActive = section.id === `${tabName}Section`;
            section.classList.toggle('active', isActive);
            // Clear inline display styles to prevent conflicts with mobile system
            section.style.display = isActive ? 'block' : 'none';
        });
        this.currentTab = tabName;
        
        // Move slider to active tab
        this.moveSlider();

        // Sync both localStorage keys used by the two tab UIs
        try {
            localStorage.setItem('clipsStudioCurrentTab', tabName);
            localStorage.setItem('clipsActiveTab', tabName);
        } catch (_) {}

        // Move sub-nav indicator if present
        const subBtn = document.querySelector(`.clips-sub-item[data-tab="${tabName}"]`);
        const indicator = document.getElementById('clipsSubPane');
        const pill = document.querySelector('.clips-sub-pill');
        if (typeof window.updateMobileClipsPillIndicator === 'function' && window.innerWidth <= 768) {
            window.updateMobileClipsPillIndicator(tabName);
        } else if (subBtn && indicator && pill) {
            const pillStyle = window.getComputedStyle(pill);
            if (pillStyle.display !== 'contents') {
                const pillRect = pill.getBoundingClientRect();
                const buttonRect = subBtn.getBoundingClientRect();
                indicator.style.left = `${buttonRect.left - pillRect.left}px`;
                indicator.style.transform = '';
            }
        }

        // Only load data when tab becomes active
        if (tabName === 'processing') {
            document.getElementById('libraryLoadMoreFab')?.remove();
            this.updateProcessingView();
            // Start monitoring only for active processing items
            this.startSmartMonitoring();
        } else if (tabName === 'library') {
            const CACHE_MS = 5 * 60 * 1000;
            // Hydrate from secure session cache if memory is empty (no auth tokens stored)
            if ((!this.libraryItems || this.libraryItems.length === 0)
                && typeof this._hydrateLibraryFromSessionCache === 'function') {
                this._hydrateLibraryFromSessionCache();
            }
            this.updateLibraryView();
            const isFresh = this._libraryLastLoaded && (Date.now() - this._libraryLastLoaded) < CACHE_MS;
            const hasCollections = Array.isArray(this.libraryCollections) && this.libraryCollections.length > 0;
            const isEmpty = (!this.libraryItems || this.libraryItems.length === 0) && !hasCollections;
            // Soft refresh on tab open — never flash hard skeletons over a known library
            if ((!isFresh || isEmpty) && typeof this.loadLibraryItems === 'function') {
                this.loadLibraryItems({ soft: true }).catch(() => {});
            }
        } else if (tabName === 'templates') {
            document.getElementById('libraryLoadMoreFab')?.remove();
            // Initialize templates view if needed
            // Templates usually don't need special initialization
        } else if (tabName === 'create') {
            document.getElementById('libraryLoadMoreFab')?.remove();
            // Initialize create view if needed
            // Create tab content should be ready
        } else if (tabName === 'editor') {
            document.getElementById('libraryLoadMoreFab')?.remove();
            this.loadEditorData();
        } else {
            document.getElementById('libraryLoadMoreFab')?.remove();
        }
    }

    moveSlider() {
        const slider = document.querySelector('.clips-tab-slider');
        const activeTab = document.querySelector('.clips-tab.active');
        
        if (slider && activeTab) {
            slider.style.left = activeTab.offsetLeft + 'px';
            slider.style.width = activeTab.offsetWidth + 'px';
        }
    }

    selectTemplate(templateId, templateCard) {
        // Remove previous selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Add selection to current card
        templateCard.classList.add('selected');
        this.selectedTemplate = templateId;

        // Show confirmation buttons
        this.showConfirmationButtons(true);
        
        // Check if template supports slot system
        const template = this.templates[templateId];
        if (template && template.supportsSlotSystem) {
            this.showSlotSystemInfo();
        }
    }

    async checkTemplateAccess(templateId) {
        // ðŸ” This only controls UI/preview display - backend MUST also enforce plan.
        // Prefetch subscription into shared cache (no-op if already cached).
        try { await window._subCache.get(); } catch (_) {}
        const templateCard = document.querySelector(`[data-template="${templateId}"]`);
        this.openTemplatePreviewModal(templateId, templateCard);
    }

    showProFeatureModal(templateId, currentPlan) {
        // Remove any existing modal
        const existingOverlay = document.querySelector('.pro-modal-overlay');
        if (existingOverlay) existingOverlay.remove();

        // Add styles to document head (only once, use data attribute to check)
        if (!document.getElementById('pro-modal-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'pro-modal-styles';
            styleEl.textContent = `
@keyframes fadeInOverlay {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes popIn {
    0%   { transform: scale(0.7); opacity: 0; }
    70%  { transform: scale(1.05); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
}

/* ── Overlay ── */
.pro-modal-overlay {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.4) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 9999 !important;
    padding: 20px !important;
    opacity: 0;
    animation: fadeInOverlay 0.25s ease forwards;
}

/* ── Modal Shell ── */
.pro-modal {
    background: #fff;
    border-radius: 24px;
    width: 100%;
    max-width: 800px;
    display: flex;
    box-shadow:
        0 24px 64px rgba(0, 0, 0, 0.1),
        0 0 0 1px rgba(0, 0, 0, 0.06);
    opacity: 0;
    transform: translateY(16px) scale(0.98);
    animation: slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.08s forwards;
    overflow: hidden;
    min-height: 420px;
}

/* ── Left Panel ── */
.pro-panel-left {
    width: 52%;
    background: #fdf8f6;
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    border-right: 1px solid #efefef;
    overflow: hidden;
}

.pro-panel-left::before {
    content: '';
    position: absolute;
    bottom: -80px;
    left: -80px;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 107, 53, 0.12), transparent 70%);
    pointer-events: none;
}

.pro-panel-left::after {
    content: '';
    position: absolute;
    top: -60px;
    right: -60px;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 107, 53, 0.08), transparent 70%);
    pointer-events: none;
}

.pro-left-top {
    position: relative;
    z-index: 1;
}

/* ── Lock Icon ── */
.pro-lock-wrap {
    width: 52px;
    height: 52px;
    background: #fff;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    border: 1px solid rgba(0, 0, 0, 0.07);
    box-shadow: 0 2px 10px rgba(255, 107, 53, 0.1);
    opacity: 0;
    animation: popIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
}

/* ── Left Text ── */
.pro-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 26px;
    font-weight: 800;
    color: #111;
    line-height: 1.2;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
    opacity: 0;
    animation: fadeUp 0.3s ease 0.42s forwards;
}

.pro-subtitle {
    font-size: 13px;
    color: #666;
    line-height: 1.6;
    max-width: 260px;
    opacity: 0;
    animation: fadeUp 0.3s ease 0.5s forwards;
}

/* ── Template Preview Card ── */
.pro-template-preview {
    position: relative;
    z-index: 1;
    background: #fff;
    border: 1px solid #efefef;
    border-radius: 14px;
    overflow: hidden;
    opacity: 0;
    animation: fadeUp 0.3s ease 0.58s forwards;
}

.pro-tpb-preview {
    background: #f5f4f2;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.pro-tpb-pro {
    position: absolute;
    top: 8px;
    right: 8px;
    background: #ff6b35;
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.6px;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    font-family: 'Plus Jakarta Sans', sans-serif;
}

.pro-tpb-info {
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.pro-tpb-info strong {
    font-size: 12px;
    font-weight: 700;
    color: #111;
    font-family: 'Plus Jakarta Sans', sans-serif;
}

.pro-tpb-info span {
    font-size: 11px;
    color: #bbb;
}

.pro-locked-overlay {
    position: absolute;
    inset: 0;
    background: rgba(253, 248, 246, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ── Right Panel ── */
.pro-panel-right {
    width: 48%;
    padding: 40px 32px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    background: #fff;
}

/* ── Close Button ── */
.pro-close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid #efefef;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #bbb;
    transition: background 0.15s ease, color 0.15s ease;
    padding: 0;
}

.pro-close-btn:hover {
    background: #f5f5f5;
    color: #111;
}

/* ── Plans ── */
.pro-plans-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.9px;
    text-transform: uppercase;
    color: #bbb;
    margin-bottom: 10px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    opacity: 0;
    animation: fadeUp 0.3s ease 0.55s forwards;
}

.pro-plan-options {
    display: flex;
    flex-direction: column;
    gap: 7px;
    flex: 1;
    margin-bottom: 20px;
    opacity: 0;
    animation: fadeUp 0.3s ease 0.63s forwards;
}

.pro-plan-card {
    border: 1.5px solid #efefef;
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 11px;
    cursor: pointer;
    transition: border-color 0.18s ease, background 0.18s ease;
    background: #fff;
    position: relative;
}

.pro-plan-card:hover {
    border-color: rgba(255, 107, 53, 0.3);
    background: #fff9f7;
}

.pro-plan-card.highlighted {
    border-color: #ff6b35;
    background: #fff9f7;
}

.pro-plan-card-icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: #fff3ef;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255, 107, 53, 0.15);
    transition: background 0.18s ease;
}

.pro-plan-card.highlighted .pro-plan-card-icon {
    background: #ff6b35;
    border-color: #ff6b35;
}

.pro-plan-card-body {
    flex: 1;
}

.pro-plan-card-body strong {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: #111;
    margin-bottom: 1px;
    font-family: 'Plus Jakarta Sans', sans-serif;
}

.pro-plan-card-body span {
    font-size: 11px;
    color: #aaa;
}

.pro-plan-card-price {
    font-size: 13px;
    font-weight: 700;
    color: #666;
    white-space: nowrap;
    font-family: 'Plus Jakarta Sans', sans-serif;
}

.pro-plan-card.highlighted .pro-plan-card-price {
    color: #ff6b35;
}

.pro-popular-tag {
    position: absolute;
    top: -1px;
    right: 12px;
    background: #ff6b35;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 0 0 6px 6px;
    font-family: 'Plus Jakarta Sans', sans-serif;
}

/* ── Footer ── */
.pro-right-footer {
    opacity: 0;
    animation: fadeUp 0.3s ease 0.72s forwards;
}

.pro-cta-btn {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #ff7a50, #ff6b35);
    color: #fff;
    border: none;
    border-radius: 12px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: box-shadow 0.2s ease, background 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 10px;
    box-shadow: 0 3px 12px rgba(255, 107, 53, 0.35);
}

.pro-cta-btn:hover {
    background: linear-gradient(135deg, #ff6b35, #ff5722);
    box-shadow: 0 5px 18px rgba(255, 107, 53, 0.45);
}

.pro-cta-btn:active {
    transform: scale(0.98);
}

.pro-fine-print {
    text-align: center;
    font-size: 11px;
    color: #bbb;
}

.pro-fine-print a {
    color: #bbb;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
    transition: color 0.15s ease;
}

.pro-fine-print a:hover {
    color: #666;
}

/* ── Responsive ── */
@media (max-width: 768px) {
    .pro-modal {
        flex-direction: column;
        border-radius: 20px;
    }

    .pro-panel-left {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid #efefef;
        padding: 32px 28px;
    }

    .pro-panel-right {
        width: 100%;
        padding: 32px 28px;
    }
}
            `;
            document.head.appendChild(styleEl);
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'pro-modal-overlay';

        // Template info  
        const templateInfo = {
            'splitscreen': {
                title: 'This is a Pro template',
                subtitle: 'Clip is only available on paid plans. Upgrade to unlock it',
                templateName: 'Clip',
                templateDesc: 'Single Clip Clean layouts for any video.'
            }
        };

        const info = templateInfo[templateId] || templateInfo['splitscreen'];

        overlay.innerHTML = `
            <div class="pro-modal">
                <div class="pro-panel-left">
                    <div class="pro-left-top">
                        <div class="pro-lock-wrap">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6A3D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                        </div>
                        <h1 class="pro-title">${info.title}</h1>
                        <p class="pro-subtitle">${info.subtitle}</p>
                    </div>

                    <div class="pro-template-preview">
                        <div class="pro-tpb-preview">
                            <div class="pro-tpb-pro">PRO</div>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C8C4BE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="7" height="18" rx="1"/>
                                <rect x="14" y="3" width="7" height="18" rx="1"/>
                            </svg>
                            <div class="pro-locked-overlay">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6A3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </div>
                        </div>
                        <div class="pro-tpb-info">
                            <div>
                                <strong>${info.templateName}</strong>
                                <span style="display:block;margin-top:2px;font-size:11px;color:#AAA">${info.templateDesc}</span>
                            </div>
                            <span style="font-size:11px;color:#FF6A3D;font-weight:600;background:#FFF3EF;padding:3px 9px;border-radius:100px;border:1px solid #FFD0C2">PRO</span>
                        </div>
                    </div>
                </div>

                <div class="pro-panel-right">
                    <button class="pro-close-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>

                    <div>
                        <div class="pro-plans-label">Unlock with a plan</div>
                        <div class="pro-plan-options">
                            <div class="pro-plan-card">
                                <div class="pro-plan-card-icon">
                                   <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <linearGradient id="basicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" style="stop-color:#f1f5f9;stop-opacity:1"></stop>
                                            <stop offset="50%" style="stop-color:#cbd5e1;stop-opacity:1"></stop>
                                            <stop offset="100%" style="stop-color:#94a3b8;stop-opacity:1"></stop>
                                        </linearGradient>
                                    </defs>
                                    <circle cx="50" cy="50" r="16" fill="url(#basicGrad)"></circle>
                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#basicGrad)" stroke-width="10" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"></ellipse>
                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#basicGrad)" stroke-width="10" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"></ellipse>
                                </svg>
                                </div>
                                <div class="pro-plan-card-body">
                                    <strong>Basic</strong>
                                    <span>Any length · 5 uploads/day · up to 3 clips</span>
                                </div>
                                <div class="pro-plan-card-price">$9.99/mo</div>
                            </div>

                            <div class="pro-plan-card highlighted">
                                <div class="pro-popular-tag">Popular</div>
                                <div class="pro-plan-card-icon">
                                   <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <linearGradient id="primeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" style="stop-color:#fff176;stop-opacity:1"></stop>
                                            <stop offset="50%" style="stop-color:#ffd600;stop-opacity:1"></stop>
                                            <stop offset="100%" style="stop-color:#ff9100;stop-opacity:1"></stop>
                                        </linearGradient>
                                    </defs>
                                    <circle cx="50" cy="50" r="16" fill="url(#primeGrad)"></circle>
                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#primeGrad)" stroke-width="12" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"></ellipse>
                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#primeGrad)" stroke-width="12" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"></ellipse>
                                </svg>
                                </div>
                                <div class="pro-plan-card-body">
                                    <strong>Prime</strong>
                                    <span>Any length · 10/day · up to 5 clips</span>
                                </div>
                                <div class="pro-plan-card-price">$23.99/mo</div>
                            </div>

                            <div class="pro-plan-card">
                                <div class="pro-plan-card-icon">
                                <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <linearGradient id="eliteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" style="stop-color:#ff6b3d;stop-opacity:1" />
                                            <stop offset="50%" style="stop-color:#ff3d00;stop-opacity:1" />
                                            <stop offset="100%" style="stop-color:#c70000;stop-opacity:1" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx="50" cy="50" r="16" fill="url(#eliteGrad)"></circle>
                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#eliteGrad)" stroke-width="12" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"></ellipse>
                                    <ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#eliteGrad)" stroke-width="12" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"></ellipse>
                                </svg>
                                </div>
                                <div class="pro-plan-card-body">
                                    <strong>Elite</strong>
                                    <span>Any length · 20/day · up to 10 clips</span>
                                </div>
                                <div class="pro-plan-card-price">$39.99/mo</div>
                            </div>
                        </div>
                    </div>

                    <div class="pro-right-footer">
                        <button class="pro-cta-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                            </svg>
                            Unlock Clip
                        </button>
                        <p class="pro-fine-print"><a>Maybe later</a></p>
                    </div>
                </div>
            </div>
        `;

        // Close button handler
        overlay.querySelector('.pro-close-btn').addEventListener('click', () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.25s ease';
            setTimeout(() => overlay.remove(), CONFIG.UI.MODAL_TRANSITION_MS);
        });

        // Plan card selection
        overlay.querySelectorAll('.pro-plan-card').forEach(card => {
            card.addEventListener('click', () => {
                overlay.querySelectorAll('.pro-plan-card').forEach(c => c.classList.remove('highlighted'));
                card.classList.add('highlighted');
            });
        });

        // CTA button handler
        overlay.querySelector('.pro-cta-btn').addEventListener('click', () => {
            // Subscription modal removed
        });

        // Maybe later link handler
        overlay.querySelector('.pro-fine-print a').addEventListener('click', () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.25s ease';
            setTimeout(() => overlay.remove(), CONFIG.UI.MODAL_TRANSITION_MS);
        });

        // Overlay background click to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.25s ease';
                setTimeout(() => overlay.remove(), CONFIG.UI.MODAL_TRANSITION_MS);
            }
        });

        document.body.appendChild(overlay);
        safeLog('✅ Pro feature modal shown for:', templateId);
    }

    closeProFeatureModal() {
        const modal = document.getElementById('proFeatureModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    openTemplatePreviewModal(templateId, templateCard, opts = {}) {
        const fromAuto = opts && opts.fromAuto ? opts.fromAuto : false;
        if (!fromAuto) {
            this._noteManualTemplateSwitch(templateId);
        } else {
            this._autoOpenedPreview = fromAuto;
        }

        const modal = document.getElementById('templatePreviewModal');
        const loadingEl = document.getElementById('templatePreviewLoading');
        if (!modal) {
            return;
        }

        safeLog(`📋 Opening template preview for: ${templateId}`);
        this.toggleLibraryPreviewLayout(false);
        if (typeof window.syncMultiGenForTemplate === 'function') {
            window.syncMultiGenForTemplate(templateId);
        }
        // Generate-flow preview — never keep leftover library "Apply & Download" state
        this._libraryRankingEditable = false;
        this._libraryRankingDirty = false;
        this._librarySplitscreenDirty = false;
        this._libraryOverlayDirty = false;
        this._librarySplitscreenCustomize = false;
        this._libraryEditingEnabled = false;
        this._libraryDirtyArmed = false;
        const confirmBtnReset = document.getElementById('confirmUseTemplateBtn');
        if (confirmBtnReset) {
            confirmBtnReset.textContent = 'Use Template';
            confirmBtnReset.classList.remove('library-download-mode');
            confirmBtnReset.disabled = false;
            confirmBtnReset.style.pointerEvents = '';
            confirmBtnReset.style.opacity = '';
            delete confirmBtnReset.dataset.applying;
            confirmBtnReset.setAttribute('data-solis-keyhint', 'Use template|Enter');
            confirmBtnReset.setAttribute('aria-keyshortcuts', 'Enter');
        }
        if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
        if (typeof window.syncPreviewModifiersForTemplate === 'function') {
            window.syncPreviewModifiersForTemplate(templateId);
        }

        // 🎬 HIDE STATUS-PILL: When opening library card with template preview, hide the status pill
        if (templateCard) {
            const statusPill = templateCard.querySelector('.status-pill');
            if (statusPill) {
                statusPill.style.opacity = '0';
                statusPill.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    statusPill.style.display = 'none';
                }, 300);
                safeLog('✅ Status-pill hidden when opening template preview');
            }
        }

        // 🔄 CLEAR PREVIEW: Remove old preview content to prevent display of wrong template
        const previewEl = document.getElementById('templateVideoPreview');
        if (previewEl) {
            // Stop/reset stale media from prior preview mount(s)
            previewEl.querySelectorAll('video').forEach((vid) => {
                try {
                    vid.pause();
                    vid.removeAttribute('src');
                    vid.load();
                } catch (_) { /* ignore */ }
            });
            try {
                if (typeof window.clearPreviewCaptionOverlays === 'function') {
                    window.clearPreviewCaptionOverlays({ hooks: true, overlays: true, container: previewEl });
                }
            } catch (_) { /* ignore */ }
            previewEl.innerHTML = `<div class="preview-skel" aria-hidden="true"></div>`;
            previewEl.classList.remove('has-video', 'library-splitscreen-preview', 'library-ranking-edit');
        }

        if (loadingEl) {
            loadingEl.classList.add('hidden');
            loadingEl.style.display = 'none';
            loadingEl.style.visibility = 'hidden';
            loadingEl.style.opacity = '0';
            loadingEl.style.pointerEvents = 'none';
        }

        // Update the elements IMMEDIATELY before showing modal
        const nameEl = document.getElementById('previewTemplateName');
        const descEl = document.getElementById('previewTemplateDescription');
        const durationEl = document.getElementById('previewVideoDuration');
        const formatEl = document.getElementById('previewVideoFormat');
        
        safeLog('Elements found:', {
            nameEl: !!nameEl,
            descEl: !!descEl,
            durationEl: !!durationEl,
            formatEl: !!formatEl
        });

        // Set template name IMMEDIATELY
        if (nameEl) {
            const templateDisplayName = templateId
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            nameEl.textContent = templateDisplayName || 'Template';
            safeLog('✅ Template name set to:', templateDisplayName);
        } else {
            safeLog('⚠ï¸ nameEl not found');
        }

        // Get video URL from input 
        const youtubeUrl = document.getElementById('youtubeUrlInput')?.value.trim();
        
        // Set description and other fields
        if (youtubeUrl) {
            if (descEl) descEl.textContent = 'Loading video info...';
            if (durationEl) durationEl.textContent = '~60s';
            if (formatEl) formatEl.textContent = 'TikTok / Shorts';
        } else {
            if (descEl) descEl.textContent = 'Paste a YouTube URL to see video details';
            if (durationEl) durationEl.textContent = '~60s';
            if (formatEl) formatEl.textContent = 'TikTok / Shorts';
        }

        // Show modal IMMEDIATELY
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        document.body.classList.add('modal-open');
        safeLog('✅ Modal displayed');
        this.syncTemplateConfirmButton();
        if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
        if (typeof window.bindUseTemplateFabIdleHint === 'function') window.bindUseTemplateFabIdleHint();
        if (typeof window._bumpUseTemplateFabIdle === 'function') window._bumpUseTemplateFabIdle();
        const sheet = document.querySelector('.template-preview-sidebar');
        if (sheet) sheet.classList.remove('expanded');

        // ðŸ” CHECK PLAN: Unlock Use Template for everyone (splitscreen is free)
        const updateTemplatePreviewButtons = async () => {
            const confirmBtn = document.getElementById('confirmUseTemplateBtn');
            const proFooter = document.getElementById('templatePreviewProFooter');
            if (confirmBtn) {
                confirmBtn.style.display = '';
                confirmBtn.removeAttribute('data-pro-locked');
                confirmBtn.disabled = false;
            }
            if (proFooter) proFooter.style.display = 'none';
            this.syncTemplateConfirmButton();
            if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
        };
        updateTemplatePreviewButtons();

        // Setup watermark toggle based on current user plan
        setTimeout(() => {
            safeLog('📋 Setting up watermark toggle...');
            this.setupWatermarkToggle();
        }, 100);

        // Hide navigation elements on mobile/tablet
        const navWrapper = document.getElementById('navWrapper');
        const profileNotifWrapper = document.querySelector('.profile-notif-wrapper');
        if (navWrapper) {
            navWrapper.classList.add('disabled');
        }
        if (profileNotifWrapper) {
            profileNotifWrapper.classList.add('disabled');
        }

        // Reset sheet position on mobile
        const templateSheet = document.querySelector('.template-preview-sheet');
        if (templateSheet) {
            templateSheet.classList.remove('expanded');
        }

        // Paint modal first, then load preview — hide spinner as soon as preview HTML lands
        requestAnimationFrame(() => {
            const hideLoadingSpinner = () => {
                if (!loadingEl) return;
                loadingEl.classList.add('hidden');
                loadingEl.style.visibility = 'hidden';
                loadingEl.style.pointerEvents = 'none';
                setTimeout(() => {
                    if (loadingEl.classList.contains('hidden')) {
                        loadingEl.style.display = 'none';
                    }
                }, 180);
            };

            const template = this.templates[templateId] || {};
            
            // Get watermark toggle state
            const watermarkToggle = document.getElementById('watermarkToggle');
            const shouldShowWatermark = watermarkToggle ? watermarkToggle.checked : false;
            
            // Store selected template info (generate flow — not library)
            this.currentTemplateForPreview = {
                id: templateId,
                card: templateCard,
                data: template,
                addWatermark: shouldShowWatermark,
                videoQuality: 'auto',
                videoUrl: youtubeUrl,
                isLibraryPreview: false,
            };
            
            // Reset AI prompt
            const promptInput = document.getElementById('aiPromptInput');
            if (promptInput) {
                promptInput.value = '';
                document.getElementById('charCountDisplay').textContent = '0';
            }
            
            // Hide AI response
            const responseArea = document.getElementById('aiResponseArea');
            if (responseArea) {
                responseArea.style.display = 'none';
            }
            
            // Load video preview with template — spinner hides when HTML is painted
            Promise.resolve(this.loadVideoPreviewWithTemplate())
                .finally(() => {
                    hideLoadingSpinner();
                    if (typeof window.syncPreviewEditorPillLayout === 'function') {
                        window.syncPreviewEditorPillLayout({ delay: 40 });
                        window.syncPreviewEditorPillLayout({ delay: 340 });
                    }
                    if (window.SolisMemory && typeof window.SolisMemory.onTemplatePreviewOpen === 'function') {
                        window.SolisMemory.onTemplatePreviewOpen(templateId);
                    }
                });
            
            // Fetch video metadata if URL exists
            if (youtubeUrl) {
                const descEl2 = document.getElementById('previewTemplateDescription');
                const durationEl2 = document.getElementById('previewVideoDuration');
                const formatEl2 = document.getElementById('previewVideoFormat');
                this.fetchVideoMetadata(youtubeUrl, durationEl2, formatEl2, descEl2);
            }
        });
        
        // renderTemplatePreview already handles watermark control visibility
        // No need for setupWatermarkControls - it was using wrong element IDs
    }

    getWatermarkPlacement() {
        const t = this.currentTemplateForPreview || {};
        const id = String(
            t.id || t.type || t.templateId || this.selectedTemplate || ''
        ).toLowerCase();
        if (
            id === 'ranked_compilation'
            || id === 'ranking'
            || id.includes('rank')
        ) {
            return 'ranking';
        }
        return 'splitscreen';
    }

    buildSolisWatermarkHTML(variant = null) {
        const v = this.getWatermarkVariant(variant);
        const place = this.getWatermarkPlacement();
        const placeClass = place === 'ranking' ? 'is-ranking' : 'is-splitscreen';
        const apiOrigin = String(window.API_BASE_URL || '').replace(/\/api\/?$/, '');
        if (v === 'classic') {
            const asset = 'Watermark_v4.png';
            const localFallback = '/assets/solis-watermark-classic.png';
            const markSrc = apiOrigin
                ? `${apiOrigin}/assets/${asset}`
                : localFallback;
            return `
            <div class="solis-watermark ${placeClass}" data-variant="classic" data-place="${place}" role="button" tabindex="0" aria-label="Solis AI">
                <img class="solis-watermark-mark" src="${markSrc}" alt="" draggable="false"
                     onerror="this.onerror=null;this.src='${localFallback}';" />
            </div>
        `;
        }
        // Branded: white login atom + Fredoka SOLIS AI (AI softer)
        return `
            <div class="solis-watermark ${placeClass}" data-variant="branded" data-place="${place}" role="button" tabindex="0" aria-label="Solis AI">
                <div class="solis-watermark-icon" aria-hidden="true">
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="50" r="12" fill="#ffffff" stroke="none"/>
                        <ellipse rx="44" ry="18" cx="50" cy="50" stroke="#ffffff" stroke-width="6" transform="rotate(45 50 50)"/>
                        <ellipse rx="44" ry="18" cx="50" cy="50" stroke="#ffffff" stroke-width="6" transform="rotate(-45 50 50)"/>
                    </svg>
                </div>
                <div class="solis-watermark-label">SOLIS <span class="ai">AI</span></div>
            </div>
        `;
    }

    getWatermarkVariant(preferred = null) {
        if (preferred === 'classic' || preferred === 'branded') return preferred;
        try {
            const raw = String(localStorage.getItem('solisWatermarkVariant') || '').toLowerCase();
            if (raw === 'classic' || raw === 'old' || raw === 'legacy') return 'classic';
            if (raw === 'branded' || raw === 'made_with' || raw === 'new') return 'branded';
        } catch (_) {}
        return 'branded';
    }

    setWatermarkVariant(variant) {
        const v = variant === 'classic' ? 'classic' : 'branded';
        try { localStorage.setItem('solisWatermarkVariant', v); } catch (_) {}
        return v;
    }

    cycleWatermarkVariant() {
        const next = this.getWatermarkVariant() === 'classic' ? 'branded' : 'classic';
        this.setWatermarkVariant(next);
        this.refreshSolisWatermarkMarks();
        return next;
    }

    refreshSolisWatermarkMarks() {
        const preview = document.getElementById('templateVideoPreview');
        const roots = preview ? [preview] : Array.from(document.querySelectorAll('.preview-placeholder, #templateVideoPreview'));
        roots.forEach((container) => {
            if (!container) return;
            const existing = container.querySelector('.solis-watermark');
            if (!existing) {
                this.ensureSolisWatermark(container);
                return;
            }
            existing.outerHTML = this.buildSolisWatermarkHTML().trim();
            this.bindSolisWatermarkClicks(container);
        });
        this.updateWatermarkDisplay();
    }

    bindSolisWatermarkClicks(container) {
        const root = container || document.getElementById('templateVideoPreview');
        if (!root) return;
        root.querySelectorAll('.solis-watermark').forEach((mark) => {
            if (mark.dataset.wmBound === '1') return;
            mark.dataset.wmBound = '1';
            const cycle = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this.shouldShowSolisWatermark()) return;
                this.cycleWatermarkVariant();
            };
            mark.addEventListener('click', cycle);
            mark.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') cycle(e);
            });
        });
    }

    shouldShowSolisWatermark() {
        const watermarkToggle = document.getElementById('watermarkToggle');
        if (!watermarkToggle) return true;
        return Boolean(watermarkToggle.checked);
    }

    ensureSolisWatermark(container) {
        if (!container) return null;
        let mark = container.querySelector('.solis-watermark');
        const wantVariant = this.getWatermarkVariant();
        const wantPlace = this.getWatermarkPlacement();
        const needsRebuild = !mark
            || mark.getAttribute('data-variant') !== wantVariant
            || mark.getAttribute('data-place') !== wantPlace
            || (wantVariant === 'branded' && !mark.querySelector('.solis-watermark-icon'))
            || (wantVariant === 'classic' && !mark.querySelector('.solis-watermark-mark'));
        if (needsRebuild) {
            if (mark) mark.remove();
            container.insertAdjacentHTML('beforeend', this.buildSolisWatermarkHTML());
            mark = container.querySelector('.solis-watermark');
        }
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        this.bindSolisWatermarkClicks(container);
        this.updateWatermarkDisplay();
        return mark;
    }

    updateWatermarkDisplay() {
        const watermarkToggle = document.getElementById('watermarkToggle');
        if (!watermarkToggle) return;

        // Prefer the open preview — avoid scanning the whole dashboard DOM
        const preview = document.getElementById('templateVideoPreview');
        const allWatermarks = preview
            ? preview.querySelectorAll('.solis-watermark')
            : document.querySelectorAll('.solis-watermark');
        if (!allWatermarks.length) return;

        // checked = show Solis mark (tip-setting "Show Solis mark on exports")
        const shouldShow = this.shouldShowSolisWatermark();
        allWatermarks.forEach((watermark) => {
            // Class alone drives visibility (CSS .is-hidden) — skip inline display thrash
            watermark.classList.toggle('is-hidden', !shouldShow);
        });
    }

    setupWatermarkToggle() {
        const watermarkToggleLabel = document.getElementById('watermarkToggleLabel');
        const watermarkUpgradeBtn = document.getElementById('watermarkUpgradeBtn');
        const watermarkNotice = document.getElementById('watermarkNotice');
        const watermarkToggle = document.getElementById('watermarkToggle');
        
        if (!watermarkToggle) {
            safeLog('⚠ï¸ watermarkToggle element not found');
            return;
        }
        
        // Fallback: If currentUser not available yet, retry in a moment
        if (!window.currentUser) {
            safeLog('â³ currentUser not loaded yet, retrying watermark setup in 500ms...');
            setTimeout(() => this.setupWatermarkToggle(), 500);
            return;
        }

        // Resolve policy async (free = always watermarked + Upgrade CTA)
        this.resolveWatermarkPolicy().then((policy) => {
            this.applyWatermarkControls(policy);
        }).catch(() => {
            const isPremium = window.currentUser.plan && window.currentUser.plan !== 'free';
            this.applyWatermarkControls({
                showUpgrade: !isPremium,
                isPremium: !!isPremium,
                usedLifetime: 0,
            });
        });
    }

    async resolveWatermarkPolicy(forceRefresh = false) {
        const plan = String(window.currentUser?.plan || 'free').toLowerCase();
        const isPremium = plan === 'basic' || plan === 'prime' || plan === 'elite';
        if (isPremium) {
            return { showUpgrade: false, isPremium: true, usedLifetime: 0 };
        }
        try {
            if (forceRefresh) this._watermarkCheckCache = null;
            if (!this._watermarkCheckCache) {
                const response = await fetch(`${window.API_BASE_URL}/auth/watermark-check`, {
                    headers: getAuthHeaders(),
                    credentials: 'include',
                });
                if (response.ok) {
                    this._watermarkCheckCache = await response.json();
                }
            }
            const data = this._watermarkCheckCache || {};
            const usedLifetime = Number(data.used_lifetime || 0);
            const showUpgrade = data.show_upgrade != null ? !!data.show_upgrade : true;
            return { showUpgrade, isPremium: false, usedLifetime, data };
        } catch (e) {
            safeLog('🚨 watermark policy resolve failed:', e);
            // Safe default for free: watermark locked + upgrade CTA
            return { showUpgrade: true, isPremium: false, usedLifetime: 0 };
        }
    }

    applyWatermarkControls(policy) {
        const watermarkToggleLabel = document.getElementById('watermarkToggleLabel');
        const watermarkToggle = document.getElementById('watermarkToggle');
        if (!watermarkToggle) return;

        const isPremium = !!policy?.isPremium;
        const usedLifetime = Number(
            policy?.usedLifetime ?? policy?.data?.used_lifetime ?? 0
        );

        document.getElementById('watermarkNotice')?.remove();
        const watermarkUpgradeBtn = document.getElementById('watermarkUpgradeBtn');
        if (watermarkUpgradeBtn) {
            watermarkUpgradeBtn.hidden = true;
            watermarkUpgradeBtn.style.display = 'none';
        }
        this.closeWatermarkPlanPopover?.();

        safeLog(`Watermark UI — premium=${isPremium} usedLifetime=${usedLifetime}`);

        // Never disable the switch — free users keep it interactive; we snap back + popover
        watermarkToggle.disabled = false;
        if (isPremium) {
            const savedState = localStorage.getItem('watermarkEnabled');
            watermarkToggle.checked = savedState === 'true';
        } else {
            // Free: switch stays ON (watermark always required)
            watermarkToggle.checked = true;
            try { localStorage.setItem('watermarkEnabled', 'true'); } catch (_) {}
        }
        watermarkToggle.style.opacity = '';
        watermarkToggle.style.cursor = '';

        if (watermarkToggleLabel) {
            watermarkToggleLabel.style.visibility = 'visible';
            watermarkToggleLabel.style.display = 'inline-flex';
            watermarkToggleLabel.setAttribute('data-premium-only', !isPremium);
            watermarkToggleLabel.classList.toggle('is-locked-free', !isPremium);
            watermarkToggleLabel.classList.toggle('is-on', Boolean(watermarkToggle.checked));
            watermarkToggleLabel.setAttribute('aria-checked', watermarkToggle.checked ? 'true' : 'false');
        }

        if (this._watermarkChangeHandler) {
            watermarkToggle.removeEventListener('change', this._watermarkChangeHandler);
            this._watermarkChangeHandler = null;
        }
        if (this._watermarkFreeClickHandler && watermarkToggleLabel) {
            watermarkToggleLabel.removeEventListener('click', this._watermarkFreeClickHandler, true);
            watermarkToggleLabel.removeEventListener('pointerdown', this._watermarkFreeClickHandler, true);
            this._watermarkFreeClickHandler = null;
        }

        this._watermarkFreeLockedOn = !isPremium;

        this._watermarkChangeHandler = () => {
            const isChecked = watermarkToggle.checked;
            if (!isPremium) {
                // Free: any attempt to change → snap back and show ranks popover
                const lockOn = !!this._watermarkFreeLockedOn;
                watermarkToggle.checked = lockOn;
                watermarkToggleLabel?.classList.toggle('is-on', lockOn);
                watermarkToggleLabel?.setAttribute('aria-checked', lockOn ? 'true' : 'false');
                try {
                    localStorage.setItem('watermarkEnabled', lockOn ? 'true' : 'false');
                } catch (_) { /* ignore */ }
                this.updateWatermarkDisplay();
                this.openWatermarkPlanPopover();
                return;
            }
            localStorage.setItem('watermarkEnabled', isChecked ? 'true' : 'false');
            watermarkToggleLabel?.classList.toggle('is-on', isChecked);
            watermarkToggleLabel?.setAttribute('aria-checked', isChecked ? 'true' : 'false');
            this.updateWatermarkDisplay();
        };
        watermarkToggle.addEventListener('change', this._watermarkChangeHandler);

        // Returning free (toggle locked ON): keep looking on, but any press/drag
        // opens upgrade instead of fighting the native toggle flip.
        if (!isPremium && this._watermarkFreeLockedOn && watermarkToggleLabel) {
            this._watermarkFreeClickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                watermarkToggle.checked = true;
                watermarkToggleLabel.classList.add('is-on');
                watermarkToggleLabel.setAttribute('aria-checked', 'true');
                try {
                    localStorage.setItem('watermarkEnabled', 'true');
                } catch (_) { /* ignore */ }
                this.updateWatermarkDisplay();
                this.openWatermarkPlanPopover();
            };
            watermarkToggleLabel.addEventListener('pointerdown', this._watermarkFreeClickHandler, true);
            watermarkToggleLabel.addEventListener('click', this._watermarkFreeClickHandler, true);
        }

        this.bindWatermarkPlanPopoverOnce();
        this.updateWatermarkDisplay();
    }

    bindWatermarkPlanPopoverOnce() {
        if (this._wmPlanPopoverBound) return;
        this._wmPlanPopoverBound = true;
        const closeBtn = document.getElementById('watermarkPlanPopoverClose');
        const backdrop = document.getElementById('watermarkPlanPopoverBackdrop');
        closeBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeWatermarkPlanPopover();
        });
        backdrop?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeWatermarkPlanPopover();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeWatermarkPlanPopover();
        });

        const cards = document.getElementById('solisUpgradeCards');
        const setBilling = (mode) => {
            const launch = mode === 'launch';
            document.getElementById('solisUpgradeBillingLaunch')?.classList.toggle('is-active', launch);
            document.getElementById('solisUpgradeBillingFull')?.classList.toggle('is-active', !launch);
            document.getElementById('solisUpgradeBillingLaunch')?.setAttribute('aria-pressed', launch ? 'true' : 'false');
            document.getElementById('solisUpgradeBillingFull')?.setAttribute('aria-pressed', launch ? 'false' : 'true');
            if (cards) cards.dataset.billing = launch ? 'launch' : 'full';
            cards?.querySelectorAll('.solis-upgrade-card').forEach((card) => {
                const now = card.querySelector('.solis-upgrade-card-now');
                const was = card.querySelector('.solis-upgrade-card-was');
                const note = card.querySelector('.solis-upgrade-card-note');
                if (now) {
                    now.textContent = launch
                        ? (now.dataset.priceLaunch || now.textContent)
                        : (now.dataset.priceFull || now.textContent);
                }
                if (was) {
                    was.textContent = launch
                        ? (was.dataset.priceWasLaunch || was.textContent)
                        : (was.dataset.priceWasFull || was.textContent);
                }
                if (note) {
                    note.textContent = launch
                        ? (note.dataset.noteLaunch || note.textContent)
                        : (note.dataset.noteFull || note.textContent);
                }
            });
        };
        document.getElementById('solisUpgradeBillingLaunch')?.addEventListener('click', () => setBilling('launch'));
        document.getElementById('solisUpgradeBillingFull')?.addEventListener('click', () => setBilling('full'));
        document.getElementById('solisUpgradeStayFree')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeWatermarkPlanPopover();
        });
        this._setSolisUpgradeBilling = setBilling;
    }

    openWatermarkPlanPopover(opts = {}) {
        const pop = document.getElementById('watermarkPlanPopover');
        if (!pop) return;
        if (pop.parentElement !== document.body) {
            document.body.appendChild(pop);
        }

        // Don't let memory accept/reject float over the upgrade sheet
        try {
            document.getElementById('subMemActions')?.classList.remove('open');
            document.querySelectorAll('.sub-mem-actions.open').forEach((el) => {
                el.classList.remove('open');
                el.style.opacity = '0';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
            });
        } catch (_) { /* ignore */ }

        const reason = opts.reason === 'quota' ? 'quota' : 'watermark';
        const applyCopy = (el) => {
            if (!el) return;
            const key = reason === 'quota' ? 'copyQuota' : 'copyWatermark';
            const next = el.dataset?.[key];
            if (next) el.textContent = next;
        };
        applyCopy(document.getElementById('solisUpgradeEyebrow'));
        applyCopy(document.getElementById('solisUpgradeTitle'));
        applyCopy(document.getElementById('solisUpgradeSub'));
        pop.dataset.reason = reason;

        this._setSolisUpgradeBilling?.('launch');
        clearTimeout(this._wmPlanCloseTimer);
        pop.hidden = false;
        pop.setAttribute('aria-hidden', 'false');
        pop.classList.remove('is-closing');
        document.body.classList.add('solis-upgrade-modal-open');

        // Double rAF so the browser paints the idle state before animating in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                pop.classList.add('is-open');
            });
        });
        try {
            document.getElementById('watermarkPlanPopoverClose')?.focus?.({ preventScroll: true });
        } catch (_) { /* ignore */ }
    }

    closeWatermarkPlanPopover() {
        const pop = document.getElementById('watermarkPlanPopover');
        if (!pop || pop.hidden) return;
        pop.classList.remove('is-open');
        pop.classList.add('is-closing');
        pop.setAttribute('aria-hidden', 'true');
        clearTimeout(this._wmPlanCloseTimer);
        this._wmPlanCloseTimer = setTimeout(() => {
            pop.hidden = true;
            pop.classList.remove('is-closing');
            document.body.classList.remove('solis-upgrade-modal-open');
        }, 280);
    }

    loadVideoPreviewWithTemplate() {
        const previewEl = document.getElementById('templateVideoPreview');
        if (!previewEl) return;

        const templateId = this.currentTemplateForPreview?.id;
        safeLog(`📺 loadVideoPreviewWithTemplate - Loading templateId: ${templateId}`);
        
        if (!templateId) {
            safeLog('No template ID available');
            previewEl.innerHTML = `
                <div class="preview-video-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>No template selected</p>
                </div>
            `;
            return;
        }

        // Fetch server-side rendered template preview
        this.fetchTemplatePreview(previewEl, templateId);
    }
    async fetchTemplatePreview(container, templateId) {
        try {
            safeLog(`ðŸ” fetchTemplatePreview - templateId: ${templateId}`);
            
            // Get the template data we already have locally
            const template = this.templates[templateId];
            
            if (!template) {
                safeLog(`⚠ï¸ Template "${templateId}" not found in this.templates`, Object.keys(this.templates));
                // Create a default template object if not found
                // This happens when templates haven't been loaded yet
                const defaultTemplate = {
                    id: templateId,
                    name: templateId?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Template',
                    description: 'Video template preview',
                    type: templateId || 'default'
                };
                return await this.renderTemplatePreview(container, defaultTemplate);
            }

            safeLog(`✅ Found template in this.templates:`, { id: templateId, type: template.type });
            // Add the template ID to the template object
            template.id = templateId;
            return await this.renderTemplatePreview(container, template);
        } catch (error) {
            safeLog('Error in fetchTemplatePreview:', error);
            container.innerHTML = `
                <div class="preview-video-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading preview</p>
                </div>
            `;
        }
    }

    async renderTemplatePreview(container, template) {
        // ðŸ” SECURITY: Validate template.id to prevent path traversal/injection
        if (template?.id && (template.id.includes('..') || template.id.includes('/') || template.id.includes('\\') || template.id.includes(':'))) {
            console.error('SECURITY: Attempted path traversal in template.id:', template.id);
            showNotification('Invalid template', 'error');
            return;
        }
        // Escape template.id for use in logs/display
        const safeTemplateId = template?.id ? String(template.id).replace(/[<>"']/g, '') : 'unknown';
        safeLog('🎨 renderTemplatePreview called with container:', !!container, 'template:', safeTemplateId);
        const html = this.generateTemplatePreviewHTML(template);
        let controlHTML = '';

        // Paint preview shell immediately so the spinner can dismiss — watermark check is non-blocking
        const paintPreview = () => {
            window.RankingTextPill?.resetSession?.();
            window._deselectSubtitleEditor?.();
            try {
                if (typeof window.clearPreviewCaptionOverlays === 'function') {
                    window.clearPreviewCaptionOverlays({ hooks: true, overlays: true, container });
                }
            } catch (_) { /* ignore */ }
            const watermarkedHTML = `
            <div class="solis-preview-frame" style="position: relative; width: 100%; height: 100%; background: #3a3a3a;">
                ${html}
                ${this.buildSolisWatermarkHTML()}
                ${controlHTML}
            </div>
        `;
            container.innerHTML = watermarkedHTML;
            this.updateWatermarkDisplay();
        };
        paintPreview();
        
        // Watermark eligibility in background — don't block spinner dismiss
        (async () => {
        try {
            const policy = await this.resolveWatermarkPolicy();
            this.applyWatermarkControls(policy);
        } catch (error) {
            safeLog('🚨 Error checking watermark eligibility:', error);
        }
        })();
        
        safeLog('✅ Watermarked HTML set', 'Has watermark element:', !!container.querySelector('.solis-watermark'));
        
        // Apply tip-setting toggle state to the newly rendered mark
        setTimeout(() => {
            if (window.clipsStudio) {
                window.clipsStudio.updateWatermarkDisplay();
            }
        }, 0);
        
        // Trigger customizer setup after content is loaded (non-ranking only)
        safeLog('[Template Preview] Content loaded, triggering customizer...');
        if (template?.id !== 'ranked_compilation' && window.FloatingCustomizeBar && window.customizer) {
            // Give DOM time to settle
            setTimeout(() => {
                if (window.initializeFloatingCustomizer) {
                    window.initializeFloatingCustomizer(true); // true = reinitialize
                }
            }, 100);
        } else {
            // Ranking → keep legacy #pill hidden so RankingTextPill owns the UI
            const legacyPill = document.getElementById('pill');
            if (legacyPill) legacyPill.style.display = 'none';
        }

        // Subtitle toolbar under preview (captions / animations / modifiers)
        const toolbar = document.getElementById('previewEditorPill');
        if (toolbar) {
            toolbar.style.display = '';
            const textBtn = toolbar.querySelector('[data-tool="text"]');
            const animBtn = toolbar.querySelector('[data-tool="animations"]');
            // Add Text tool removed — keep hidden if a leftover node exists
            if (textBtn) textBtn.style.display = 'none';
            if (animBtn) animBtn.style.display = '';
            if (typeof window.activatePreviewToolbar === 'function') {
                if (animBtn) {
                    const visible = Array.from(toolbar.querySelectorAll('.tool-btn')).filter(
                        b => b.style.display !== 'none'
                    );
                    window.activatePreviewToolbar(animBtn, Math.max(0, visible.indexOf(animBtn)));
                }
            }
            // Remeasure after modal scale-in + lucide icons — first open was clipping the pill
            if (typeof window.syncPreviewEditorPillLayout === 'function') {
                window.syncPreviewEditorPillLayout({ delay: 320 });
            }
        }

        // Initialize ranking template editor if this is a ranking template
        if (template?.id === 'ranked_compilation' && window.initializeRankingTemplateEditor) {
            setTimeout(() => {
                window.initializeRankingTemplateEditor();
                const isLib = !!this.currentTemplateForPreview?.isLibraryPreview;
                const suggestOn = window.SolisMemory?.isSuggestEnabled?.() !== false;
                // Prefer last-generated styles (same source as "Apply last ranking style?")
                const defer = !isLib && suggestOn && (
                    (typeof window.SolisMemory?.rankingStylesReady === 'function'
                        && window.SolisMemory.rankingStylesReady('ranked_compilation'))
                    || (() => {
                        const mem = window.SolisMemory?.getTemplateMemory?.('ranked_compilation');
                        const want = mem?.lastGeneratedStyles || mem?.styles;
                        return !!(want && Object.keys(want).length);
                    })()
                );
                // Keep classic look so Solis Memory can offer the saved style (like captions)
                if (defer) {
                    window.__solisRankingDeferCustoms = true;
                    // Don't seed defaults while Memory is about to offer last style
                } else if (window.rankingCustomizer) {
                    window.__solisRankingDeferCustoms = false;
                    window.rankingCustomizer.applyCustomizations();
                    try { window.RankingTextPill?.seedDefaultSizes?.(); } catch (_) {}
                } else {
                    try { window.RankingTextPill?.seedDefaultSizes?.(); } catch (_) {}
                }
            }, 50);
        }

        if (template?.id === 'splitscreen') {
            setTimeout(() => {
                // Product default is Reframe — never leave Minecraft showing on clean demos
                try {
                    if (typeof selectSecondaryGameplay === 'function') {
                        selectSecondaryGameplay('face_track');
                    } else {
                        splitscreenSecondaryType = 'face_track';
                    }
                } catch (_) {
                    splitscreenSecondaryType = 'face_track';
                }
                initializeSplitscreenDivider();
                applySplitscreenPreview();
                // Clear stale hooks only — keep captions + Accept/Reject suggest chrome
                if (typeof window.clearPreviewCaptionOverlays === 'function') {
                    window.clearPreviewCaptionOverlays({
                        hooks: true,
                        overlays: true,
                        captions: false,
                        keepMemorySuggest: true,
                    });
                }
                syncSplitscreenSubtitles(container);
            }, 80);
        }

        // Captions ON by default + AI suggest immediately (no Presets menu yet).
        const isLibPreview = !!this.currentTemplateForPreview?.isLibraryPreview;
        if (!isLibPreview && (template?.id === 'splitscreen' || template?.id === 'ranked_compilation')) {
            const tid = template.id;
            const seedCaptionsAndSuggest = () => {
                try {
                    const cont = document.getElementById('templateVideoPreview');
                    if (!cont || cont.querySelector('.preview-skel')) return false;
                    const hasCap = !!cont.querySelector('.sub-text-block:not(.overlay-text-block)');
                    const memReady = tid === 'ranked_compilation'
                        && window.SolisMemory?.rankingStylesReady?.('ranked_compilation');
                    if (!hasCap && !memReady && typeof window.applySubtitleStyle === 'function') {
                        window.applySubtitleStyle({
                            anim: 'karaoke',
                            font: 'Montserrat',
                            color: '#ffffff',
                            highlight: '#FFFFFF',
                            shadow: 'outline',
                            enabled: true,
                            y_pct: tid === 'ranked_compilation' ? 0.82 : 0.78,
                        }, {
                            selectAfter: false,
                            playAnim: false,
                            markSuggest: true,
                            softClamp: true,
                        });
                    } else if (hasCap && typeof window.markSubtitleSuggest === 'function') {
                        const block = cont.querySelector('.sub-text-block:not(.overlay-text-block)');
                        if (block) window.markSubtitleSuggest(block);
                    }
                    // Always (re)offer Accept/Reject — splitscreen init used to wipe it
                    const forceTip = () => {
                        try {
                            if (typeof window.SolisMemory?.wasSuggestionRejected === 'function'
                                && window.SolisMemory.wasSuggestionRejected(tid)) {
                                return;
                            }
                            if (typeof window.SolisMemory?.offerFirstCaptionTip === 'function') {
                                // Re-paint only when chrome was wiped mid-open — never after dismiss
                                const actionsOpen = !!document.getElementById('subMemActions')?.classList.contains('open');
                                const softCap = !!document.querySelector(
                                    '#templateVideoPreview .sub-text-block.sub-suggest, #templateVideoPreview .sub-text-block.sub-mem-pick, .sub-mem-ghost'
                                );
                                if (!actionsOpen && !softCap && !window.__solisPendingSubMem) {
                                    if (window.SolisMemory._forceCaptionTipReshow) {
                                        window.SolisMemory._forceCaptionTipReshow();
                                    }
                                }
                                window.SolisMemory.offerFirstCaptionTip(tid, {
                                    retries: actionsOpen || softCap ? 0 : 3,
                                    gapMs: 160,
                                    force: !(actionsOpen || softCap),
                                });
                            } else if (typeof window.SolisMemory?.retrySuggest === 'function') {
                                window.SolisMemory.retrySuggest(tid);
                            }
                        } catch (_) { /* ignore */ }
                    };
                    forceTip();
                    setTimeout(forceTip, 220);
                    return true;
                } catch (_) {
                    return false;
                }
            };
            setTimeout(() => { if (!seedCaptionsAndSuggest()) setTimeout(seedCaptionsAndSuggest, 220); }, 90);
            setTimeout(seedCaptionsAndSuggest, 400);
        }
    }

    generateTemplatePreviewHTML(template) {
        // ðŸ” DEBUG: Log template info
        safeLog(`🎨 generateTemplatePreviewHTML - template.id: ${template?.id}, template.type: ${template?.type}`);
        
        const previewTemplates = {
            'ranked_compilation': () => `
                <style>
                    .ranking-preview-container * {
                        box-sizing: border-box;
                    }
                    .ranking-preview-container {
                        position: absolute;
                        inset: 0;
                        width: 100%;
                        height: 100%;
                        /* Title higher — less top pad */
                        padding: 14px 12px 16px;
                        border-radius: inherit;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        pointer-events: auto;
                        overflow: hidden;
                        background: transparent;
                    }


                    .ranking-preview-container::-webkit-scrollbar {
                        width: 4px;
                    }
                    .ranking-preview-container::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .ranking-preview-container::-webkit-scrollbar-thumb {
                        background: rgba(255,255,255,0.3);
                        border-radius: 2px;
                    }
                    .ranking-preview-container .text-stroke {
                        font-weight: 400;
                        /* Same as caption Outline (sub-color-line) */
                        text-shadow:
                            2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000,
                            1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
                        pointer-events: auto;
                    }
                    .ranking-preview-container .title {
                        font-size: clamp(0.95rem, 5.2vw, 1.35rem);
                        text-align: center;
                        line-height: 1.12;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                        margin-top: 0;
                        padding-top: 0;
                        color: white;
                        font-family: 'Luckiest Guy', cursive;
                        font-weight: 400;
                        pointer-events: auto;
                        width: fit-content;
                        max-width: calc(100% - 8px);
                        margin-left: auto;
                        margin-right: auto;
                        overflow: visible;
                    }
                    .ranking-preview-container .funniest {
                        color: #ff0000;
                        pointer-events: auto;
                    }
                    .ranking-preview-container .ranking-list {
                        list-style: none; 
                        padding: 0;
                        margin: 6px 0 0 0;
                        text-align: left;
                        width: fit-content;
                        max-width: 100%;
                        align-self: flex-start;
                        pointer-events: auto;
                        flex: 0 0 auto;
                        flex-shrink: 0;
                        overflow: visible;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    .ranking-preview-container .ranked-item {
                        font-size: clamp(0.72rem, 3.8vw, 0.98rem);
                        margin-bottom: 0;
                        font-family: 'Luckiest Guy', cursive;
                        line-height: 1.2;
                        display: flex;
                        align-items: baseline;
                        justify-content: flex-start;
                        font-weight: 400;
                        pointer-events: auto;
                        flex: 0 0 auto;
                        flex-shrink: 0;
                        overflow: visible;
                        gap: 6px;
                        width: fit-content;
                        min-height: 1.2em;
                    }
                    .ranking-preview-container .ranked-item .rank-number {
                        display: inline-block;
                        pointer-events: auto;
                        flex-shrink: 0;
                        margin-right: 0.15em;
                        padding: 0;
                        width: max-content;
                        letter-spacing: 0;
                        line-height: 1.05;
                    }
                    .ranking-preview-container .rank-1 { color: #ffd700; pointer-events: auto; }
                    .ranking-preview-container .rank-2 { color: #c0c0c0; pointer-events: auto; }
                    .ranking-preview-container .rank-3 { color: #cd7f32; pointer-events: auto; }
                    .ranking-preview-container .rank-4 { color: #ffffff; pointer-events: auto; }
                    .ranking-preview-container .rank-5 { color: #ffffff; pointer-events: auto; }
                    .ranking-editor-zone-header {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: flex-start;
                        width: 100%;
                        max-width: 100%;
                        margin: 0 auto;
                        text-align: center;
                        overflow: visible;
                        padding: 0 4px 4px;
                        flex: 0 0 auto;
                        flex-shrink: 0;
                        position: relative;
                        z-index: 6;
                        box-sizing: border-box;
                    }
                    .ranking-preview-container .title .text-stroke,
                    .ranking-preview-container h2.text-stroke {
                        -webkit-text-stroke: 0;
                        paint-order: stroke fill;
                    }
                    .ranking-editor-zone-ranks {
                        width: fit-content;
                        max-width: 100%;
                        align-self: flex-start;
                    }
                    .ranking-preview-container [data-template-element-id] {
                        transition: none;
                    }
                    /* CHANNEL MOMENTS — one line directly under RANKING BEST */
                    .ranking-preview-container [data-template-element-id="title_channel"] {
                        font-size: clamp(0.88rem, 4.8vw, 1.15rem);
                        line-height: 1.1;
                        margin: 2px auto 8px auto !important;
                        max-width: calc(100% - 24px);
                        display: block !important;
                        width: fit-content;
                        text-align: center;
                        white-space: nowrap;
                        overflow-wrap: normal;
                        word-break: normal;
                        box-sizing: border-box;
                        position: relative;
                        z-index: 7;
                        float: none;
                        transform: none;
                    }
                    .ranking-preview-container h1.title {
                        display: block;
                        white-space: nowrap;
                        max-width: 100%;
                        width: fit-content;
                        margin: 0 auto 2px auto;
                        text-align: center;
                        position: relative;
                        z-index: 7;
                    }
                    .ranking-preview-container [data-template-element-id="title_ranking"],
                    .ranking-preview-container [data-template-element-id="title_funniest"] {
                        display: inline-block;
                        line-height: inherit;
                        vertical-align: baseline;
                        white-space: nowrap;
                    }
                    .ranking-preview-container .rank-title:empty::before {
                        content: attr(data-placeholder);
                        opacity: 0.42;
                        font-style: italic;
                    }
                    .ranking-preview-container .rank-title {
                        min-width: 2.5rem;
                        cursor: var(--solis-preview-cursor-text);
                        text-transform: uppercase;
                    }
                </style>
                <div class="ranking-preview-container">
                    <div class="ranking-editor-zone ranking-editor-zone-header">
                    <h1 class="title">
                        <span data-template-element-id="title_ranking" class="text-stroke" style="color: white; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">RANKING</span> <span data-template-element-id="title_funniest" class="funniest text-stroke" style="color: #ff0000; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">BEST</span>
                    </h1>
                    <h2 data-template-element-id="title_channel" style="text-align: center; margin: 2px auto 12px auto; color: white !important; background: transparent !important; font-family: 'Luckiest Guy', cursive; font-weight: 400; max-width: calc(100% - 24px); pointer-events: auto; display: block; position: relative;" class="text-stroke">CHANNEL MOMENTS</h2>
                    </div>
                    <ul class="ranking-list ranking-editor-zone ranking-editor-zone-ranks">
                        <li class="ranked-item rank-1">
                            <span data-template-element-id="rank_1_number" class="rank-number text-stroke" style="color: #ffd700; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">1.</span>
                            <span data-template-element-id="rank_1_title" class="rank-title text-stroke" style="color: #ffd700; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>
                        </li>
                        <li class="ranked-item rank-2">
                            <span data-template-element-id="rank_2_number" class="rank-number text-stroke" style="color: #c0c0c0; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">2.</span>
                            <span data-template-element-id="rank_2_title" class="rank-title text-stroke" style="color: #c0c0c0; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>
                        </li>
                        <li class="ranked-item rank-3">
                            <span data-template-element-id="rank_3_number" class="rank-number text-stroke" style="color: #cd7f32; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">3.</span>
                            <span data-template-element-id="rank_3_title" class="rank-title text-stroke" style="color: #cd7f32; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>
                        </li>
                        <li class="ranked-item rank-4">
                            <span data-template-element-id="rank_4_number" class="rank-number text-stroke" style="color: #ffffff; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">4.</span>
                            <span data-template-element-id="rank_4_title" class="rank-title text-stroke" style="color: #ffffff; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>
                        </li>
                        <li class="ranked-item rank-5">
                            <span data-template-element-id="rank_5_number" class="rank-number text-stroke" style="color: #ffffff; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;">5.</span>
                            <span data-template-element-id="rank_5_title" class="rank-title text-stroke" style="color: #ffffff; font-family: 'Luckiest Guy', cursive; font-weight: 400; font-size: inherit; pointer-events: auto;"></span>
                        </li>
                    </ul>
                </div>
            `,
            'splitscreen': () => `
                <div id="splitscreenRoot" style="display:flex;flex-direction:column;height:100%;width:100%;background:transparent;overflow:hidden;border-radius:inherit;user-select:none;">
                    <!-- TOP: Content slot — transparent so shared preview grey shows (same as ranking) -->
                    <div id="splitscreenTop" style="flex:0 0 50%;width:100%;min-height:0;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
                        <div class="ss-content-placeholder" style="text-align:center;position:relative;z-index:2;">
                            <div style="font-size:11px;color:#ff6a3d;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:5px;">
                                <span style="width:5px;height:5px;background:#ff6a3d;border-radius:50%;animation:splitscreen-pulse 2s infinite;display:inline-block;"></span>
                                Your Content
                            </div>
                            <div style="font-size:12px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.5px;">Video Preview</div>
                        </div>
                    </div>

                    <!-- DIVIDER — 1px seam; hit target expands via CSS ::before (no fat gap) -->
                    <div id="splitscreenDivider" style="flex:0 0 1px;width:100%;height:1px;min-height:1px;max-height:1px;cursor:var(--solis-preview-cursor-hand);display:flex;align-items:center;justify-content:center;position:relative;z-index:50;background:transparent;flex-shrink:0;overflow:visible;padding:0;margin:0;">
                        <div id="dividerLine" class="ss-divider-grip" style="position:absolute;left:0;right:0;top:50%;width:100%;height:1px;background:rgba(148,163,184,0.85);border-radius:0;box-shadow:none;pointer-events:none;transform:translateY(-50%);"></div>
                    </div>

                    <!-- BOTTOM: Secondary panel (gameplay / face) — default type is face_track via JS -->
                    <div id="splitscreenBottom" style="flex:1 1 0;width:100%;min-height:0;background:transparent;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;"
                         data-no-text-select="true">
                        <video style="width:100%;height:100%;object-fit:cover;display:none;pointer-events:none;" autoplay muted loop playsinline preload="auto" disablePictureInPicture controlslist="nodownload nofullscreen noremoteplayback" id="splitscreenGameplayVideo"></video>
                    </div>
                </div>
            `
        };
        
        // Use template ID to find the correct preview renderer
        // First try template.id directly, then fallback to template.type
        let generator = previewTemplates[template.id];
        if (!generator) {
            generator = previewTemplates[template.type];
            safeLog(`⚠ï¸ Template.id '${template.id}' not found, using template.type '${template.type}'`);
        }
        if (!generator) {
            safeLog(`âŒ CRITICAL: Neither template.id '${template.id}' nor template.type '${template.type}' found in previewTemplates`);
            safeLog('Available template keys:', Object.keys(previewTemplates));
            // Show error instead of defaulting to ranked_compilation
            generator = () => `
                <div class="preview-video-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Template preview not available: ${template.id || template.type}</p>
                </div>
            `;
        }
        return `<style>@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } }</style>${generator()}`;
    }

    async loadYouTubeSubtitles(videoId) {
        try {
            const statusEl = document.getElementById('youtubeSubtitleStatus');
            if (statusEl) {
                statusEl.textContent = 'Loading...';
            }

            // Fetch subtitles from backend
            const response = await fetch('/api/youtube/subtitles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ video_id: videoId })
            });

            let subtitles = [];
            if (response.ok) {
                const data = await response.json();
                subtitles = data.subtitles || [];
            }

            if (statusEl) {
                statusEl.textContent = subtitles.length > 0 ? 'Ready' : 'No subs';
            }

            // Initialize caption system with fetched subtitles
            if (typeof captionSystem !== 'undefined') {
                captionSystem.initializeCaptions(subtitles);
                captionSystem.playAnimation();
            }
        } catch (error) {
            safeLog('Error loading YouTube subtitles:', error);
            const statusEl = document.getElementById('youtubeSubtitleStatus');
            if (statusEl) {
                statusEl.textContent = 'Error';
            }
        }
    }

    extractYouTubeVideoId(url) {
        const regexPatterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^?&]+)/
        ];

        for (const regex of regexPatterns) {
            const match = url.match(regex);
            if (match && match[1]) {
                const videoId = match[1];
                // ðŸ” SECURITY: Validate extracted video ID format
                // YouTube video IDs are exactly 11 characters: [a-zA-Z0-9_-]
                if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
                    return videoId;
                }
            }
        }
        return null;
    }

    isYouTubeShort(url) {
        return /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\//.test(url);
    }

    isShortFormUrl(url) {
        return /youtube\.com\/shorts\//i.test(url);
    }

    getMediaUrlError(urlString) {
        const platform = this.detectMediaPlatform(urlString);
        if (platform === 'tiktok' || platform === 'instagram') {
            return 'TikTok and Instagram are coming soon. Paste a YouTube or YouTube Shorts link for now.';
        }
        return 'Enter a valid YouTube or YouTube Shorts URL';
    }

    detectMediaPlatform(url) {
        const u = (url || '').toLowerCase();
        if (/(?:vm|vt)\.tiktok\.com|tiktok\.com/.test(u)) return 'tiktok';
        if (/youtube\.com\/shorts\//.test(u)) return 'youtube_shorts';
        if (/instagram\.com\/reels?\//.test(u) || /instagram\.com\/p\//.test(u)) return 'instagram';
        if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
        return 'unknown';
    }

    isValidMediaUrl(urlString) {
        try {
            const url = new URL(urlString.startsWith('http') ? urlString : 'https://' + urlString);
            const hostname = url.hostname.toLowerCase();
            const pathname = url.pathname.toLowerCase();

            const allowedDomains = new Set([
                'youtube.com', 'www.youtube.com', 'm.youtube.com',
                'youtu.be', 'www.youtu.be',
            ]);
            if (!allowedDomains.has(hostname)) {
                return false;
            }

            if (pathname.includes('..') || pathname.includes('//')) {
                return false;
            }

            const platform = this.detectMediaPlatform(urlString);
            if (platform === 'tiktok' || platform === 'instagram') {
                return false;
            }
            if (platform === 'youtube') {
                const videoId = this.extractYouTubeVideoId(urlString);
                return !!(videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId));
            }
            if (platform === 'youtube_shorts') {
                return /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i.test(urlString);
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    async canUseShortFormUpload() {
        try {
            const sub = await window._subCache.get();
            const plan = (sub?.plan || 'free').toLowerCase();
            return plan === 'prime' || plan === 'elite';
        } catch {
            return false;
        }
    }

    showShortFormUploadModal() {
        const existing = document.querySelector('.shortform-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'pro-modal-overlay shortform-modal-overlay';
        overlay.innerHTML = `
            <div class="pro-modal">
                <div class="pro-panel-left">
                    <div class="pro-left-top">
                        <div class="pro-lock-wrap">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6A3D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                        </div>
                        <h1 class="pro-title">Short-form upload is Prime+</h1>
                        <p class="pro-subtitle">YouTube Shorts, TikToks, and Reels are only available on Prime and Elite. Upgrade to unlock short-form content.</p>
                    </div>
                    <div class="pro-template-preview">
                        <div class="pro-tpb-preview">
                            <div class="pro-tpb-pro">PRIME+</div>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C8C4BE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="23 7 16 12 23 17 23 7"/>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                            </svg>
                            <div class="pro-locked-overlay">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6A3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </div>
                        </div>
                        <div class="pro-tpb-info">
                            <div>
                                <strong>Short-form Upload</strong>
                                <span style="display:block;margin-top:2px;font-size:11px;color:#AAA">YT Shorts · TikTok · Reels</span>
                            </div>
                            <span style="font-size:11px;color:#FF6A3D;font-weight:600;background:#FFF3EF;padding:3px 9px;border-radius:100px;border:1px solid #FFD0C2">PRIME+</span>
                        </div>
                    </div>
                </div>
                <div class="pro-panel-right">
                    <button class="pro-close-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                    <div>
                        <div class="pro-plans-label">Unlock with a plan</div>
                        <div class="pro-plan-options">
                            <div class="pro-plan-card" style="opacity:0.45;pointer-events:none;">
                                <div class="pro-plan-card-icon">
                                    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sfBasicGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f1f5f9"/><stop offset="100%" style="stop-color:#94a3b8"/></linearGradient></defs><circle cx="50" cy="50" r="16" fill="url(#sfBasicGrad)"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfBasicGrad)" stroke-width="10" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfBasicGrad)" stroke-width="10" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"/></svg>
                                </div>
                                <div class="pro-plan-card-body"><strong>Basic</strong><span>Long-form YouTube only</span></div>
                                <div class="pro-plan-card-price">$9.99/mo</div>
                            </div>
                            <div class="pro-plan-card highlighted">
                                <div class="pro-popular-tag">Unlock Short-form</div>
                                <div class="pro-plan-card-icon">
                                    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sfPrimeGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#fff176"/><stop offset="50%" style="stop-color:#ffd600"/><stop offset="100%" style="stop-color:#ff9100"/></linearGradient></defs><circle cx="50" cy="50" r="16" fill="url(#sfPrimeGrad)"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfPrimeGrad)" stroke-width="12" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfPrimeGrad)" stroke-width="12" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"/></svg>
                                </div>
                                <div class="pro-plan-card-body"><strong>Prime</strong><span>YT Shorts · TikTok · Reels</span></div>
                                <div class="pro-plan-card-price">$23.99/mo</div>
                            </div>
                            <div class="pro-plan-card">
                                <div class="pro-plan-card-icon">
                                    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sfEliteGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#ff6b3d"/><stop offset="50%" style="stop-color:#ff3d00"/><stop offset="100%" style="stop-color:#c70000"/></linearGradient></defs><circle cx="50" cy="50" r="16" fill="url(#sfEliteGrad)"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfEliteGrad)" stroke-width="12" fill="none" transform="rotate(45 50 50)" stroke-linecap="round"/><ellipse rx="42" ry="18" cx="50" cy="50" stroke="url(#sfEliteGrad)" stroke-width="12" fill="none" transform="rotate(-45 50 50)" stroke-linecap="round"/></svg>
                                </div>
                                <div class="pro-plan-card-body"><strong>Elite</strong><span>Everything + Priority queue</span></div>
                                <div class="pro-plan-card-price">$39.99/mo</div>
                            </div>
                        </div>
                    </div>
                    <div class="pro-right-footer">
                        <button class="pro-cta-btn shortform-upgrade-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                            </svg>
                            Unlock Short-form Upload
                        </button>
                        <p class="pro-fine-print"><a class="shortform-maybe-later">Maybe later</a></p>
                    </div>
                </div>
            </div>
        `;

        const close = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.25s ease';
            setTimeout(() => overlay.remove(), 250);
        };

        overlay.querySelector('.pro-close-btn').addEventListener('click', close);
        overlay.querySelector('.shortform-maybe-later').addEventListener('click', close);
        overlay.querySelector('.shortform-upgrade-btn').addEventListener('click', () => {
            window.location.href = '/premium.html?plan=prime';
        });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        document.body.appendChild(overlay);
    }

    async fetchVideoMetadata(videoUrl, durationEl, formatEl, descEl) {
        try {
            // Extract video ID from URL
            const videoId = this.extractYouTubeVideoId(videoUrl);
            if (!videoId) {
                if (descEl) descEl.textContent = 'Invalid YouTube URL';
                return;
            }

            const apiBase = window.API_BASE_URL || 'https://api.solisai.video/api';
            
            // Try to fetch video metadata from backend
            try {
                const response = await fetch(`${apiBase}/youtube/get-metadata/${videoId}`, {
                    signal: AbortSignal.timeout(3000) // 3 second timeout
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Update description with video title
                    if (descEl && data.title) {
                        descEl.textContent = data.title;
                    }
                    
                    // Update duration
                    if (durationEl && data.duration) {
                        let durationText = data.duration;
                        if (typeof data.duration === 'number') {
                            durationText = `~${Math.floor(data.duration / 60)}m ${data.duration % 60}s`;
                        }
                        durationEl.textContent = durationText;
                    }
                    
                    // Update format
                    if (formatEl) {
                        const format = this.isYouTubeShort(videoUrl) ? 'YouTube Shorts' : 'TikTok / Shorts';
                        formatEl.textContent = format;
                    }
                    return;
                }
            } catch (fetchError) {
                safeLog('Backend metadata fetch failed, using fallback:', fetchError.message);
            }
            
            // FALLBACK: If backend endpoint doesn't exist, just show basic info
            if (descEl) descEl.textContent = `YouTube Video (ID: ${videoId.substring(0, 8)}...)`;
            if (formatEl) formatEl.textContent = this.isYouTubeShort(videoUrl) ? 'YouTube Shorts' : 'TikTok / Shorts';
            if (durationEl) durationEl.textContent = '~60s';
            
        } catch (error) {
            safeLog('Error in fetchVideoMetadata:', error);
            // Keep default/loading values
            if (descEl) descEl.textContent = 'Unable to fetch video info';
        }
    }

    closeTemplatePreviewModal() {
        // Snapshot styles BEFORE wiping the phone — reopen suggests them until refresh
        try {
            const tid = this.currentTemplateForPreview?.id
                || this.selectedTemplate
                || null;
            if (tid && window.SolisMemory?.snapshotSessionDraft) {
                window.SolisMemory.snapshotSessionDraft(tid);
            }
        } catch (_) { /* ignore */ }

        // Auto-opened preview dismissed → soften next open, then stop if dismissed again
        try { this._noteAutoPreviewClosed(); } catch (_) { /* ignore */ }

        // Flush ranking styles BEFORE wiping the phone DOM — otherwise generate
        // only gets layout and burn falls back to Luckiest Guy.
        try {
            const isRanking = this.currentTemplateForPreview?.id === 'ranked_compilation'
                || this.selectedTemplate === 'ranked_compilation'
                || !!document.querySelector('#templateVideoPreview .ranking-preview-container');
            if (isRanking && window.rankingCustomizer) {
                try {
                    if (typeof window.rankingCustomizer.flushRankingStylesForGenerate === 'function') {
                        window.rankingCustomizer.flushRankingStylesForGenerate();
                    } else {
                        document.querySelectorAll('#templateVideoPreview .rk-inline-editing').forEach((el) => {
                            try { el.blur(); } catch (_) { /* ignore */ }
                        });
                        window.rankingCustomizer.persistAllPreviewStyles?.();
                        const snap = window.rankingCustomizer.captureGenerateLock?.();
                        if (snap && Object.keys(snap).length) {
                            window.__solisPendingGenerateRankingCustoms = snap;
                            window.__solisRankingStyleLock = snap;
                        }
                    }
                } catch (_) { /* ignore */ }
            }
        } catch (_) { /* ignore */ }

        // Clear immersive reframe before tearing down DOM
        if (typeof resetReframeImmersiveState === 'function') {
            resetReframeImmersiveState();
        }

        const modal = document.getElementById('templatePreviewModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            modal.style.visibility = 'hidden';
            modal.style.opacity = '0';
            document.body.classList.remove('modal-open');
        }
        
        // 🔄 CLEAN UP: Clear preview content when closing modal
        const previewEl = document.getElementById('templateVideoPreview');
        if (previewEl) {
            previewEl.querySelectorAll('video').forEach((vid) => {
                try {
                    vid.pause();
                    vid.removeAttribute('src');
                    vid.load();
                } catch (_) { /* ignore */ }
            });
            try {
                if (typeof window.clearPreviewCaptionOverlays === 'function') {
                    window.clearPreviewCaptionOverlays({
                        hooks: true,
                        overlays: true,
                        captions: true,
                        container: previewEl,
                        keepMemorySuggest: true,
                        keepCaptionOptIn: true,
                    });
                }
            } catch (_) { /* ignore */ }
            previewEl.innerHTML = '';
        }
        if (this._libraryPreviewObjectUrl) {
            const cached = window.LibraryPreviewMediaCache?.getBySrc?.(this._libraryPreviewObjectUrl)
                || (this._libraryPreviewProjectId
                    && window.LibraryPreviewMediaCache?.get?.(this._libraryPreviewProjectId, false));
            if (!cached || cached.objectUrl !== this._libraryPreviewObjectUrl) {
                try { URL.revokeObjectURL(this._libraryPreviewObjectUrl); } catch (_) { /* ignore */ }
            }
            this._libraryPreviewObjectUrl = null;
        }
        if (this._libraryPreviewFetchController) {
            this._libraryPreviewFetchController.abort();
            this._libraryPreviewFetchController = null;
        }
        if (this._libraryPreviewRetryTimer) {
            clearTimeout(this._libraryPreviewRetryTimer);
            this._libraryPreviewRetryTimer = null;
        }
        this._libraryPreviewLoadGen += 1;
        this._libraryPreviewFailedId = null;
        this._hideLibraryPreviewLoading();
        const modalContent = document.querySelector('.template-preview-content');
        if (modalContent) modalContent.classList.remove('is-library-preview');
        if (typeof PreviewTimeline !== 'undefined') {
            PreviewTimeline.detach();
        }
        teardownLibrarySplitscreenCropObserver();
        setSplitscreenScope(null);
        
        // Collapse sheet on mobile
        const templateSheet = document.querySelector('.template-preview-sidebar');
        if (templateSheet) {
            templateSheet.classList.remove('expanded');
        }
        
        // Restore navigation elements on mobile/tablet
        const navWrapper = document.getElementById('navWrapper');
        const profileNotifWrapper = document.querySelector('.profile-notif-wrapper');
        if (navWrapper) {
            navWrapper.classList.remove('disabled');
        }
        if (profileNotifWrapper) {
            profileNotifWrapper.classList.remove('disabled');
        }
        
        // 🔧 RESTORE BUTTON TEXT FROM LIBRARY PREVIEW MODE
        const confirmBtn = document.getElementById('confirmUseTemplateBtn');
        if (confirmBtn) {
            confirmBtn.textContent = 'Use Template';
            confirmBtn.classList.remove('library-download-mode');
            confirmBtn.disabled = false;
            confirmBtn.style.pointerEvents = '';
            confirmBtn.style.opacity = '';
        }
        if (typeof window.resetClipIntentMode === 'function') {
            window.resetClipIntentMode();
        }
        const intentToggle = document.getElementById('clipIntentToggleBtn');
        if (intentToggle) intentToggle.style.display = '';

        // 🎨 TOGGLE LAYOUT: Restore template layout
        this.toggleLibraryPreviewLayout(false);
        
        // 🔒 RE-ENABLE LIBRARY UPDATES: Clear flag to allow library updates now that modal is closed
        this.libraryPreviewModalOpen = false;
        try { window.SolisSilencer?.reset?.(); } catch (_) { /* ignore */ }
        try { window.SolisImproveClip?.reset?.(); } catch (_) { /* ignore */ }
        try { window.SolisSilencer?.syncVisibility?.(); } catch (_) { /* ignore */ }
        this._libraryRankingOverlayPending = null;
        this._libraryRankingUseCleanVideo = false;
        if (this._customizeExpiryTimer) {
            clearInterval(this._customizeExpiryTimer);
            this._customizeExpiryTimer = null;
        }
        const expiryPill = document.getElementById('libraryCustomizeExpiryPill');
        if (expiryPill) {
            expiryPill.hidden = true;
            expiryPill.textContent = '';
        }
        if (this._libraryRefreshPending) {
            this._libraryRefreshPending = false;
            this._libraryLastLoaded = 0;
            this.loadLibraryItems({ soft: true, force: true }).catch(() => {
                this.updateLibraryView();
            });
        }
        
        this.currentTemplateForPreview = null;
        if (window.SolisMemory && typeof window.SolisMemory.onTemplatePreviewClose === 'function') {
            window.SolisMemory.onTemplatePreviewClose();
        }
        try {
            if (typeof window.clearSubtitleMemorySuggest === 'function') {
                window.clearSubtitleMemorySuggest();
            }
            if (window.RankingTextPill?.clearSuggest) window.RankingTextPill.clearSuggest();
            if (window.RankingTextPill?.hide) window.RankingTextPill.hide();
            if (window.RankingTextPill?.deselectAll) window.RankingTextPill.deselectAll();
            document.querySelectorAll('.rk-ghost-stack,.sub-mem-ghost,.solis-memory-suggest').forEach((n) => {
                if (n.id === 'solisMemorySuggest') {
                    n.hidden = true;
                    n.style.visibility = 'hidden';
                    n.style.opacity = '0';
                    n.style.pointerEvents = 'none';
                } else {
                    n.remove();
                }
            });
            const rkActs = document.getElementById('rkSuggestActions');
            if (rkActs) {
                rkActs.classList.remove('open');
                rkActs.style.visibility = 'hidden';
                rkActs.style.opacity = '0';
                rkActs.style.pointerEvents = 'none';
            }
            const subActs = document.getElementById('subMemActions');
            if (subActs) {
                subActs.classList.remove('open');
                subActs.style.visibility = 'hidden';
                subActs.style.opacity = '0';
                subActs.style.pointerEvents = 'none';
            }
        } catch (_) { /* ignore */ }
    }

    getLibraryPreviewVideoUrl(projectId, { bust = false, clean = false } = {}) {
        if (!projectId) return '';
        const base = `${API_BASE_URL}/clips/preview/${encodeURIComponent(projectId)}/1`;
        const parts = [];
        if (clean) parts.push('clean=1');
        if (bust) parts.push(`_=${Date.now()}`);
        return parts.length ? `${base}?${parts.join('&')}` : base;
    }

    _showLibraryPreviewLoading() {
        const modalContent = document.querySelector('.template-preview-content');
        if (modalContent) modalContent.classList.add('is-library-preview');
        this._hideLibraryPreviewLoading();
    }

    _hideLibraryPreviewLoading() {
        const loadingEl = document.getElementById('templatePreviewLoading');
        // Keep is-library-preview while the library modal is open (pill/layout depend on it)
        if (!loadingEl) return;
        loadingEl.classList.add('hidden');
        loadingEl.style.opacity = '0';
        loadingEl.style.visibility = 'hidden';
        loadingEl.style.pointerEvents = 'none';
        // Immediate remove — delayed display:none left a full-screen blur veil that flickered
        loadingEl.style.display = 'none';
    }

    _setLibraryPreviewPlaceholder(container, message = 'Loading preview...') {
        if (!container) return;
        container.classList.remove('has-video');
        container.innerHTML = `<div class="preview-skel" aria-hidden="true"></div>`;
    }

    _showLibraryPreviewError(container, message = 'Could not load video preview', projectId = null) {
        if (!container) return;
        container.classList.remove('has-video');
        const pid = projectId || this._libraryPreviewProjectId || this.currentTemplateForPreview?.projectId || '';
        const safePid = String(pid).replace(/"/g, '');
        container.innerHTML = `
            <div class="preview-video-placeholder">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                ${safePid ? `<button type="button" class="library-preview-retry-btn" data-project-id="${safePid}">Retry</button>` : ''}
            </div>
        `;
        const retryBtn = container.querySelector('.library-preview-retry-btn');
        if (retryBtn && safePid) {
            retryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._setLibraryPreviewPlaceholder(container);
                this.mountLibraryPreviewVideo(container, safePid);
            }, { once: true });
        }
        this._hideLibraryPreviewLoading();
    }

    openLibraryPreviewWhenReady(cardId, projectId, attempt = 0) {
        const pid = projectId != null ? String(projectId) : '';
        const cid = cardId != null ? cardId : projectId;

        // Prefer an in-memory library item — don't require a rendered card
        let libraryItem = this.libraryItems.find(
            (item) => String(item.id) === String(cid)
                || String(item.projectId) === pid
                || String(item.id) === pid
        );

        if (!libraryItem && pid && attempt === 0) {
            // Optimistic stub so preview can open immediately after generation
            const processingHint = (this.processingItems || []).find(
                (item) => String(item.projectId) === pid || String(item.id) === String(cid)
            );
            libraryItem = {
                id: cid || pid,
                projectId: pid,
                name: processingHint?.name || 'Clip Preview',
                template: processingHint?.template || 'Clip',
                templateName: processingHint?.templateName || processingHint?.template || 'Clip',
                status: 'completed',
                timestamp: new Date().toISOString(),
                _optimistic: true,
            };
            this.libraryItems.unshift(libraryItem);
        }

        const card = pid
            ? document.querySelector(`.library-card[data-project-id="${CSS.escape(pid)}"]`)
            : null;

        // Open as soon as we have item data — card is optional
        if (libraryItem && (card || attempt >= 2)) {
            this.openLibraryPreview(libraryItem.id, libraryItem.projectId || pid, card, { fast: true });
            return;
        }

        if (attempt < 40) {
            setTimeout(() => this.openLibraryPreviewWhenReady(cid, pid, attempt + 1), 120);
            return;
        }

        // Last resort — open with whatever we have
        if (libraryItem || pid) {
            this.openLibraryPreview(
                (libraryItem && libraryItem.id) || cid || pid,
                (libraryItem && libraryItem.projectId) || pid,
                card,
                { fast: true }
            );
        }
    }

    openLibraryPreview(cardId, projectId, libraryCard, options = {}) {
        const modal = document.getElementById('templatePreviewModal');
        if (!modal) {
            return;
        }

        safeLog(`🎬 Opening library preview for: ${cardId} (project: ${projectId})`);

        // 🎬 HIDE STATUS-PILL: When opening library card preview, hide the status pill
        if (libraryCard) {
            const statusPill = libraryCard.querySelector('.status-pill');
            if (statusPill) {
                statusPill.style.opacity = '0';
                statusPill.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    statusPill.style.display = 'none';
                    safeLog('✅ Status-pill hidden for library preview');
                }, 300);
            }
        }

        // 🔒 PREVENT STATUS-PILL FROM DISAPPEARING: Set flag to prevent library updates while modal is open
        this.libraryPreviewModalOpen = true;
        this._libraryCleanRemountTried = false;
        this._pendingLibraryTextConfig = null;
        this._libraryTextSeedInFlight = null;

        this._showLibraryPreviewLoading();

        const previewEl = document.getElementById('templateVideoPreview');
        if (previewEl) {
            this._setLibraryPreviewPlaceholder(previewEl);
        }

        // Get library item data (match id or projectId)
        const libraryItem = this.libraryItems.find(
            (item) => item.id == cardId
                || item.projectId == projectId
                || item.id == projectId
                || item.projectId == cardId
        );
        if (!libraryItem) {
            safeLog(`âŒ Library item not found: ${cardId}`);
            this.libraryPreviewModalOpen = false;
            this._hideLibraryPreviewLoading();
            return;
        }

        // Prefer canonical project id for video fetch
        projectId = libraryItem.projectId || libraryItem.id || projectId;

        // Update modal header with library item info
        const nameEl = document.getElementById('previewTemplateName');
        const descEl = document.getElementById('previewTemplateDescription');
        const durationEl = document.getElementById('previewVideoDuration');
        const formatEl = document.getElementById('previewVideoFormat');
        
        if (nameEl) {
            nameEl.textContent = libraryItem.name || 'Clip Preview';
        }
        if (descEl) {
            descEl.textContent = `Template: ${libraryItem.templateName || libraryItem.template || 'Custom'}`;
        }
        if (durationEl && libraryItem.duration) {
            durationEl.textContent = libraryItem.duration;
        }
        if (formatEl) {
            formatEl.textContent = 'Generated Clip';
        }
        
        // 🔧 UPDATE BUTTON TEXT FOR LIBRARY PREVIEW
        const confirmBtn = document.getElementById('confirmUseTemplateBtn');
        if (confirmBtn) {
            confirmBtn.textContent = 'Download';
            confirmBtn.classList.add('library-download-mode');
        }

        // Show modal IMMEDIATELY
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        document.body.classList.add('modal-open');

        // Hide navigation elements on mobile/tablet
        const navWrapper = document.getElementById('navWrapper');
        const profileNotifWrapper = document.querySelector('.profile-notif-wrapper');
        if (navWrapper) {
            navWrapper.classList.add('disabled');
        }
        if (profileNotifWrapper) {
            profileNotifWrapper.classList.add('disabled');
        }

        // Reset sheet position on mobile
        const templateSheet = document.querySelector('.template-preview-sheet');
        if (templateSheet) {
            templateSheet.classList.remove('expanded');
        }

        const watermarkToggle = document.getElementById('watermarkToggle');
        const shouldShowWatermark = watermarkToggle ? watermarkToggle.checked : false;

        const templateKey = libraryItem.template || libraryItem.templateName || '';
        this.currentTemplateForPreview = {
            id: cardId,
            projectId: projectId,
            // Keep template id for ranking/split detection (cardId is not a template id)
            type: templateKey,
            templateId: templateKey,
            isLibraryPreview: true,
            card: libraryCard,
            data: {
                name: libraryItem.name,
                template: libraryItem.template,
                templateName: libraryItem.templateName
            },
            addWatermark: shouldShowWatermark,
            videoQuality: 'auto'
        };

        this.toggleLibraryPreviewLayout(true);
        this._renderPreviewViralityRail(libraryItem);
        // Library apply doesn't re-detect SFX — hide the generate-time toggle
        if (typeof window.syncPreviewModifiersForTemplate === 'function') {
            window.syncPreviewModifiersForTemplate('');
        }
        try { window.SolisSilencer?.reset?.(); } catch (_) { /* ignore */ }
        try { window.SolisImproveClip?.reset?.(); } catch (_) { /* ignore */ }
        try { window.SolisSilencer?.syncVisibility?.(); } catch (_) { /* ignore */ }

        // Re-evaluate watermark policy every time a library item opens.
        // The template-select flow calls renderTemplatePreview which runs this;
        // the library path skips that, so the Upgrade button / toggle was left
        // in whatever state the last template-select left it.
        // Force a fresh check (cache may be stale after a generation completes).
        this._watermarkCheckCache = null;
        this.setupWatermarkToggle();

        this.loadLibraryVideoPreview().then(() => this._configureLibraryEditingUI());
    }

    loadLibraryVideoPreview() {
        const previewEl = document.getElementById('templateVideoPreview');
        if (!previewEl) return Promise.resolve();

        const projectId = this.currentTemplateForPreview?.projectId;
        if (!projectId) {
            this._showLibraryPreviewError(previewEl, 'No project selected');
            return Promise.resolve();
        }

        // Ranking (and other non-split templates) must never mount the gameplay+content shell.
        // Auto-open after generate used to always probe splitscreen-state, which could paint
        // Minecraft + dual panels over a ranked clip.
        if (this._isCurrentLibraryRanking()) {
            return this.mountLibraryRankingPreview(previewEl, projectId);
        }
        if (this._isCurrentLibrarySplitScreen()) {
            return this.mountLibrarySplitscreenPreview(previewEl, projectId);
        }
        // Non-split templates: flat master only (avoids false-positive dual-panel shells)
        return this.mountLibraryPreviewVideo(previewEl, projectId);
    }

    /**
     * Seed live transcription + AI hook overlays on library preview so the user
     * can customize real post-gen text (not the pre-generate template placeholders).
     */
    seedLibraryCaptionAndHookOverlays(config = {}) {
        try {
            if (this._isCurrentLibraryRanking?.()) return false;
            if (config.customize_expired) return false;

            this._libraryHookCleared = false;
            this._libraryCaptionsCleared = false;
            try {
                if (typeof clearSubtitleMemorySuggest === 'function') clearSubtitleMemorySuggest();
                document.querySelectorAll('.sub-mem-ghost,.sub-mem-actions').forEach((el) => el.remove());
            } catch (_) { /* ignore */ }

            const captionsOn = Boolean(
                config.captions_burned
                || config.subtitles_enabled
                || (config.caption_style && (config.caption_style.anim || config.caption_style.enabled))
                || (Array.isArray(config.caption_preview_words) && config.caption_preview_words.length)
                || String(config.caption_preview_text || '').trim()
            );
            this._libraryCaptionsOn = captionsOn;

            if (captionsOn) {
                const capStyle = config.caption_style || {
                    anim: 'karaoke', font: 'Montserrat', color: '#ffffff',
                    shadow: 'none', font_size: 70, font_size_ratio: 70 / 1920, y_pct: 0.80, enabled: true,
                };
                if (typeof window.setLiveCaptionTimedWords === 'function') {
                    window.setLiveCaptionTimedWords(config.caption_preview_words || []);
                }
                let previewText = String(
                    config.caption_preview_text
                    || (typeof config.caption_style?.preview_text === 'string' ? config.caption_style.preview_text : '')
                    || ''
                ).trim();
                if (!previewText && Array.isArray(config.caption_preview_words) && config.caption_preview_words.length) {
                    previewText = config.caption_preview_words
                        .map((w) => (w && w.text != null ? String(w.text) : String(w || '')))
                        .filter(Boolean)
                        .join(' ')
                        .trim();
                }
                if (typeof window.applySubtitleStyle === 'function') {
                    window.applySubtitleStyle(capStyle, {
                        selectAfter: false,
                        applyFill: true,
                        playAnim: false,
                        markSuggest: true,
                        softClamp: true,
                        previewText: previewText || null,
                    });
                }
            }

            const savedState = config.state || {};
            const hookText = String(
                savedState.subtitle_text
                || config.ai_hook_text
                || ''
            ).trim();
            if (hookText && typeof window.ensureLibraryAiHookOverlay === 'function') {
                const hookOpts = {
                    ...(config.ai_hook_style || {}),
                    secondary_type: config.splitscreen_secondary_type
                        || (typeof splitscreenSecondaryType !== 'undefined' ? splitscreenSecondaryType : 'gameplay'),
                    inverted: config.splitscreen_inverted != null
                        ? Boolean(config.splitscreen_inverted)
                        : (typeof splitscreenInverted !== 'undefined' ? splitscreenInverted : false),
                    content_ratio: config.splitscreen_content_ratio
                        ?? (typeof splitscreenContentRatio !== 'undefined' ? splitscreenContentRatio : 0.5),
                    secondary_collapsed: config.splitscreen_secondary_collapsed != null
                        ? Boolean(config.splitscreen_secondary_collapsed)
                        : (typeof splitscreenSecondaryCollapsed !== 'undefined' ? splitscreenSecondaryCollapsed : false),
                };
                window.ensureLibraryAiHookOverlay(hookText, hookOpts);
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        try { window.ensureLibraryAiHookOverlay(hookText, hookOpts); } catch (_) { /* ignore */ }
                    });
                });
            }

            requestAnimationFrame(() => {
                try {
                    const prev = document.getElementById('templateVideoPreview');
                    if (!prev || typeof window.markSubtitleSuggest !== 'function') return;
                    const cap = prev.querySelector('.sub-text-block:not(.overlay-text-block)');
                    const hook = prev.querySelector('.overlay-text-block[data-ai-hook="1"]');
                    if (cap) window.markSubtitleSuggest(cap);
                    if (hook) window.markSubtitleSuggest(hook);
                } catch (_) { /* ignore */ }
            });
            return Boolean(captionsOn || hookText);
        } catch (err) {
            safeLog('Library caption/hook seed skipped:', err);
            return false;
        }
    }

    async fetchAndSeedLibraryTextOverlays(projectId) {
        if (!projectId || this._isCurrentLibraryRanking?.()) return false;
        if (this._libraryTextSeedInFlight === projectId) return false;
        this._libraryTextSeedInFlight = projectId;
        try {
            const response = await fetch(
                `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/splitscreen-state`,
                { credentials: 'include', headers: getAuthHeaders() },
            );
            if (!response.ok) return false;
            const config = await response.json();
            if (config.customize_expired) return false;
            // Prefer clean master when seeding live captions over a burned video
            const needClean = Boolean(
                (config.captions_burned || config.subtitles_enabled)
                && !this._librarySplitscreenCustomize
                && !document.querySelector('#templateVideoPreview.library-splitscreen-preview')
            );
            if (needClean && !this._libraryCleanRemountTried) {
                const cont = document.getElementById('templateVideoPreview');
                const alreadyClean = String(
                    cont?.querySelector?.('video.library-preview-video')?.currentSrc || ''
                ).includes('clean=1');
                if (cont && !alreadyClean) {
                    this._libraryCleanRemountTried = true;
                    this._pendingLibraryTextConfig = config;
                    this.mountLibraryPreviewVideo(cont, projectId, { clean: true });
                    return true;
                }
            }
            return this.seedLibraryCaptionAndHookOverlays(config);
        } catch (err) {
            safeLog('fetchAndSeedLibraryTextOverlays failed:', err);
            return false;
        } finally {
            if (this._libraryTextSeedInFlight === projectId) {
                this._libraryTextSeedInFlight = null;
            }
        }
    }

    async mountLibrarySplitscreenPreview(container, projectId) {
        this._librarySplitscreenCustomize = false;
        this._librarySplitscreenDirty = false;
        this._libraryOverlayDirty = false;
        this._libraryDirtyArmed = false;
        this._libraryPreviewProjectId = projectId;
        revokeLibrarySplitscreenObjectUrls();

        try {
            if (!this.validateProjectId(projectId)) {
                throw new Error('Invalid project id');
            }
            if (this._isCurrentLibraryRanking()) {
                this.mountLibraryPreviewVideo(container, projectId);
                return;
            }
            const response = await fetch(
                `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/splitscreen-state`,
                { credentials: 'include', headers: getAuthHeaders() },
            );
            if (!response.ok) {
                this.mountLibraryPreviewVideo(container, projectId);
                return;
            }

            const config = await response.json();
            this._libraryCustomizeMeta = {
                can_customize: Boolean(config.can_customize),
                customize_expired: Boolean(config.customize_expired),
                customize_expires_at: config.customize_expires_at || null,
                customize_ttl_hours: config.customize_ttl_hours,
                customize_remaining_hours: config.customize_remaining_hours,
                apply_consumes_quota: config.apply_consumes_quota !== false,
            };
            this._updateLibraryCustomizeExpiryPill();
            if (config.customize_expired) {
                try {
                    showNotification(
                        'Customization window expired for this project. You can still download the last render.',
                        'info',
                    );
                } catch (_) {}
                this.mountLibraryPreviewVideo(container, projectId);
                return;
            }
            const layers = config.layers || {};
            const layerReady = (layer) => {
                if (!layer) return false;
                if (typeof layer === 'boolean') return layer;
                if (typeof layer === 'string') return layer.trim().length > 0;
                if (typeof layer === 'object') {
                    return Boolean(
                        layer.url
                        || layer.path
                        || layer.key
                        || layer.src
                        || layer.ready
                        || layer.exists
                        || layer.available
                    );
                }
                return false;
            };
            const hasSplitMedia = Boolean(
                config.has_segment
                || layerReady(layers.segment)
                || layerReady(layers.content)
                || layerReady(layers.secondary)
            );
            // Metadata defaults (gameplay_clip_id etc.) are written for every template —
            // only mount the dual-panel shell when real split assets exist.
            if (!hasSplitMedia) {
                this.mountLibraryPreviewVideo(container, projectId, { clean: true });
                this.fetchAndSeedLibraryTextOverlays(projectId);
                return;
            }
            if (!config.can_customize && !config.has_segment) {
                this.mountLibraryPreviewVideo(container, projectId, { clean: true });
                this.fetchAndSeedLibraryTextOverlays(projectId);
                return;
            }

            // Captions live on the master only — layers stay clean for editing.
            // Prefer interactive layers whenever customize is available.
            const captionsOn = Boolean(
                config.captions_burned
                || config.subtitles_enabled
                || (config.caption_style && (config.caption_style.anim || config.caption_style.enabled))
                || (Array.isArray(config.caption_preview_words) && config.caption_preview_words.length)
                || String(config.caption_preview_text || '').trim()
            );
            this._libraryCaptionsOn = captionsOn;
            if (captionsOn && !(config.can_customize || config.has_segment)) {
                safeLog('Captioned master → flat library preview with editable overlays');
                this._librarySplitscreenCustomize = false;
                this._libraryPreviewProjectId = projectId;
                applySplitscreenConfigFromServer(config);
                this._pendingLibraryTextConfig = config;
                this.mountLibraryPreviewVideo(container, projectId, { clean: true });
                this.seedLibraryCaptionAndHookOverlays(config);
                await this._configureLibraryEditingUI();
                return;
            }

            applySplitscreenConfigFromServer(config);
            const savedState = config.state || {};
            const isFaceTrack = splitscreenSecondaryType === 'face_track';
            const hasSecondaryLayer = Boolean(layers.secondary);
            const hasContentLayer = Boolean(layers.content);
            const hasSegment = Boolean(config.has_segment || layers.segment);
            // No reframe media at all → fullscreen content (don't leave an empty panel)
            if (isFaceTrack && !hasSecondaryLayer && !hasSegment) {
                splitscreenSecondaryCollapsed = true;
                splitscreenContentRatio = 1;
            }
            const isCollapsedLayout = Boolean(
                splitscreenSecondaryCollapsed
                || config.layers?.collapsed
                || savedState.secondary_collapsed
                || splitscreenContentRatio >= 0.97
            );
            const hasFaceCrop = Boolean(
                savedState.face_crop
                && Number(savedState.face_crop.w) > 0
                && Number(savedState.face_crop.h) > 0
            );
            // Prefer pre-cropped layers for reframe — dual full-segment CSS crop lags and looks off
            const useBakedReframe = isFaceTrack
                && hasSecondaryLayer
                && hasContentLayer
                && !isCollapsedLayout
                && hasFaceCrop;
            const useLayers = (!isFaceTrack && hasContentLayer) || useBakedReframe;

            // Face track: baked panels by default; live CSS crop only as fallback / after pan
            setLibrarySplitscreenCropState({
                cropX: savedState.crop_x ?? null,
                faceCrop: savedState.face_crop || null,
                srcW: 0,
                srcH: 0,
                useLayers,
                liveFaceEdit: isFaceTrack && (useBakedReframe || hasSegment),
                faceDisplayMode: isFaceTrack
                    ? (useBakedReframe ? 'baked' : (hasSegment ? 'live' : 'baked'))
                    : null,
                secondaryFromLayer: useBakedReframe,
            });

            // Must be true before applySplitscreenPreview / crop sync, or face_track
            // falls back to the REFRAME placeholder and hides the live video.
            this._librarySplitscreenCustomize = true;
            this._librarySplitscreenDirty = false;
            this._libraryOverlayDirty = false;
            this._libraryDirtyArmed = false;

            setSplitscreenScope(container);
            container.classList.remove('has-video');
            container.innerHTML = buildSplitscreenPreviewShell();

            const layerBase = `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/splitscreen-layer`;
            const segmentApiUrl = `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/splitscreen-segment`;

            const contentVideo = container.querySelector('#splitscreenContentVideo');
            const reframeVideo = container.querySelector('#splitscreenReframeVideo');
            const gameplayVideo = container.querySelector('#splitscreenGameplayVideo');

            // Add class early so CSS overrides apply before videos paint
            container.classList.add('library-splitscreen-preview');

            const wireVideo = async (videoEl, url, { secure = true } = {}) => {
                if (!videoEl || !url) return false;
                forceLibraryPanelVideoFill(videoEl);
                videoEl.muted = true;
                videoEl.loop = true;
                videoEl.playsInline = true;
                videoEl.preload = 'auto';
                videoEl.setAttribute('playsinline', '');
                // Do NOT set crossOrigin — it breaks cookie-auth media in Chromium
                videoEl.removeAttribute('crossorigin');

                let playUrl = url;
                if (secure && typeof url === 'string' && url.startsWith('http')) {
                    try {
                        playUrl = await fetchSecureVideoObjectUrl(url);
                    } catch (blobErr) {
                        safeLog('Layer blob fetch failed, trying direct src:', blobErr);
                        playUrl = url;
                    }
                }

                return new Promise((resolve) => {
                    let settled = false;
                    const finish = (ok) => {
                        if (settled) return;
                        settled = true;
                        if (ok && videoEl.videoWidth && _librarySplitscreenCropState) {
                            _librarySplitscreenCropState.srcW = videoEl.videoWidth;
                            _librarySplitscreenCropState.srcH = videoEl.videoHeight;
                            if (videoEl === reframeVideo) {
                                _librarySplitscreenCropState.faceSrcW = videoEl.videoWidth;
                                _librarySplitscreenCropState.faceSrcH = videoEl.videoHeight;
                            }
                        }
                        forceLibraryPanelVideoFill(videoEl);
                        syncLibrarySplitscreenCropPreview();
                        try {
                            if (typeof splitscreenSecondaryType !== 'undefined'
                                && (splitscreenSecondaryType === 'blank' || splitscreenSecondaryType === 'blank_blur')) {
                                syncBlankBlurVideo();
                            }
                        } catch (_) {}
                        resolve(ok);
                    };
                    videoEl.addEventListener('loadeddata', () => finish(true), { once: true });
                    videoEl.addEventListener('loadedmetadata', () => {
                        forceLibraryPanelVideoFill(videoEl);
                        videoEl.play().catch(() => {});
                        if (videoEl.videoWidth > 0) finish(true);
                    }, { once: true });
                    videoEl.addEventListener('canplay', () => {
                        if (videoEl.videoWidth > 0) finish(true);
                    }, { once: true });
                    videoEl.addEventListener('error', () => finish(false), { once: true });
                    videoEl.src = playUrl;
                    videoEl.load();
                    videoEl.play().catch(() => {});
                    setTimeout(() => finish(videoEl.videoWidth > 0 && videoEl.readyState >= 1), 10000);
                });
            };

            if (isFaceTrack && useBakedReframe) {
                // Smooth path: already face-cropped secondary + content layers
                if (gameplayVideo) {
                    gameplayVideo.style.setProperty('display', 'none', 'important');
                    gameplayVideo.removeAttribute('src');
                }
                const contentOk = await wireVideo(contentVideo, `${layerBase}/content`);
                if (!contentOk) throw new Error('Failed to load content layer');
                if (reframeVideo) {
                    reframeVideo.style.setProperty('display', 'block', 'important');
                    reframeVideo.style.touchAction = 'none';
                    reframeVideo.style.cursor = 'grab';
                    const secOk = await wireVideo(reframeVideo, `${layerBase}/secondary`);
                    if (!secOk) {
                        // Secondary not ready yet — fall back to live segment crop on reframe panel
                        if (!hasSegment) throw new Error('Failed to load reframe layer');
                        safeLog('Reframe layer failed — falling back to live segment crop');
                        if (_librarySplitscreenCropState) {
                            _librarySplitscreenCropState.faceDisplayMode = 'live';
                            _librarySplitscreenCropState.liveFaceEdit = true;
                            _librarySplitscreenCropState.secondaryFromLayer = false;
                        }
                        const pair = await fetchSecureVideoObjectUrlPair(segmentApiUrl);
                        const liveOk = await wireVideo(reframeVideo, pair[1], { secure: false });
                        if (!liveOk) throw new Error('Failed to load reframe layer');
                    }
                    forceLibraryPanelVideoFill(reframeVideo);
                    reframeVideo.style.setProperty('pointer-events', 'auto', 'important');
                }
                bindLibrarySplitscreenPlaybackSync(contentVideo, reframeVideo);
                syncLibrarySplitscreenCropPreview();
            } else if (isFaceTrack && hasSegment && !isCollapsedLayout) {
                // Fallback: twin blob URLs for both panels (one blob URL → second video stays black)
                if (gameplayVideo) {
                    gameplayVideo.style.setProperty('display', 'none', 'important');
                    gameplayVideo.removeAttribute('src');
                }
                let contentUrl = segmentApiUrl;
                let reframeUrl = segmentApiUrl;
                try {
                    [contentUrl, reframeUrl] = await fetchSecureVideoObjectUrlPair(segmentApiUrl);
                } catch (blobErr) {
                    safeLog('Shared segment blob pair failed, streaming URLs:', blobErr);
                }
                const contentOk = await wireVideo(contentVideo, contentUrl, { secure: false });
                if (!contentOk) throw new Error('Failed to load splitscreen segment');
                if (reframeVideo) {
                    reframeVideo.style.setProperty('display', 'block', 'important');
                    reframeVideo.style.touchAction = 'none';
                    reframeVideo.style.cursor = 'grab';
                    const secOk = await wireVideo(reframeVideo, reframeUrl, { secure: false });
                    if (!secOk) throw new Error('Failed to load reframe panel');
                    forceLibraryPanelVideoFill(reframeVideo);
                    reframeVideo.style.setProperty('pointer-events', 'auto', 'important');
                }
                bindLibrarySplitscreenPlaybackSync(contentVideo, reframeVideo);
                syncLibrarySplitscreenCropPreview();
            } else if (isFaceTrack && !hasSecondaryLayer && !hasSegment) {
                // Reframe bake still running — show flat master instead of empty black panels
                safeLog('Face track without secondary/segment yet — flat preview');
                throw new Error('Reframe layers not ready');
            } else {
                const contentUrl = useLayers ? `${layerBase}/content` : segmentApiUrl;
                const contentOk = await wireVideo(contentVideo, contentUrl);
                if (!contentOk && useLayers && hasSegment) {
                    if (_librarySplitscreenCropState) _librarySplitscreenCropState.useLayers = false;
                    await wireVideo(contentVideo, segmentApiUrl);
                }

                if (isFaceTrack) {
                    if (gameplayVideo) {
                        gameplayVideo.style.setProperty('display', 'none', 'important');
                        gameplayVideo.removeAttribute('src');
                    }
                    if (reframeVideo && hasSecondaryLayer && !isCollapsedLayout && hasFaceCrop) {
                        if (_librarySplitscreenCropState) {
                            _librarySplitscreenCropState.faceDisplayMode = 'baked';
                            _librarySplitscreenCropState.liveFaceEdit = false;
                        }
                        reframeVideo.style.setProperty('display', 'block', 'important');
                        await wireVideo(reframeVideo, `${layerBase}/secondary`);
                        forceLibraryPanelVideoFill(reframeVideo);
                        if (contentVideo) bindLibrarySplitscreenPlaybackSync(contentVideo, reframeVideo);
                    }
                } else if (hasSecondaryLayer) {
                    if (reframeVideo) {
                        reframeVideo.style.setProperty('display', 'none', 'important');
                        reframeVideo.removeAttribute('src');
                    }
                    if (gameplayVideo) {
                        gameplayVideo.style.setProperty('display', 'block', 'important');
                        await wireVideo(gameplayVideo, `${layerBase}/secondary`);
                        if (contentVideo) bindLibrarySplitscreenPlaybackSync(contentVideo, gameplayVideo);
                    }
                } else if (gameplayVideo) {
                    if (reframeVideo) reframeVideo.style.setProperty('display', 'none', 'important');
                    gameplayVideo.style.setProperty('display', 'block', 'important');
                }
            }

            if (availableGameplayClips.length === 0) {
                await loadAvailableGameplayClips();
            }
            applySplitscreenPreview();
            const facePanel = container.querySelector('#splitscreenFacePanel');
            if (facePanel) facePanel.classList.remove('visible');
            if (isFaceTrack && reframeVideo) {
                // Keep live crop applied (not cover-fill) so face matches segment
                syncLibrarySplitscreenCropPreview();
            }
            if (contentVideo && !isFaceTrack) forceLibraryPanelVideoFill(contentVideo);

            initializeSplitscreenDivider();
            requestAnimationFrame(() => {
                applySplitscreenRatio();
                syncLibrarySplitscreenCropPreview();
                const div = container.querySelector('#splitscreenDivider');
                if (div) {
                    delete div.dataset.splitscreenInit;
                    initializeSplitscreenDivider();
                    div.style.setProperty('display', 'flex', 'important');
                    div.style.setProperty('opacity', '1', 'important');
                    div.style.setProperty('pointer-events', 'auto', 'important');
                    div.style.setProperty('z-index', '60', 'important');
                }
                playBothLibraryPanels(container);
            });
            bindLibrarySplitscreenCropObserver(container.querySelector('#splitscreenRoot'));
            if (_librarySplitscreenCropState?.liveFaceEdit) {
                bindFaceReframePanHandlers();
            }

            container.classList.add('has-video', 'library-splitscreen-preview');
            this._hideLibraryPreviewLoading();
            playBothLibraryPanels(container);
            ensurePreviewAudioToggle(container);
            if (typeof PreviewTimeline !== 'undefined' && contentVideo) {
                PreviewTimeline.attach(contentVideo);
            }
            // Live caption style + AI hook on clean layers (Apply re-burns into master)
            this.seedLibraryCaptionAndHookOverlays({
                ...config,
                state: savedState,
            });
            if (typeof syncSplitscreenSubtitles === 'function') {
                syncSplitscreenSubtitles(container);
            }
            await this._configureLibraryEditingUI();
        } catch (error) {
            safeLog('Library splitscreen preview failed, using flat video:', error);
            this._librarySplitscreenCustomize = false;
            teardownLibrarySplitscreenCropObserver();
            setSplitscreenScope(null);
            this._pendingLibraryTextConfig = null;
            this.mountLibraryPreviewVideo(container, projectId, { clean: true });
            this.fetchAndSeedLibraryTextOverlays(projectId);
        }
    }

    async runLibraryApplyWithSpinner(projectId, {
        needsRecompose,
        needsOverlayRender,
        needsRankingRecompose = false,
        needsSilenceOnly = false,
        overlays = null,
    }) {
        const spinner = typeof getGenerationProgressSpinner === 'function'
            ? getGenerationProgressSpinner()
            : window.generationProgressSpinner;

        const applyFn = (needsRecompose || needsOverlayRender || needsRankingRecompose || needsSilenceOnly)
            ? async () => {
                if (needsRankingRecompose) {
                    await this.saveLibraryRankingCustomizations(projectId);
                }
                if (needsRecompose) {
                    await this.saveLibrarySplitscreenLayout(projectId);
                }
                if (needsSilenceOnly) {
                    await this.saveLibrarySilenceCuts(projectId);
                }
                if (needsOverlayRender) {
                    await this.saveLibraryOverlayTexts(projectId, overlays);
                }
            }
            : null;

        const downloadFn = async () => {
            await this.downloadClip(projectId, { skipModalClose: true, quiet: true });
        };

        if (spinner?.runLibraryApplyFlow) {
            await spinner.runLibraryApplyFlow(projectId, { applyFn, downloadFn });
            return;
        }

        if (applyFn) await applyFn();
        await downloadFn();
        showNotification('Download started!', 'success');
    }

    async saveLibrarySilenceCuts(projectId) {
        const cuts = (typeof window.SolisSilencer?.getCuts === 'function')
            ? window.SolisSilencer.getCuts()
            : (this._librarySilenceCuts || []);
        if (!Array.isArray(cuts) || !cuts.length) {
            this._librarySilenceDirty = false;
            return;
        }
        const response = await fetch(
            `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/silence-strip`,
            {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    silence_cuts: cuts.map((r) => ({
                        start: Number(Number(r.start).toFixed(3)),
                        end: Number(Number(r.end).toFixed(3)),
                    })),
                }),
            },
        );
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw this._libraryApplyError(err, response.status, 'Silence cleanup failed');
        }
        this._librarySilenceDirty = false;
        this._librarySilenceCuts = [];
        try { window.SolisSilencer?.reset?.(); } catch (_) { /* ignore */ }
        try { window.SolisImproveClip?.reset?.(); } catch (_) { /* ignore */ }
        try { window.LibraryPreviewMediaCache?.invalidateProject?.(projectId); } catch (_) { /* ignore */ }
    }

    async saveLibraryOverlayTexts(projectId, overlaysPrecollected = null) {
        const overlays = Array.isArray(overlaysPrecollected) && overlaysPrecollected.length
            ? overlaysPrecollected
            : (typeof window.collectLibraryOverlayTexts === 'function'
                ? window.collectLibraryOverlayTexts()
                : []);
        if (!overlays.length) {
            throw new Error('Type some text on the preview first (not just “Text”)');
        }
        const response = await fetch(
            `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/overlay-text`,
            {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ overlays }),
            },
        );
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw this._libraryApplyError(err, response.status, 'Overlay apply failed');
        }
        const okBody = await response.json().catch(() => ({}));
        this._libraryOverlayDirty = false;
        try { await this.refreshQuotaAfterApply(okBody); } catch (_) { /* ignore */ }
    }

    async saveLibrarySplitscreenLayout(projectId) {
        const config = typeof window.getSplitscreenConfig === 'function'
            ? window.getSplitscreenConfig()
            : {};
        const cropState = _librarySplitscreenCropState || {};
        const body = {
            splitscreen_content_ratio: config.splitscreen_content_ratio,
            splitscreen_inverted: config.splitscreen_inverted,
            splitscreen_secondary_collapsed: config.splitscreen_secondary_collapsed,
            splitscreen_secondary_type: config.splitscreen_secondary_type,
            gameplay_clip_id: config.gameplay_clip_id,
        };
        if (Array.isArray(cropState.faceCrop) && cropState.faceCrop.length === 4) {
            body.face_crop = cropState.faceCrop.map((v) => Number(v));
        }
        if (cropState.cropX != null && Number.isFinite(Number(cropState.cropX))) {
            body.crop_x = Number(cropState.cropX);
        }
        // Timeline trim → actually cut the clip on apply
        try {
            const trim = window.PreviewTimeline?.getTrim?.();
            if (trim && trim.duration > 0) {
                const start = Number(trim.start) || 0;
                const end = Number(trim.end) || trim.duration;
                if (start > 0.05 || end < trim.duration - 0.05) {
                    body.trim_start = Number(start.toFixed(3));
                    body.trim_end = Number(end.toFixed(3));
                }
            }
        } catch (_) { /* ignore */ }

        // Silencer keep-cuts (preview skip regions → real encode on apply)
        try {
            const cuts = (typeof window.SolisSilencer?.getCuts === 'function')
                ? window.SolisSilencer.getCuts()
                : (this._librarySilenceCuts || []);
            if (Array.isArray(cuts) && cuts.length) {
                body.silence_cuts = cuts.map((r) => ({
                    start: Number(Number(r.start).toFixed(3)),
                    end: Number(Number(r.end).toFixed(3)),
                }));
            }
        } catch (_) { /* ignore */ }

        // Post-gen caption + AI hook edits (remove overlay → clear from burn)
        try {
            const capBlock = document
                .getElementById('templateVideoPreview')
                ?.querySelector('.sub-text-block:not(.overlay-text-block)');
            if (capBlock && typeof window.collectSubtitleStyle === 'function') {
                const cap = window.collectSubtitleStyle();
                if (cap && typeof cap === 'object') {
                    body.caption_style = cap;
                    body.subtitles_enabled = true;
                    body.clear_captions = false;
                }
            } else if (this._libraryCaptionsCleared || this._libraryCaptionsOn) {
                // User deleted the caption block (or captions were on and are gone)
                if (!capBlock) {
                    body.clear_captions = true;
                    body.subtitles_enabled = false;
                }
            }
        } catch (_) { /* ignore */ }
        try {
            const hook = (typeof window.collectAiHookFromPreview === 'function')
                ? window.collectAiHookFromPreview()
                : null;
            if (hook?.present && hook.text) {
                body.ai_hook_text = hook.text;
                body.subtitle_text = hook.text;
                body.clear_ai_hook = false;
                if (hook.style) body.ai_hook_style = hook.style;
            } else {
                const stillThere = document.querySelector(
                    '#templateVideoPreview .overlay-text-block[data-ai-hook="1"]'
                );
                if (!stillThere) {
                    body.ai_hook_text = '';
                    body.subtitle_text = '';
                    body.clear_ai_hook = true;
                }
            }
        } catch (_) { /* ignore */ }

        const response = await fetch(
            `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/splitscreen/recompose`,
            {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(body),
            },
        );
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw this._libraryApplyError(err, response.status, 'Recompose failed');
        }
        const okBody = await response.json().catch(() => ({}));
        this._librarySplitscreenDirty = false;
        this._librarySilenceDirty = false;
        this._librarySilenceCuts = [];
        try { window.SolisSilencer?.reset?.(); } catch (_) { /* ignore */ }
        try { window.SolisImproveClip?.reset?.(); } catch (_) { /* ignore */ }
        try { window.LibraryPreviewMediaCache?.invalidateProject?.(projectId); } catch (_) { /* ignore */ }
        try { await this.refreshQuotaAfterApply(okBody); } catch (_) { /* ignore */ }
    }

    async mountLibraryRankingPreview(container, projectId) {
        await this._preflightRankingLibraryState(projectId);
        this.mountLibraryPreviewVideo(container, projectId, {
            clean: !!this._libraryRankingUseCleanVideo,
        });
    }

    async _preflightRankingLibraryState(projectId) {
        this._libraryRankingUseCleanVideo = false;
        this._libraryRankingOverlayPending = null;
        this._libraryRankingTimelineState = null;
        try {
            const response = await fetch(
                `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/ranking-edit-state`,
                { credentials: 'include', headers: getAuthHeaders() },
            );
            if (!response.ok) return;
            const state = await response.json();
            this._libraryCustomizeMeta = {
                can_customize: state.can_customize !== false && state.can_edit !== false,
                customize_expired: Boolean(state.customize_expired),
                customize_expires_at: state.customize_expires_at || null,
                customize_ttl_hours: state.customize_ttl_hours,
                customize_remaining_hours: state.customize_remaining_hours,
                apply_consumes_quota: state.apply_consumes_quota !== false,
            };
            const overlaysInVideo = Boolean(state.overlay_burned) && !Boolean(state.burn_deferred);
            const hasCleanMaster = typeof state.has_clean_master === 'boolean'
                ? state.has_clean_master
                : false;
            const canMountEdit = Boolean(state.can_edit) && !state.customize_expired;
            this._libraryRankingTimelineState = state;
            // Editable ranking: HTML overlay on clean concat when available.
            // Never force clean=1 when the clean master is missing — that only
            // hydrates *_clean.mp4 from R2 and leaves the preview blank/white.
            if (canMountEdit && (hasCleanMaster || !overlaysInVideo)) {
                this._libraryRankingUseCleanVideo = hasCleanMaster;
                this._libraryRankingOverlayPending = state;
            } else {
                this._libraryRankingEditable = Boolean(state.can_edit) && !state.customize_expired;
                this._libraryRankingNeedsBurn = false;
            }
            this._updateLibraryCustomizeExpiryPill();
        } catch (err) {
            safeLog('Ranking library preflight failed:', err);
        }
    }

    _formatCustomizeExpiryLabel(meta) {
        if (!meta || meta.customize_ttl_hours == null) return '';
        if (meta.customize_expired) return 'Customization expired — download only';
        const expiresAt = meta.customize_expires_at ? Date.parse(meta.customize_expires_at) : NaN;
        if (!Number.isFinite(expiresAt)) {
            const hrs = Number(meta.customize_remaining_hours);
            if (Number.isFinite(hrs) && hrs > 0) {
                if (hrs >= 24) return `Customize expires in ${Math.ceil(hrs / 24)}d`;
                return `Customize expires in ${Math.ceil(hrs)}h`;
            }
            return '';
        }
        const ms = expiresAt - Date.now();
        if (ms <= 0) return 'Customization expired — download only';
        const totalMin = Math.ceil(ms / 60000);
        if (totalMin >= 24 * 60) return `Customize expires in ${Math.ceil(totalMin / (24 * 60))}d`;
        if (totalMin >= 60) return `Customize expires in ${Math.ceil(totalMin / 60)}h`;
        return `Customize expires in ${totalMin}m`;
    }

    _updateLibraryCustomizeExpiryPill() {
        const pill = document.getElementById('libraryCustomizeExpiryPill');
        if (!pill) return;
        if (this._customizeExpiryTimer) {
            clearInterval(this._customizeExpiryTimer);
            this._customizeExpiryTimer = null;
        }
        const isLib = Boolean(this.currentTemplateForPreview?.isLibraryPreview);
        const meta = this._libraryCustomizeMeta;
        if (!isLib || !meta || meta.customize_ttl_hours == null) {
            pill.hidden = true;
            pill.textContent = '';
            return;
        }
        const label = this._formatCustomizeExpiryLabel(meta);
        if (!label) {
            pill.hidden = true;
            return;
        }
        pill.hidden = false;
        pill.textContent = label;
        pill.classList.toggle('is-expired', Boolean(meta.customize_expired));
        if (!meta.customize_expired && meta.customize_expires_at) {
            this._customizeExpiryTimer = setInterval(() => {
                if (!this.libraryPreviewModalOpen) {
                    clearInterval(this._customizeExpiryTimer);
                    this._customizeExpiryTimer = null;
                    return;
                }
                const next = this._formatCustomizeExpiryLabel(this._libraryCustomizeMeta);
                if (!next || next.includes('expired')) {
                    pill.textContent = next || 'Customization expired — download only';
                    pill.classList.add('is-expired');
                    clearInterval(this._customizeExpiryTimer);
                    this._customizeExpiryTimer = null;
                    return;
                }
                pill.textContent = next;
            }, 30000);
        }
    }

    mountLibraryPreviewVideo(container, projectId, opts = {}) {
        if (this._libraryPreviewRetryTimer) {
            clearTimeout(this._libraryPreviewRetryTimer);
            this._libraryPreviewRetryTimer = null;
        }
        if (this._libraryPreviewFetchController) {
            this._libraryPreviewFetchController.abort();
            this._libraryPreviewFetchController = null;
        }
        // Do not revoke session-cached blob URLs — remounts must stay instant
        if (this._libraryPreviewObjectUrl) {
            const cached = window.LibraryPreviewMediaCache?.get?.(projectId, !!opts.clean)
                || window.LibraryPreviewMediaCache?.getBySrc?.(this._libraryPreviewObjectUrl);
            if (!cached || cached.objectUrl !== this._libraryPreviewObjectUrl) {
                try { URL.revokeObjectURL(this._libraryPreviewObjectUrl); } catch (_) { /* ignore */ }
            }
            this._libraryPreviewObjectUrl = null;
        }

        const loadGen = ++this._libraryPreviewLoadGen;
        this._libraryPreviewProjectId = projectId;
        this._libraryPreviewFailedId = null;

        // Prefer session blob cache — zero network on reopen
        const cached = window.LibraryPreviewMediaCache?.get?.(projectId, !!opts.clean);
        if (cached?.objectUrl) {
            this._libraryPreviewObjectUrl = cached.objectUrl;
            this._mountLibraryPreviewFromUrl(container, projectId, cached.objectUrl, {
                loadGen,
                clean: !!opts.clean,
                fromCache: true,
            });
            return;
        }

        // Stream with Range requests — never download the full master as a blob on first open
        this.fetchSecureLibraryPreviewBlob(container, projectId, null, {
            loadGen,
            attempt: 0,
            clean: !!opts.clean,
        });
    }

    _mountLibraryPreviewFromUrl(container, projectId, url, opts = {}) {
        const loadGen = opts.loadGen != null ? opts.loadGen : this._libraryPreviewLoadGen;
        const isStale = () => (
            loadGen !== this._libraryPreviewLoadGen
            || !this.libraryPreviewModalOpen
            || (this._libraryPreviewProjectId && String(this._libraryPreviewProjectId) !== String(projectId))
        );
        if (isStale() || !container || !url) return;

        container.classList.remove('library-ranking-edit', 'library-splitscreen-preview');
        this._libraryRankingDirty = false;
        if (!this._libraryRankingOverlayPending) {
            this._libraryRankingEditable = false;
            this._libraryRankingNeedsBurn = false;
        }

        const video = document.createElement('video');
        video.className = 'library-preview-video';
        video.controls = false;
        video.removeAttribute('controls');
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;
        video.preload = 'auto';
        video.setAttribute('playsinline', '');
        video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback noplaybackrate');
        video.disablePictureInPicture = true;
        video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:transparent;z-index:2;display:block;visibility:visible;opacity:0;';
        video.removeAttribute('crossorigin');
        container.querySelectorAll('video').forEach((v) => v.remove());
        if (!container.querySelector('.preview-skel')) {
            const skel = document.createElement('div');
            skel.className = 'preview-skel';
            skel.setAttribute('aria-hidden', 'true');
            container.appendChild(skel);
        }
        container.appendChild(video);
        container.classList.remove('has-video');

        // Show timeline shell immediately so first-open clips aren't missing the rail
        try {
            if (typeof PreviewTimeline !== 'undefined') {
                PreviewTimeline.attach(video);
                PreviewTimeline.show?.();
            }
        } catch (_) { /* ignore */ }

        let revealed = false;
        const reveal = (force = false) => {
            if (revealed || isStale()) return;
            const hasDims = (video.videoWidth > 0) && (video.videoHeight > 0);
            const hasDuration = Number.isFinite(video.duration) && video.duration > 0;
            // Accept metadata even before first decoded frame (Range streams lag readyState)
            if (!force && !hasDims && !hasDuration && video.readyState < 1) return;
            if (!force && !hasDims && video.readyState < 1) return;
            revealed = true;
            container.classList.add('has-video');
            video.style.setProperty('display', 'block', 'important');
            video.style.setProperty('visibility', 'visible', 'important');
            video.style.setProperty('opacity', '1', 'important');
            video.style.setProperty('background', '#000', 'important');
            container.querySelector('.preview-skel')?.remove();
            this._hideLibraryPreviewLoading();
            ensurePreviewAudioToggle(container);
            try {
                if (typeof PreviewTimeline !== 'undefined') {
                    // Re-attach once duration is known so filmstrip/trim paint correctly
                    PreviewTimeline.attach(video);
                    PreviewTimeline.show?.();
                    if (typeof PreviewTimeline.scheduleFilmstripBuild === 'function') {
                        PreviewTimeline.scheduleFilmstripBuild(80);
                        PreviewTimeline.scheduleFilmstripBuild(600);
                    }
                }
            } catch (_) { /* ignore */ }
            video.play().catch(() => {});
            this.maybeMountLibraryRankingOverlay(container, projectId).catch(() => {});
            if (this._isCurrentLibraryRanking?.() && this._libraryRankingTimelineState) {
                try {
                    this.seedLibraryRankingTimelineSplits(this._libraryRankingTimelineState);
                } catch (_) { /* ignore */ }
            }
            // Flat path: still seed real transcription + hook for post-gen customize
            try {
                if (this._pendingLibraryTextConfig) {
                    const cfg = this._pendingLibraryTextConfig;
                    this._pendingLibraryTextConfig = null;
                    this.seedLibraryCaptionAndHookOverlays(cfg);
                } else if (!container.classList.contains('library-splitscreen-preview')
                    && !this._isCurrentLibraryRanking?.()) {
                    this.fetchAndSeedLibraryTextOverlays(projectId);
                }
            } catch (_) { /* ignore */ }
            try { window.SolisSilencer?.syncVisibility?.(); } catch (_) { /* ignore */ }
            try { window.SolisImproveClip?.syncVisibility?.(); } catch (_) { /* ignore */ }
        };

        video.addEventListener('loadedmetadata', () => reveal());
        video.addEventListener('loadeddata', () => reveal());
        video.addEventListener('canplay', () => reveal());
        video.addEventListener('durationchange', () => reveal());
        video.addEventListener('playing', () => reveal());

        // Poll for late-decoded dimensions (Chromium Range paths often skip early events)
        let pollN = 0;
        const pollId = setInterval(() => {
            if (revealed || isStale()) {
                clearInterval(pollId);
                return;
            }
            pollN += 1;
            if ((video.videoWidth > 0 || (Number.isFinite(video.duration) && video.duration > 0))
                && video.readyState >= 1) {
                clearInterval(pollId);
                reveal();
                return;
            }
            if (pollN >= 40) clearInterval(pollId);
        }, 200);

        video.src = url;
        video.load();
        video.play().catch(() => {});
        setTimeout(() => {
            if (!revealed && !isStale() && (video.videoWidth > 0 || video.readyState >= 1)) {
                reveal();
            }
        }, 500);
        setTimeout(() => {
            if (!revealed && !isStale() && video.readyState >= 1) {
                reveal(true);
            }
        }, 2500);
    }

    async maybeMountLibraryRankingOverlay(container, projectId) {
        if (!container || !projectId) return;
        if (this._librarySplitscreenCustomize) return;
        if (this._libraryRankingOverlayPending) {
            const state = this._libraryRankingOverlayPending;
            this._libraryRankingOverlayPending = null;
            if (state.customize_expired) {
                this._updateLibraryCustomizeExpiryPill();
                return;
            }
            if (state.can_edit) {
                this.mountLibraryRankingOverlay(container, state);
            }
            return;
        }
        // Fallback if preflight was skipped
        try {
            const response = await fetch(
                `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/ranking-edit-state`,
                { credentials: 'include', headers: getAuthHeaders() },
            );
            if (!response.ok) return;
            const state = await response.json();
            this._libraryCustomizeMeta = {
                can_customize: state.can_customize !== false && state.can_edit !== false,
                customize_expired: Boolean(state.customize_expired),
                customize_expires_at: state.customize_expires_at || null,
                customize_ttl_hours: state.customize_ttl_hours,
                customize_remaining_hours: state.customize_remaining_hours,
                apply_consumes_quota: state.apply_consumes_quota !== false,
            };
            const overlaysInVideo = Boolean(state.overlay_burned) && !Boolean(state.burn_deferred);
            const hasCleanMaster = typeof state.has_clean_master === 'boolean'
                ? state.has_clean_master
                : false;
            const canMountEdit = Boolean(state.can_edit) && !state.customize_expired;
            if (!canMountEdit || (overlaysInVideo && !hasCleanMaster)) {
                this._libraryRankingEditable = Boolean(state.can_edit) && !state.customize_expired;
                this._libraryRankingNeedsBurn = false;
                this._updateLibraryCustomizeExpiryPill();
                return;
            }
            this._libraryRankingUseCleanVideo = hasCleanMaster;
            this._libraryRankingTimelineState = state;
            this.mountLibraryRankingOverlay(container, state);
            this._updateLibraryCustomizeExpiryPill();
        } catch (err) {
            safeLog('Ranking edit state failed:', err);
        }
    }

    mountLibraryRankingOverlay(container, state) {
        if (!container) return;
        // Don't double-mount
        if (container.querySelector('.ranking-preview-container.library-ranking-layer')) return;

        const html = this.generateTemplatePreviewHTML({ id: 'ranked_compilation', type: 'ranked_compilation' });
        const wrap = document.createElement('div');
        wrap.innerHTML = html;
        const rankingRoot = wrap.querySelector('.ranking-preview-container');
        if (!rankingRoot) return;

        rankingRoot.classList.add('library-ranking-layer');
        container.appendChild(rankingRoot);
        const styleEl = wrap.querySelector('style');
        if (styleEl) {
            styleEl.setAttribute('data-ranking-library', '1');
            const old = container.querySelector('style[data-ranking-library]');
            if (old) old.replaceWith(styleEl);
            else container.appendChild(styleEl);
        }

        container.classList.add('library-ranking-edit');
        const video = container.querySelector('video.library-preview-video');
        if (video) {
            video.controls = false;
            video.style.pointerEvents = 'none';
            // Keep full compilation under editable overlay (base concat on deferred path)
        }

        this._libraryRankingEditable = true;
        this._libraryRankingDirty = false;
        // Needs burn only when overlays/captions were actually deferred — not when
        // captions_deferred was a stale always-true flag that forced recompose.
        this._libraryRankingNeedsBurn = Boolean(
            state.burn_deferred
            || !state.overlay_burned
            || (state.captions_deferred && state.subtitles_enabled)
        );
        this._libraryRankingChannel = state.channel_name || state.overlay_subject || 'CHANNEL';
        this._libraryRankingBaseDurations = state.base_durations || {};
        this._libraryRankingMoments = Array.isArray(state.moments) ? state.moments : [];
        this._libraryRankingCaptionStyle = state.caption_style || null;
        this._libraryRankingSubtitlesOn = Boolean(state.subtitles_enabled);
        const seededOrder = Array.isArray(state.clip_order) && state.clip_order.length >= 3
            ? state.clip_order.map((r) => Math.max(1, Math.min(5, Number(r) || 0))).filter(Boolean)
            : [5, 4, 3, 2, 1];
        this._libraryRankingClipOrder = seededOrder.slice();
        this._libraryRankingClipOrderPrev = seededOrder.slice();
        this._libraryRankingTitleByPhysical = {};
        (this._libraryRankingMoments || []).forEach((m) => {
            const r = Number(m?.rank);
            if (r >= 1 && r <= 5 && m?.title) {
                this._libraryRankingTitleByPhysical[r] = String(m.title).trim();
            }
        });
        try { PreviewTimeline.setClipOrder?.(seededOrder); } catch (_) { /* ignore */ }

        // Ranking uses its own text editor — hide freeform T tool
        const textBtn = document.getElementById('previewEditorPill')?.querySelector('[data-tool="text"]');
        if (textBtn) textBtn.style.display = 'none';
        if (typeof window.activatePreviewToolbar === 'function') {
            const animBtn = document.getElementById('previewEditorPill')?.querySelector('[data-tool="animations"]');
            if (animBtn) window.activatePreviewToolbar(animBtn);
        }

            // Apply saved customizations + channel line + AI titles
            const customs = state.ranking_customizations || {};
            // Merge AI pack headers into customs before first paint so RANKING/BEST
            // never flash / stick when the pack already landed on the server.
            const pack = (state.ai_text_pack && typeof state.ai_text_pack === 'object')
                ? state.ai_text_pack
                : {};
            const mergePackContent = (eid, value) => {
                const v = String(value || '').trim();
                if (!v) return;
                const node = (customs[eid] && typeof customs[eid] === 'object')
                    ? { ...customs[eid] }
                    : {};
                const cur = String(node.content || '').trim();
                const classic = !cur
                    || /^(ranking|best|funniest|channel moments)$/i.test(cur);
                if (classic) {
                    node.content = v;
                    customs[eid] = node;
                }
            };
            mergePackContent('title_ranking', pack.header_line1);
            mergePackContent('title_funniest', pack.header_line2);
            mergePackContent('title_channel', pack.header_line3);
            if (Array.isArray(pack.moments)) {
                pack.moments.forEach((m) => {
                    const r = Number(m?.rank);
                    if (r >= 1 && r <= 5) {
                        mergePackContent(`rank_${r}_title`, m.title || m.text);
                    }
                });
            }
            if (window.rankingCustomizer) {
                window.rankingCustomizer.customizations = JSON.parse(JSON.stringify(customs));
                setTimeout(() => {
                    try {
                        if (typeof window.initializeRankingTemplateEditor === 'function') {
                            window.initializeRankingTemplateEditor();
                        }
                        // Styles first (fonts/colors), then AI titles — never blank after apply
                        window.rankingCustomizer.applyCustomizations();
                        this.seedLibraryRankingAiTexts(container, state, customs);
                        // Re-apply fonts after seed so template CSS can't win
                        window.rankingCustomizer.applyCustomizations();
                    } catch (err) {
                        safeLog('Library ranking customizer init failed:', err);
                    }
                }, 40);
            } else {
                setTimeout(() => {
                    try { this.seedLibraryRankingAiTexts(container, state, customs); } catch (_) {}
                }, 40);
            }

        // Seed 5 timeline segments from base clip durations (moveable bounds)
        this.seedLibraryRankingTimelineSplits(state);
        // CapCut-style: always show draggable handles + force filmstrip thumbnails
        try {
            const shell = document.getElementById('previewTimelineShell');
            if (shell) {
                shell.classList.add('is-ranking-edit', 'handles-on');
            }
            if (typeof PreviewTimeline !== 'undefined') {
                if (typeof PreviewTimeline.setRankingEditMode === 'function') {
                    PreviewTimeline.setRankingEditMode(true);
                }
                if (typeof PreviewTimeline.setHandlesUnlocked === 'function') {
                    PreviewTimeline.setHandlesUnlocked(true);
                }
                if (typeof PreviewTimeline.scheduleFilmstripBuild === 'function') {
                    PreviewTimeline.scheduleFilmstripBuild(120);
                    PreviewTimeline.scheduleFilmstripBuild(700);
                    PreviewTimeline.scheduleFilmstripBuild(1600);
                } else if (typeof PreviewTimeline.rebuild === 'function') {
                    PreviewTimeline.rebuild();
                }
            }
        } catch (_) { /* ignore */ }

        // Presets tool available for ranking library edits
        const animBtn = document.querySelector('#previewEditorPill [data-tool="animations"]');
        if (animBtn) animBtn.style.display = '';

        // Seed live caption overlay only when burn is deferred (flat video has no burned captions)
        try {
            if (this._libraryRankingSubtitlesOn && this._libraryRankingNeedsBurn) {
                const capStyle = this._libraryRankingCaptionStyle || {
                    anim: 'static', font: 'Montserrat', color: '#ffffff',
                    shadow: 'none', font_size: 70, font_size_ratio: 70 / 1920, y_pct: 0.80, enabled: true,
                };
                const previewText = String(
                    state.caption_preview_text
                    || (typeof capStyle.preview_text === 'string' ? capStyle.preview_text : '')
                    || ''
                ).trim();
                if (typeof window.setLiveCaptionTimedWords === 'function') {
                    window.setLiveCaptionTimedWords(state.caption_preview_words || []);
                }
                if (typeof window.applySubtitleStyle === 'function') {
                    window.applySubtitleStyle(capStyle, {
                        selectAfter: false,
                        applyFill: true,
                        playAnim: false,
                        markSuggest: true,
                        softClamp: true,
                        previewText: previewText || null,
                    });
                }
                requestAnimationFrame(() => {
                    const prev = document.getElementById('templateVideoPreview');
                    const cap = prev?.querySelector('.sub-text-block:not(.overlay-text-block)');
                    if (cap && typeof window.markSubtitleSuggest === 'function') {
                        window.markSubtitleSuggest(cap);
                    }
                });
            }
        } catch (capErr) {
            safeLog('Library ranking caption seed skipped:', capErr);
        }

        const markDirty = () => {
            if (!this.currentTemplateForPreview?.isLibraryPreview) return;
            if (!this._libraryRankingEditable) return;
            if (this._libraryDirtyArmed === false) return;
            this._libraryRankingDirty = true;
            if (typeof window.syncLibraryConfirmLabel === 'function') {
                window.syncLibraryConfirmLabel();
            } else {
                const btn = document.getElementById('confirmUseTemplateBtn');
                if (btn) {
                    btn.textContent = 'Apply & Download';
                    btn.classList.add('library-download-mode');
                }
                if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
            }
        };

        container.addEventListener('input', markDirty, true);
        container.addEventListener('mouseup', () => {
            if (!this._libraryRankingEditable) return;
            if (window.rankingCustomizer && typeof window.rankingCustomizer.syncFromDOM === 'function') {
                try {
                    const before = JSON.stringify(window.rankingCustomizer.customizations || {});
                    window.rankingCustomizer.syncFromDOM();
                    const after = JSON.stringify(window.rankingCustomizer.customizations || {});
                    if (before !== after) markDirty();
                } catch (_) {}
            }
        }, true);

        // Timeline segment drags count as ranking edits
        const shell = document.getElementById('previewTimelineShell');
        if (shell && !shell.dataset.rankingBound) {
            shell.dataset.rankingBound = '1';
            shell.addEventListener('pointerup', () => {
                if (!this._libraryRankingEditable) return;
                // Only dirty when splits actually moved (seeded bounds alone don't count)
                if (typeof PreviewTimeline !== 'undefined' && PreviewTimeline._rankingTouched) {
                    markDirty();
                    PreviewTimeline._rankingTouched = false;
                }
            });
        }
    }

    /**
     * Seed RANKING / BEST / CHANNEL + per-rank AI titles into the phone overlay
     * so users can edit immediately (not only after Apply/recompose).
     * Rank titles are stored for countdown reveal — only the active segment shows.
     */
    seedLibraryRankingAiTexts(container, state, customs) {
        if (!container) return;
        const root = container.querySelector?.('.ranking-preview-container') || container;
        const pack = (state && state.ai_text_pack && typeof state.ai_text_pack === 'object')
            ? state.ai_text_pack
            : {};
        const customsMap = customs && typeof customs === 'object' ? customs : {};
        const moments = Array.isArray(state?.moments) ? state.moments : (this._libraryRankingMoments || []);
        const packMoments = Array.isArray(pack.moments) ? pack.moments : [];
        const byRank = (rows = []) => {
            const out = new Map();
            rows.forEach((row) => {
                const rank = Number(row?.rank);
                if (rank >= 1 && rank <= 5 && !out.has(rank)) out.set(rank, row);
            });
            return out;
        };
        const packByRank = byRank(packMoments);
        const momentsByRank = byRank(moments);

        const normalizeOverlayText = (value, maxLen = 80) => String(value || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLen);

        const isClassicPlaceholder = (value) => {
            const t = String(value || '').replace(/\s+/g, ' ').trim();
            if (!t) return true;
            if (/^add title/i.test(t)) return true;
            if (t === '…' || t === '...') return true;
            // Template defaults before AI pack lands
            if (/^(ranking|best|funniest)$/i.test(t)) return true;
            if (/^channel(\s+moments?)?$/i.test(t)) return true;
            if (/^.+\s+moments$/i.test(t) && t.length <= 24) {
                // Short "X MOMENTS" from template channel line — treat as fillable
                // only when we have a stronger AI header_line3
                return false;
            }
            return false;
        };

        const setHeaderText = (id, preferred, { force = false } = {}) => {
            const el = root.querySelector(`[data-template-element-id="${id}"]`);
            if (!el) return;
            const saved = customsMap[id]?.content;
            const savedTrim = saved != null ? String(saved).trim() : '';
            const packVal = normalizeOverlayText(preferred, id.startsWith('title_') ? 32 : 48);
            // Prefer real user/AI saved content; classic RANKING/BEST never blocks the pack
            const keepSaved = savedTrim && !isClassicPlaceholder(savedTrim) && !force;
            const next = keepSaved
                ? normalizeOverlayText(savedTrim, id.startsWith('title_') ? 32 : 48)
                : packVal;
            if (!next) return;
            el.textContent = next;
            el.classList.remove('rk-title-empty');
            el.removeAttribute('data-placeholder');
            if (window.rankingCustomizer?.customizations) {
                window.rankingCustomizer.customizations[id] = {
                    ...(window.rankingCustomizer.customizations[id] || {}),
                    content: next,
                };
            }
        };

        const h1 = String(pack.header_line1 || '').trim();
        const h2 = String(pack.header_line2 || '').trim();
        const h3 = String(pack.header_line3 || '').trim();
        if (h1) setHeaderText('title_ranking', h1);
        else setHeaderText('title_ranking', 'RANKING');
        if (h2) setHeaderText('title_funniest', h2);
        else setHeaderText('title_funniest', 'BEST');

        const channelSubject = String(
            h3
            || this._libraryRankingChannel
            || state?.channel_name
            || state?.overlay_subject
            || 'CHANNEL'
        ).toUpperCase();
        const channelLine = channelSubject.includes('MOMENT')
            ? channelSubject
            : `${channelSubject.replace(/\s+MOMENTS?$/i, '')} MOMENTS`.replace(/\s+/g, ' ').trim();
        // Always prefer AI header_line3 when present
        setHeaderText('title_channel', h3 ? channelLine : channelLine, { force: !!h3 });

        const titleByRank = {};
        for (let rank = 1; rank <= 5; rank++) {
            const fromPack = packByRank.get(rank);
            const fromMoment = momentsByRank.get(rank);
            const liveTitle = String(
                window.rankingCustomizer?.customizations?.[`rank_${rank}_title`]?.content || '',
            ).trim();
            const savedRaw = liveTitle
                || String(customsMap[`rank_${rank}_title`]?.content || '').trim();
            const savedTitle = (savedRaw && !isClassicPlaceholder(savedRaw)) ? savedRaw : '';
            const title = normalizeOverlayText(
                savedTitle
                || fromPack?.title
                || fromPack?.text
                || fromMoment?.title
                || fromMoment?.text
                || '',
                48,
            );
            titleByRank[rank] = title;
            // Keep customizer payload complete for Apply/burn
            if (title && window.rankingCustomizer?.customizations) {
                const node = {
                    ...(window.rankingCustomizer.customizations[`rank_${rank}_title`] || {}),
                    content: title,
                };
                window.rankingCustomizer.customizations[`rank_${rank}_title`] = node;
            }
            const el = root.querySelector(`[data-template-element-id="rank_${rank}_title"]`);
            if (el) {
                el.setAttribute('data-rk-full-title', title || '');
                if (title) {
                    // Show AI / saved titles immediately — editable on double-click
                    el.textContent = title;
                    el.classList.remove('rk-title-empty');
                    el.removeAttribute('data-placeholder');
                } else {
                    el.textContent = '';
                    el.classList.add('rk-title-empty');
                    el.setAttribute('data-placeholder', 'Add title…');
                }
            }
        }
        this._libraryRankingTitleByRank = titleByRank;
        this._libraryRankingRevealState = state;

        // Keep all 5 rank titles (+ numbers) on one shared font so AI fills match
        try {
            this.unifyLibraryRankingFonts(root);
        } catch (_) { /* ignore */ }

        // Library edit: keep all titles visible (don't blank for countdown)
        this.wireLibraryRankingCountdownReveal(container, state);
    }

    /**
     * Force rank numbers + titles onto one font (user/AI pick — never invent Luckiest Guy).
     */
    unifyLibraryRankingFonts(root) {
        if (!root) return;
        const customs = window.rankingCustomizer?.customizations || {};
        const fontLock = (() => {
            try {
                return window.rankingCustomizer?._readFontLock?.()
                    || JSON.parse(sessionStorage.getItem('solisRankingFontLock') || '{}')
                    || {};
            } catch (_) {
                return {};
            }
        })();
        let shared = null;
        for (let rank = 1; rank <= 5; rank++) {
            const fromDom = root.querySelector(`[data-template-element-id="rank_${rank}_title"]`)
                ?.getAttribute('data-rk-font');
            const fromLock = fontLock[`rank_${rank}_title`] || fontLock[`rank_${rank}_number`];
            const rawFont = customs[`rank_${rank}_title`]?.font
                || customs[`rank_${rank}_number`]?.font
                || fromLock;
            if (fromDom) {
                shared = fromDom;
                break;
            }
            if (rawFont && window.rankingCustomizer?._displayFont) {
                shared = window.rankingCustomizer._displayFont(rawFont);
                break;
            }
            if (typeof rawFont === 'string' && rawFont && !/\.ttf|\.otf|\.woff/i.test(rawFont)) {
                shared = rawFont;
                break;
            }
        }
        if (!shared) {
            // Leave elements alone — do not stamp Luckiest Guy over AI/user fonts
            return;
        }
        const stack = shared === 'Luckiest Guy'
            ? `'Luckiest Guy', cursive`
            : `'${shared}', sans-serif`;
        const weightMap = {
            Fredoka: '700', Montserrat: '700', 'Bebas Neue': '400', Anton: '400',
            'Luckiest Guy': '400', Poppins: '600', Roboto: '700',
        };
        const weight = weightMap[shared] || '400';

        for (let rank = 1; rank <= 5; rank++) {
            for (const kind of ['title', 'number']) {
                const eid = `rank_${rank}_${kind}`;
                const el = root.querySelector(`[data-template-element-id="${eid}"]`);
                if (!el) continue;
                el.style.setProperty('font-family', stack, 'important');
                el.style.setProperty('font-weight', weight, 'important');
                el.setAttribute('data-rk-font', shared);
                if (window.rankingCustomizer?.setElementFontFile) {
                    window.rankingCustomizer.setElementFontFile(eid, shared);
                }
            }
        }
    }

    /**
     * Mark the active countdown rank while editing.
     * Titles stay visible with AI/saved text — blank "Add title…" only when empty.
     */
    wireLibraryRankingCountdownReveal(container, state) {
        if (!container) return;
        const root = container.querySelector?.('.ranking-preview-container') || container;
        const video = container.querySelector('video.library-preview-video')
            || container.querySelector('video');
        if (!video || !root) return;

        const segments = (() => {
            const raw = state?.ranking_timeline?.segments;
            if (Array.isArray(raw) && raw.length) {
                return raw
                    .slice()
                    .sort((a, b) => Number(a?.output_start || 0) - Number(b?.output_start || 0))
                    .map((s) => ({
                        rank: Number(s.rank),
                        start: Number(s.output_start) || 0,
                        end: Number(s.output_end) || 0,
                    }))
                    .filter((s) => s.rank >= 1 && s.rank <= 5 && s.end > s.start);
            }
            // Fallback from clip_windows / base durations in countdown order
            const durs = [];
            const cw = state?.clip_windows;
            const base = state?.base_durations || this._libraryRankingBaseDurations || {};
            for (let rank = 5; rank >= 1; rank--) {
                let d = 0;
                const w = cw?.[String(rank)] || cw?.[rank];
                if (w) {
                    d = Number(w.duration);
                    if (!(d > 0) && w.start != null && w.end != null) {
                        d = Number(w.end) - Number(w.start);
                    }
                }
                if (!(d > 0)) d = Number(base[String(rank)] || base[rank] || 0);
                if (d > 0) durs.push({ rank, duration: d });
            }
            let acc = 0;
            return durs.map(({ rank, duration }) => {
                const start = acc;
                acc += duration;
                return { rank, start, end: acc };
            });
        })();

        if (!segments.length) return;

        const titles = this._libraryRankingTitleByRank || {};
        let lastActive = null;

        const paintTitle = (el, rank) => {
            // Don't clobber text while the user is typing
            if (el.classList.contains('rk-inline-editing') || el.isContentEditable) return;
            const cur = String(el.textContent || '').trim();
            if (cur && !/^add title/i.test(cur)) {
                el.setAttribute('data-rk-full-title', cur);
                if (this._libraryRankingTitleByRank) {
                    this._libraryRankingTitleByRank[rank] = cur;
                }
                if (window.rankingCustomizer?.customizations) {
                    window.rankingCustomizer.customizations[`rank_${rank}_title`] = {
                        ...(window.rankingCustomizer.customizations[`rank_${rank}_title`] || {}),
                        content: cur,
                    };
                }
            }
            const full = el.getAttribute('data-rk-full-title')
                || titles[rank]
                || cur
                || '';
            if (full && !/^add title/i.test(full)) {
                if (el.textContent !== full) el.textContent = full;
                el.classList.remove('rk-title-empty');
                el.removeAttribute('data-placeholder');
            } else {
                el.textContent = '';
                el.classList.add('rk-title-empty');
                el.setAttribute('data-placeholder', 'Add title…');
            }
        };

        const applyReveal = (force = false) => {
            const t = Number(video.currentTime) || 0;
            let active = segments[0]?.rank ?? 5;
            for (const seg of segments) {
                if (t >= seg.start - 0.02 && t < seg.end - 0.02) {
                    active = seg.rank;
                    break;
                }
                if (t >= seg.end - 0.02) active = seg.rank;
            }
            if (!force && active === lastActive) return;
            lastActive = active;

            for (let rank = 1; rank <= 5; rank++) {
                const el = root.querySelector(`[data-template-element-id="rank_${rank}_title"]`);
                if (!el) continue;
                paintTitle(el, rank);
                el.classList.toggle('rk-title-active', rank === active);
            }
        };

        if (video._rkRevealCleanup) {
            try { video._rkRevealCleanup(); } catch (_) {}
        }
        const onTick = () => applyReveal(false);
        video.addEventListener('timeupdate', onTick);
        video.addEventListener('seeked', onTick);
        video.addEventListener('play', onTick);
        video._rkRevealCleanup = () => {
            video.removeEventListener('timeupdate', onTick);
            video.removeEventListener('seeked', onTick);
            video.removeEventListener('play', onTick);
            delete video._rkRevealCleanup;
        };
        applyReveal(true);
    }

    seedLibraryRankingTimelineSplits(state) {
        if (typeof PreviewTimeline === 'undefined' || !PreviewTimeline.setSplits) return;

        const splitsFromTimeline = () => {
            const segments = state?.ranking_timeline?.segments;
            if (!Array.isArray(segments) || segments.length < 2) return [];
            const ordered = segments
                .slice()
                .sort((a, b) => Number(a?.output_start || 0) - Number(b?.output_start || 0));
            const cuts = [];
            for (let i = 0; i < ordered.length - 1 && cuts.length < 4; i++) {
                const end = Number(ordered[i]?.output_end);
                if (Number.isFinite(end) && end > 0.05) cuts.push(end);
            }
            return cuts;
        };

        const durations = [];
        const order = Array.isArray(state?.clip_order) && state.clip_order.length >= 3
            ? state.clip_order.map((r) => Math.max(1, Math.min(5, Number(r) || 0))).filter(Boolean)
            : [5, 4, 3, 2, 1];
        const cw = state?.clip_windows;
        // Lengths follow playlist order (physical bases left→right)
        if (cw && typeof cw === 'object' && !Array.isArray(cw)) {
            for (const rank of order) {
                const w = cw[String(rank)] || cw[rank];
                if (!w) continue;
                let d = Number(w.duration);
                if (!(d > 0) && w.start != null && w.end != null) {
                    d = Number(w.end) - Number(w.start);
                }
                if (d > 0) durations.push(d);
            }
        }

        if (durations.length < 2) {
            const baseDur = state?.base_durations || this._libraryRankingBaseDurations || {};
            const moments = (state?.moments || this._libraryRankingMoments || [])
                .slice()
                .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));
            for (const rank of order) {
                let d = Number(baseDur[String(rank)] || baseDur[rank] || 0);
                if (!(d > 0)) {
                    const m = moments.find((x) => Number(x.rank) === rank);
                    if (m) {
                        d = Number(m.duration);
                        if (!(d > 0) && m.start != null && m.end != null) {
                            d = Number(m.end) - Number(m.start);
                        }
                    }
                }
                if (d > 0) durations.push(d);
            }
        }

        const applySeed = () => {
            try {
                if (typeof PreviewTimeline.show === 'function') PreviewTimeline.show();
                if (typeof PreviewTimeline.attach === 'function') {
                    const v = document.querySelector('#templateVideoPreview video')
                        || document.getElementById('previewVideo');
                    if (v) PreviewTimeline.attach(v);
                }
                PreviewTimeline.setClipOrder?.(order);
            } catch (_) { /* ignore */ }

            const timelineCuts = splitsFromTimeline();
            if (timelineCuts.length) {
                PreviewTimeline.setSplits(timelineCuts);
                return;
            }

            const trim = PreviewTimeline.getTrim?.();
            const total = Number(trim?.duration) || 0;
            if (!(total > 0) || durations.length < 2) {
                if (total > 0) {
                    PreviewTimeline.setSplits([
                        total * 0.2, total * 0.4, total * 0.6, total * 0.8,
                    ]);
                }
                return;
            }
            const sum = durations.reduce((a, b) => a + b, 0) || 1;
            const scale = total / sum;
            const splits = [];
            let acc = 0;
            for (let i = 0; i < durations.length - 1 && splits.length < 4; i++) {
                acc += durations[i] * scale;
                if (acc > 0.05 && acc < total - 0.05) splits.push(acc);
            }
            if (splits.length) PreviewTimeline.setSplits(splits);
        };
        applySeed();
        setTimeout(applySeed, 250);
        setTimeout(applySeed, 800);
        setTimeout(applySeed, 1600);
        setTimeout(applySeed, 3000);
    }

    collectLibraryRankingClipWindows() {
        const baseDur = this._libraryRankingBaseDurations || {};
        const bounds = (typeof PreviewTimeline !== 'undefined' && PreviewTimeline.getSegmentBounds)
            ? PreviewTimeline.getSegmentBounds()
            : [];
        if (!bounds || bounds.length < 2) return {};

        const order = (typeof PreviewTimeline !== 'undefined' && PreviewTimeline.getClipOrder)
            ? PreviewTimeline.getClipOrder()
            : [5, 4, 3, 2, 1];
        const windows = {};
        const segCount = Math.min(5, bounds.length - 1);
        // Master plays left→right; order[i] is the physical base at that slot
        for (let i = 0; i < segCount; i++) {
            const rank = order[i] || (5 - i);
            const orig = Number(baseDur[String(rank)] || baseDur[rank] || 0);
            const segLen = Math.max(1.5, Number(bounds[i + 1]) - Number(bounds[i]));
            if (!(orig > 0)) {
                windows[String(rank)] = { start: 0, end: segLen };
                continue;
            }
            if (segLen >= orig - 0.08) {
                windows[String(rank)] = { start: 0, end: orig };
            } else {
                const start = Math.max(0, (orig - segLen) / 2);
                windows[String(rank)] = { start, end: start + segLen };
            }
        }
        return windows;
    }

    /**
     * Timeline hold-drag reordered clips — remap titles so content follows the
     * physical base while display ranks (#5→#1) stay left-to-right.
     */
    onRankingClipReorder(order) {
        if (!Array.isArray(order) || !order.length) return;
        this._libraryRankingClipOrder = order.slice();
        const root = document.querySelector(
            '#templateVideoPreview .ranking-preview-container, .ranking-preview-container'
        );
        if (!root) return;

        // Snapshot content keyed by previous physical→display mapping
        const prevOrder = this._libraryRankingClipOrderPrev || [5, 4, 3, 2, 1];
        const contentByPhysical = {};
        for (let i = 0; i < 5; i++) {
            const displayRank = 5 - i;
            const physical = prevOrder[i] || displayRank;
            const el = root.querySelector(`[data-template-element-id="rank_${displayRank}_title"]`);
            const text = (el?.getAttribute('data-rk-full-title')
                || el?.textContent
                || this._libraryRankingTitleByRank?.[displayRank]
                || '').trim();
            contentByPhysical[physical] = text;
            if (this._libraryRankingTitleByPhysical == null) this._libraryRankingTitleByPhysical = {};
            if (text) this._libraryRankingTitleByPhysical[physical] = text;
        }
        // Prefer accumulated physical titles
        const byPhysical = { ...(this._libraryRankingTitleByPhysical || {}), ...contentByPhysical };

        for (let i = 0; i < order.length; i++) {
            const displayRank = 5 - i;
            const physical = order[i];
            const title = byPhysical[physical] || '';
            const el = root.querySelector(`[data-template-element-id="rank_${displayRank}_title"]`);
            if (el) {
                if (title && !/^add title/i.test(title)) {
                    el.textContent = title;
                    el.setAttribute('data-rk-full-title', title);
                    el.classList.remove('rk-title-empty');
                    el.removeAttribute('data-placeholder');
                }
            }
            if (this._libraryRankingTitleByRank) {
                this._libraryRankingTitleByRank[displayRank] = title;
            }
            if (window.rankingCustomizer?.customizations) {
                const eid = `rank_${displayRank}_title`;
                window.rankingCustomizer.customizations[eid] = {
                    ...(window.rankingCustomizer.customizations[eid] || {}),
                    content: title,
                };
            }
        }
        this._libraryRankingClipOrderPrev = order.slice();
        this._libraryRankingDirty = true;
    }

    async saveLibraryRankingCustomizations(projectId) {
        // Flush countdown-hidden titles back into customs before sync
        try {
            const root = document.querySelector('#templateVideoPreview .ranking-preview-container');
            if (root && window.rankingCustomizer) {
                if (!window.rankingCustomizer.customizations) {
                    window.rankingCustomizer.customizations = {};
                }
                for (let rank = 1; rank <= 5; rank++) {
                    const el = root.querySelector(`[data-template-element-id="rank_${rank}_title"]`);
                    const full = el?.getAttribute('data-rk-full-title')
                        || this._libraryRankingTitleByRank?.[rank]
                        || '';
                    if (full) {
                        window.rankingCustomizer.customizations[`rank_${rank}_title`] = {
                            ...(window.rankingCustomizer.customizations[`rank_${rank}_title`] || {}),
                            content: String(full).trim(),
                        };
                    }
                }
                // Persist stack drag layout
                if (window.__solisRankingLayout) {
                    window.rankingCustomizer.customizations.__ranking_layout = {
                        ...(window.rankingCustomizer.customizations.__ranking_layout || {}),
                        ...window.__solisRankingLayout,
                    };
                }
            }
        } catch (_) { /* ignore */ }

        if (window.rankingCustomizer?.syncFromDOM) {
            try { window.rankingCustomizer.syncFromDOM(); } catch (_) {}
        }
        const customs = (window.rankingCustomizer?.collectCustomizations?.() || {});
        const clipWindows = this.collectLibraryRankingClipWindows();
        const clipOrder = (typeof PreviewTimeline !== 'undefined' && PreviewTimeline.getClipOrder)
            ? PreviewTimeline.getClipOrder()
            : (this._libraryRankingClipOrder || null);

        let captionStyle = null;
        try {
            if (typeof window.collectSubtitleStyle === 'function') {
                captionStyle = window.collectSubtitleStyle();
            }
        } catch (_) {}
        if (!captionStyle) {
            captionStyle = this._libraryRankingCaptionStyle
                || window.__solisLastCaptionStyle
                || null;
        }
        const subtitlesEnabled = Boolean(
            this._libraryRankingSubtitlesOn
        );

        const response = await fetch(
            `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/ranking/recompose`,
            {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    ranking_customizations: customs,
                    channel_name: this._libraryRankingChannel || undefined,
                    clip_windows: clipWindows,
                    clip_order: clipOrder || undefined,
                    caption_style: captionStyle || undefined,
                    subtitles_enabled: subtitlesEnabled,
                    silence_cuts: (() => {
                        try {
                            const cuts = (typeof window.SolisSilencer?.getCuts === 'function')
                                ? window.SolisSilencer.getCuts()
                                : (this._librarySilenceCuts || []);
                            return Array.isArray(cuts) && cuts.length
                                ? cuts.map((r) => ({
                                    start: Number(Number(r.start).toFixed(3)),
                                    end: Number(Number(r.end).toFixed(3)),
                                }))
                                : undefined;
                        } catch (_) {
                            return undefined;
                        }
                    })(),
                }),
            },
        );
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw this._libraryApplyError(err, response.status, 'Ranking recompose failed');
        }
        const okBody = await response.json().catch(() => ({}));
        this._libraryRankingDirty = false;
        this._libraryRankingNeedsBurn = false;
        this._librarySilenceDirty = false;
        this._librarySilenceCuts = [];
        try { window.SolisSilencer?.reset?.(); } catch (_) { /* ignore */ }
        try { window.SolisImproveClip?.reset?.(); } catch (_) { /* ignore */ }
        try { window.LibraryPreviewMediaCache?.invalidateProject?.(projectId); } catch (_) { /* ignore */ }
        try { await this.refreshQuotaAfterApply(okBody); } catch (_) { /* ignore */ }
    }

    async refreshQuotaAfterApply(payload) {
        try { window._subCache?.invalidate?.(); } catch (_) { /* ignore */ }
        try {
            if (typeof loadTierInfo === 'function') await loadTierInfo();
        } catch (_) { /* ignore */ }
        try {
            if (typeof this.loadAndDisplayStorageInfo === 'function') {
                await this.loadAndDisplayStorageInfo();
            }
        } catch (_) { /* ignore */ }
        const daily = payload?.daily;
        if (daily && daily.used != null && daily.limit != null) {
            try {
                showNotification(
                    `Apply counted as 1 upload (${daily.used}/${daily.limit} today).`,
                    'info',
                );
            } catch (_) { /* ignore */ }
        }
    }

    _libraryApplyError(err, status, fallback) {
        const code = err?.error_code || '';
        if (code === 'CUSTOMIZE_EXPIRED') {
            return new Error(err.error || 'Customization window expired for this project.');
        }
        if (code === 'DAILY_LIMIT_REACHED' || code === 'MONTHLY_LIMIT_REACHED' || status === 429) {
            return new Error(
                err.error
                || 'Applying changes uses 1 daily upload — daily limit reached. Try again after reset, or upgrade.',
            );
        }
        return new Error(err?.error || `${fallback} (${status})`);
    }
    async fetchSecureLibraryPreviewBlob(container, projectId, existingVideo = null, opts = {}) {
        const loadGen = opts.loadGen != null ? opts.loadGen : ++this._libraryPreviewLoadGen;
        const attempt = Math.max(0, Number(opts.attempt) || 0);
        const justFinished = Boolean(
            (this.libraryItems || []).some((item) => {
                const id = String(item.projectId || item.id || '');
                return id === String(projectId) && (item._justCompleted || item._optimistic);
            })
        );
        const maxAttempts = opts.clean ? 3 : (justFinished ? 18 : 5);
        const useClean = !!opts.clean;

        if (this._libraryPreviewFetchController) {
            this._libraryPreviewFetchController.abort();
            this._libraryPreviewFetchController = null;
        }
        const controller = new AbortController();
        this._libraryPreviewFetchController = controller;

        const isStale = () => (
            loadGen !== this._libraryPreviewLoadGen
            || !this.libraryPreviewModalOpen
            || (this._libraryPreviewProjectId && String(this._libraryPreviewProjectId) !== String(projectId))
        );

        const giveUp = (reason) => {
            if (isStale()) return;
            if (!useClean && !opts.cleanFallbackTried) {
                safeLog('Preview burned path failed — trying clean master');
                this.fetchSecureLibraryPreviewBlob(container, projectId, null, {
                    loadGen,
                    attempt: 0,
                    clean: true,
                    cleanFallbackTried: true,
                });
                return;
            }
            // Clean path failed (common right after ranking fast-path gen) — try deliverable
            if (useClean && !opts.burnedFallbackTried) {
                safeLog('Preview clean path failed — trying final master');
                this.fetchSecureLibraryPreviewBlob(container, projectId, null, {
                    loadGen,
                    attempt: 0,
                    clean: false,
                    burnedFallbackTried: true,
                    cleanFallbackTried: true,
                });
                return;
            }
            safeLog('Preview load gave up:', reason);
            this._libraryPreviewFailedId = String(projectId);
            this._showLibraryPreviewError(container, 'Could not load video preview', projectId);
        };

        const retrySoon = (reason) => {
            if (isStale()) return;
            if (String(this._libraryPreviewFailedId) === String(projectId)) return;
            if (attempt + 1 >= maxAttempts) {
                giveUp(reason);
                return;
            }
            const delay = justFinished
                ? Math.min(8000, 1500 + attempt * 1500)
                : Math.min(4000, 900 + attempt * 900);
            safeLog(`Preview not ready (${reason}) — retry ${attempt + 1}/${maxAttempts} in ${delay}ms`);
            if (attempt === 0 && !container.querySelector('video')) {
                this._setLibraryPreviewPlaceholder(container);
            }
            if (this._libraryPreviewRetryTimer) {
                clearTimeout(this._libraryPreviewRetryTimer);
            }
            this._libraryPreviewRetryTimer = setTimeout(() => {
                this._libraryPreviewRetryTimer = null;
                if (isStale()) return;
                this.fetchSecureLibraryPreviewBlob(container, projectId, null, {
                    loadGen,
                    attempt: attempt + 1,
                    clean: useClean,
                    cleanFallbackTried: !!opts.cleanFallbackTried,
                    burnedFallbackTried: !!opts.burnedFallbackTried,
                });
            }, delay);
        };

        try {
            // Never bust on first attempt — that killed HTTP cache every open.
            // Only bust on retries after decode/stall failures.
            const url = this.getLibraryPreviewVideoUrl(projectId, {
                bust: attempt > 0,
                clean: useClean,
            });

            if (isStale()) return;

            // Cross-origin API: <video src> often won't send auth cookies.
            // Fetch with credentials, then play from a blob URL.
            const res = await fetch(url, {
                credentials: 'include',
                headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {},
                signal: controller.signal,
                cache: attempt > 0 ? 'no-store' : 'force-cache',
            });
            if (isStale()) return;

            if (!res.ok) {
                if (res.status === 404 || res.status === 409 || res.status === 425 || res.status === 202) {
                    retrySoon(`http ${res.status}`);
                    return;
                }
                retrySoon(`http ${res.status}`);
                return;
            }

            const blob = await res.blob();
            if (isStale()) return;
            if (!blob || blob.size < 64) {
                retrySoon('empty blob');
                return;
            }

            const typed = (blob.type && blob.type.startsWith('video/'))
                ? blob
                : new Blob([blob], { type: 'video/mp4' });
            const objectUrl = URL.createObjectURL(typed);
            this._libraryPreviewObjectUrl = objectUrl;
            try {
                window.LibraryPreviewMediaCache?.rememberProject?.(
                    projectId, useClean, typed, objectUrl, url,
                );
            } catch (_) { /* ignore */ }

            this._mountLibraryPreviewFromUrl(container, projectId, objectUrl, {
                loadGen,
                clean: useClean,
            });

            // Retries still need error/stall handling on the live video element
            const video = container.querySelector('video.library-preview-video');
            if (!video) {
                retrySoon('video missing');
                return;
            }

            let failureHandled = false;
            const scheduleRetry = (reason) => {
                if (failureHandled || isStale()) return;
                if (container.classList.contains('has-video') && video.videoWidth > 0) return;
                failureHandled = true;
                retrySoon(reason);
            };
            video.addEventListener('error', () => {
                scheduleRetry('video decode error');
            }, { once: true });
            setTimeout(() => {
                if (!container.classList.contains('has-video')) {
                    scheduleRetry('video stall');
                }
            }, 9000);
        } catch (error) {
            if (error?.name === 'AbortError') return;
            if (isStale()) return;
            safeLog('Error loading secure preview:', error);
            retrySoon(error?.message || 'fetch error');
        } finally {
            if (this._libraryPreviewFetchController === controller) {
                this._libraryPreviewFetchController = null;
            }
        }
    }

    async _warmLibraryPreviewCache(projectId, url, clean = false) {
        if (!projectId || !url || !window.LibraryPreviewMediaCache) return;
        if (window.LibraryPreviewMediaCache.has(projectId, clean)) return;
        // Prefer an already-cloned filmstrip blob if present
        const bySrc = window.LibraryPreviewMediaCache.getBySrc(url);
        if (bySrc?.blob && bySrc?.objectUrl) {
            window.LibraryPreviewMediaCache.rememberProject(
                projectId, clean, bySrc.blob, bySrc.objectUrl, url,
            );
            this._libraryPreviewObjectUrl = bySrc.objectUrl;
            return;
        }
        try {
            const res = await fetch(url, { credentials: 'include', cache: 'force-cache' });
            if (!res.ok) return;
            const blob = await res.blob();
            if (!blob.size || blob.size > 90 * 1024 * 1024) return;
            const typed = blob.type ? blob : new Blob([blob], { type: 'video/mp4' });
            const objectUrl = URL.createObjectURL(typed);
            window.LibraryPreviewMediaCache.rememberProject(
                projectId, clean, typed, objectUrl, url,
            );
            this._libraryPreviewObjectUrl = objectUrl;
        } catch (_) { /* ignore */ }
    }

    async fetchSecureLibraryPreview(container, projectId) {
        this.mountLibraryPreviewVideo(container, projectId);
    }

    _hidePreviewViralityRail() {
        const rail = document.getElementById('previewViralityRail');
        if (!rail) return;
        rail.hidden = true;
        rail.innerHTML = '';
    }

    _setTipPublishMode(isLibrary) {
        const create = document.getElementById('tipCreateBlock');
        const publish = document.getElementById('tipPublishBlock');
        const panel = document.getElementById('templateInfoPanel');
        if (create) create.hidden = !!isLibrary;
        if (publish) publish.hidden = !isLibrary;
        if (panel) panel.classList.toggle('is-publish', !!isLibrary);
        if (!isLibrary) {
            this._hidePreviewViralityRail();
            const whyBtn = document.getElementById('tipScoreWhyBtn');
            const whyEl = document.getElementById('tipScoreWhy');
            if (whyEl) whyEl.hidden = true;
            if (whyBtn) whyBtn.setAttribute('aria-expanded', 'false');
        }
    }

    _score10FromVirality(v) {
        if (!v || typeof v !== 'object') return null;
        const ten = v.score_10 != null ? v.score_10 : (v.n != null ? v.n : null);
        if (ten != null && Number.isFinite(Number(ten))) {
            let x = Number(ten);
            if (x > 10) x = x / 10;
            return Math.round(Math.max(0, Math.min(10, x)) * 10) / 10;
        }
        const hundred = v.score_100 != null ? v.score_100
            : (v.n100 != null ? v.n100 : null);
        if (hundred != null && Number.isFinite(Number(hundred))) {
            return Math.round(Math.max(0, Math.min(10, Number(hundred) / 10)) * 10) / 10;
        }
        if (Number(v.score_max) === 100 && v.score != null && Number.isFinite(Number(v.score))) {
            return Math.round(Math.max(0, Math.min(10, Number(v.score) / 10)) * 10) / 10;
        }
        if (v.score != null && Number.isFinite(Number(v.score))) {
            let x = Number(v.score);
            if (x > 10) x = x / 10;
            return Math.round(Math.max(0, Math.min(10, x)) * 10) / 10;
        }
        return null;
    }

    /** @deprecated use _score10FromVirality — kept for any legacy callers */
    _scoreFromVirality(v) {
        const ten = this._score10FromVirality(v);
        return ten == null ? null : Math.round(ten * 10);
    }

    _bandLabel(score10) {
        if (score10 == null || !Number.isFinite(Number(score10))) return '';
        const s = Number(score10);
        if (s >= 8) return 'High potential';
        if (s >= 6) return 'Worth posting';
        if (s >= 4) return 'Average';
        return 'Needs work';
    }

    _formatScore10(score) {
        if (!Number.isFinite(score)) return '—';
        const rounded = Math.round(score * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    _whyFromVirality(v) {
        if (!v || typeof v !== 'object') return '';
        const direct = String(v.why || '').trim();
        if (direct) return direct;
        const bits = [];
        for (const key of ['hook', 'clip', 'subtitles', 'video']) {
            const note = String(v[key]?.note || '').trim();
            if (note) bits.push(note);
            if (bits.length >= 2) break;
        }
        return bits.join(' ').trim();
    }

    _paintSharePack(pack, virality) {
        const scoreEl = document.getElementById('tipScoreNum');
        const labelEl = document.getElementById('tipScoreLabel');
        const whyBtn = document.getElementById('tipScoreWhyBtn');
        const whyEl = document.getElementById('tipScoreWhy');
        const titleEl = document.getElementById('tipShareTitle');
        if (!titleEl) return;

        let score = (pack && pack.score_10 != null)
            ? Number(pack.score_10)
            : this._score10FromVirality(virality);
        // Legacy packs only had score_100
        if (!Number.isFinite(score) && pack && pack.score_100 != null) {
            score = Math.round((Number(pack.score_100) / 10) * 10) / 10;
        }
        // Prefer dimension blend if overall is missing / zero but dims exist
        if ((!Number.isFinite(score) || score <= 0) && virality && typeof virality === 'object') {
            const dims = ['hook', 'clip', 'subtitles', 'video']
                .map((k) => Number(virality[k]?.n))
                .filter((n) => Number.isFinite(n) && n > 0);
            if (dims.length) {
                score = Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) * 10) / 10;
            }
        }
        if (scoreEl) {
            scoreEl.textContent = this._formatScore10(score);
            scoreEl.classList.toggle('is-low', Number.isFinite(score) && score > 0 && score < 6);
            scoreEl.classList.toggle('is-high', Number.isFinite(score) && score >= 8);
            scoreEl.classList.toggle('is-empty', !Number.isFinite(score) || score <= 0);
        }
        if (labelEl) {
            if (!Number.isFinite(score) || score <= 0) {
                labelEl.textContent = 'Scoring…';
            } else {
                labelEl.textContent = (pack && pack.band_label)
                    || this._bandLabel(score);
            }
        }

        const why = String(pack?.why || this._whyFromVirality(virality) || '').trim();
        if (whyBtn && whyEl) {
            whyEl.classList.remove('is-open');
            whyEl.hidden = true;
            whyBtn.setAttribute('aria-expanded', 'false');
            if (why) {
                whyBtn.hidden = false;
                whyEl.hidden = false; // CSS hover controls visibility; keep in DOM
                whyEl.textContent = why;
                if (!whyBtn.dataset.bound) {
                    whyBtn.dataset.bound = '1';
                    const wrap = whyBtn.closest('.tip-score-why-wrap') || whyBtn.parentElement;
                    const show = () => {
                        whyEl.classList.add('is-open');
                        whyBtn.setAttribute('aria-expanded', 'true');
                    };
                    const hide = () => {
                        whyEl.classList.remove('is-open');
                        whyBtn.setAttribute('aria-expanded', 'false');
                    };
                    // Hover dropdown (desktop) + focus (keyboard / touch)
                    if (wrap) {
                        wrap.addEventListener('mouseenter', show);
                        wrap.addEventListener('mouseleave', hide);
                    }
                    whyBtn.addEventListener('focus', show);
                    whyBtn.addEventListener('blur', () => {
                        // Delay so click-inside tooltip doesn't flash
                        setTimeout(() => {
                            if (!wrap?.contains(document.activeElement)) hide();
                        }, 80);
                    });
                    whyBtn.addEventListener('click', (e) => {
                        // Touch / keyboard: toggle; hover already covers desktop
                        e.preventDefault();
                        if (whyEl.classList.contains('is-open')) hide();
                        else show();
                    });
                }
            } else {
                whyBtn.hidden = true;
                whyEl.hidden = true;
                whyEl.textContent = '';
            }
        }

        const title = String(pack?.title || '').trim();
        if (document.activeElement !== titleEl) titleEl.textContent = title;
        this._bindSharePackEditors();
    }

    _bindSharePackEditors() {
        if (this._sharePackBound) return;
        this._sharePackBound = true;
        const titleEl = document.getElementById('tipShareTitle');
        const save = () => this._saveSharePackFromEditors();
        if (!titleEl) return;
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                titleEl.blur();
            }
        });
        titleEl.addEventListener('blur', save);
    }

    async _saveSharePackFromEditors() {
        const projectId = this.currentTemplateForPreview?.projectId;
        if (!projectId) return;
        const titleEl = document.getElementById('tipShareTitle');
        const title = (titleEl?.innerText || '').trim();
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
            const res = await fetch(
                `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/share-pack`,
                {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body: JSON.stringify({ title, hashtags_text: '' }),
                },
            );
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            const pack = data?.share_pack;
            if (pack) {
                const lib = this.libraryItems.find(
                    (x) => String(x.projectId || x.id) === String(projectId)
                );
                if (lib) lib.share_pack = pack;
                if (this.currentTemplateForPreview) {
                    this.currentTemplateForPreview.share_pack = pack;
                }
            }
        } catch (_) { /* ignore */ }
    }

    async _fetchPreviewReportCard(projectId) {
        if (!projectId) return null;
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
            const res = await fetch(
                `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/report-card`,
                { credentials: 'include', headers }
            );
            if (!res.ok) return null;
            return await res.json();
        } catch (_) {
            return null;
        }
    }

    async _renderPreviewViralityRail(item) {
        // Rail retired — publish pack lives in template-info-panel
        this._hidePreviewViralityRail();
        await this._renderPublishPack(item);
    }

    async _renderPublishPack(item) {
        this._setTipPublishMode(true);
        let source = item || {};
        let pack = source.share_pack || null;
        let virality = source.virality || null;
        const pid = source.projectId || source.id;

        const needsScore = !pack || (pack.score_10 == null && pack.score_100 == null);
        if ((needsScore || !(pack && pack.why)) && pid) {
            const fresh = await this._fetchPreviewReportCard(pid);
            if (fresh) {
                if (fresh.virality) virality = fresh.virality;
                if (fresh.share_pack) pack = fresh.share_pack;
                const lib = this.libraryItems.find(
                    (x) => String(x.projectId || x.id) === String(pid)
                );
                if (lib) {
                    if (virality) lib.virality = virality;
                    if (pack) lib.share_pack = pack;
                }
            }
        }

        const score10 = this._score10FromVirality(virality);
        const why = this._whyFromVirality(virality);
        if (!pack) {
            pack = {
                title: source.name || source.video_title || 'You need to see this',
                hashtags: ['#fyp', '#viral', '#shorts'],
                hashtags_text: '#fyp #viral #shorts',
                score_10: score10,
                score_100: score10 == null ? null : Math.round(score10 * 10),
                band_label: this._bandLabel(score10),
                why,
            };
        } else {
            const resolved10 = pack.score_10 != null
                ? Number(pack.score_10)
                : (pack.score_100 != null
                    ? Math.round((Number(pack.score_100) / 10) * 10) / 10
                    : score10);
            pack = {
                ...pack,
                score_10: resolved10,
                score_100: resolved10 == null ? pack.score_100 : Math.round(resolved10 * 10),
                band_label: pack.band_label || this._bandLabel(resolved10),
                why: pack.why || why,
            };
        }

        this._paintSharePack(pack, virality);
    }

    toggleLibraryPreviewLayout(isLibrary) {
        const templateInfoPanel = document.getElementById('templateInfoPanel');
        const libraryInfoPanel = document.getElementById('libraryInfoPanel');
        const durationRow = document.getElementById('previewDurationRow');
        const multiGenCard = document.getElementById('multiGenCard');
        const previewToolbar = document.getElementById('previewEditorPill');
        const textBtn = previewToolbar?.querySelector('[data-tool="text"]');
        const isRanking = this._isCurrentLibraryRanking();
        const visibleToolbarBtns = () => previewToolbar
            ? Array.from(previewToolbar.querySelectorAll('.tool-btn')).filter(
                btn => btn.style.display !== 'none' && getComputedStyle(btn).display !== 'none'
            )
            : [];

        this._setTipPublishMode(!!isLibrary);

        // Duration only on library-item preview — never on template (ranking/splitscreen) select
        if (durationRow) {
            durationRow.hidden = !isLibrary;
            durationRow.style.display = isLibrary ? '' : 'none';
        }
        // Multi-gen is create-flow only — hide on library item preview
        if (multiGenCard) {
            multiGenCard.hidden = !!isLibrary;
            multiGenCard.style.display = isLibrary ? 'none' : '';
        }
        const intentToggle = document.getElementById('clipIntentToggleBtn');
        if (intentToggle) {
            intentToggle.style.display = isLibrary ? 'none' : '';
        }
        if (isLibrary && typeof window.resetClipIntentMode === 'function') {
            window.resetClipIntentMode();
        }
        
        if (isLibrary) {
            if (templateInfoPanel) templateInfoPanel.style.display = '';
            if (libraryInfoPanel) libraryInfoPanel.style.display = 'block';
            // Library: show pill; hide freeform T on ranking (RankingTextPill owns text)
            if (previewToolbar) previewToolbar.style.display = '';
            if (textBtn) textBtn.style.display = isRanking ? 'none' : '';
            const animBtnLib = previewToolbar?.querySelector('[data-tool="animations"]');
            if (animBtnLib) animBtnLib.style.display = '';
            try { window.SolisSilencer?.syncVisibility?.(); } catch (_) { /* ignore */ }
            try { window.SolisImproveClip?.syncVisibility?.(); } catch (_) { /* ignore */ }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ attrs: { 'stroke-width': 2 }, nameAttr: 'data-lucide' });
            }
            const btns = visibleToolbarBtns();
            // Show the tool pill idle — don't auto-select Captions (felt like the editor opened)
            if (previewToolbar) {
                previewToolbar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            }
            this.attachSocialButtonListeners();
            this._configureLibraryEditingUI();
        } else {
            if (templateInfoPanel) templateInfoPanel.style.display = '';
            if (libraryInfoPanel) libraryInfoPanel.style.display = 'none';
            if (previewToolbar) previewToolbar.style.display = '';
            if (textBtn) textBtn.style.display = isRanking ? 'none' : '';
            const btns = visibleToolbarBtns();
            // Fresh template open: leave pill idle until the user picks a tool
            // (memory ghost + ✓/✗ is the suggestion UI — not the captions editor)
            if (previewToolbar) {
                previewToolbar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            }
            this._libraryEditingEnabled = false;
            if (typeof PreviewTimeline !== 'undefined') {
                PreviewTimeline.detach();
            }
            try { window.SolisSilencer?.syncVisibility?.(); } catch (_) { /* ignore */ }
            try { window.SolisImproveClip?.syncVisibility?.(); } catch (_) { /* ignore */ }
        }
        if (typeof window.syncSolisModStripes === 'function') {
            try { window.syncSolisModStripes(); } catch (_) {}
        }
        try { window.SolisSilencer?.syncVisibility?.(); } catch (_) { /* ignore */ }
    }

    async _isPrimeOrElitePlan() {
        try {
            const sub = await window._subCache.get();
            const planName = String(sub?.plan_name || sub?.plan || 'free').toLowerCase();
            return planName === 'prime' || planName === 'elite';
        } catch (_) {
            return false;
        }
    }

    _isCurrentLibrarySplitScreen() {
        const data = this.currentTemplateForPreview?.data || {};
        const raw = `${data.template || ''} ${data.templateName || ''} ${this.currentTemplateForPreview?.type || ''} ${this.currentTemplateForPreview?.templateId || ''}`.toLowerCase();
        return raw.includes('splitscreen')
            || raw.includes('split screen')
            || raw.includes('split_screen')
            || raw.includes('face_track')
            || raw.includes('facetrack')
            || raw.includes('reframe');
    }

    _isCurrentLibraryRanking() {
        const t = this.currentTemplateForPreview;
        if (!t) return false;
        if (
            t.id === 'ranked_compilation'
            || t.type === 'ranked_compilation'
            || t.type === 'ranking'
            || t.templateId === 'ranked_compilation'
        ) {
            return true;
        }
        const data = t.data || {};
        const raw = `${t.id || ''} ${t.type || ''} ${t.templateId || ''} ${data.template || ''} ${data.templateName || ''}`.toLowerCase();
        return raw.includes('ranked') || raw.includes('ranking');
    }

    async _configureLibraryEditingUI() {
        const previewToolbar = document.getElementById('previewEditorPill');
        const confirmBtn = document.getElementById('confirmUseTemplateBtn');
        if (!previewToolbar || !confirmBtn) return;

        this._libraryEditingEnabled = true;
        // Keep customize flag if mount already enabled interactive splitscreen
        if (!this._librarySplitscreenCustomize) {
            this._librarySplitscreenCustomize = this._isCurrentLibrarySplitScreen();
        }

        // Always show the editor pill under the library preview
        previewToolbar.style.display = '';
        const textBtn = previewToolbar.querySelector('[data-tool="text"]');
        const animBtn = previewToolbar.querySelector('[data-tool="animations"]');
        const isRanking = this._isCurrentLibraryRanking();
        // Ranking: RankingTextPill owns overlay text — keep presets visible
        if (textBtn) textBtn.style.display = isRanking ? 'none' : '';
        if (animBtn) animBtn.style.display = '';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': 2 }, nameAttr: 'data-lucide' });
        }

        const visible = Array.from(previewToolbar.querySelectorAll('.tool-btn')).filter(
            btn => btn.style.display !== 'none'
        );
        // Keep tools available, but don't auto-activate a tool on open
        previewToolbar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        void visible;

        // "Apply & Download" only when the user changed something.
        // Hold the arm until seed/layout finish so clicking around doesn't false-dirty.
        this._libraryDirtyArmed = false;
        this._librarySplitscreenDirty = false;
        this._libraryOverlayDirty = false;
        this._libraryRankingDirty = false;
        // Preserve _librarySilenceDirty across UI reconfigure
        if (typeof window.syncLibraryConfirmLabel === 'function') {
            window.syncLibraryConfirmLabel();
        } else {
            confirmBtn.textContent = this._librarySilenceDirty ? 'Apply & Download' : 'Download';
            confirmBtn.classList.toggle('library-download-mode', true);
            if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
        }
        window.clearTimeout(this._libraryDirtyArmTimer);
        this._libraryDirtyArmTimer = window.setTimeout(() => {
            this._libraryDirtyArmed = true;
        }, 450);
    }

    async downloadRenderedLibraryClip(projectId) {
        const renderUrl = `${API_BASE_URL}/clips/render/${encodeURIComponent(projectId)}`;
        try {
            const response = await fetch(renderUrl, {
                method: 'GET',
                credentials: 'include',
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error(`Render failed (${response.status})`);
            }

            const blob = await response.blob();
            if (!blob.size) throw new Error('Rendered file is empty');

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `clip_${projectId}.mp4`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showNotification('Edited clip download started!', 'success');
        } catch (error) {
            showNotification(`Render failed: ${error.message}`, 'error');
        }
    }

    attachSocialButtonListeners() {
        const socialButtons = document.querySelectorAll('.social-btn');
        socialButtons.forEach(btn => {
            btn.removeEventListener('click', this.handleSocialButtonClick);
            btn.addEventListener('click', (e) => this.handleSocialButtonClick(e));
        });
    }

    handleSocialButtonClick(event) {
        const platform = event.currentTarget.getAttribute('data-platform');
        const projectId = this.currentTemplateForPreview?.projectId;
        
        if (!projectId) {
            alert('No project selected');
            return;
        }

        safeLog(`📤 Share to ${platform}: ${projectId}`);

        // TODO: Implement platform-specific sharing
        // This will download the video and prepare for upload to the selected platform
        const message = `Share to ${platform.toUpperCase()} coming soon!`;
        alert(message);
    }

    async updateWatermarkToggleState() {
        const watermarkFreeNotice = document.getElementById('watermarkFreeNotice');
        const watermarkPaidSection = document.getElementById('watermarkPaidSection');
        const watermarkToggle = document.getElementById('watermarkToggle');
        
        if (!watermarkToggle) return;
        
        try {
            const sub = await window._subCache.get();
            const planName = (sub?.plan_name || sub?.plan || 'free').toLowerCase();
            const isPaid = ['basic', 'prime', 'elite'].includes(planName);

            if (isPaid) {
                if (watermarkPaidSection) watermarkPaidSection.style.display = 'block';
                if (watermarkFreeNotice) watermarkFreeNotice.style.display = 'none';
                watermarkToggle.disabled = false;
                watermarkToggle.checked = false;
                this.currentTemplateForPreview.addWatermark = false;
            } else {
                if (watermarkFreeNotice) watermarkFreeNotice.style.display = 'block';
                if (watermarkPaidSection) watermarkPaidSection.style.display = 'none';
                this.currentTemplateForPreview.addWatermark = true;
            }
        } catch (error) {
            safeLog('Error checking watermark eligibility:', error);
            if (watermarkPaidSection) watermarkPaidSection.style.display = 'block';
            if (watermarkFreeNotice) watermarkFreeNotice.style.display = 'none';
        }
    }

    handleWatermarkToggle(e) {
        if (!this.currentTemplateForPreview) return;
        
        const watermarkToggle = document.getElementById('watermarkToggle');
        const isChecked = watermarkToggle.checked;
        
        // Update the template preview state
        this.currentTemplateForPreview.addWatermark = isChecked;
    }

    async confirmTemplateUse() {

        const confirmBtn = document.getElementById('confirmUseTemplateBtn');
        if (confirmBtn?.dataset.applying === '1') return;
        if (confirmBtn?.getAttribute('data-pro-locked') === '1') {
            window.location.href = '/premium.html';
            return;
        }
        
        if (!this.currentTemplateForPreview) {
            console.warn('No template selected');
            showNotification('Please select a template', 'error');
            return;
        }

        // Finish any in-progress overlay text edit so we capture typed content
        try {
            const editing = document.querySelector('#templateVideoPreview .overlay-text-block.overlay-editing .sub-text-inner');
            if (editing) editing.blur();
        } catch (_) {}

        // SAVE template data BEFORE closing modal (closing sets currentTemplateForPreview to null)
        const templateId = this.currentTemplateForPreview.id;
        const isLibraryPreview = this.currentTemplateForPreview.isLibraryPreview || false;
        const projectId = this.currentTemplateForPreview.projectId;
        const template = this.templates[templateId];
        
        safeLog('ðŸ” confirmTemplateUse:', {
            templateId,
            isLibraryPreview,
            projectId,
            availableTemplates: Object.keys(this.templates),
            foundTemplate: !!template,
            cachedData: this.currentTemplateForPreview.data
        });
        
        // 🎬 FOR LIBRARY PREVIEW: apply layout edits if needed, then download
        if (isLibraryPreview && projectId) {
            safeLog(`📥 Library mode: Downloading clip ${projectId}`);

            // Only recompose when the user actually edited/cleared something.
            // Presence of an AI hook or overlay DOM must NOT force "Applying changes".
            const hookCleared = Boolean(this._libraryHookCleared);
            const captionsCleared = Boolean(this._libraryCaptionsCleared);
            const silenceDirty = Boolean(
                this._librarySilenceDirty
                || (typeof window.SolisSilencer?.isApplied === 'function' && window.SolisSilencer.isApplied())
            );
            const needsRecompose = Boolean(
                this._librarySplitscreenCustomize
                && (this._librarySplitscreenDirty || hookCleared || captionsCleared || silenceDirty)
            );
            const overlays = typeof window.collectLibraryOverlayTexts === 'function'
                ? window.collectLibraryOverlayTexts()
                : [];
            const needsOverlayRender = Boolean(this._libraryOverlayDirty && !silenceDirty);
            // Deferred first-burn still needs a pass — but label stays Download unless dirty.
            const needsRankingRecompose = Boolean(
                this._libraryRankingEditable
                && (this._libraryRankingDirty || this._libraryRankingNeedsBurn || silenceDirty)
            );
            const needsSilenceOnly = Boolean(
                silenceDirty && !needsRecompose && !needsRankingRecompose
            );

            if (confirmBtn) {
                confirmBtn.dataset.applying = '1';
                confirmBtn.disabled = true;
                confirmBtn.dataset.prevLabel = confirmBtn.textContent || '';
                confirmBtn.textContent = (needsRecompose || needsOverlayRender || needsRankingRecompose || needsSilenceOnly)
                    ? 'Applying…'
                    : 'Downloading…';
            }

            try {
                if (needsRecompose || needsOverlayRender || needsRankingRecompose || needsSilenceOnly) {
                    if (needsOverlayRender && !overlays.length && !needsRankingRecompose && !needsRecompose && !needsSilenceOnly) {
                        throw new Error('Type some text on the preview first (not just “Text”)');
                    }
                    // Apply reprocesses video — same pool as daily generations
                    const meta = this._libraryCustomizeMeta || {};
                    if (meta.customize_expired) {
                        throw new Error(
                            'Customization window expired for this project. Download the last render, or generate a new clip.',
                        );
                    }
                    if (meta.apply_consumes_quota !== false && !needsSilenceOnly) {
                        try {
                            showNotification(
                                'Applying changes uses 1 daily upload.',
                                'info',
                            );
                        } catch (_) {}
                    }
                    await this.runLibraryApplyWithSpinner(projectId, {
                        needsRecompose,
                        needsOverlayRender,
                        needsRankingRecompose,
                        needsSilenceOnly,
                        overlays,
                    });
                    this.closeTemplatePreviewModal();
                } else {
                    this.closeTemplatePreviewModal();
                    await this.downloadClip(projectId);
                }
            } catch (error) {
                showNotification(`Save failed: ${error.message}`, 'error');
            } finally {
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.dataset.applying = '0';
                    confirmBtn.textContent = confirmBtn.dataset.prevLabel || 'Download';
                }
            }
            return;
        }
        
        // If template not found in templates dict, try to use cached data
        if (!template && !this.currentTemplateForPreview.data) {
            safeLog('âŒ Template not found:', templateId, 'Available:', Object.keys(this.templates));
            showNotification(`Template "${templateId}" not found. Available: ${Object.keys(this.templates).join(', ')}`, 'error');
            return;
        }

        const promptText = document.getElementById('aiPromptInput')?.value.trim() || '';
        
        // Store the AI prompt
        this.currentAIPrompt = promptText;

        
        // Persist watermark preference when confirming a template
        try {
            const watermarkEnabled = localStorage.getItem('watermarkEnabled') === 'true';
            fetch(`${window.API_BASE_URL}/user/settings/watermark`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                credentials: 'include',
                body: JSON.stringify({ watermarkEnabled })
            }).catch(() => {});
        } catch (_) {}

        const youtubeUrl = document.getElementById('youtubeUrlInput')?.value.trim();

        // Snapshot preview overlays before either path closes/wipes the modal.
        // Previously this only ran when a URL was already present, so the common
        // template-first flow lost captions before /clips/start.
        try {
            window.__solisPendingGenerateCaptions =
                (typeof window.flushCaptionsForGenerate === 'function')
                    ? window.flushCaptionsForGenerate(templateId)
                    : (typeof window.collectSubtitleStyle === 'function'
                        ? window.collectSubtitleStyle()
                        : null);
            // Snapshot means consent — don't let modal teardown flip cleared=true after this
            if (window.__solisPendingGenerateCaptions) {
                window.__solisCaptionsOptedIn = true;
                window.__solisCaptionsClearedForGenerate = false;
            }
        } catch (_) {
            window.__solisPendingGenerateCaptions = null;
        }
        try {
            window.__solisPendingGenerateHook =
                (typeof window.collectAiHookFromPreview === 'function')
                    ? window.collectAiHookFromPreview()
                    : null;
        } catch (_) {
            window.__solisPendingGenerateHook = null;
        }
        try {
            if (templateId === 'ranked_compilation'
                && window.rankingCustomizer) {
                let snap = null;
                try {
                    if (typeof window.rankingCustomizer.flushRankingStylesForGenerate === 'function') {
                        snap = window.rankingCustomizer.flushRankingStylesForGenerate();
                    } else if (typeof window.rankingCustomizer.captureGenerateLock === 'function') {
                        try {
                            document.querySelectorAll('#templateVideoPreview .rk-inline-editing').forEach((el) => {
                                try { el.blur(); } catch (_) { /* ignore */ }
                            });
                        } catch (_) { /* ignore */ }
                        snap = window.rankingCustomizer.captureGenerateLock();
                    } else if (typeof window.rankingCustomizer.collectCustomizations === 'function') {
                        snap = window.rankingCustomizer.collectCustomizations();
                    }
                } catch (capErr) {
                    safeLog('[RankingStyles] capture failed:', capErr?.message || capErr);
                    snap = null;
                }
                const fontCount = window.rankingCustomizer.countFonts?.(snap) || 0;
                // Never overwrite a good lock with {} / layout-only
                if (!snap || !Object.keys(snap).length || fontCount === 0) {
                    try {
                        const prior = JSON.parse(sessionStorage.getItem('solisRankingStyleLock') || 'null');
                        const priorFonts = window.rankingCustomizer.countFonts?.(prior) || 0;
                        if (priorFonts > 0) {
                            snap = { ...(prior || {}), ...(snap || {}) };
                            // Re-merge: prior fonts win where snap is empty
                            Object.entries(prior).forEach(([k, v]) => {
                                if (!v || typeof v !== 'object') return;
                                if (!snap[k]) snap[k] = { ...v };
                                else if (v.font && !snap[k].font) snap[k].font = v.font;
                            });
                            safeLog('[RankingStyles] Recovered fonts from prior style lock:', priorFonts);
                        }
                    } catch (_) { /* ignore */ }
                }
                snap = snap || {};
                window.__solisPendingGenerateRankingCustoms = snap;
                window.__solisRankingStyleLock = snap;
                try {
                    sessionStorage.setItem('solisPendingRankingCustoms', JSON.stringify(snap));
                    if ((window.rankingCustomizer.countFonts?.(snap) || 0) > 0) {
                        sessionStorage.setItem('solisRankingStyleLock', JSON.stringify(snap));
                    }
                } catch (_) { /* ignore */ }
                try {
                    const fonts = Object.entries(snap)
                        .filter(([k, v]) => k !== '__ranking_layout' && v && v.font)
                        .map(([k, v]) => `${k}:${v.font}`);
                    const sizes = Object.entries(snap)
                        .filter(([k, v]) => k !== '__ranking_layout' && v && v.font_size)
                        .map(([k, v]) => `${k}:${v.font_size}`);
                    safeLog('[RankingStyles] LOCK fonts:', fonts.slice(0, 14));
                    safeLog('[RankingStyles] LOCK sizes:', sizes.slice(0, 14));
                    if (!fonts.length) {
                        safeLog('[RankingStyles] WARNING: style lock has no fonts — burn may look default');
                    }
                } catch (_) { /* ignore */ }
            } else {
                window.__solisPendingGenerateRankingCustoms = null;
                window.__solisRankingStyleLock = null;
            }
        } catch (_) {
            window.__solisPendingGenerateRankingCustoms = null;
            window.__solisRankingStyleLock = null;
        }

        // Template-first: pick template → land on URL submit if no link yet
        if (!youtubeUrl) {
            this.closeTemplatePreviewModal();
            this._armTemplateThenUrlFlow(templateId);
            return;
        }

        if (!this.isValidMediaUrl(youtubeUrl)) {
            showNotification(
                this.getMediaUrlError(youtubeUrl),
                'error'
            );
            this.closeTemplatePreviewModal();
            this._armTemplateThenUrlFlow(templateId);
            return;
        }

        this.closeTemplatePreviewModal();
        this.selectedTemplate = templateId;
        this.startClipProcessingWithSlots(youtubeUrl, templateId);
    }

    /** Template → Create: select template, focus URL field + submit arrow. */
    _armTemplateThenUrlFlow(templateId) {
        this.selectedTemplate = templateId;
        this._awaitingUrlForTemplate = true;

        document.querySelectorAll('.template-card').forEach((card) => {
            card.classList.toggle('selected', card.dataset.template === templateId);
        });

        this.switchTab('create');

        const urlInput = document.getElementById('youtubeUrlInput');
        const submitBtn = document.getElementById('processUrlBtn');
        const stack = document.getElementById('urlInputStack')
            || document.querySelector('.url-input-container');

        if (stack) {
            stack.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (urlInput) {
            try {
                urlInput.focus({ preventScroll: true });
                const len = urlInput.value.length;
                urlInput.setSelectionRange(len, len);
            } catch (_) { /* ignore */ }
        }

        // No pulse lock — user pastes or clicks Continue when ready
        if (submitBtn) {
            submitBtn.classList.remove('needs-url-pulse');
        }
    }



    showSlotSystemInfo() {
        // Create or update slot system info in the UI
        let slotInfo = document.getElementById('slotSystemInfo');
        if (!slotInfo) {
            slotInfo = document.createElement('div');
            slotInfo.id = 'slotSystemInfo';
            slotInfo.className = 'slot-system-info';
            
            const templateSection = document.getElementById('templatesSection');
            if (templateSection) {
                templateSection.appendChild(slotInfo);
            }
        }
        
        slotInfo.innerHTML = `
            <div class="slot-system-card">
                <div class="slot-system-icon">
                    <i class="fas fa-layer-group"></i>
                </div>
                <div class="slot-system-content">
                    <h4>Slot System Active</h4>
                    <p>This template uses the dynamic 1-5 slot system. New clips will fill from slot 5 upward.</p>
                    <div class="slot-visualization">
                        <div class="slot-row">
                            <div class="slot-visual" data-slot="1">1</div>
                            <div class="slot-visual" data-slot="2">2</div>
                            <div class="slot-visual" data-slot="3">3</div>
                            <div class="slot-visual" data-slot="4">4</div>
                            <div class="slot-visual" data-slot="5">5</div>
                        </div>
                        <div class="slot-labels">
                            <span>New clips start here →</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showConfirmationButtons(show) {
        const confirmBtn = document.getElementById('confirmTemplateBtn');
        const cancelBtn = document.getElementById('cancelTemplateBtn');
        
        if (confirmBtn && cancelBtn) {
            if (show) {
                confirmBtn.style.display = 'flex';
                cancelBtn.style.display = 'flex';
            } else {
                confirmBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
            }
        }
    }

    async confirmTemplateSelection() {
        if (!this.selectedTemplate) {
            showNotification('Please select a template first', 'error');
            return;
        }

        const url = document.getElementById('youtubeUrlInput')?.value.trim();
        if (!url) {
            showNotification('Please enter a YouTube URL first', 'error');
            return;
        }

        if (this._pendingDurationCheck) {
            showNotification('Finishing video length check…', 'info');
            const durationResult = await this._pendingDurationCheck;
            this._pendingDurationCheck = null;
            if (!durationResult.allowed) {
                return;
            }
            this._rememberVideoDuration(durationResult);
        }

        // Show template confirmation with slot info
        this.showTemplateConfirmation(this.selectedTemplate, url);
    }

    showTemplateConfirmation(templateId, url) {
        const template = this.templates[templateId];
        if (!template) {
            showNotification('Template not found', 'error');
            return;
        }

        const slotInfo = template.supportsSlotSystem ? 
            '\n\n🎯 Using Slot System: New clips will fill from slot 5 upward' : 
            '';

        if (confirm(`Create "${template.name}" from this YouTube URL?\n\nURL: ${url}\n\n${template.description}\n${template.duration}${slotInfo}\n\nThis may take a few minutes to process.`)) {
            this.startClipProcessingWithSlots(url, templateId);
        }
    }

    cancelTemplateSelection() {
        this.selectedTemplate = null;
        this._awaitingUrlForTemplate = false;
        this._pendingDurationCheck = null;
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.getElementById('processUrlBtn')?.classList.remove('needs-url-pulse');
        clearTimeout(this._urlPulseTimer);

        this.showConfirmationButtons(false);
        
        // Remove slot system info
        const slotInfo = document.getElementById('slotSystemInfo');
        if (slotInfo) {
            slotInfo.remove();
        }
    }

    _lockGenerationButtons() {
        const submitBtn = document.getElementById('processUrlBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('is-generating');
            submitBtn.classList.remove('is-cancelling', 'is-cancel-locked');
            submitBtn.setAttribute('aria-label', 'Generating…');
            submitBtn.title = 'Generating…';
        }
        const confirmBtn = document.getElementById('confirmUseTemplateBtn');
        if (confirmBtn) confirmBtn.disabled = true;
    }

    _unlockGenerationButtons() {
        this._generationStartInFlight = false;
        this._cancelGenerationInFlight = false;
        const submitBtn = document.getElementById('processUrlBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.classList.remove('is-generating', 'is-cancelling', 'is-cancel-locked', 'is-upgrade-cta', 'loading');
            submitBtn.setAttribute('aria-label', 'Continue');
            submitBtn.removeAttribute('title');
        }
        sessionStorage.removeItem('urlButtonLocked');
        sessionStorage.removeItem('urlButtonLockeduntil');
        this.syncTemplateConfirmButton();
    }

    /**
     * Cancel removed — generations always run to completion.
     * Kept as a no-op so older call sites do not throw.
     */
    async cancelActiveGeneration() {
        return;
    }

    syncTemplateConfirmButton() {
        const confirmBtn = document.getElementById('confirmUseTemplateBtn');
        if (!confirmBtn) return;

        // Library download / apply flows manage their own label + enabled state
        if (this.currentTemplateForPreview?.isLibraryPreview) {
            return;
        }

        // Generate-flow: always Use Template (clear leftover library mode)
        confirmBtn.classList.remove('library-download-mode');

        // Don't unlock while a generation is locking the CTA
        if (confirmBtn.dataset.applying === '1') return;
        if (document.getElementById('processUrlBtn')?.classList.contains('is-generating')) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Use Template';
            if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
            return;
        }

        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Use Template';
        confirmBtn.removeAttribute('aria-disabled');
        confirmBtn.style.pointerEvents = '';
        confirmBtn.style.opacity = '';
        if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
    }

    _rollbackOptimisticStart(optimisticItemId, errorMessage = null) {
        const spinner = typeof getGenerationProgressSpinner === 'function'
            ? getGenerationProgressSpinner()
            : window.generationProgressSpinner;
        if (spinner) {
            const msg = (errorMessage && String(errorMessage).trim())
                || 'Could not start generation — try again';
            if (typeof spinner.failOptimisticStart === 'function') {
                spinner.failOptimisticStart(msg);
            } else {
                spinner.cancelOptimisticGeneration();
                if (spinner.activeGenerations.size === 0) {
                    spinner._unlockUrlSubmitButton();
                }
            }
        }
        this._unlockGenerationButtons();

        if (optimisticItemId == null) return;
        const idx = this.processingItems.findIndex(i => i.id === optimisticItemId);
        if (idx === -1) return;
        this.processingItems.splice(idx, 1);
        this.saveProcessingItems();
        if (this.processingItems.length === 0) {
            this.stopLibraryPolling();
        }
        if (this.currentTab === 'library') {
            this.updateLibraryView();
        }
    }

    _notifyGenerationBlock(limitData, errorData = null) {
        const daily = limitData?.daily || errorData?.daily || {};
        const monthly = limitData?.monthly || errorData?.monthly || {};
        const used = errorData?.daily_count ?? daily.used;
        const limit = errorData?.daily_limit ?? daily.limit;
        const remaining = daily.remaining ?? (limit != null && used != null ? Math.max(0, limit - used) : null);
        const monthlyUsed = errorData?.monthly_count ?? monthly.used;
        const monthlyLimit = errorData?.monthly_limit ?? monthly.limit;
        const monthlyRemaining = monthly.remaining
            ?? (monthlyLimit != null && monthlyUsed != null ? Math.max(0, monthlyLimit - monthlyUsed) : null);

        const formatWhen = (resetsAt) => {
            if (!resetsAt) {
                // Next local midnight — never invent "4:00 AM" from UTC
                try {
                    const now = new Date();
                    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
                    const timeStr = next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    return `tomorrow at ${timeStr}`;
                } catch (_) {
                    return '';
                }
            }
            try {
                const raw = String(resetsAt).trim();
                const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
                const normalized = hasTz ? raw.replace(' ', 'T') : `${raw.replace(' ', 'T')}Z`;
                const d = new Date(normalized);
                if (!Number.isNaN(d.getTime())) {
                    // UTC midnight mislabeled → user's local midnight
                    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0
                        && d.getMinutes() === 0 && d.getHours() > 0 && d.getHours() <= 6) {
                        const now = new Date();
                        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
                        const timeStr = next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const startOfWhen = new Date(next.getFullYear(), next.getMonth(), next.getDate());
                        const dayDiff = Math.round((startOfWhen - startOfToday) / 86400000);
                        if (dayDiff === 0) return `today at ${timeStr}`;
                        if (dayDiff === 1) return `tomorrow at ${timeStr}`;
                        return next.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                    }
                    const now = new Date();
                    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const startOfWhen = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    const dayDiff = Math.round((startOfWhen - startOfToday) / 86400000);
                    if (dayDiff === 0) return `today at ${timeStr}`;
                    if (dayDiff === 1) return `tomorrow at ${timeStr}`;
                    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                }
            } catch (_) { /* ignore */ }
            return '';
        };

        const videoUsed = limitData?.storage?.videos?.used
            ?? errorData?.current_count
            ?? (typeof window.clipsStudio?.libraryItems?.length === 'number' ? window.clipsStudio.libraryItems.length : null);
        const videoLimit = limitData?.storage?.videos?.limit ?? errorData?.limit ?? null;

        const showStorageFullModal = (title, subtitle) => {
            if (typeof window.showUpgradeModal === 'function') {
                window.showUpgradeModal(title, subtitle);
            } else {
                showNotification(subtitle, 'warning');
            }
        };

        // Month = entitlement (check first)
        if (
            limitData?.monthly_limit_reached
            || errorData?.error_code === 'MONTHLY_LIMIT_REACHED'
            || (monthlyLimit > 0 && monthlyRemaining === 0)
        ) {
            showNotification(
                'You\'ve used this month\'s uploads. Resets with your plan renewal.',
                'warning'
            );
            return;
        }

        if (limitData?.daily_limit_reached || errorData?.error_code === 'DAILY_LIMIT_REACHED' || remaining === 0) {
            const when = formatWhen(daily.resets_at || errorData?.daily?.resets_at);
            if (monthlyRemaining > 0) {
                showNotification(
                    when
                        ? `Next upload unlocks ${when}.`
                        : 'Next upload unlocks tomorrow.',
                    'info'
                );
                return;
            }
            showNotification(
                when
                    ? `Daily limit reached. Resets around ${when}.`
                    : 'Daily limit reached.',
                'warning'
            );
            return;
        }

        const cooldown = limitData?.generation?.cooldown_remaining_seconds
            || errorData?.cooldown_remaining_seconds
            || 0;
        if (cooldown > 0) {
            const mins = Math.floor(cooldown / 60);
            const secs = cooldown % 60;
            const wait = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            showNotification(`Please wait ${wait} before your next upload.`, 'warning');
            return;
        }

        if (
            limitData?.library_limit_reached
            || limitData?.block_reason === 'library_full'
            || errorData?.error_code === 'VIDEO_LIMIT_REACHED'
        ) {
            showStorageFullModal(
                'Library Storage Full',
                `You have ${videoUsed ?? '?'}/${videoLimit ?? '?'} saved videos. Delete clips from your library to create new ones, or upgrade your plan for more storage.`
            );
            return;
        }

        if (limitData?.storage_limit_reached || limitData?.block_reason === 'storage_full' || errorData?.error_code === 'INSUFFICIENT_STORAGE') {
            const usedMb = limitData?.storage?.space_mb?.used;
            const totalMb = limitData?.storage?.space_mb?.total;
            const spaceLine = (usedMb != null && totalMb != null)
                ? ` (${usedMb} MB / ${totalMb} MB used)`
                : '';
            showStorageFullModal(
                'Disk Storage Full',
                `Your plan storage is almost full${spaceLine}. Delete old projects or upgrade your plan to continue.`
            );
            return;
        }

        if (limitData?.block_reason === 'in_progress' || limitData?.is_generating) {
            showNotification('A video is already generating. Please wait for it to finish.', 'warning');
            return;
        }

        showNotification('Cannot start a new upload right now. Try again shortly.', 'warning');
    }

    async startClipProcessingWithSlots(url, templateId) {
        // Always resolve duration on Railway before template/Vast work
        try {
            const needsDuration = !(
                Number.isFinite(this._lastVideoDurationSeconds) && this._lastVideoDurationSeconds > 0
            );
            if (needsDuration && url) {
                const durationResult = await this._getCachedDurationCheck(url);
                if (durationResult && durationResult.allowed === false) {
                    return;
                }
                this._rememberVideoDuration(durationResult);
            }
        } catch (durErr) {
            safeLog('Duration preflight failed (continuing):', durErr?.message || durErr);
        }
        if (this._generationStartInFlight) return;

        let optimisticItemId = null;

        try {

            const template = this.templates[templateId];
            const templateName = template?.name || templateId;
            optimisticItemId = Date.now();

            this._generationStartInFlight = true;
            this._lockGenerationButtons();
            this.switchTab('library');

            if (typeof window.refreshPlanSelector === 'function') {
                window.refreshPlanSelector().catch(() => {});
            }

            const spinner = typeof initGenerationProgressSpinner === 'function'
                ? initGenerationProgressSpinner()
                : (typeof getGenerationProgressSpinner === 'function'
                    ? getGenerationProgressSpinner()
                    : window.generationProgressSpinner);
            if (spinner) {
                const urlVal = document.getElementById('youtubeUrlInput')?.value?.trim() || '';
                const source = (typeof this.resolveSourceVideoCardMeta === 'function'
                    ? this.resolveSourceVideoCardMeta(urlVal)
                    : {}) || {};
                const videoTitle = source.title
                    || (urlVal ? 'YouTube video' : 'Your video');
                const spinnerOptions = {
                    ...(templateId === 'splitscreen' && typeof window.getSplitscreenConfig === 'function'
                        ? { secondaryType: window.getSplitscreenConfig().splitscreen_secondary_type }
                        : {}),
                    videoTitle,
                    title: videoTitle,
                    thumbnailUrl: source.thumbnailUrl || null,
                    videoId: source.videoId || null,
                };
                spinner.beginOptimisticGeneration('Starting...', templateId, spinnerOptions);
            }

            const optimisticItem = {
                id: optimisticItemId,
                projectId: null,
                optimistic: true,
                name: `${templateName} from YouTube`,
                template: templateId,
                templateName,
                status: 'processing',
                progress: 0,
                message: 'Starting...',
                timestamp: new Date(),
                lastChecked: Date.now(),
                slotNumber: null,
                useSlotSystem: true,
                isSlotSystem: true,
            };
            this.addProcessingItem(optimisticItem);

            // Get watermark preference from toggle (free is always locked ON)
            const watermarkToggle = document.getElementById('watermarkToggle');
            const watermarkEnabled = watermarkToggle ? watermarkToggle.checked : false;
            
            const headers = getAuthHeaders();
            
            // 🎨 Get customizations from customizer and ranking customizer
            let customizations = null;
            let rankingCustomizations = null;
            
            // Collect from main customizer
            if (window.customizer && typeof window.customizer.collectCustomizations === 'function') {
                customizations = window.customizer.collectCustomizations();
            }
            
            // Collect from ranking customizer (for ranking templates)
            if (templateId === 'ranked_compilation') {
                const mergeStyleMaps = (...maps) => {
                    const out = {};
                    maps.forEach((src) => {
                        if (!src || typeof src !== 'object') return;
                        Object.entries(src).forEach(([k, v]) => {
                            if (!v || typeof v !== 'object') {
                                if (v != null) out[k] = v;
                                return;
                            }
                            // Later maps win per-key, but never erase earlier style props with undefined
                            const prev = out[k] && typeof out[k] === 'object' ? out[k] : {};
                            const next = { ...prev };
                            Object.entries(v).forEach(([pk, pv]) => {
                                if (pv !== undefined && pv !== null && pv !== '') next[pk] = pv;
                            });
                            out[k] = next;
                        });
                    });
                    return out;
                };
                let fromSession = null;
                let fromLock = null;
                try {
                    fromSession = JSON.parse(sessionStorage.getItem('solisPendingRankingCustoms') || 'null');
                } catch (_) { fromSession = null; }
                try {
                    fromLock = JSON.parse(sessionStorage.getItem('solisRankingStyleLock') || 'null');
                } catch (_) { fromLock = null; }
                let fromLocal = null;
                try {
                    const uid = window.currentUser?.id || window.currentUser?.user_id || null;
                    const key = uid != null ? `rankingCustomizations:u${uid}` : 'rankingCustomizations';
                    fromLocal = JSON.parse(localStorage.getItem(key) || 'null');
                    if (!fromLocal && key !== 'rankingCustomizations') {
                        fromLocal = JSON.parse(localStorage.getItem('rankingCustomizations') || 'null');
                    }
                } catch (_) { fromLocal = null; }
                let fromLive = null;
                try {
                    if (window.rankingCustomizer?.captureGenerateLock
                        && document.querySelector('#templateVideoPreview .ranking-preview-container')) {
                        fromLive = window.rankingCustomizer.captureGenerateLock();
                    } else if (window.rankingCustomizer?.customizations) {
                        fromLive = JSON.parse(JSON.stringify(window.rankingCustomizer.customizations));
                    }
                } catch (_) { fromLive = null; }

                rankingCustomizations = mergeStyleMaps(
                    fromLocal,
                    fromSession,
                    fromLive,
                    window.__solisPendingGenerateRankingCustoms,
                    window.__solisRankingStyleLock,
                    fromLock,
                );
                // If merge somehow lost fonts, rescue from any font-rich source
                const countFonts = (map) => {
                    if (!map || typeof map !== 'object') return 0;
                    return Object.entries(map).filter(
                        ([k, v]) => k !== '__ranking_layout' && v && typeof v === 'object' && v.font
                    ).length;
                };
                if (countFonts(rankingCustomizations) === 0) {
                    const rescue = mergeStyleMaps(
                        rankingCustomizations,
                        fromLocal,
                        fromSession,
                        fromLock,
                        window.__solisRankingStyleLock,
                        window.rankingCustomizer?.customizations,
                    );
                    if (countFonts(rescue) > 0) {
                        rankingCustomizations = rescue;
                        safeLog('[RankingStyles] Rescued fonts after empty merge:', countFonts(rescue));
                    }
                }
                window.__solisPendingGenerateRankingCustoms = null;
                try {
                    sessionStorage.setItem(
                        'solisPendingRankingCustoms',
                        JSON.stringify(rankingCustomizations || {}),
                    );
                    // Never poison style lock with a fontless / layout-only bag
                    const mergedFonts = countFonts(rankingCustomizations);
                    const priorFonts = countFonts(fromLock);
                    if (mergedFonts > 0) {
                        sessionStorage.setItem(
                            'solisRankingStyleLock',
                            JSON.stringify(rankingCustomizations || {}),
                        );
                        window.__solisRankingStyleLock = rankingCustomizations;
                    } else if (priorFonts > 0) {
                        rankingCustomizations = mergeStyleMaps(rankingCustomizations, fromLock);
                        safeLog('[RankingStyles] Kept prior style lock fonts:', priorFonts);
                    } else {
                        sessionStorage.setItem(
                            'solisRankingStyleLock',
                            JSON.stringify(rankingCustomizations || {}),
                        );
                        window.__solisRankingStyleLock = rankingCustomizations;
                    }
                } catch (_) { /* ignore */ }

                // Always attach — even if only layout — so backend never gets {}
                if (!rankingCustomizations || !Object.keys(rankingCustomizations).length) {
                    rankingCustomizations = { __ranking_layout: window.__solisRankingLayout || {} };
                }
                // Nuclear: stamp fonts/sizes/colors so burn never gets a layout-only bag
                if (typeof window.rankingCustomizer.ensureGeneratePayload === 'function') {
                    rankingCustomizations = window.rankingCustomizer.ensureGeneratePayload(
                        rankingCustomizations,
                    );
                }
            }
            // Never attach leftover ranking fonts/locks to splitscreen / other templates
            if (templateId !== 'ranked_compilation') {
                rankingCustomizations = null;
            }
            if (templateId === 'ranked_compilation' && rankingCustomizations) {
                try {
                    if (typeof window.rankingCustomizer?.ensureGeneratePayload === 'function') {
                        rankingCustomizations = window.rankingCustomizer.ensureGeneratePayload(
                            rankingCustomizations,
                        );
                    }
                    const fonts = Object.entries(rankingCustomizations)
                        .filter(([k, v]) => k !== '__ranking_layout' && v && v.font)
                        .map(([k, v]) => `${k}:${v.font}`);
                    const colors = Object.entries(rankingCustomizations)
                        .filter(([k, v]) => k !== '__ranking_layout' && v && v.color)
                        .map(([k, v]) => `${k}:rgb(${(v.color || []).slice(0, 3).join(',')})`);
                    safeLog('[RankingStyles] Sending fonts:', fonts.slice(0, 14));
                    safeLog('[RankingStyles] Sending colors:', colors.slice(0, 8));
                    if (!fonts.length) {
                        console.warn('[RankingStyles] NO FONTS in generate payload — overlay will look default');
                    }
                } catch (_) { /* ignore */ }
            }
            
            const payload = {
                url: url,
                template_id: templateId,
                use_slot_system: true,
                watermark_enabled: watermarkEnabled,
                watermark_variant: (typeof this.getWatermarkVariant === 'function'
                    ? this.getWatermarkVariant()
                    : (localStorage.getItem('solisWatermarkVariant') || 'branded')),
                effort: (typeof window.getSelectedEffortMode === 'function'
                    ? window.getSelectedEffortMode()
                    : null) || 'auto',
                // Modifiers → AI Text Generation (default ON)
                ai_text_generation: window.solisAiTitleGenerationEnabled !== false,
                // Modifiers → Auto Modes (Solis picks Reframe / Blur / Focus)
                auto_modes: window.solisAutoModesEnabled !== false,
                // Modifiers → Sound Effects temporarily forced off
                sfx_enabled: false,
            };
            // AI hook sticker placement/style from preview (exact burn match)
            try {
                const pendingHook = window.__solisPendingGenerateHook || null;
                window.__solisPendingGenerateHook = null;
                const hookSnap = pendingHook
                    || (typeof window.collectAiHookFromPreview === 'function'
                        ? window.collectAiHookFromPreview()
                        : null);
                if (hookSnap?.present && hookSnap.style) {
                    payload.ai_hook_style = hookSnap.style;
                } else if (window.solisAiTitleGenerationEnabled === false) {
                    // Toggle off only — hook is hidden on template preview by design
                    payload.ai_text_generation = false;
                }
            } catch (_) { /* ignore */ }
            if (Number.isFinite(this._lastVideoDurationSeconds) && this._lastVideoDurationSeconds > 0) {
                payload.video_duration_seconds = this._lastVideoDurationSeconds;
            } else if (Number.isFinite(this._lastVideoDurationMinutes) && this._lastVideoDurationMinutes > 0) {
                payload.video_duration_minutes = this._lastVideoDurationMinutes;
            }

            // Settings → Plugins preferences (captions only — SFX is the modifiers toggle)
            const pluginPrefs = (typeof window.getSolisPluginPrefs === 'function')
                ? window.getSolisPluginPrefs()
                : null;
            if (pluginPrefs) {
                payload.subtitles_enabled = !!pluginPrefs.auto_captions;
            }

            // Preview caption styles → final ASS burn (same anim/font/edge as sub-anim-grid).
            // Ranking compilations honor caption opt-in the same as splitscreen.
            try {
                // Prefer snapshot taken before modal close (innerHTML wipe destroys blocks)
                let captionStyle = window.__solisPendingGenerateCaptions || null;
                window.__solisPendingGenerateCaptions = null;
                if (!captionStyle && typeof window.flushCaptionsForGenerate === 'function') {
                    captionStyle = window.flushCaptionsForGenerate(templateId);
                }
                if (!captionStyle && typeof window.collectSubtitleStyle === 'function') {
                    const live = window.collectSubtitleStyle();
                    const hasLiveBlock = !!document
                        .getElementById('templateVideoPreview')
                        ?.querySelector('.sub-text-block:not(.overlay-text-block)');
                    // Only use live collect when a real caption block exists (not ghost/stale)
                    if (live && hasLiveBlock) captionStyle = live;
                }
                const hasSubtitleBlock = !!document
                    .getElementById('templateVideoPreview')
                    ?.querySelector('.sub-text-block:not(.overlay-text-block)');
                // Pending style from confirmTemplateUse means user opted in BEFORE modal wipe.
                // closeTemplatePreviewModal used to flip cleared=true after snapshot and
                // wrongly kill captions even when captionStyle was already captured.
                const hasPendingStyle = !!(captionStyle && typeof captionStyle === 'object');
                const captionsCleared = !!window.__solisCaptionsClearedForGenerate && !hasPendingStyle;
                const captionsOptedIn = !!window.__solisCaptionsOptedIn
                    || hasSubtitleBlock
                    || hasPendingStyle;
                window.__solisCaptionsClearedForGenerate = false;
                if (captionsCleared && !hasSubtitleBlock && !hasPendingStyle) {
                    payload.subtitles_enabled = false;
                    delete payload.caption_style;
                    safeLog('Captions removed in preview — skipping burn');
                } else if (
                    captionStyle
                    && typeof captionStyle === 'object'
                    && captionsOptedIn
                    && captionStyle.enabled !== false
                ) {
                    const smartOn = window.solisSmartCaptionsEnabled !== false;
                    payload.caption_style = {
                        ...captionStyle,
                        enabled: true,
                        smart_captions: captionStyle.smart_captions !== undefined
                            ? !!captionStyle.smart_captions
                            : smartOn,
                        crisper_mode: (captionStyle.smart_captions !== undefined
                            ? !!captionStyle.smart_captions
                            : smartOn)
                            ? 'verbatim'
                            : 'intended',
                        remove_fillers: false,
                    };
                    payload.subtitles_enabled = true;
                    safeLog('Sending caption style:', payload.caption_style);
                } else if (hasSubtitleBlock && captionsOptedIn) {
                    // Block present but collect failed — still request default karaoke burn
                    payload.caption_style = {
                        anim: 'karaoke',
                        enabled: true,
                        smart_captions: window.solisSmartCaptionsEnabled !== false,
                        crisper_mode: window.solisSmartCaptionsEnabled !== false ? 'verbatim' : 'intended',
                        remove_fillers: false,
                    };
                    payload.subtitles_enabled = true;
                    safeLog('Subtitle block present — sending default caption style');
                } else if (pluginPrefs?.auto_captions && !captionsCleared) {
                    payload.caption_style = {
                        anim: 'karaoke',
                        enabled: true,
                        smart_captions: window.solisSmartCaptionsEnabled !== false,
                        crisper_mode: window.solisSmartCaptionsEnabled !== false ? 'verbatim' : 'intended',
                        remove_fillers: false,
                    };
                    payload.subtitles_enabled = true;
                    safeLog('Plugin auto_captions on — default karaoke burn');
                } else {
                    payload.subtitles_enabled = false;
                    delete payload.caption_style;
                    safeLog('No caption opt-in — skipping ASR/burn');
                }
            } catch (capCollectErr) {
                safeLog('Caption style collect failed:', capCollectErr?.message || capCollectErr);
            }
            
            // 🎨 Add customizations to payload if they exist and are not empty
            if (customizations && Object.keys(customizations).length > 0) {
                payload.customizations = customizations;
                safeLog('ðŸ“ Sending customizations with video generation:', customizations);
            }
            
            // 🎨 Add ranking customizations if they exist
            if (rankingCustomizations && Object.keys(rankingCustomizations).length > 0) {
                payload.ranking_customizations = rankingCustomizations;
                // Style lock survives AI title merge on the backend
                payload.ranking_style_lock = rankingCustomizations;
                safeLog('Sending ranking customizations:', Object.keys(rankingCustomizations));
            }

            if (templateId === 'splitscreen' && typeof window.getSplitscreenConfig === 'function') {
                Object.assign(payload, window.getSplitscreenConfig());
            }

            if ((templateId === 'splitscreen' || templateId === 'ranked_compilation')
                && typeof window.getMultiGenCount === 'function') {
                const clipCount = Math.max(1, Number(window.getMultiGenCount()) || 1);
                payload.clip_count = clipCount;
                payload.series_mode = clipCount > 1;
            }

            if (typeof window.isClipIntentEnabled === 'function' && window.isClipIntentEnabled()) {
                const clipIntent = (typeof window.getClipIntentText === 'function')
                    ? window.getClipIntentText()
                    : '';
                if (clipIntent) {
                    payload.clip_intent = clipIntent;
                }
            }

            let response = await fetch(`${API_BASE_URL}/clips/start`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            // CSRF expired (e.g. after server restart) — refresh token and retry once
            if (response.status === 403) {
                const csrfErr = await response.clone().json().catch(() => ({}));
                if (csrfErr.code === 'CSRF_INVALID' && typeof initializeCSRFToken === 'function') {
                    await initializeCSRFToken();
                    response = await fetch(`${API_BASE_URL}/clips/start`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        credentials: 'include',
                        body: JSON.stringify(payload)
                    });
                }
            }


            if (response.status === 401) {
                this._rollbackOptimisticStart(optimisticItemId, 'Session expired. Please try again.');
                showNotification('Session expired. Please try again.', 'error');
                return;
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Handle 429 status specifically
                if (response.status === 429) {
                   
                    // ✅ NEW: Handle CONCURRENT_GENERATION_BLOCKED
                    if (errorData.error_code === 'CONCURRENT_GENERATION_BLOCKED') {
                        this._rollbackOptimisticStart(
                            optimisticItemId,
                            errorData.error || 'Another generation is already running.',
                        );
                        showNotification(errorData.error, 'error');
                        return;
                    }
                    
                    // Handle GENERATION_COOLDOWN (per-tier cooldown limit)
                    if (errorData.error_code === 'GENERATION_COOLDOWN') {
                        this._rollbackOptimisticStart(
                            optimisticItemId,
                            errorData.error || 'Please wait before starting another generation.',
                        );
                        const remainingSeconds = errorData.remaining_seconds || errorData.cooldown_seconds || 30;
                        
                        // Start countdown timer on submit button
                        startCooldownTimer(remainingSeconds);
                        
                        showNotification(errorData.error, 'error');
                        return;
                    }
                    
                    // Handle other 429 errors
                    if (errorData.error_code === 'MAX_EFFORT_LIMIT_REACHED') {
                        this._rollbackOptimisticStart(
                            optimisticItemId,
                            errorData.error || 'Max effort daily limit reached. Switch to Normal effort.',
                        );
                        showNotification(errorData.error || 'Max effort daily limit reached. Switch to Normal effort.', 'error');
                        try {
                            if (typeof window.setSelectedEffortMode === 'function') {
                                window.setSelectedEffortMode('normal');
                            }
                            if (typeof window.refreshPlanSelector === 'function') {
                                window.refreshPlanSelector();
                            }
                        } catch (_) {}
                        return;
                    }
                    if (errorData.error_code === 'DAILY_LIMIT_REACHED' || errorData.error_code === 'MONTHLY_LIMIT_REACHED') {
                        this._rollbackOptimisticStart(
                            optimisticItemId,
                            errorData.error || 'Generation limit reached — upgrade or wait for reset.',
                        );
                        this._notifyGenerationBlock(null, errorData);
                        try {
                            if (typeof window.refreshPlanSelector === 'function') {
                                window.refreshPlanSelector();
                            }
                        } catch (_) {}
                        return;
                    }
                    if (errorData.error_code === 'VIDEO_LIMIT_REACHED') {
                        this._rollbackOptimisticStart(
                            optimisticItemId,
                            errorData.error || 'Library is full — free a slot or upgrade.',
                        );
                        this._notifyGenerationBlock({
                            storage_limit_reached: true,
                            plan_type: errorData.plan_type,
                        }, errorData);
                        return;
                    }
                    this._rollbackOptimisticStart(
                        optimisticItemId,
                        errorData.error || 'Rate limit reached. Please try again later.',
                    );
                    showNotification(errorData.error || 'Rate limit reached. Please try again later.', 'error');
                    return;
                }
                if (response.status === 503 && errorData.error_code === 'SERVER_AT_CAPACITY') {
                    const capMsg = errorData.error || errorData.message
                        || 'Our servers are at capacity right now. Please try again in a few minutes or upload your video directly.';
                    this._rollbackOptimisticStart(optimisticItemId, capMsg);
                    showNotification(capMsg, 'error');
                    return;
                } else if (errorData.error_code === 'VIDEO_TOO_LONG') {
                    const videoMinutes = errorData.video_minutes || 0;
                    const maxMinutes = errorData.max_duration_minutes || 0;
                    const tooLongMsg = errorData.error
                        || `Source exceeds the ${maxMinutes}m safety limit (${videoMinutes}m).`;
                    this._rollbackOptimisticStart(optimisticItemId, tooLongMsg);
                    showNotification(tooLongMsg, 'error');
                    return;
                } else {
                    const errorMsg = errorData.error || 'Failed to start processing';
                    this._rollbackOptimisticStart(optimisticItemId, errorMsg);
                    showNotification(errorMsg, 'error');
                    throw new Error(errorMsg);
                }
            }

            const result = await response.json();
            this.currentProjectId = result.project_id;

            try {
                window.solisQuotaDisplay?.markEverGenerated?.();
                if (typeof window.refreshPlanSelector === 'function') {
                    window.refreshPlanSelector();
                } else {
                    window.solisQuotaDisplay?.syncUpgradeCard?.(window.currentUser);
                }
            } catch (_) {}

            // Free first-gen grace is consumed once a project exists — flip to Upgrade CTA
            try {
                this._watermarkCheckCache = null;
                const policy = await this.resolveWatermarkPolicy(true);
                this.applyWatermarkControls(policy);
            } catch (_) {}

            const processingItem = this.processingItems.find(i => i.id === optimisticItemId);
            if (processingItem) {
                processingItem.projectId = this.currentProjectId;
                processingItem.optimistic = false;
                processingItem.templateName = result.template.name;
                processingItem.name = `${result.template.name} from YouTube`;
                processingItem.message = 'Starting download...';
                this.saveProcessingItems();
            } else {
                const fallbackItem = {
                    id: optimisticItemId,
                    projectId: this.currentProjectId,
                    name: `${result.template.name} from YouTube`,
                    template: templateId,
                    templateName: result.template.name,
                    status: 'processing',
                    progress: 0,
                    message: 'Starting download...',
                    timestamp: new Date(),
                    lastChecked: Date.now(),
                    slotNumber: null,
                    useSlotSystem: true,
                    isSlotSystem: true,
                };
                this.addProcessingItem(fallbackItem);
            }

            
            if (spinner) {
                const urlVal = document.getElementById('youtubeUrlInput')?.value?.trim() || '';
                const source = (typeof this.resolveSourceVideoCardMeta === 'function'
                    ? this.resolveSourceVideoCardMeta(urlVal)
                    : {}) || {};
                const prevOpts = spinner.activeTemplateOptions || {};
                const videoTitle = source.title
                    || prevOpts.videoTitle
                    || prevOpts.title
                    || 'Your video';
                const spinnerOptions = {
                    ...prevOpts,
                    ...(templateId === 'splitscreen' && typeof window.getSplitscreenConfig === 'function'
                        ? { secondaryType: window.getSplitscreenConfig().splitscreen_secondary_type }
                        : {}),
                    videoTitle,
                    title: videoTitle,
                    thumbnailUrl: source.thumbnailUrl || prevOpts.thumbnailUrl || null,
                    videoId: source.videoId || prevOpts.videoId || null,
                };
                const queueStatus = result?.queue?.queue_status;
                const usersAhead = Number(result?.queue?.users_ahead);
                const reallyWaiting = queueStatus === 'waiting'
                    || (Number.isFinite(usersAhead) && usersAhead > 0);
                const queueMsg = result?.message
                    || (reallyWaiting
                        ? 'We’re experiencing very high demand — your generation will be ready soon.'
                        : 'Starting upload...');
                spinner.startGeneration(
                    result.project_id,
                    queueMsg,
                    templateId,
                    spinnerOptions,
                );
                if (result?.queue) {
                    spinner.updateProgress(
                        result.project_id,
                        reallyWaiting ? 1 : 3,
                        queueMsg,
                        true,
                        result.queue,
                    );
                }
            } else {
                console.warn('[GENERATION] Spinner not initialized! Trying fallback wrapper...');
                const wrapper = document.getElementById('generationProgressWrapper');
                if (wrapper) {
                    wrapper.style.display = 'flex';
                }
            }

            if (typeof window.refreshPlanSelector === 'function') {
                window.refreshPlanSelector();
            }

            // After generation starts, surface library storage pressure on the badge
            try {
                const used = window.clipsStudio?.libraryItems?.length
                    ?? Number(document.getElementById('storageUsedBadge')?.textContent || 0);
                const plan = (document.getElementById('storagePlanBadge')?.textContent || 'free').toLowerCase();
                const unlimited = typeof window.isUnlimitedLibrary === 'function'
                    && window.isUnlimitedLibrary(null, plan);
                const limit = unlimited ? null : (Number(document.getElementById('storageTotalBadge')?.textContent || 0) || 5);
                if (typeof window.applyStorageBadgeUI === 'function') {
                    window.applyStorageBadgeUI({ used, limit, plan, unlimited });
                }
                if (!unlimited) {
                    const phase = window.getStoragePhase?.(used, limit, plan)?.phase;
                    if ((phase === 'high' || phase === 'full') && typeof window.pulseStorageBadgeWarning === 'function') {
                        window.pulseStorageBadgeWarning();
                    }
                }
            } catch (_) { /* ignore badge update failures */ }
            
            if (solisWSClient && result.project_id) {
                solisWSClient.registerTask(result.project_id, 'processing');
            }
            
            this.startMonitoring(optimisticItemId);
            this._generationStartInFlight = false;

            try {
                if (window.SolisMemory && typeof window.SolisMemory.recordFromGeneration === 'function') {
                    const isRanking = templateId === 'ranked_compilation'
                        || String(templateId || '').toLowerCase().includes('rank');
                    const memStyles = isRanking
                        ? (rankingCustomizations || customizations || null)
                        : null;
                    const memCaps = isRanking
                        ? null
                        : ((payload && payload.caption_style) || null);
                    const memLayout = templateId === 'splitscreen' && typeof window.getSplitscreenConfig === 'function'
                        ? window.getSplitscreenConfig()
                        : null;
                    window.SolisMemory.recordFromGeneration(
                        templateId,
                        memStyles,
                        memCaps,
                        memLayout
                    );
                }
            } catch (_) { /* ignore memory errors */ }

            try { this._noteSuccessfulGenerate(templateId); } catch (_) { /* ignore */ }

            // Disarm template→URL so the next run can be URL→template again.
            // Failed starts keep selectedTemplate so retry still works without re-picking.
            this.cancelTemplateSelection();
            // Keep Use Template locked only while this run is active; unlock on complete via spinner.
            // If start succeeded, URL button stays locked until complete — confirm stays locked too
            // until completeGeneration → _unlockUrlSubmitButton.

        } catch (error) {
            this._rollbackOptimisticStart(
                optimisticItemId,
                error?.message ? `Failed to start: ${error.message}` : null,
            );
            safeLog('startClipProcessingWithSlots error:', error);
            showNotification('Failed to start processing: ' + error.message, 'error');
        }
    }

    startMonitoring(itemId) {
        // Clear existing interval for this item
        this.stopMonitoring(itemId);

        const intervalId = setInterval(async () => {
            const item = this.processingItems.find(i => i.id === itemId);
            if (!item) {
                this.stopMonitoring(itemId);
                return;
            }

            // Spinner already owns live status for this project — don't triple-poll
            try {
                const spin = window.generationProgressSpinner;
                if (spin?.activeGenerations?.has?.(item.projectId)) {
                    if (item.status === 'processing') return;
                    this.stopMonitoring(itemId);
                    return;
                }
            } catch (_) { /* ignore */ }

            // Check status while item is processing (on any tab)
            if (item.status === 'processing') {
                await this.checkItemStatus(itemId);
            } else {
                this.stopMonitoring(itemId);
            }
        }, 10000);

        this.monitoringIntervals.set(itemId, intervalId);
    }

    stopMonitoring(itemId) {
        if (this.monitoringIntervals.has(itemId)) {
            clearInterval(this.monitoringIntervals.get(itemId));
            this.monitoringIntervals.delete(itemId);
        }
    }

    stopAllMonitoring() {
        this.monitoringIntervals.forEach((intervalId, itemId) => {
            clearInterval(intervalId);
        });
        this.monitoringIntervals.clear();
    }

    async checkItemStatus(itemId) {
        try {
            const item = this.processingItems.find(i => i.id === itemId);
            if (!item || !item.projectId || item.optimistic) return;

            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/clips/status/${item.projectId}`, {
                headers: headers,
                credentials: 'include'  // ðŸ” Send httpOnly cookie
            });
            
            if (!response.ok) return;
            
            const status = await response.json();

            // Only update if status actually changed (reduce re-renders)
            const statusChanged = item.status !== status.status || item.progress !== status.progress;
            
            if (statusChanged) {
                // Update item
                item.status = status.status;
                item.progress = status.progress;
                item.message = status.message;
                item.lastChecked = Date.now();
                
                // Update slot number if available
                if (status.slot_number && item.isSlotSystem) {
                    item.slotNumber = status.slot_number;
                    item.name = `${item.templateName} (Slot ${status.slot_number})`;
                }
                
                // Update spinner with current progress
                const statusSpinner = typeof getGenerationProgressSpinner === 'function'
                    ? getGenerationProgressSpinner()
                    : window.generationProgressSpinner;
                if (statusSpinner) {
                    const message = status.message || {
                        'downloading': 'Downloading video...',
                        'processing': 'Processing moments...',
                        'rendering': 'Rendering video...',
                        'completed': 'Complete!'
                    }[status.status] || `${status.status}...`;
                    statusSpinner.updateProgress(item.projectId, status.progress, message, true);
                }

                this.updateProcessingView();
                // Also update library view if on that tab to show progress updates
                if (this.currentTab === 'library') {
                    this.updateLibraryView();
                }
                this.saveProcessingItems();
            }

            if (status.status === 'completed') {
                item.status = 'completed';

                const completeSpinner = typeof getGenerationProgressSpinner === 'function'
                    ? getGenerationProgressSpinner()
                    : window.generationProgressSpinner;
                if (completeSpinner) {
                    completeSpinner.completeGeneration(item.projectId);
                }
                this._unlockGenerationButtons();

                this.moveToLibrary(item);
                this.stopMonitoring(itemId);
                
                showNotification('Clip created successfully!', 'success');
                try {
                    const shareUrl = this.publicPreviewUrl(item.projectId);
                    if (shareUrl && navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(shareUrl).then(() => {
                            showNotification('Public preview link copied — share it anywhere', 'info');
                        }).catch(() => {});
                    }
                } catch (_) {}

                try {
                    this._watermarkCheckCache = null;
                    const policy = await this.resolveWatermarkPolicy(true);
                    this.applyWatermarkControls(policy);
                } catch (_) {}

                try {
                    this.invalidateLimitCheckCache?.();
                } catch (_) {}
                try {
                    sessionStorage.removeItem('solis_quota_rail_dismiss');
                } catch (_) {}
                if (typeof window.refreshPlanSelector === 'function') {
                    window.refreshPlanSelector();
                }
                
                // Re-enable the submit button when generation completes
                this._unlockGenerationButtons();
                
                // Show slot info if using slot system
                if (item.isSlotSystem && item.slotNumber) {
                    showNotification(`Clip added to Slot ${item.slotNumber}`, 'info');
                }
                
                // Keep library tab active to see the completed clip
                this.switchTab('library');
                this.updateProcessingView();
                this.saveProcessingItems();
            } else if (status.status === 'cancelled' || status.status === 'canceled') {
                item.status = 'cancelled';
                item.message = status.message || 'Stopped';
                const stopSpinner = typeof getGenerationProgressSpinner === 'function'
                    ? getGenerationProgressSpinner()
                    : window.generationProgressSpinner;
                if (stopSpinner?.stopGeneration) {
                    stopSpinner.stopGeneration(item.projectId, item.message);
                } else {
                    this._unlockGenerationButtons();
                }
                this.stopMonitoring(itemId);
                this.saveProcessingItems();
                this.updateProcessingView();
            } else if (status.status === 'error' || status.status === 'failed' || status.status === 'timeout') {
                item.status = 'failed';
                item.message = status.message; // Preserve error message for display

                const failSpinner = typeof getGenerationProgressSpinner === 'function'
                    ? getGenerationProgressSpinner()
                    : window.generationProgressSpinner;
                if (failSpinner?.failGeneration) {
                    failSpinner.failGeneration(item.projectId, status.message || 'There was an error — try again');
                }
                this._unlockGenerationButtons();
                this.stopMonitoring(itemId);
                
                // Re-enable the submit button on error
                const submitBtn = document.getElementById('processUrlBtn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('is-generating', 'is-cancelling');
                }
                
                // Remove failed item from processing after showing for a bit
                setTimeout(() => {
                    this.processingItems = this.processingItems.filter(i => i.id !== itemId);
                    this.updateLibraryView();
                    this.saveProcessingItems();
                    
                    // ⚡ Stop polling if no more processing items
                    if (this.processingItems.length === 0) {
                        this.stopLibraryPolling();
                    }
                }, 5000); // Show error for 5 seconds then remove
                
                // Check if error is about video being too long
                const errorMsg = status.message || '';
                safeLog('Processing error detected:', errorMsg);
                
                // Try to detect video too long error using multiple patterns
                // Pattern 1: Exact format "Video is too long. Maximum allowed: X minutes. Your video: Y minutes."
                const videoTooLongPattern1 = /Video is too long\. Maximum allowed:\s*(\d+)\s*minutes\. Your video:\s*(\d+)\s*minutes/i;
                // Pattern 2: Alternative format
                const videoTooLongPattern2 = /Maximum allowed:\s*(\d+)\s*minutes.*Your video:\s*(\d+)\s*minutes/i;
                // Pattern 3: Fallback with just looking for keywords
                const videoTooLongPattern3 = /too long|duration limit/i;
                

                let videoTooLongMatch = errorMsg.match(videoTooLongPattern1);
                safeLog('Pattern 1 match:', videoTooLongMatch);
                
                if (videoTooLongMatch && videoTooLongMatch.length >= 3) {
                    const maxMinutes = parseInt(videoTooLongMatch[1]);
                    const videoMinutes = parseInt(videoTooLongMatch[2]);
                    safeLog('✓ Video too long detected (pattern 1):', videoMinutes, 'max:', maxMinutes);
                    setTimeout(() => {
                        if (window && typeof window.openVideoTooLongModal === 'function') {
                            window.openVideoTooLongModal(videoMinutes, maxMinutes);
                        }
                    }, 100);
                } else {
                    // Try pattern 2
                    videoTooLongMatch = errorMsg.match(videoTooLongPattern2);
                    safeLog('Pattern 2 match:', videoTooLongMatch);
                    
                    if (videoTooLongMatch && videoTooLongMatch.length >= 3) {
                        const maxMinutes = parseInt(videoTooLongMatch[1]);
                        const videoMinutes = parseInt(videoTooLongMatch[2]);
                        safeLog('✓ Video too long detected (pattern 2):', videoMinutes, 'max:', maxMinutes);
                        setTimeout(() => {
                            if (window && typeof window.openVideoTooLongModal === 'function') {
                                window.openVideoTooLongModal(videoMinutes, maxMinutes);
                            }
                        }, 100);
                    } else if (videoTooLongPattern3.test(errorMsg)) {
                        // Fallback: Try to extract any numbers
                        safeLog('Pattern 3 match (keywords found), trying number extraction...');
                        const numbers = errorMsg.match(/\d+/g);
                        if (numbers && numbers.length >= 2) {
                            // Try to find the last two numbers (likely video duration and max duration)
                            const videoMinutes = parseInt(numbers[numbers.length - 2]);
                            const maxMinutes = parseInt(numbers[numbers.length - 1]);
                            if (videoMinutes > 0 && maxMinutes > 0 && videoMinutes > maxMinutes) {
                                safeLog('✓ Video too long detected (fallback):', videoMinutes, 'max:', maxMinutes);
                                setTimeout(() => {
                                    if (window && typeof window.openVideoTooLongModal === 'function') {
                                        window.openVideoTooLongModal(videoMinutes, maxMinutes);
                                    }
                                }, 100);
                            }
                        }
                    }
                }
                
                showNotification('Clip creation failed: ' + status.message, 'error');
            }
            // If still processing, continue monitoring

        } catch (error) {
            safeLog('Error checking status for item', itemId, error);
            // Don't stop monitoring on network errors, just try again next interval
        }
    }

    startSmartMonitoring() {
        // Only monitor items that are still processing
        this.processingItems.forEach(item => {
            if (item.status === 'processing') {
                this.startMonitoring(item.id);
            }
        });
    }

    // Long-form YouTube only
    isValidYouTubeUrl(urlString) {
        return this.isValidMediaUrl(urlString) &&
            !this.isShortFormUrl(urlString) &&
            this.detectMediaPlatform(urlString) === 'youtube';
    }

    /**
     * ðŸ” SECURITY: Validate projectId format to prevent path traversal/IDOR
     * NOTE: Backend MUST validate ownership - frontend validation is UX only
     */
    validateProjectId(projectId) {
        if (!projectId || typeof projectId !== 'string') return false;
        if (projectId.match(/\.\.|\/|\\|:|\||<|>|"|'|\x00/g)) return false;
        // Opaque public ids issued by the API (prj_ + random chars)
        if (/^prj_[A-Za-z0-9]{12,}$/.test(projectId)) return true;
        // Legacy internal ids (transition only; server enforces ownership)
        return /^[0-9]+_[a-zA-Z0-9-]+$/.test(projectId);
    }

    /**
     * ðŸ” SECURITY: Validate itemId format to prevent injection/IDOR
     * NOTE: Backend MUST validate ownership - frontend validation is UX only
     */
    validateItemId(itemId) {
        if (itemId == null || itemId === '') return false;
        const id = String(itemId);
        // Reject path traversal and injection attempts
        if (id.match(/\.\.|\/|\\|:|\||<|>|"|'|\x00/g)) return false;
        // Accept alphanumeric, dash, underscore, dot
        return /^[a-zA-Z0-9_.-]+$/.test(id);
    }

    clearUrlIfProcessingDone() {
        /**
         * 🧹 AUTO-CLEAR: Smart URL clearing on page load
         * - If user has ALREADY processed something (has processing items), clear the URL
         * - If user HASN'T processed anything yet, KEEP the URL (don't remove it)
         */
        try {
            const urlInput = document.getElementById('youtubeUrlInput');
            if (!urlInput) return;
            
            // Only clear URL if there are processing items (meaning user already did something)
            if (this.processingItems.length > 0) {
                urlInput.value = '';
                safeLog('🧹 Auto-cleared YouTube URL (processing already done)');
            } else {
                safeLog('✅ Keeping YouTube URL (no processing done yet)');
            }
        } catch (error) {
            safeLog('Error managing URL on page load:', error);
        }
    }

    /** Landing `/` pill paste → sessionStorage / ?url= → fill create URL + run template flow */
    consumeLandingPendingUrl() {
        try {
            const PENDING_KEY = 'solis_pending_youtube_url';
            let pending = '';
            try {
                pending = (sessionStorage.getItem(PENDING_KEY) || '').trim();
                if (pending) sessionStorage.removeItem(PENDING_KEY);
            } catch (_) { /* ignore */ }

            if (!pending) {
                try {
                    const params = new URLSearchParams(window.location.search || '');
                    pending = (params.get('url') || params.get('youtube') || '').trim();
                    if (pending) {
                        params.delete('url');
                        params.delete('youtube');
                        const qs = params.toString();
                        history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || ''));
                    }
                } catch (_) { /* ignore */ }
            }

            if (!pending) return;
            if (!pending.startsWith('http')) pending = 'https://' + pending;
            if (!this.isValidMediaUrl(pending)) {
                safeLog('Landing pending URL rejected (invalid):', pending);
                return;
            }

            const apply = () => {
                try {
                    this.goToCreateUrlSubmit();
                } catch (_) {
                    try { this.switchTab('create'); } catch (__) { /* ignore */ }
                }
                const urlInput = document.getElementById('youtubeUrlInput');
                if (!urlInput) return;
                urlInput.value = pending;
                try {
                    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                } catch (_) { /* ignore */ }
                this.syncTemplateConfirmButton?.();
                this._scheduleAutoSubmitFromPaste({ quiet: true });
            };

            // Wait a tick so create tab / URL field are ready after init switchTab
            requestAnimationFrame(() => setTimeout(apply, 120));
        } catch (err) {
            safeLog('consumeLandingPendingUrl failed:', err);
        }
    }

    toggleUrlButtonLoading(isLoading) {
        const submitBtn = document.getElementById('processUrlBtn');
        if (!submitBtn) return;

        if (isLoading) {
            this.clearUrlSubmitUpgradeCta({ keepLoading: true });
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            // ✅ SECURITY FIX: Persist button state to sessionStorage to prevent refresh bypass
            sessionStorage.setItem('urlButtonLockeduntil', Date.now().toString());
            sessionStorage.setItem('urlButtonLocked', 'true');
        } else {
            submitBtn.classList.remove('loading');
            if (!submitBtn.classList.contains('is-upgrade-cta')) {
                submitBtn.disabled = false;
            }
            // Clear persistent lock
            sessionStorage.removeItem('urlButtonLocked');
            sessionStorage.removeItem('urlButtonLockeduntil');
        }
    }

    /**
     * After loading dots: morph submit into Upgrade when free (or any) user
     * ignores quota and still tries to generate.
     */
    showUrlSubmitUpgradeCta({ holdDotsMs = 480 } = {}) {
        const submitBtn = document.getElementById('processUrlBtn');
        if (!submitBtn) return;

        clearTimeout(this._urlUpgradeCtaTimer);
        this._urlUpgradeCtaPending = true;
        submitBtn.classList.add('loading');
        submitBtn.classList.remove('is-upgrade-cta');
        submitBtn.disabled = true;

        const morph = () => {
            this._urlUpgradeCtaPending = false;
            submitBtn.classList.remove('loading');
            submitBtn.classList.add('is-upgrade-cta');
            submitBtn.disabled = false;
            submitBtn.setAttribute('aria-label', 'Upgrade');
            submitBtn.title = 'Upgrade for more daily uploads';
            sessionStorage.removeItem('urlButtonLocked');
            sessionStorage.removeItem('urlButtonLockeduntil');
        };

        if (holdDotsMs <= 0) {
            morph();
            return;
        }
        this._urlUpgradeCtaTimer = setTimeout(morph, holdDotsMs);
    }

    clearUrlSubmitUpgradeCta({ keepLoading = false } = {}) {
        clearTimeout(this._urlUpgradeCtaTimer);
        this._urlUpgradeCtaTimer = null;
        this._urlUpgradeCtaPending = false;
        const submitBtn = document.getElementById('processUrlBtn');
        if (!submitBtn) return;
        submitBtn.classList.remove('is-upgrade-cta');
        if (!keepLoading) submitBtn.classList.remove('loading');
        if (!submitBtn.classList.contains('is-generating')) {
            submitBtn.disabled = false;
            submitBtn.setAttribute('aria-label', 'Continue');
            submitBtn.removeAttribute('title');
        }
    }

    openUrlSubmitUpgrade() {
        try {
            this.openWatermarkPlanPopover({ reason: 'quota' });
            return;
        } catch (_) { /* fall through */ }
        const title = 'Free upload used';
        const subtitle =
            "You've used your free upload for today. Upgrade anytime for more daily clips.";
        if (typeof window.showUpgradeModal === 'function') {
            window.showUpgradeModal(title, subtitle);
        } else if (typeof openUpgradeModal === 'function') {
            openUpgradeModal();
        } else {
            showNotification(subtitle, 'warning');
        }
    }

    // ✅ SECURITY FIX: Check for persistent rate limit on page load
    enforceUrlButtonRateLimitOnLoad() {
        const submitBtn = document.getElementById('processUrlBtn');
        if (!submitBtn) return;
        
        // Check if button should be locked from sessionStorage
        const isLocked = sessionStorage.getItem('urlButtonLocked') === 'true';
        const lockedUntil = sessionStorage.getItem('urlButtonLockeduntil');
        
        if (isLocked && lockedUntil) {
            const lockedUntilTime = parseInt(lockedUntil, 10);
            const now = Date.now();
            const remainingMs = lockedUntilTime - now;
            
            // If still within cooldown window, re-enable the lock
            if (remainingMs > 0) {
                const COOLDOWN_MS = CONFIG.RATE_LIMITING.YOUTUBE_PROCESS_MIN_MS || 3000;
                if (remainingMs < COOLDOWN_MS + 5000) { // Add 5s buffer for processing time
                    submitBtn.disabled = true;
                    submitBtn.style.cursor = 'not-allowed';
                    submitBtn.style.opacity = '0.5';
                    submitBtn.classList.add('loading');
                    
                    // Auto-unlock when timer expires
                    const unlockTimer = setTimeout(() => {
                        submitBtn.disabled = false;
                        submitBtn.style.cursor = 'pointer';
                        submitBtn.style.opacity = '1';
                        submitBtn.classList.remove('loading');
                        sessionStorage.removeItem('urlButtonLocked');
                        sessionStorage.removeItem('urlButtonLockeduntil');
                    }, remainingMs);
                    
                    // Store timer ID so it can be cancelled if needed
                    submitBtn._unlockTimer = unlockTimer;
                }
            } else {
                // Lock expired, clear it
                sessionStorage.removeItem('urlButtonLocked');
                sessionStorage.removeItem('urlButtonLockeduntil');
            }
        }
    }

    // ── Zero-click URL → best template preview ──────────────────────────
    _autoPreviewStorageKey() {
        try {
            const uid = window.currentUser?.id || window.currentUser?.user_id || 'anon';
            return `solis_auto_preview_v1_${uid}`;
        } catch (_) {
            return 'solis_auto_preview_v1_anon';
        }
    }

    _readAutoPreviewState() {
        try {
            const raw = localStorage.getItem(this._autoPreviewStorageKey());
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return {
                        mode: ['auto', 'suggest', 'off'].includes(parsed.mode) ? parsed.mode : 'auto',
                        preferredTemplateId: parsed.preferredTemplateId || null,
                        closes: Number(parsed.closes) || 0,
                    };
                }
            }
        } catch (_) { /* ignore */ }
        return { mode: 'auto', preferredTemplateId: null, closes: 0 };
    }

    _writeAutoPreviewState(patch) {
        try {
            const next = { ...this._readAutoPreviewState(), ...(patch || {}) };
            localStorage.setItem(this._autoPreviewStorageKey(), JSON.stringify(next));
            return next;
        } catch (_) {
            return this._readAutoPreviewState();
        }
    }

    _userPlanSlug() {
        try {
            return String(
                window.currentUser?.plan
                || window.currentUser?.plan_type
                || 'free'
            ).toLowerCase();
        } catch (_) {
            return 'free';
        }
    }

    _canPreferClipTemplate() {
        const paid = new Set(['basic', 'prime', 'elite', 'pro', 'nextgen']);
        return paid.has(this._userPlanSlug());
    }

    _pickBestTemplateId() {
        const state = this._readAutoPreviewState();
        const catalog = this.templates || this.getTemplateCatalog?.() || {};
        const valid = (id) => id && catalog[id];

        // Prefer remembered choice, else Clip (MOST USED product default)
        if (valid(state.preferredTemplateId)) return state.preferredTemplateId;

        try {
            const mem = window.SolisMemory?.readState?.();
            const log = Array.isArray(mem?.usageLog) ? mem.usageLog : [];
            for (const row of log) {
                const tid = row?.templateId || row?.template_id || row?.id;
                if (valid(tid)) return tid;
            }
        } catch (_) { /* ignore */ }

        if (valid('splitscreen')) return 'splitscreen';
        if (valid('ranked_compilation')) return 'ranked_compilation';
        return Object.keys(catalog)[0] || 'splitscreen';
    }

    _scheduleAutoSubmitFromPaste(opts = {}) {
        clearTimeout(this._pasteAutoSubmitT);
        const delay = opts.quiet ? 380 : 60;
        this._pasteAutoSubmitT = setTimeout(() => {
            try {
                const url = document.getElementById('youtubeUrlInput')?.value.trim() || '';
                if (!url || !this.isValidMediaUrl(url)) return;
                if (this._urlAnalyzeInFlight || this._generationStartInFlight) return;
                const btn = document.getElementById('processUrlBtn');
                if (btn?.classList.contains('is-generating') || btn?.classList.contains('is-upgrade-cta')) return;
                if (document.getElementById('templatePreviewModal')?.classList.contains('active')) return;
                if (this._awaitingUrlForTemplate) return;
                // Allow re-paste of same URL if preview never opened
                const modalOpen = document.getElementById('templatePreviewModal')?.classList.contains('active');
                if (
                    this._lastAutoSubmittedUrl === url
                    && Date.now() - (this._lastAutoSubmittedAt || 0) < 1500
                    && modalOpen
                ) {
                    return;
                }
                this._lastAutoSubmittedUrl = url;
                this._lastAutoSubmittedAt = Date.now();
                this.processYouTubeUrl();
            } catch (_) { /* ignore */ }
        }, delay);
    }

    _forceTemplatesSection() {
        try {
            if (typeof window.switchSection === 'function') {
                window.switchSection('clips');
            }
        } catch (_) { /* ignore */ }

        // Dismiss URL sheet immediately so Templates + preview aren't covered
        try {
            if (typeof window.closeMobileCreateSheet === 'function') {
                window.closeMobileCreateSheet({ immediate: true });
            }
        } catch (_) { /* ignore */ }

        // One clean tab switch — avoid double-calling mobile swipe + switchTab
        const mobile = typeof window !== 'undefined' && window.innerWidth <= 768;
        try {
            if (mobile && typeof window.goMobileClipsTab === 'function') {
                window.goMobileClipsTab('templates');
            } else {
                this.switchTab('templates');
            }
        } catch (_) {
            try { this.switchTab('templates'); } catch (__) { /* ignore */ }
        }

        // Clear leftover inline styles that fight CSS transitions
        const templates = document.getElementById('templatesSection');
        const create = document.getElementById('createSection');
        const library = document.getElementById('librarySection');
        if (templates) {
            templates.classList.add('active');
            templates.style.removeProperty('display');
            templates.style.removeProperty('visibility');
            templates.style.removeProperty('opacity');
            templates.style.removeProperty('transform');
            templates.style.display = 'block';
        }
        [create, library].forEach((el) => {
            if (!el) return;
            el.classList.remove('active');
            el.classList.remove('clips-slide-from-left', 'clips-slide-from-right', 'clips-drag', 'clips-drag-snap');
            el.style.removeProperty('transform');
            el.style.removeProperty('opacity');
            el.style.display = 'none';
        });
        document.querySelectorAll('.clips-tab, .clips-sub-item').forEach((el) => {
            el.classList.toggle('active', el.getAttribute('data-tab') === 'templates');
        });
        try { this.moveSlider(); } catch (_) { /* ignore */ }
        try {
            localStorage.setItem('clipsStudioCurrentTab', 'templates');
            localStorage.setItem('clipsActiveTab', 'templates');
        } catch (_) { /* ignore */ }
        if (typeof window.updateMobileClipsPillIndicator === 'function' && mobile) {
            try { window.updateMobileClipsPillIndicator('templates'); } catch (_) { /* ignore */ }
        }
    }

    _highlightMostUsedTemplate(templateId) {
        const tid = templateId || 'splitscreen';
        document.querySelectorAll('.template-card').forEach((card) => {
            const on = card.dataset.template === tid;
            card.classList.toggle('is-most-used', on);
            // Soft ring only — don't also apply orange .selected (breaks the outline)
            card.classList.remove('selected');
            let tag = card.querySelector('.most-used-outline-tag');
            if (on) {
                if (!tag) {
                    tag = document.createElement('span');
                    tag.className = 'most-used-outline-tag';
                    tag.textContent = 'MOST USED';
                    card.appendChild(tag);
                }
                tag.hidden = false;
                tag.removeAttribute('hidden');
            } else if (tag) {
                tag.hidden = true;
            }
        });
    }

    _continueAfterUrlReady(url) {
        try {
            this._writeAutoPreviewState({ mode: 'auto' });
        } catch (_) { /* ignore */ }

        const tid = this._pickBestTemplateId();
        this.selectedTemplate = tid;

        // 1) Switch to Templates cleanly
        this._forceTemplatesSection();
        // 2) Soft light ring on the popular card
        this._highlightMostUsedTemplate(tid);

        const card = document.querySelector(`.template-card[data-template="${tid}"]`);
        const previewContainer = document.getElementById('clipPreviewContainer');
        if (previewContainer) previewContainer.style.display = 'block';

        const openNow = () => {
            try {
                const modal = document.getElementById('templatePreviewModal');
                if (modal?.classList.contains('active') && this.currentTemplateForPreview?.id === tid) {
                    return;
                }
                this.openTemplatePreviewModal(tid, card, { fromAuto: true });
            } catch (err) {
                safeLog('auto-open template preview failed:', err);
            }
        };

        // Let Templates fade in, then open preview (avoids janky cut)
        clearTimeout(this._autoOpenPreviewT);
        this._autoOpenPreviewT = setTimeout(openNow, 260);
    }

    _noteAutoPreviewClosed() {
        if (!this._autoOpenedPreview) return;
        const state = this._readAutoPreviewState();
        const tid = this.currentTemplateForPreview?.id || this.selectedTemplate || state.preferredTemplateId;
        // Remember preferred template only — keep auto-open on for the next paste
        this._writeAutoPreviewState({
            mode: 'auto',
            preferredTemplateId: tid || state.preferredTemplateId,
            closes: (state.closes || 0) + 1,
        });
        this._autoOpenedPreview = false;
    }

    _noteManualTemplateSwitch(templateId) {
        if (!this._autoOpenedPreview) return;
        const prev = this.currentTemplateForPreview?.id;
        if (prev && templateId && prev !== templateId) {
            // Remember their new pick; keep auto-open for next paste
            this._writeAutoPreviewState({
                mode: 'auto',
                preferredTemplateId: templateId,
                closes: this._readAutoPreviewState().closes || 0,
            });
            this._autoOpenedPreview = false;
        }
    }

    _noteSuccessfulGenerate(templateId) {
        if (!templateId) return;
        this._writeAutoPreviewState({
            mode: 'auto',
            preferredTemplateId: templateId,
            closes: 0,
        });
        this._autoOpenedPreview = false;
    }

    async processYouTubeUrl() {
        // Prevent double-fire (HTML onclick + listener) and rapid re-entry
        if (this._urlAnalyzeInFlight || this._generationStartInFlight) {
            return;
        }
        if (document.getElementById('processUrlBtn')?.classList.contains('is-generating')) {
            showNotification('A video is already generating. Please wait for it to finish.', 'warning');
            return;
        }

        // Close plan popover immediately — it's portaled to <body> and would
        // otherwise stay floating after we switch to the templates tab.
        if (typeof window.closePlanSelectorPopover === 'function') {
            window.closePlanSelectorPopover(true);
        }

        // ⚠ï¸ SECURITY: Client-side rate limiting is UX only, NOT security
        // Attackers can disable JavaScript or send requests directly to API
        // BACKEND MUST enforce rate limiting on the server
        const now = Date.now();
        if (now - this.lastYouTubeProcessTime < CONFIG.RATE_LIMITING.YOUTUBE_PROCESS_MIN_MS) {
            showNotification('Please wait a moment before trying again', 'warning');
            return;
        }
        this.lastYouTubeProcessTime = now;
        this._urlAnalyzeInFlight = true;

        try {
        const urlInput = document.getElementById('youtubeUrlInput');
        if (!urlInput) return;
        
        const url = urlInput.value.trim();
        
        // 🧹 AUTO-CLEAR: Save the URL being processed so we can auto-clear it on refresh
        if (url) {
            sessionStorage.setItem('lastProcessedYouTubeUrl', url);
        }
        
        if (!url) {
            showNotification('Please enter a video URL', 'error');
            return;
        }

        if (!this.isValidMediaUrl(url)) {
            showNotification(
                this.getMediaUrlError(url),
                'error'
            );
            return;
        }

        // Block short-form URLs for free/basic users — uses cached subscription
        if (this.isShortFormUrl(url)) {
            const canUpload = await this.canUseShortFormUpload();
            if (!canUpload) {
                this.showShortFormUploadModal();
                return;
            }
        }

        this.toggleUrlButtonLoading(true);

            const durationPromise = this._getCachedDurationCheck(url);
            const limitData = await this._getCachedLimitCheck(true);

            if (limitData) {
                try {
                    if (typeof window.updateUrlQuotaRail === 'function') {
                        window.updateUrlQuotaRail(limitData);
                    }
                } catch (_) {}
                const dailyRemaining = limitData.daily?.remaining;
                const monthlyRemaining = limitData.monthly?.remaining;
                if (limitData.daily_limit_reached || dailyRemaining === 0) {
                    this.showUrlSubmitUpgradeCta();
                    try {
                        this.openWatermarkPlanPopover({ reason: 'quota' });
                    } catch (_) {}
                    try {
                        if (typeof window.updateUrlQuotaRail === 'function') {
                            window.updateUrlQuotaRail(limitData);
                        }
                    } catch (_) {}
                    try {
                        sessionStorage.removeItem('solis_quota_rail_dismiss');
                    } catch (_) {}
                    try {
                        if (typeof window.refreshPlanSelector === 'function') {
                            window.refreshPlanSelector();
                        }
                    } catch (_) {}
                    return;
                }
                if (limitData.monthly_limit_reached || (limitData.monthly?.limit > 0 && monthlyRemaining === 0)) {
                    this.showUrlSubmitUpgradeCta();
                    try {
                        this.openWatermarkPlanPopover({ reason: 'quota' });
                    } catch (_) {}
                    try {
                        if (typeof window.refreshPlanSelector === 'function') {
                            window.refreshPlanSelector();
                        }
                    } catch (_) {}
                    return;
                }
                const maxEffort = limitData.max_effort;
                if (
                    maxEffort
                    && maxEffort.limit > 0
                    && maxEffort.remaining <= 0
                    && typeof window.getSelectedEffortMode === 'function'
                    && window.getSelectedEffortMode() === 'max'
                ) {
                    if (typeof window.setSelectedEffortMode === 'function') {
                        window.setSelectedEffortMode('normal');
                    }
                }

                // URL step: daily/monthly already handled above.
                // Library/storage: warn only — still let them pick a template;
                // generation start enforces the hard block.
                if (!limitData.can_generate) {
                    if (limitData.block_reason === 'library_full' || limitData.block_reason === 'storage_full') {
                        this._notifyGenerationBlock(limitData);
                        if (typeof window.syncStorageLimitsFromStatus === 'function') {
                            window.syncStorageLimitsFromStatus(limitData);
                        }
                    } else if (limitData.is_generating || limitData.block_reason === 'in_progress') {
                        showNotification(
                            'An upload may still be finishing. You can pick a template — we\'ll retry when you confirm.',
                            'warning'
                        );
                    } else if ((limitData.generation?.cooldown_remaining_seconds || 0) > 0) {
                        this._notifyGenerationBlock(limitData);
                    }
                }
            }

            const durationQuick = await Promise.race([
                durationPromise,
                new Promise((resolve) => setTimeout(() => resolve({ allowed: true, pending: true }), 500)),
            ]);

            const templateArmed = !!(
                this._awaitingUrlForTemplate
                && this.selectedTemplate
                && this.templates[this.selectedTemplate]
            );

            if (durationQuick.pending) {
                // Template-first (Use template → Create): stay on Create and start once length check finishes
                if (templateArmed) {
                    showNotification('Checking video length…', 'info');
                    this._pendingDurationCheck = durationPromise;
                    durationPromise.then((result) => {
                        if (this._pendingDurationCheck !== durationPromise) return;
                        this._pendingDurationCheck = null;
                        if (!result.allowed) return;
                        this._rememberVideoDuration(result);
                        const submitBtn = document.getElementById('processUrlBtn');
                        submitBtn?.classList.remove('needs-url-pulse');
                        this._awaitingUrlForTemplate = false;
                        this.startClipProcessingWithSlots(url, this.selectedTemplate);
                    });
                    return;
                }

                showNotification('Checking video length…', 'info');
                this._pendingDurationCheck = durationPromise;
                durationPromise.then((result) => {
                    if (this._pendingDurationCheck !== durationPromise) return;
                    this._pendingDurationCheck = null;
                    if (!result.allowed) {
                        this.switchTab('create');
                        return;
                    }
                    this._rememberVideoDuration(result);
                    this._continueAfterUrlReady(url);
                });
                return;
            }

            if (!durationQuick.allowed) {
                return;
            }

            this._rememberVideoDuration(durationQuick);

            const storagePhase = typeof window.syncStorageLimitsFromStatus === 'function'
                ? window.syncStorageLimitsFromStatus(limitData)
                : null;

            // Nearly full: highlight storage badge (no toast). Hard-full still redirects above.
            if (storagePhase?.phase === 'high' || storagePhase?.phase === 'full') {
                if (typeof window.pulseStorageBadgeWarning === 'function') {
                    window.pulseStorageBadgeWarning();
                }
            }

            // Template-first only when explicitly armed (Use template → URL submit)
            if (templateArmed) {
                const submitBtn = document.getElementById('processUrlBtn');
                submitBtn?.classList.remove('needs-url-pulse');
                this._awaitingUrlForTemplate = false;
                this.startClipProcessingWithSlots(url, this.selectedTemplate);
                return;
            }

            // URL-first: paste/submit → best template preview (almost zero clicks)
            this._continueAfterUrlReady(url);
        } finally {
            this._urlAnalyzeInFlight = false;
            // Keep dots alive while morphing into Upgrade CTA
            if (!this._urlUpgradeCtaPending && !document.getElementById('processUrlBtn')?.classList.contains('is-upgrade-cta')) {
                this.toggleUrlButtonLoading(false);
            }
        }
    }

    // Returns cached duration check or fetches fresh — 5 min TTL per URL
    _rememberVideoDuration(result) {
        if (!result || typeof result !== 'object') return;
        const secs = Number(result.duration_seconds);
        const mins = Number(result.duration);
        if (Number.isFinite(secs) && secs > 0) {
            this._lastVideoDurationSeconds = secs;
            this._lastVideoDurationMinutes = secs / 60;
        } else if (Number.isFinite(mins) && mins > 0) {
            this._lastVideoDurationMinutes = mins;
            this._lastVideoDurationSeconds = mins * 60;
        }
        const title = String(result.title || '').trim();
        if (title && !/^https?:\/\//i.test(title)) {
            this._lastVideoTitle = title;
        }
        const channel = String(result.channel || '').trim();
        if (channel) this._lastVideoChannel = channel;
        const thumb = String(result.thumbnail || result.thumbnailUrl || '').trim();
        if (thumb && /^https?:\/\//i.test(thumb)) {
            this._lastVideoThumbnail = thumb;
        }
        const vid = String(result.video_id || result.videoId || '').trim();
        if (vid && /^[a-zA-Z0-9_-]{11}$/.test(vid)) {
            this._lastVideoId = vid;
            if (!this._lastVideoThumbnail) {
                this._lastVideoThumbnail = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
            }
        }
    }

    /** Title + thumb for gen-stage video card (and spinner options). */
    resolveSourceVideoCardMeta(urlOverride) {
        const url = String(
            urlOverride
            || document.getElementById('youtubeUrlInput')?.value?.trim()
            || ''
        ).trim();
        const videoId = this.extractYouTubeVideoId(url)
            || this._lastVideoId
            || window.videoPreviewSystem?.currentVideoId
            || null;
        const preview = window.videoPreviewSystem?.videoData || {};
        let title = String(
            this._lastVideoTitle
            || preview.title
            || ''
        ).trim();
        if (!title || /^https?:\/\//i.test(title)) {
            title = '';
        }
        let thumbnailUrl = String(
            this._lastVideoThumbnail
            || preview.thumbnail
            || preview.thumbnail_url
            || ''
        ).trim();
        if (!thumbnailUrl && videoId) {
            thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }
        return {
            title,
            thumbnailUrl,
            videoId,
            url,
            channel: this._lastVideoChannel || preview.channel || preview.uploader || '',
        };
    }

    _getCachedDurationCheck(url) {
        if (!this._durationCheckCache) this._durationCheckCache = {};
        if (!this._durationInflight) this._durationInflight = {};

        const cached = this._durationCheckCache[url];
        if (cached && (Date.now() - cached.at) < 5 * 60_000) {
            return Promise.resolve(cached.result);
        }
        if (this._durationInflight[url]) {
            return this._durationInflight[url];
        }

        const promise = this.checkVideoDurationBeforeTemplates(url)
            .then((result) => {
                this._durationCheckCache[url] = { result, at: Date.now() };
                delete this._durationInflight[url];
                return result;
            })
            .catch((err) => {
                delete this._durationInflight[url];
                throw err;
            });

        this._durationInflight[url] = promise;
        return promise;
    }

    // Returns cached limit/plan check — 30 s TTL (avoids slow folder scan every URL submit)
    _getCachedLimitCheck(forceFresh = false) {
        const cached = this._limitCheckCache;
        if (!forceFresh && cached && (Date.now() - cached.at) < 30_000) {
            return Promise.resolve(cached.data);
        }
        return fetch(`${API_BASE_URL}/clips/status`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data) this._limitCheckCache = { data, at: Date.now() };
            if (data && data.clips) {
                window.__solisClipLimits = data.clips;
                if (typeof window.refreshMultiGenSlider === 'function') window.refreshMultiGenSlider();
            }
            return data;
        })
        .catch(() => null);
    }

    invalidateLimitCheckCache() {
        this._limitCheckCache = null;
    }

    async checkVideoDurationBeforeTemplates(url) {
        try {
            const headers = getAuthHeaders();
            
            // Call backend to check video duration
            const response = await fetch(`${API_BASE_URL}/clips/duration`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',  // ðŸ” Send httpOnly cookie
                body: JSON.stringify({ url: url })
            });

            const data = await response.json();

            if (!response.ok) {
                // Hard-block only absolute safety / short-form limits — never AI-budget length
                if (data.error_code === 'VIDEO_TOO_LONG') {
                    const videoMinutes = data.video_minutes || 0;
                    const maxMinutes = data.max_duration_minutes || 0;
                    showNotification(
                        data.error
                            || `This source exceeds the ${maxMinutes}-minute safety limit (${videoMinutes}m).`,
                        'error'
                    );
                    return { allowed: false };
                }
                showNotification('Error checking video: ' + (data.error || 'Unknown error'), 'error');
                return { allowed: false };
            }

            // AI minutes = how much content we analyze/install — NOT an upload length gate.
            // Long videos are allowed; backend Smart-selects within the plan budget.
            const videoMinutes = data.duration_minutes || 0;
            const budgetMinutes = data.ai_budget_minutes || data.max_duration_minutes || 0;
            const capped = Boolean(data.ai_budget_capped);

            return {
                allowed: true,
                duration: videoMinutes,
                duration_seconds: data.duration_seconds
                    ?? (Number.isFinite(data.duration_minutes) ? data.duration_minutes * 60 : null),
                maxAllowed: budgetMinutes,
                aiBudgetMinutes: budgetMinutes,
                aiBudgetCapped: capped,
                title: data.title || null,
                channel: data.channel || null,
                thumbnail: data.thumbnail || null,
                video_id: data.video_id || null,
            };

        } catch (error) {
            safeLog('Error checking video duration:', error);
            // Silently allow proceeding if check fails
            return { allowed: true };
        }
    }

    async generateClipWithSlotSystem() {
        const urlInput = document.getElementById('youtubeUrlInput');
        if (!urlInput) return;
        
        const url = urlInput.value.trim();
        
        if (!url) {
            showNotification('Please process a YouTube URL first', 'error');
            return;
        }

        if (!this.selectedTemplate) {
            showNotification('Please select a template first', 'error');
            return;
        }

        this.startClipProcessingWithSlots(url, this.selectedTemplate);
    }

    addProcessingItem(item) {
        const wasEmpty = this.processingItems.length === 0;
        this.processingItems.unshift(item);
        this.saveProcessingItems();
        
        // ⚡ Start polling when first processing item is added
        if (wasEmpty) {
            safeLog('🚀 First processing item added - starting smart polling');
            this.startLibraryPolling();
        }
        // Do not render processing cards in library — generation spinner owns progress UI
    }

    updateProcessingView() {
        // No-op for library cards (removed). Spinner handles progress display.
    }

    oldUpdateProcessingView_old() {
        const processingList = document.getElementById('processingList');
        const processingSection = document.getElementById('processingSection');
        const emptyState = document.getElementById('emptyProcessingState');
        
        if (!processingList || !emptyState || !processingSection) return;
        
        // Show/hide section
        if (this.processingItems.length === 0) {
            emptyState.style.display = 'block';
            processingList.innerHTML = '';
            processingSection.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        processingSection.style.display = 'block';
        
        // Update items with progressive loader
        processingList.innerHTML = this.processingItems.map(item => {
            const progress = item.progress || 0;
            return `
                <div class="processing-item" data-id="${item.id}">
                    <div>
                        <!-- Thumbnail with video icon -->
                        <div class="processing-thumbnail">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                            </svg>
                            
                            <!-- Progressive circular loader (only show if processing) -->
                            ${item.status === 'processing' ? `
                                <div class="processing-loader">
                                    <div class="loader">
                                        ${this.renderLoaderParts(progress)}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Info section -->
                        <div class="processing-info">
                            <div>
                                <div class="processing-name">${item.name}</div>
                                <div class="processing-status ${item.status}">
                                    <i class="fas fa-${this.getStatusIcon(item.status)}"></i>
                                    ${this.formatStatus(item.status)}
                                </div>
                                ${item.message && item.status === 'processing' ? `
                                    <div class="processing-message">${item.message}</div>
                                ` : ''}
                            </div>
                            ${item.status === 'processing' ? `
                                <div class="processing-percentage">${progress}%</div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusIcon(status) {
        const icons = {
            'processing': 'spinner',
            'completed': 'check',
            'failed': 'exclamation'
        };
        return icons[status] || 'question';
    }

    formatStatus(status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    renderLoaderParts(progress) {
        // Show REMAINING progress (how much is left)
        const remaining = 100 - progress;
        const parts = [
            { opacity: remaining >= 25 ? 1 : 0 },
            { opacity: remaining >= 50 ? 1 : 0 },
            { opacity: remaining >= 75 ? 1 : 0 },
            { opacity: remaining >= 100 ? 1 : 0 }
        ];
        return parts.map((part, i) => `<div class="loader-part loader-part-${i + 1}" style="opacity: ${part.opacity}; transition: opacity 0.4s ease;"></div>`).join('');
    }

    publicPreviewUrl(projectId) {
        const id = String(projectId || '').trim();
        if (!id.startsWith('prj_')) return '';
        const host = location.hostname;
        const origin = (host === 'localhost' || host === '127.0.0.1')
            ? location.origin
            : 'https://solisai.video';
        return `${origin}/preview/${encodeURIComponent(id)}`;
    }

    async copyPublicPreviewLink(projectId) {
        const url = this.publicPreviewUrl(projectId);
        if (!url) {
            showNotification('Share link unavailable for this clip', 'warning');
            return false;
        }
        try {
            await navigator.clipboard.writeText(url);
            showNotification('Preview link copied', 'success');
            return true;
        } catch (_) {
            try {
                prompt('Copy preview link', url);
                return true;
            } catch (__) {
                showNotification('Could not copy link', 'warning');
                return false;
            }
        }
    }

    async downloadClip(projectId, options = {}) {
        const { skipModalClose = false, quiet = false, light = false } = options;
        window.__solisDownloadBusy = true;

        try {
            // Prefer signed URL + native browser download (avoids loading whole MP4 into JS memory,
            // which often surfaces as TypeError: Failed to fetch on large clips).
            if (!light) {
                try {
                    const linkResp = await fetch(
                        `${API_BASE_URL}/clips/link/${encodeURIComponent(projectId)}`,
                        {
                            method: 'GET',
                            credentials: 'include',
                            headers: { Accept: 'application/json' },
                        }
                    );
                    if (linkResp.ok) {
                        const data = await linkResp.json();
                        const signed = data.full_download_url;
                        if (signed) {
                            // Probe — catch CLIP_NOT_READY before fake "started" toast
                            let ready = false;
                            for (let attempt = 0; attempt < 8; attempt++) {
                                try {
                                    const probe = await fetch(signed, {
                                        method: 'GET',
                                        credentials: 'include',
                                        redirect: 'manual',
                                        headers: { Range: 'bytes=0-0', Accept: 'video/mp4,*/*' },
                                    });
                                    // 200/206 local stream, or 302/303 to R2
                                    if (
                                        probe.status === 200
                                        || probe.status === 206
                                        || probe.status === 302
                                        || probe.status === 303
                                        || probe.type === 'opaqueredirect'
                                    ) {
                                        ready = true;
                                        break;
                                    }
                                    if (probe.status === 404) {
                                        const err = await probe.json().catch(() => ({}));
                                        if (err.error_code === 'CLIP_NOT_READY' && attempt < 7) {
                                            await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
                                            continue;
                                        }
                                        throw new Error(err.error || 'Clip is still uploading — try again in a moment.');
                                    }
                                } catch (probeErr) {
                                    if (attempt >= 7) throw probeErr;
                                    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
                                }
                            }
                            if (!ready) {
                                throw new Error('Clip is still uploading — try again in a moment.');
                            }
                            const a = document.createElement('a');
                            a.href = signed;
                            a.rel = 'noopener';
                            a.download = `clip_${projectId}.mp4`;
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);

                            if (!quiet) showNotification('Download started!', 'success');
                            if (!skipModalClose) this.closeTemplatePreviewModal();

                            document.querySelectorAll('[data-project-id]').forEach(card => {
                                if (card.getAttribute('data-project-id') === projectId) {
                                    const statusPill = card.querySelector('.status-pill');
                                    if (statusPill) {
                                        statusPill.style.opacity = '0';
                                        statusPill.style.transition = 'opacity 0.3s ease';
                                        setTimeout(() => statusPill.remove(), 300);
                                    }
                                }
                            });
                            return;
                        }
                    } else if (linkResp.status === 404) {
                        const err = await linkResp.json().catch(() => ({}));
                        if (err.error_code === 'CLIP_NOT_READY') {
                            throw new Error(err.error || 'Clip is still uploading — try again in a moment.');
                        }
                    }
                } catch (linkErr) {
                    console.warn('Signed download link failed, falling back to blob fetch', linkErr);
                }
            }

            const params = light ? '?light=1' : '';
            const downloadUrl = `${API_BASE_URL}/clips/download/${encodeURIComponent(projectId)}${params}`;
            const response = await fetch(downloadUrl, {
                method: 'GET',
                credentials: 'include',
                headers: { Accept: 'video/mp4,*/*' },
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Download failed (${response.status})`);
            }
            const blob = await response.blob();
            if (!blob || blob.size < 1000) {
                throw new Error('Downloaded file is empty');
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.rel = 'noopener';
            link.download = light ? 'clip-preview.mp4' : `clip_${projectId}.mp4`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 30_000);

            if (!quiet) {
                showNotification('Download started!', 'success');
            }

            if (!skipModalClose) {
                this.closeTemplatePreviewModal();
            }

            const allLibraryCards = document.querySelectorAll('[data-project-id]');
            allLibraryCards.forEach(card => {
                if (card.getAttribute('data-project-id') === projectId) {
                    const statusPill = card.querySelector('.status-pill');
                    if (statusPill) {
                        statusPill.style.opacity = '0';
                        statusPill.style.transition = 'opacity 0.3s ease';
                        setTimeout(() => statusPill.remove(), 300);
                    }
                }
            });
        } catch (error) {
            console.error('Download error:', error);
            showNotification('Download failed: ' + error.message, 'error');
            throw error;
        } finally {
            window.__solisDownloadBusy = false;
        }
    }

    cancelProcessing(itemId) {
        const item = this.processingItems.find(i => i.id === itemId);
        if (item) {
            item.status = 'cancelled';
            this.stopMonitoring(itemId);
            this.updateProcessingView();
            this.saveProcessingItems();
            showNotification('Processing cancelled', 'info');
        }
    }

    deleteProcessingItem(itemId) {
        const index = this.processingItems.findIndex(i => i.id === itemId);
        if (index !== -1) {
            const item = this.processingItems[index];
            
            // PREVENT deletion of currently processing items
            if (item.status === 'processing') {
                showNotification('Cannot delete items while processing. Wait for completion or cancel first.', 'warning');
                return;
            }
            
            // Delete from backend
            this.deleteProjectFromServer(item.projectId);
            
            // Remove from local list
            this.processingItems.splice(index, 1);
            this.stopMonitoring(itemId);
            this.updateProcessingView();
            this.saveProcessingItems();
            
            // ⚡ Stop polling if no more processing items
            if (this.processingItems.length === 0) {
                this.stopLibraryPolling();
            }
            
            showNotification(`${item.name} deleted successfully`, 'success');
        }
    }

    retryProcessing(itemId) {
        const item = this.processingItems.find(i => i.id === itemId);
        if (item) {
            item.status = 'processing';
            item.progress = 0;
            this.updateProcessingView();
            this.saveProcessingItems();
            this.startMonitoring(itemId);
            showNotification('Retrying processing...', 'info');
        }
    }

    moveToLibrary(processingItem) {
        // ðŸ” SECURITY: Validate projectId format to prevent path traversal
        if (!this.validateProjectId(processingItem.projectId)) {
            safeLog(`âŒ SECURITY: Invalid projectId format rejected: ${processingItem.projectId}`);
            return;
        }

        const libraryItem = {
            id: processingItem.projectId || processingItem.id,
            projectId: processingItem.projectId || processingItem.id,
            name: processingItem.name,
            template: processingItem.template,
            templateName: processingItem.templateName,
            timestamp: processingItem.timestamp || new Date().toISOString(),
            status: 'completed',
            slotNumber: processingItem.slotNumber,
            isSlotSystem: processingItem.isSlotSystem,
            virality: processingItem.virality || null,
            share_pack: processingItem.share_pack || null,
            _optimistic: true,
        };

        // ⚡ OPTIMIZED: Transform card in-place instead of re-rendering entire grid
        const processingCard = document.querySelector(`[data-processing-id="${processingItem.id}"]`);
        
        if (processingCard) {
            // Smoothly animate the card transformation
            processingCard.style.transition = 'all 0.5s ease';
            processingCard.style.opacity = '0.5';
            
            setTimeout(() => {
                // ðŸ” SECURITY: Clear old content first to prevent leftover listeners
                processingCard.innerHTML = '';
                
                processingCard.classList.add('library-card', 'solis-clip-card');
                processingCard.innerHTML = (window.SolisClipCard && SolisClipCard.buildHTML(libraryItem))
                    || `<div class="scc-meta"><h2 class="card-title">${sanitizeHTML(libraryItem.name)}</h2></div>`;
                if (window.SolisClipCard) SolisClipCard.bind(processingCard, libraryItem, this);
                
                // Remove processing attributes and add library attrs
                processingCard.removeAttribute('data-processing-id');
                processingCard.setAttribute('data-id', libraryItem.id);
                processingCard.setAttribute('data-project-id', libraryItem.projectId);
                
                // Fade in the new content
                processingCard.style.opacity = '0';
                processingCard.style.transition = 'opacity 0.3s ease';
                
                setTimeout(() => {
                    processingCard.style.opacity = '1';
                }, 10);
                
                // Re-attach event listeners for this card only
                this.attachLibraryCardListeners(processingCard, libraryItem.id, libraryItem.projectId);
                
                // Fetch duration from server with validated projectId
                this.fetchAndUpdateDuration(processingCard, libraryItem.projectId);
            }, 300);
        }

        // Update data arrays
        this.processingItems = this.processingItems.filter(item => item.id !== processingItem.id);
        const already = this.libraryItems.some((item) => (
            String(item.projectId || item.id) === String(libraryItem.projectId)
        ));
        if (!already) {
            this.libraryItems.unshift(libraryItem);
        }
        // Do NOT stamp _libraryLastLoaded here — that blocked post-complete refetch
        // and left blank thumbnails/titles until a hard page refresh.
        
        // Save to localStorage
        this.saveProcessingItems();
        this.saveLibraryItems();
        
        // ⚡ Stop polling if no more processing items
        if (this.processingItems.length === 0) {
            this.stopLibraryPolling();
        }
        
        // Update other UI elements (storage badge, recent activity)
        this.loadAndDisplayStorageInfo();
        this.updateRecentActivity();
        
        safeLog(`✅ Card transformed: ${processingItem.name}`);

        if (!processingCard) {
            this.updateLibraryView();
        }

        // Pull real title/thumbnail from server (status-only project.json races are common)
        this.loadLibraryItems({ soft: true, force: true }).catch(() => {});

        this.openLibraryPreview(libraryItem.id, libraryItem.projectId, null, { fast: true });
    }

    fetchAndUpdateDuration(cardElement, projectId) {
        // ðŸ” SECURITY: Validate projectId before making API call
        if (!this.validateProjectId(projectId)) {
            safeLog(`âŒ SECURITY: Invalid projectId in fetchAndUpdateDuration`);
            return;
        }
        if (window.__solisDownloadBusy) return;

        const url = `${API_BASE_URL}/clips/duration/${encodeURIComponent(projectId)}`;
        const attempt = (n) => {
            fetch(url, { method: 'GET', credentials: 'include' })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    if (data.duration_formatted && cardElement) {
                        if (window.SolisClipCard) SolisClipCard.setDuration(cardElement, data.duration_formatted);
                        else {
                            const durationSpan = cardElement.querySelector('.duration-text');
                            if (durationSpan) durationSpan.textContent = data.duration_formatted;
                        }
                    }
                })
                .catch(error => {
                    if (n < 4) setTimeout(() => attempt(n + 1), 1500 * (n + 1));
                    else safeLog('Could not fetch duration:', error);
                });
        };
        attempt(0);
    }

    attachLibraryCardListeners(cardElement, itemId, projectId) {
        const downloadBtn = cardElement.querySelector('.library-download-btn');
        const deleteBtn = cardElement.querySelector('.library-delete-btn');
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (projectId && this.validateProjectId(projectId) && clipsStudio) {
                    clipsStudio.downloadClip(projectId);
                } else {
                    safeLog(`âŒ SECURITY: Invalid projectId for download: ${projectId}`);
                }
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (itemId != null && itemId !== '' && this.validateItemId(itemId) && clipsStudio) {
                    clipsStudio.deleteClip(String(itemId), { card: cardElement });
                } else {
                    safeLog(`âŒ SECURITY: Invalid itemId for delete: ${itemId}`);
                }
            });
        }

        if (!cardElement.dataset.previewBound) {
            cardElement.dataset.previewBound = '1';
            cardElement.addEventListener('click', (e) => {
                if (e.target.closest('.library-download-btn, .library-delete-btn, .scc-ico, .scc-viral, .scc-delete-confirm')) return;
                if (this.librarySelectMode) {
                    // Select mode is handled by libraryGrid capture listener
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                this.openLibraryPreview(itemId, projectId, cardElement);
            });
        }
    }

    showLibrarySkeleton(count = 6) {
        const grid = document.getElementById('libraryGrid');
        if (!grid) return;
        // Don't clobber an already-rendered library (cards / folders)
        if (grid.querySelector('.library-card, .library-collection-folder')) return;
        const emptyState = document.getElementById('emptyLibraryState');
        if (emptyState) emptyState.style.display = 'none';
        Array.from(grid.children).forEach(child => {
            if (!child.classList.contains('empty-state')) child.remove();
        });
        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const card = document.createElement('div');
            card.className = 'library-card-skeleton library-card-skeleton--clip';
            card.innerHTML = `
                <div class="skeleton-block skeleton-preview"></div>
                <div class="skeleton-block skeleton-title"></div>
                <div class="skeleton-block skeleton-meta"></div>`;
            frag.appendChild(card);
        }
        grid.appendChild(frag);
    }

    hideLibrarySkeleton() {
        const grid = document.getElementById('libraryGrid');
        if (!grid) return;
        grid.querySelectorAll('.library-card-skeleton').forEach(el => el.remove());
    }

    async loadLibraryItems(options = {}) {
        const force = options.force === true;
        const CACHE_MS = 5 * 60 * 1000;
        const hasItems = Array.isArray(this.libraryItems) && this.libraryItems.length > 0;
        const hasCollections = Array.isArray(this.libraryCollections) && this.libraryCollections.length > 0;
        const isFresh = this._libraryLastLoaded && (Date.now() - this._libraryLastLoaded) < CACHE_MS;

        // In-memory short-circuit — avoid refetch spam on every Library tab open.
        // Never short-circuit force refreshes (post-generation / video_ready).
        if (!force && hasItems && isFresh) {
            if (this.libraryPreviewModalOpen) this._libraryRefreshPending = true;
            else this.updateLibraryView();
            return;
        }

        const gridEl = document.getElementById('libraryGrid');
        const gridHasCards = !!(gridEl && gridEl.querySelector('.library-card, .library-collection-folder'));
        const soft = options.soft === true
            || hasItems
            || hasCollections
            || gridHasCards
            || (Array.isArray(this.processingItems) && this.processingItems.length > 0);

        // Soft refresh keeps existing cards visible — hard skeleton wipe was hiding the library
        if (!soft) {
            this.showLibrarySkeleton(6);
        }

        try {
            const headers = getAuthHeaders();
            const projectsUrl = `${API_BASE_URL}/clips/projects`;
            const fetchProjects = window.apiRequestCache?.dedupFetch
                ? window.apiRequestCache.dedupFetch(projectsUrl, {
                    headers,
                    credentials: 'include',
                })
                : fetch(projectsUrl, {
                    headers: headers,
                    credentials: 'include'
                });
            const response = await fetchProjects;
            
            if (response.ok) {
                const data = await response.json();
                const incoming = data.projects
                    .filter((project) => project && project.id)
                    .map((project) => ({
                        id: project.id,
                        projectId: project.id,
                        name: project.video_title || project.template_name || 'Clip',
                        template: project.template,
                        templateName: project.template_name,
                        timestamp: new Date(project.created_at),
                        status: 'completed',
                        thumbnailUrl: project.thumbnail_url,
                        collectionId: project.collection_id || null,
                        batchIndex: project.batch_index || null,
                        slotNumber: project.slot_number,
                        isSlotSystem: project.slots ? true : false,
                        slots: project.slots,
                        virality: project.virality || null,
                        share_pack: project.share_pack || null,
                        duration: project.duration_formatted || project.duration_seconds || null,
                    }));

                this.libraryCollections = (data.collections || []).map((col) => ({
                    id: col.id,
                    title: col.title || 'Project',
                    thumbnailUrl: col.thumbnail_url,
                    clipCount: col.clip_count || 0,
                    createdAt: col.created_at,
                    updatedAt: col.updated_at,
                }));

                // Keep just-finished cards if Railway/R2 list hasn't caught up yet
                const incomingIds = new Set(incoming.map((p) => String(p.id)));
                const pendingOptimistic = (this.libraryItems || []).filter((item) => {
                    const id = String(item.projectId || item.id || '');
                    if (!id || incomingIds.has(id)) return false;
                    if (item._optimistic || item._justCompleted) return true;
                    return false;
                });
                this.libraryItems = [...pendingOptimistic, ...incoming];
                for (const item of this.libraryItems) {
                    const id = String(item.projectId || item.id || '');
                    if (incomingIds.has(id)) {
                        item._optimistic = false;
                        item._justCompleted = false;
                    }
                }
                this.libraryCollections.forEach((col) => {
                    const matched = this.libraryItems.filter(
                        (i) => String(i.collectionId || '') === String(col.id)
                    ).length;
                    // Keep API clip_count when membership ids have not hydrated yet
                    if (matched > 0) col.clipCount = matched;
                });
                this.libraryCollections = this.libraryCollections.filter(
                    (col) => (col.clipCount || 0) > 0
                );
                
                this._libraryLastLoaded = Date.now();
                this.hideLibrarySkeleton();
                if (this.libraryPreviewModalOpen) {
                    this._libraryRefreshPending = true;
                    const pid = this.currentTemplateForPreview?.projectId;
                    const fresh = pid && this.libraryItems.find(
                        (item) => String(item.projectId || item.id) === String(pid)
                    );
                    if (fresh) this._renderPreviewViralityRail(fresh);
                } else {
                    this.updateLibraryView();
                }
                this.updateRecentActivity();
                this.saveLibraryItems();
                this._writeLibrarySessionCache();
                if (window.portalManager && typeof window.portalManager.refresh === 'function') {
                    window.portalManager.refresh();
                }
            }
        } catch (error) {
            safeLog('Failed to load library items:', error);
            this.hideLibrarySkeleton();
            this.loadLibraryItemsFromStorage();
        }
    }

    /** User-scoped session cache key — never stores tokens/cookies */
    _librarySessionCacheKey() {
        const uid = String(currentUser?.id || window.currentUser?.id || '');
        return uid ? `solis_lib_v2_${uid}` : null;
    }

    _writeLibrarySessionCache() {
        try {
            const key = this._librarySessionCacheKey();
            const uid = String(currentUser?.id || window.currentUser?.id || '');
            if (!key || !uid || !Array.isArray(this.libraryItems)) return;
            sessionStorage.setItem(key, JSON.stringify({
                uid,
                at: Date.now(),
                items: this.libraryItems,
                collections: this.libraryCollections || [],
            }));
        } catch (_) {}
    }

    _clearLibrarySessionCache() {
        try {
            const key = this._librarySessionCacheKey();
            if (key) sessionStorage.removeItem(key);
        } catch (_) {}
    }

    _hydrateLibraryFromSessionCache() {
        try {
            const key = this._librarySessionCacheKey();
            const uid = String(currentUser?.id || window.currentUser?.id || '');
            if (!key || !uid) return false;
            const raw = sessionStorage.getItem(key);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || String(data.uid) !== uid || !Array.isArray(data.items)) return false;
            // Session hydrate window: 15 minutes
            if (Date.now() - Number(data.at || 0) > 15 * 60 * 1000) {
                sessionStorage.removeItem(key);
                return false;
            }
            this.libraryItems = data.items.map((it) => ({
                ...it,
                timestamp: it.timestamp ? new Date(it.timestamp) : new Date()
            }));
            if (Array.isArray(data.collections)) {
                this.libraryCollections = data.collections;
            }
            this._libraryLastLoaded = Number(data.at) || Date.now();
            return this.libraryItems.length > 0
                || (Array.isArray(this.libraryCollections) && this.libraryCollections.length > 0);
        } catch (_) {
            return false;
        }
    }

    /** Force next library open to hit the network (after delete / new clip) */
    invalidateLibraryCache() {
        this._libraryLastLoaded = 0;
        this._clearLibrarySessionCache();
    }

    startLibraryPolling() {
        // ⚡ SMART POLLING: Only poll when there are items actually being processed
        // This prevents unnecessary API spam when the library is idle
        
        // Clear any existing polling
        if (this.libraryPollingInterval) {
            clearInterval(this.libraryPollingInterval);
        }
        
        // Only start polling if there are processing items
        if (this.processingItems.length === 0) {
            safeLog('ðŸ“ No processing items - polling not started (will start when items appear)');
            return;
        }
        
        safeLog(`🔄 Starting smart polling for ${this.processingItems.length} processing item(s)`);
        
        // Poll every 8 seconds only when processing items exist
        this.libraryPollingInterval = setInterval(async () => {
            try {
                if (window.solisApiGate && !window.solisApiGate.allowPoll()) {
                    return; // Backend restarting — don't burn quota
                }
                // Only continue polling if there are still processing items
                if (this.processingItems.length === 0) {
                    safeLog('No processing items - stopping polling');
                    this.stopLibraryPolling();
                    return;
                }
                
                // Validate processing items to remove any stale/orphaned cards
                const validItems = [];
                for (const item of this.processingItems) {
                    try {
                        // Spinner already polls this project — skip duplicate /status hits
                        try {
                            const spin = window.generationProgressSpinner;
                            if (spin?.activeGenerations?.has?.(item.projectId)) {
                                validItems.push(item);
                                continue;
                            }
                        } catch (_) { /* ignore */ }

                        const headers = getAuthHeaders();
                        const resp = await fetch(`${API_BASE_URL}/clips/status/${item.projectId}`, {
                            headers,
                            credentials: 'include',
                            solisOptionalPoll: true,
                        });
                        
                        if (resp.ok) {
                            const status = await resp.json();
                            // Keep only if actively processing
                            if (status.status && ['processing', 'waiting', 'pending', 'queued', 'downloading'].includes(status.status)) {
                                validItems.push(item);
                            } else if (status.status === 'cancelled' || status.status === 'canceled') {
                                const stopSpinner = typeof getGenerationProgressSpinner === 'function'
                                    ? getGenerationProgressSpinner()
                                    : window.generationProgressSpinner;
                                if (stopSpinner?.stopGeneration) {
                                    stopSpinner.stopGeneration(item.projectId, status.message || 'Stopped');
                                }
                                this.stopMonitoring?.(item.id);
                            } else if (status.status === 'error' || status.status === 'failed' || status.status === 'timeout') {
                                const failSpinner = typeof getGenerationProgressSpinner === 'function'
                                    ? getGenerationProgressSpinner()
                                    : window.generationProgressSpinner;
                                if (failSpinner?.failGeneration) {
                                    failSpinner.failGeneration(item.projectId, status.message || 'There was an error — try again');
                                }
                                this.stopMonitoring?.(item.id);
                            } else if (status.status === 'completed') {
                                const completeSpinner = typeof getGenerationProgressSpinner === 'function'
                                    ? getGenerationProgressSpinner()
                                    : window.generationProgressSpinner;
                                if (completeSpinner?.completeGeneration) {
                                    completeSpinner.completeGeneration(item.projectId);
                                }
                                item.status = 'completed';
                                this.moveToLibrary(item);
                                this.stopMonitoring?.(item.id);
                            } else {
                                safeLog(`Removing stale card during polling: ${item.name} (status: ${status.status})`);
                            }
                        } else if (resp.status >= 500) {
                            // Keep card while API is bouncing — don't thrash
                            validItems.push(item);
                        } else {
                            safeLog(`Backend check failed for ${item.name}, removing from processing`);
                        }
                    } catch (e) {
                        // Network / backoff — keep item, don't spam
                        validItems.push(item);
                    }
                }
                
                // Update if any items were removed
                if (validItems.length !== this.processingItems.length) {
                    this.processingItems = validItems;
                    this.saveProcessingItems();
                    this.updateLibraryView();
                    safeLog(`🧹 Polling cleanup: ${this.processingItems.length} active items remaining`);
                    
                    // If no items left, stop polling
                    if (validItems.length === 0) {
                        this.stopLibraryPolling();
                    }
                }
            } catch (e) {
                safeLog('Auto-polling error:', e);
            }
        }, 8000);
    }

    stopLibraryPolling() {
        if (this.libraryPollingInterval) {
            clearInterval(this.libraryPollingInterval);
            this.libraryPollingInterval = null;
            safeLog('� Library polling stopped');
        }
    }

    async loadAndDisplayStorageInfo() {
        try {
            if (!currentUser?.id) return;
            const subscription = await window._subCache.get();
            if (subscription) {
                this.updateStorageDisplay(subscription);
                return subscription;
            }
        } catch (error) {
            safeLog('Error loading storage info:', error);
        }
    }
    
    updateStorageDisplay(subscription) {
        const videosInLibrary = this.libraryItems.length;
        const plan = (subscription.plan || 'free').toLowerCase();
        const unlimited = subscription.library_unlimited === true
            || (typeof window.isUnlimitedLibrary === 'function' && window.isUnlimitedLibrary(null, plan));
        const videoLimit = unlimited ? null : (subscription.video_limit || subscription.videos_space_limit || 5);

        if (typeof window.applyStorageBadgeUI === 'function') {
            window.applyStorageBadgeUI({ used: videosInLibrary, limit: videoLimit, plan, unlimited });
        }

        safeLog(unlimited
            ? `📊 Library storage: ${videosInLibrary} clips (${plan})`
            : `📊 Library storage: ${videosInLibrary} / ${videoLimit} (${plan})`);
    }

    handleSubscriptionExpiration() {
        // SECURITY: Do NOT read user data from localStorage
        // Backend enforces plan restrictions, not client-side
        // Use loadAndDisplayStorageInfo() to fetch fresh subscription data from backend
        
        if (!this.loadAndDisplayStorageInfo) return;
        
        // Fetch fresh subscription data from backend (no caching)
        this.loadAndDisplayStorageInfo().then(subscription => {
            if (!subscription || !subscription.subscription_end_date) {
                return;
            }
            
            const expirationDate = new Date(subscription.subscription_end_date);
            const today = new Date();
            
            // If subscription expired, show notification (backend handles enforcement)
            if (today > expirationDate && subscription.plan !== 'free') {
                // UI notification only - backend will enforce plan restrictions
                showNotification('Your subscription has expired. You are now on the Free plan.', 'warning');
                
                // UI update: show storage limit warning if needed
                if (this.libraryItems && this.libraryItems.length > 2) {
                    showNotification('Your storage has been limited to 2 videos per the Free plan.', 'warning');
                }
            }
        }).catch(error => {
            safeLog('Error checking subscription expiration:', error);
            // Silently fail - backend will enforce limits regardless
        });
    }

    updateLibraryView() {
        // 🔒 Don't wipe the grid while preview modal is open — queue a refresh instead
        if (this.libraryPreviewModalOpen) {
            this._libraryRefreshPending = true;
            safeLog('â¸ï¸ Library update deferred: preview modal open');
            return;
        }

        this.hideLibrarySkeleton();

        // Load storage info first (but with caching to reduce API calls)
        this.loadAndDisplayStorageInfo();
        
        // Check for subscription expiration and downgrade storage if needed
        this.handleSubscriptionExpiration();
        
        const libraryGrid = document.getElementById('libraryGrid');
        const emptyState = document.getElementById('emptyLibraryState');
        
        if (!libraryGrid || !emptyState) return;
        
        // Ensure library items are loaded before rendering
        if (!Array.isArray(this.libraryItems)) {
            this.libraryItems = [];
        }
        if (!Array.isArray(this.processingItems)) {
            this.processingItems = [];
        }
        
        if (this.libraryItems.length === 0 && (!this.libraryCollections || this.libraryCollections.length === 0)) {
            emptyState.style.display = 'block';
            libraryGrid.classList.add('is-empty');
            libraryGrid.innerHTML = '';
            libraryGrid.appendChild(emptyState);
            document.getElementById('libraryLoadMoreFab')?.remove();
            if (this._librarySentinelObserver) {
                this._librarySentinelObserver.disconnect();
                this._librarySentinelObserver = null;
            }
            const backBtn = document.getElementById('libraryNavBackBtn');
            const fwdBtn = document.getElementById('libraryNavForwardBtn');
            if (backBtn) backBtn.disabled = true;
            if (fwdBtn) fwdBtn.disabled = true;
            return;
        }

        emptyState.style.display = 'none';
        libraryGrid.classList.remove('is-empty');

        // Cancel any in-flight render frame so rapid successive calls don't stack
        if (this._libraryRenderFrame) {
            cancelAnimationFrame(this._libraryRenderFrame);
        }

        // Defer the heavy DOM work to next paint — keeps the tab-switch animation smooth
        this._libraryRenderFrame = requestAnimationFrame(() => {
        this._libraryRenderFrame = null;

        // ── Lazy-rendering setup ──────────────────────────────────────────────
        const LIBRARY_PAGE_SIZE = 8;

        // Disconnect any previous sentinel observer to avoid stale callbacks
        if (this._librarySentinelObserver) {
            this._librarySentinelObserver.disconnect();
            this._librarySentinelObserver = null;
        }
        // Duration cache persists across re-renders to avoid redundant requests
        if (!this._durationCache) this._durationCache = {};
        // Disconnect all per-card duration observers from the previous render
        if (this._durationObservers) {
            this._durationObservers.forEach(obs => obs.disconnect());
        }
        this._durationObservers = [];

        // Processing cards removed — generation spinner owns in-progress UI

        const openCol = this.openCollectionId
            ? this._findCollection(this.openCollectionId)
            : null;
        let displayItems;
        let displayCollections = [];
        if (openCol) {
            displayItems = this._getCollectionClips(openCol.id);
        } else {
            displayItems = this._getLibraryRootItems();
            displayCollections = (this.libraryCollections || []).filter(
                (col) => (col.clipCount || this._getCollectionClips(col.id).length) > 0
            );
        }

        const items = this.getSortedLibraryItems(displayItems);
        let renderedCount = 0;
        let collectionsRendered = false;

        const buildCollectionCard = (col) => {
            const card = document.createElement('div');
            card.className = 'library-card library-collection-folder solis-collection-card';
            card.setAttribute('data-collection-id', col.id);
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            const titleRaw = col.title || 'Project';
            const title = sanitizeHTML(titleRaw);
            const count = col.clipCount || this._getCollectionClips(col.id).length;
            const countLabel = `${count} clip${count !== 1 ? 's' : ''}`;
            const expiry = sanitizeHTML(countLabel);
            const sub = sanitizeHTML(col.planLabel || 'Project');
            const thumb = col.thumbnailUrl
                ? `<img class="scc-collection-thumb" src="${sanitizeHTML(col.thumbnailUrl)}" alt="" draggable="false" loading="lazy">`
                : `<div class="scc-collection-thumb scc-collection-thumb-empty"><i class="fas fa-folder"></i></div>`;
            card.innerHTML = `
                <div class="scc-collection-stack">
                    <div class="scc-collection-hover-title" title="${title}">${title}</div>
                    <span class="scc-collection-layer scc-collection-layer--2" aria-hidden="true"></span>
                    <span class="scc-collection-layer scc-collection-layer--1" aria-hidden="true"></span>
                    <div class="scc-collection-preview">
                        ${thumb}
                        <div class="scc-collection-expiry">${expiry}</div>
                    </div>
                </div>
                <div class="scc-collection-meta">
                    <div class="scc-collection-title-row">
                        <h2 class="scc-collection-title" title="${title}">${title}</h2>
                        <button type="button" class="scc-collection-menu" aria-label="Project options" aria-haspopup="menu" aria-expanded="false">···</button>
                    </div>
                    <p class="scc-collection-sub">${sub}</p>
                    <div class="scc-collection-dropdown" role="menu" hidden>
                        <button type="button" class="scc-collection-dd-item" data-action="zip" role="menuitem">
                            <span>Download zip</span><span class="scc-collection-dd-ext">ZIP</span>
                        </button>
                        <div class="scc-collection-dd-sep" aria-hidden="true"></div>
                        <button type="button" class="scc-collection-dd-item" data-action="delete" role="menuitem">Delete</button>
                    </div>
                </div>`;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.library-delete-btn, .scc-collection-menu, .scc-collection-dropdown')) return;
                this.openLibraryCollection(col.id);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.openLibraryCollection(col.id);
                }
            });
            this._bindCollectionMenu(card, col);
            this._bindCollectionDrop(card, col.id);
            return card;
        };

        const syncCollectionHeader = () => {
            this._syncLibraryNavArrows();
        };
        syncCollectionHeader();

        // Builds and appends a DOM card for a single library item
        const buildCard = (item) => {
            const card = document.createElement('div');
            card.className = 'library-card solis-clip-card';
            card.setAttribute('data-id', item.id);
            card.setAttribute('data-project-id', item.projectId);
            if (this.librarySelectMode && this._librarySelectedIds?.has(String(item.id))) {
                card.classList.add('is-selected');
            }
            card.innerHTML = (window.SolisClipCard && SolisClipCard.buildHTML(item))
                || `<div class="scc-meta"><h2 class="card-title">${sanitizeHTML(item.name)}</h2></div>`;
            if (window.SolisClipCard) SolisClipCard.bind(card, item, this);
            this.attachLibraryCardListeners(card, item.id, item.projectId);
            this._bindLibraryDragDrop(card, item);

            // Store card for restoration
            if (typeof storeLibraryCard === 'function') {
                storeLibraryCard(item.id, { id: item.id, html: card.innerHTML, classList: card.className, dataAttributes: { 'data-id': item.id } });
            }

            // Duration comes from /clips/projects — no per-card /clips/duration spam
            const pid = String(item.projectId);
            const cachedDur = item.duration || this._durationCache[pid];
            if (cachedDur) {
                if (window.SolisClipCard) SolisClipCard.setDuration(card, cachedDur);
                else {
                    const durationText = card.querySelector('.duration-text');
                    if (durationText) durationText.textContent = cachedDur;
                }
                if (pid) this._durationCache[pid] = cachedDur;
            }

            return card;
        };

        // Appends the next batch of cards to the grid
        const appendBatch = () => {
            const needsCollections = !openCol && !collectionsRendered && displayCollections.length > 0;
            if (renderedCount >= items.length && !needsCollections) return;

            const end = Math.min(renderedCount + LIBRARY_PAGE_SIZE, items.length);

            const frag = document.createDocumentFragment();

            if (!openCol && !collectionsRendered && displayCollections.length) {
                displayCollections.forEach((col) => frag.appendChild(buildCollectionCard(col)));
                collectionsRendered = true;
            }

            for (let i = renderedCount; i < end; i++) {
                frag.appendChild(buildCard(items[i]));
            }
            renderedCount = end;

            // Remove previous load UI
            libraryGrid.querySelector('.library-scroll-sentinel')?.remove();
            document.getElementById('libraryLoadMoreFab')?.remove();
            if (this._librarySentinelObserver) {
                this._librarySentinelObserver.disconnect();
                this._librarySentinelObserver = null;
            }

            libraryGrid.appendChild(frag);

            if (renderedCount < items.length) {
                const remaining = items.length - renderedCount;

                // In-flow sentinel at end of grid — scroll-driven load (FAB is fixed so IO can't use it)
                const scrollSentinel = document.createElement('div');
                scrollSentinel.className = 'library-scroll-sentinel';
                scrollSentinel.setAttribute('aria-hidden', 'true');
                libraryGrid.appendChild(scrollSentinel);

                const scroller = document.getElementById('clipsContainer');
                this._librarySentinelObserver = new IntersectionObserver((entries) => {
                    if (!entries.some((e) => e.isIntersecting)) return;
                    if (renderedCount >= items.length) return;
                    if (this._libraryAppending) return;
                    this._libraryAppending = true;
                    try { appendBatch(); } finally { this._libraryAppending = false; }
                }, {
                    root: scroller || null,
                    rootMargin: '280px 0px',
                    threshold: 0
                });
                this._librarySentinelObserver.observe(scrollSentinel);

                // Fixed FAB — click still loads more (backup / discoverability)
                const sentinel = document.createElement('button');
                sentinel.type = 'button';
                sentinel.id = 'libraryLoadMoreFab';
                sentinel.className = 'library-load-sentinel';
                sentinel.setAttribute('aria-label', `Load more — ${remaining} clip${remaining !== 1 ? 's' : ''} left`);
                sentinel.title = 'Load more';
                sentinel.innerHTML = `
                    <span class="library-load-hint" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-icon lucide-arrow-down"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                    </span>`;
                (scroller || libraryGrid).appendChild(sentinel);

                sentinel.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this._libraryAppending) return;
                    this._libraryAppending = true;
                    try { appendBatch(); } finally { this._libraryAppending = false; }
                    if (scroller) {
                        requestAnimationFrame(() => {
                            const step = Math.round(Math.min(scroller.clientHeight * 0.55, 420));
                            scroller.scrollBy({ top: step, behavior: 'smooth' });
                        });
                    }
                }, { once: true });
            }
        };

        // Clear the grid (except the empty-state element) and render first batch
        Array.from(libraryGrid.children).forEach(child => {
            if (!child.classList.contains('empty-state')) child.remove();
        });
        document.getElementById('libraryLoadMoreFab')?.remove();

        if (!items.length && !displayCollections.length && !openCol) {
            // Only show empty-state when there is truly nothing (no clips, no projects)
            const hasAnyProjects = Array.isArray(this.libraryCollections) && this.libraryCollections.length > 0;
            if (hasAnyProjects) {
                emptyState.style.display = 'none';
                libraryGrid.classList.remove('is-empty');
                appendBatch();
                return;
            }
            emptyState.style.display = 'block';
            libraryGrid.classList.add('is-empty');
            if (!emptyState.isConnected) libraryGrid.appendChild(emptyState);
            const title = emptyState.querySelector('h3');
            const copy = emptyState.querySelector('p');
            if (title) title.textContent = 'No clips for this sort';
            if (copy) copy.textContent = 'Try Newest, or another filter.';
            return;
        }

        if (openCol && !items.length) {
            libraryGrid.classList.remove('is-empty');
            emptyState.style.display = 'none';
            appendBatch();
            const emptyCol = document.createElement('p');
            emptyCol.className = 'library-collection-empty';
            emptyCol.textContent = 'No clips in this project yet — drag clips here from the library.';
            libraryGrid.appendChild(emptyCol);
            return;
        }

        // Restore default empty copy for the real empty library
        const title = emptyState.querySelector('h3');
        const copy = emptyState.querySelector('p');
        if (title) title.textContent = 'No clips yet';
        if (copy) copy.textContent = 'Start creating clips to build your library';

        appendBatch();

        // Hook into websocket for real-time updates
        this.setupWebSocketHandlers();

        // Event delegation for library actions — attached only once
        if (libraryGrid && !libraryGrid._hasClickListener) {
            libraryGrid._hasClickListener = true;
            // Capture-phase select handler (runs before card listeners; avoids double-toggle)
            libraryGrid.addEventListener('click', (e) => {
                if (!this.librarySelectMode) return;
                const card = e.target.closest('.library-card.solis-clip-card');
                if (!card || !libraryGrid.contains(card)) return;
                if (e.target.closest('.scc-delete-confirm')) return;
                e.preventDefault();
                e.stopPropagation();
                const cardId = card.getAttribute('data-id');
                if (cardId) this.toggleLibraryClipSelected(cardId, card);
            }, true);
            libraryGrid.addEventListener('click', (e) => {
                const shareBtn = e.target.closest('.library-share-btn');
                if (shareBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const projectId = shareBtn.getAttribute('data-project-id');
                    if (projectId && clipsStudio) clipsStudio.copyPublicPreviewLink(projectId);
                    return;
                }
                const downloadBtn = e.target.closest('.library-download-btn');
                if (downloadBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const projectId = downloadBtn.getAttribute('data-project-id');
                    if (projectId && clipsStudio) clipsStudio.downloadClip(projectId);
                    return;
                }
                const deleteBtn = e.target.closest('.library-delete-btn');
                if (deleteBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const card = deleteBtn.closest('.library-card, .solis-clip-card, [data-id]');
                    const itemId = deleteBtn.getAttribute('data-item-id')
                        || card?.getAttribute('data-id')
                        || card?.getAttribute('data-project-id');
                    if (itemId && clipsStudio) clipsStudio.deleteClip(itemId, { card });
                    return;
                }
                if (this.librarySelectMode) return;
                const libraryCard = e.target.closest('.library-card');
                if (libraryCard && !e.target.closest('.library-download-btn, .library-delete-btn, .library-share-btn, .scc-ico, .scc-viral, .scc-delete-confirm')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const cardId = libraryCard.getAttribute('data-id');
                    const projectId = libraryCard.getAttribute('data-project-id');
                    if (cardId && clipsStudio) clipsStudio.openLibraryPreview(cardId, projectId, libraryCard);
                }
            });
        }

        }); // end requestAnimationFrame
    }

    deleteClip(itemId, opts = {}) {
        safeLog(`ðŸ—‘ï¸ Delete initiated for item: ${itemId}`);
        
        // Find the item to delete BEFORE filtering
        const itemToDelete = this.libraryItems.find(item => item.id == itemId) || 
                            this.processingItems.find(item => item.id == itemId);
        
        if (!itemToDelete) {
            safeLog(`âŒ Item not found: ${itemId}`);
            showNotification('Clip not found', 'error');
            return;
        }
        
        safeLog(`ðŸ“ Item found:`, itemToDelete);
        
        // PREVENT deletion of currently processing items
        if (itemToDelete.status === 'processing') {
            safeLog(`⚠ï¸ Cannot delete processing item: ${itemId}`);
            showNotification('Cannot delete items while processing. Wait for completion or cancel first.', 'warning');
            return;
        }

        const card = opts.card
            || document.querySelector(`.library-card[data-id="${CSS.escape(String(itemId))}"]`)
            || document.querySelector(`.solis-clip-card[data-id="${CSS.escape(String(itemId))}"]`);

        if (card) {
            this._showCardDeleteConfirm(card, itemId, itemToDelete);
            return;
        }

        this._showDeleteConfirmModal(itemId, itemToDelete);
    }

    _dismissCardDeleteConfirms(exceptCard = null) {
        document.querySelectorAll('.solis-clip-card.is-delete-confirm').forEach((card) => {
            if (exceptCard && card === exceptCard) return;
            card.classList.remove('is-delete-confirm');
            card.querySelectorAll('.scc-delete-confirm').forEach((el) => el.remove());
        });
    }

    _showCardDeleteConfirm(card, itemId, itemToDelete) {
        if (!card) {
            this._showDeleteConfirmModal(itemId, itemToDelete);
            return;
        }

        this._dismissCardDeleteConfirms(card);
        const existing = card.querySelector('.scc-delete-confirm');
        if (existing) {
            existing.remove();
            card.classList.remove('is-delete-confirm');
        }

        const preview = card.querySelector('.scc-preview') || card;
        const clipName = itemToDelete.name || 'this clip';
        const layer = document.createElement('div');
        layer.className = 'scc-delete-confirm';
        layer.setAttribute('role', 'alertdialog');
        layer.setAttribute('aria-label', 'Delete clip');
        layer.innerHTML = `
            <div class="scc-delete-confirm-panel">
                <p class="scc-delete-confirm-text">Delete this clip?<span>Can’t be undone</span></p>
                <div class="scc-delete-confirm-actions">
                    <button type="button" class="scc-delete-confirm-btn keep">Keep</button>
                    <button type="button" class="scc-delete-confirm-btn go">Delete</button>
                </div>
            </div>`;

        const keepBtn = layer.querySelector('.keep');
        const goBtn = layer.querySelector('.go');
        const dismiss = () => {
            layer.remove();
            card.classList.remove('is-delete-confirm');
            document.removeEventListener('pointerdown', onOutside, true);
            document.removeEventListener('keydown', onKey, true);
        };
        const onOutside = (e) => {
            if (!card.contains(e.target)) dismiss();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                dismiss();
            }
        };

        keepBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
        });
        goBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            keepBtn.disabled = true;
            goBtn.disabled = true;
            goBtn.textContent = 'Deleting…';
            try {
                await this._performDeleteClip(itemId, itemToDelete);
                dismiss();
            } catch (err) {
                showNotification('Failed to delete clip: ' + (err?.message || err), 'error');
                keepBtn.disabled = false;
                goBtn.disabled = false;
                goBtn.textContent = 'Delete';
            }
        });
        layer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        card.classList.add('is-delete-confirm');
        preview.appendChild(layer);
        goBtn.focus();
        setTimeout(() => {
            document.addEventListener('pointerdown', onOutside, true);
            document.addEventListener('keydown', onKey, true);
        }, 0);
        safeLog(`Inline delete confirm shown for "${clipName}"`);
    }

    _showDeleteConfirmModal(itemId, itemToDelete) {
        const modal = document.getElementById('deleteConfirmationModal');
        const deleteTitle = document.getElementById('deleteModalTitle');
        const confirmText = document.getElementById('deleteConfirmationText');
        const deleteWarning = modal?.querySelector('.delete-modal-warning');
        let confirmBtn = document.getElementById('confirmDeleteBtn');
        
        if (!modal || !confirmText || !confirmBtn) {
            showNotification('Error: Delete confirm not available', 'error');
            return;
        }
        
        if (deleteTitle) deleteTitle.textContent = 'Delete clip?';
        if (deleteWarning) deleteWarning.textContent = 'This can’t be undone.';
        confirmBtn.textContent = 'Delete';
        confirmBtn.disabled = false;
        const clipName = itemToDelete.name || 'this clip';
        confirmText.textContent = `"${clipName}" will be removed from your library.`;
        
        if (confirmBtn._eventControllers) {
            Object.values(confirmBtn._eventControllers).forEach(ctrl => {
                try { ctrl.abort(); } catch (e) { /* already aborted */ }
            });
            confirmBtn._eventControllers = {};
        }
        
        const controller = new AbortController();
        if (!confirmBtn._eventControllers) confirmBtn._eventControllers = {};
        confirmBtn._eventControllers['click'] = controller;
        
        confirmBtn.addEventListener('click', async () => {
            controller.abort();
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Deleting…';
            try {
                modal.classList.remove('show');
                await this._performDeleteClip(itemId, itemToDelete);
            } catch (error) {
                showNotification('Failed to delete clip: ' + (error.message || error), 'error');
            } finally {
                modal.classList.remove('show');
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Delete';
            }
        }, { once: true, signal: controller.signal });
        
        modal.classList.add('show');
        
        const closeOnBackdropClick = (event) => {
            if (event.target === modal) {
                modal.classList.remove('show');
                document.removeEventListener('click', closeOnBackdropClick);
            }
        };
        document.addEventListener('click', closeOnBackdropClick);
    }

    async _performDeleteClip(itemId, itemToDelete, opts = {}) {
        const quiet = !!opts.quiet;
        if (!quiet) showNotification('Deleting clip...', 'info');

        if (itemToDelete.projectId) {
            safeLog(`📤 Deleting project from server: ${itemToDelete.projectId}`);
            await this.deleteProjectFromServer(itemToDelete.projectId);
        }

        this._removeClipFromLocalState(itemId, itemToDelete);
        await this._removeLibraryCardDom(itemId);
        this._syncLibrarySelectUI();

        if (typeof this.updateProcessingView === 'function') this.updateProcessingView();
        if (typeof this.updateRecentActivity === 'function') this.updateRecentActivity();
        this.saveLibraryItems();
        this.saveProcessingItems();
        this.invalidateLibraryCache();
        this._writeLibrarySessionCache();
        this._maybeRefreshLibraryEmptyState();

        if (typeof updateStorageBadgeDisplay === 'function') {
            await updateStorageBadgeDisplay();
        } else if (typeof this.loadAndDisplayStorageInfo === 'function') {
            this.loadAndDisplayStorageInfo();
        }

        if (!quiet) showNotification('Clip deleted', 'success');
    }

    _removeClipFromLocalState(itemId, itemToDelete = null) {
        const idKey = String(itemId);
        this.libraryItems = (this.libraryItems || []).filter((item) => String(item.id) !== idKey);
        this.processingItems = (this.processingItems || []).filter((item) => String(item.id) !== idKey);
        const projectId = itemToDelete?.projectId;
        if (projectId) {
            this.processingItems = this.processingItems.filter(
                (item) => String(item.projectId || '') !== String(projectId)
            );
        }
        if (this._librarySelectedIds) this._librarySelectedIds.delete(idKey);

        if (itemToDelete?.collectionId && Array.isArray(this.libraryCollections)) {
            const col = this._findCollection(itemToDelete.collectionId);
            if (col) col.clipCount = this._getCollectionClips(col.id).length;
            this.libraryCollections = this.libraryCollections.filter(
                (c) => (c.clipCount || this._getCollectionClips(c.id).length) > 0
            );
        }
    }

    async _removeLibraryCardDom(itemId) {
        const grid = document.getElementById('libraryGrid');
        if (!grid) return;
        const id = String(itemId);
        const card = grid.querySelector(`.library-card[data-id="${CSS.escape(id)}"]`);
        if (!card) return;
        card.classList.add('is-removing');
        card.style.pointerEvents = 'none';
        await new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                card.remove();
                resolve();
            };
            card.addEventListener('transitionend', finish, { once: true });
            setTimeout(finish, 280);
        });
    }

    _maybeRefreshLibraryEmptyState() {
        const grid = document.getElementById('libraryGrid');
        if (!grid) return;
        const hasCards = !!grid.querySelector('.library-card, .library-collection-folder');
        const hasItems = (this.libraryItems || []).length > 0
            || ((this.libraryCollections || []).length > 0);
        if (!hasCards || !hasItems) {
            this.updateLibraryView();
            return;
        }
        // Keep collection folder counts in sync without a full rebuild when possible
        grid.querySelectorAll('.library-collection-folder[data-collection-id]').forEach((folder) => {
            const colId = folder.getAttribute('data-collection-id');
            const count = this._getCollectionClips(colId).length;
            const expiry = folder.querySelector('.scc-collection-expiry');
            if (expiry) expiry.textContent = `${count} clip${count !== 1 ? 's' : ''}`;
            if (count <= 0) folder.remove();
        });
    }

    async deleteProjectFromServer(projectId) {
        try {
            // ðŸ” SECURITY: Client-side validation as defense-in-depth
            // (Backend MUST also validate ownership!)
            if (!projectId || typeof projectId !== 'string') {
                throw new Error('Invalid project ID format');
            }
            
            // Assuming project IDs are UUIDs in format: userId_uuid or similar
            // Add validation based on your actual project ID format
            // Basic check: should be a reasonable length string with alphanumeric chars
            if (!/^[a-zA-Z0-9_-]+$/.test(projectId) || projectId.length < 10) {
                throw new Error('Invalid project ID format');
            }
            
            // ðŸ” CRITICAL - IDOR PREVENTION: /clips/project/{projectId} DELETE MUST:
            // 1. Verify user session from httpOnly cookie
            // 2. Query database: Is this projectId owned by the authenticated user?
            // 3. Return 403 Forbidden if projectId belongs to another user
            // 4. Only then delete the project
            // Frontend sends projectId but backend MUST verify ownership!
            
            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/clips/project/${projectId}`, {
                method: 'DELETE',
                headers: headers,
                credentials: 'include'  // ðŸ” Send httpOnly cookie
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            
            const data = await response.json();
            return true;
        } catch (error) {
            // ðŸ” SECURITY FIX: Sanitize error message to avoid exposing sensitive info
            // Do NOT expose error.message directly - it may contain stack traces, paths, etc.
            const sanitized = sanitizeErrorMessage(error);
            showNotification(`Warning: Failed to delete files on server`, 'warning');
            safeLog('Delete error (sanitized for user):', sanitized);
            return false;
        }
    }

    _getLibraryRootItems() {
        return (this.libraryItems || []).filter((item) => !item.collectionId);
    }

    _getCollectionClips(collectionId) {
        return (this.libraryItems || []).filter(
            (item) => String(item.collectionId || '') === String(collectionId || '')
        );
    }

    _findCollection(collectionId) {
        return (this.libraryCollections || []).find(
            (c) => String(c.id) === String(collectionId || '')
        ) || null;
    }

    _syncLibraryNavArrows() {
        const backBtn = document.getElementById('libraryNavBackBtn');
        const fwdBtn = document.getElementById('libraryNavForwardBtn');
        if (!Array.isArray(this._libraryNavStack) || !this._libraryNavStack.length) {
            this._libraryNavStack = [null];
            this._libraryNavIndex = 0;
        }
        const idx = Math.max(0, Math.min(this._libraryNavIndex || 0, this._libraryNavStack.length - 1));
        this._libraryNavIndex = idx;
        if (backBtn) backBtn.disabled = idx <= 0;
        if (fwdBtn) fwdBtn.disabled = idx >= this._libraryNavStack.length - 1;

        if (!this._libraryNavBound) {
            this._libraryNavBound = true;
            backBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.libraryNavBack();
            });
            fwdBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.libraryNavForward();
            });
        }
    }

    _pushLibraryNav(collectionId) {
        const next = collectionId || null;
        const cur = (this._libraryNavStack || [null])[this._libraryNavIndex || 0] || null;
        if (String(cur || '') === String(next || '')) {
            this._syncLibraryNavArrows();
            return;
        }
        const stack = (this._libraryNavStack || [null]).slice(0, (this._libraryNavIndex || 0) + 1);
        stack.push(next);
        this._libraryNavStack = stack;
        this._libraryNavIndex = stack.length - 1;
        this._syncLibraryNavArrows();
    }

    libraryNavBack() {
        if ((this._libraryNavIndex || 0) <= 0) return;
        this._libraryNavIndex -= 1;
        const target = this._libraryNavStack[this._libraryNavIndex] || null;
        this.openCollectionId = target;
        this._syncLibraryNavArrows();
        this.updateLibraryView();
    }

    libraryNavForward() {
        const stack = this._libraryNavStack || [null];
        if ((this._libraryNavIndex || 0) >= stack.length - 1) return;
        this._libraryNavIndex += 1;
        const target = stack[this._libraryNavIndex] || null;
        this.openCollectionId = target;
        this._syncLibraryNavArrows();
        this.updateLibraryView();
    }

    openLibraryCollection(collectionId) {
        this.openCollectionId = collectionId || null;
        this._pushLibraryNav(this.openCollectionId);
        this.updateLibraryView();
    }

    closeLibraryCollection() {
        this.openCollectionId = null;
        this._pushLibraryNav(null);
        this.updateLibraryView();
    }

    async moveClipToCollection(projectId, collectionId) {
        if (!projectId) return false;
        try {
            const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
            const response = await fetch(
                `${API_BASE_URL}/clips/projects/${encodeURIComponent(projectId)}/collection`,
                {
                    method: 'PATCH',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify({ collection_id: collectionId }),
                }
            );
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                showNotification(err.error || 'Could not move clip', 'warning');
                return false;
            }
            const item = this.libraryItems.find(
                (i) => String(i.projectId || i.id) === String(projectId)
            );
            if (item) {
                item.collectionId = collectionId || null;
            }
            if (collectionId) {
                const col = this._findCollection(collectionId);
                if (col) col.clipCount = this._getCollectionClips(collectionId).length;
            }
            this.libraryCollections.forEach((col) => {
                col.clipCount = this._getCollectionClips(col.id).length;
            });
            this.libraryCollections = this.libraryCollections.filter(
                (col) => (col.clipCount || 0) > 0
            );
            this.saveLibraryItems();
            this.updateLibraryView();
            return true;
        } catch (err) {
            safeLog('moveClipToCollection failed:', err);
            return false;
        }
    }

    _bindLibraryDragDrop(card, item) {
        if (!card || !item || card.dataset.dragBound === '1') return;
        card.dataset.dragBound = '1';
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', (e) => {
            if (this.librarySelectMode) {
                e.preventDefault();
                return;
            }
            const pid = item.projectId || item.id;
            this._dragClipId = pid;
            card.classList.add('library-card-dragging');
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', String(pid)); } catch (_) {}
            document.getElementById('librarySection')?.classList.add('library-drag-active');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('library-card-dragging');
            this._dragClipId = null;
            document.getElementById('librarySection')?.classList.remove('library-drag-active');
            document.querySelectorAll('.library-collection-folder.is-drop-target').forEach((el) => {
                el.classList.remove('is-drop-target');
            });
        });
    }

    _closeAllCollectionMenus() {
        document.querySelectorAll('.library-collection-folder.is-menu-open').forEach((card) => {
            card.classList.remove('is-menu-open');
            const menu = card.querySelector('.scc-collection-menu');
            const dd = card.querySelector('.scc-collection-dropdown');
            if (menu) menu.setAttribute('aria-expanded', 'false');
            if (dd) dd.hidden = true;
        });
    }

    _bindCollectionMenu(card, col) {
        if (!card || !col || card.dataset.menuBound === '1') return;
        card.dataset.menuBound = '1';
        const btn = card.querySelector('.scc-collection-menu');
        const dd = card.querySelector('.scc-collection-dropdown');
        if (!btn || !dd) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const wasOpen = !dd.hidden;
            this._closeAllCollectionMenus();
            if (!wasOpen) {
                dd.hidden = false;
                btn.setAttribute('aria-expanded', 'true');
                card.classList.add('is-menu-open');
            }
        });

        dd.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = e.target.closest('.scc-collection-dd-item');
            if (!item) return;
            const action = item.dataset.action;
            this._closeAllCollectionMenus();
            if (action === 'zip') {
                showNotification('Zip download coming soon', 'info');
                return;
            }
            if (action === 'delete') {
                const ok = window.confirm(`Delete project folder "${col.title || 'Project'}"? Clips stay in your library.`);
                if (!ok) return;
                await this.dissolveCollection(col.id);
            }
        });

        if (!this._collectionMenuDocBound) {
            this._collectionMenuDocBound = true;
            document.addEventListener('click', (e) => {
                if (e.target.closest('.scc-collection-dropdown, .scc-collection-menu')) return;
                this._closeAllCollectionMenus();
            });
        }
    }

    async dissolveCollection(collectionId) {
        const clips = this._getCollectionClips(collectionId);
        for (const clip of clips) {
            const pid = clip.projectId || clip.id;
            if (pid) await this.moveClipToCollection(pid, null);
        }
        this.libraryCollections = (this.libraryCollections || []).filter(
            (c) => String(c.id) !== String(collectionId)
        );
        if (String(this.openCollectionId || '') === String(collectionId)) {
            this.openCollectionId = null;
        }
        this.saveLibraryItems();
        this.updateLibraryView();
        showNotification('Project folder removed', 'success');
    }

    _bindCollectionDrop(card, collectionId) {
        if (!card || card.dataset.dropBound === '1') return;
        card.dataset.dropBound = '1';
        card.addEventListener('dragover', (e) => {
            if (!this._dragClipId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.classList.add('is-drop-target');
        });
        card.addEventListener('dragleave', () => {
            card.classList.remove('is-drop-target');
        });
        card.addEventListener('drop', async (e) => {
            e.preventDefault();
            card.classList.remove('is-drop-target');
            const pid = this._dragClipId || e.dataTransfer.getData('text/plain');
            if (!pid || !collectionId) return;
            await this.moveClipToCollection(pid, collectionId);
        });
    }

    filterLibrary(filter) {
        // Filter library items based on selected filter
        const filteredItems = this.libraryItems.filter(item => {
            if (filter === 'all') return true;
            if (filter === 'recent') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return new Date(item.timestamp) > oneWeekAgo;
            }
            if (filter === 'favorites') {
                // You can add favorite functionality later
                return true;
            }
            return true;
        });
        
        // Update view with filtered items
        showNotification(`Filtered by: ${filter}`, 'info');
        // Note: In a full implementation, you would update the grid with filteredItems
    }

    _readLibrarySortMode() {
        try {
            const saved = localStorage.getItem('solisLibrarySort');
            if (['newest', 'oldest', 'ranking', 'split'].includes(saved)) return saved;
            // Migrate old name sorts
            if (saved === 'name_asc' || saved === 'name_desc') return 'newest';
        } catch (_) {}
        return 'newest';
    }

    _initLibrarySelectMode() {
        const toggle = document.getElementById('librarySelectModeBtn');
        const deleteBtn = document.getElementById('librarySelectDeleteBtn');
        const cancelBtn = document.getElementById('librarySelectCancelBtn');
        if (toggle && toggle.dataset.bound !== '1') {
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.setLibrarySelectMode(!this.librarySelectMode);
            });
        }
        if (deleteBtn && deleteBtn.dataset.bound !== '1') {
            deleteBtn.dataset.bound = '1';
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.confirmDeleteSelectedClips();
            });
        }
        if (cancelBtn && cancelBtn.dataset.bound !== '1') {
            cancelBtn.dataset.bound = '1';
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.setLibrarySelectMode(false);
            });
        }
        this._syncLibrarySelectUI();
    }

    setLibrarySelectMode(on) {
        this.librarySelectMode = !!on;
        if (!this.librarySelectMode) {
            this._librarySelectedIds = new Set();
            this._dismissCardDeleteConfirms();
        }
        const section = document.getElementById('librarySection');
        section?.classList.toggle('library-select-mode', this.librarySelectMode);
        document.querySelectorAll('#libraryGrid .library-card.solis-clip-card').forEach((card) => {
            card.classList.toggle('is-selected', this.librarySelectMode && this._librarySelectedIds.has(String(card.getAttribute('data-id') || '')));
            // Drag fights with click-to-select — disable while selecting
            if (card.getAttribute('draggable') != null) {
                card.setAttribute('draggable', this.librarySelectMode ? 'false' : 'true');
            }
        });
        this._syncLibrarySelectUI();
    }

    _syncLibrarySelectUI() {
        const toggle = document.getElementById('librarySelectModeBtn');
        const bar = document.getElementById('librarySelectBar');
        const countEl = document.getElementById('librarySelectCount');
        const deleteBtn = document.getElementById('librarySelectDeleteBtn');
        const n = this._librarySelectedIds ? this._librarySelectedIds.size : 0;

        if (toggle) {
            toggle.classList.toggle('is-active', !!this.librarySelectMode);
            toggle.setAttribute('aria-pressed', this.librarySelectMode ? 'true' : 'false');
            toggle.title = this.librarySelectMode ? 'Exit selection' : 'Select clips';
        }
        if (bar) bar.hidden = !this.librarySelectMode;
        if (countEl) countEl.textContent = n === 1 ? '1 selected' : `${n} selected`;
        if (deleteBtn) {
            deleteBtn.disabled = n === 0;
            deleteBtn.textContent = n > 0 ? `Delete ${n}` : 'Delete';
        }
    }

    toggleLibraryClipSelected(itemId, cardEl = null) {
        if (!this.librarySelectMode) return;
        const id = String(itemId || '');
        if (!id) return;
        if (!this._librarySelectedIds) this._librarySelectedIds = new Set();
        const card = cardEl
            || document.querySelector(`#libraryGrid .library-card[data-id="${CSS.escape(id)}"]`);
        if (this._librarySelectedIds.has(id)) {
            this._librarySelectedIds.delete(id);
            card?.classList.remove('is-selected');
        } else {
            this._librarySelectedIds.add(id);
            card?.classList.add('is-selected');
        }
        this._syncLibrarySelectUI();
    }

    confirmDeleteSelectedClips() {
        const ids = [...(this._librarySelectedIds || [])];
        if (!ids.length) return;

        const modal = document.getElementById('deleteConfirmationModal');
        const deleteTitle = document.getElementById('deleteModalTitle');
        const confirmText = document.getElementById('deleteConfirmationText');
        const deleteWarning = modal?.querySelector('.delete-modal-warning');
        let confirmBtn = document.getElementById('confirmDeleteBtn');
        if (!modal || !confirmText || !confirmBtn) {
            this.deleteSelectedClips();
            return;
        }

        if (deleteTitle) deleteTitle.textContent = ids.length === 1 ? 'Delete clip?' : `Delete ${ids.length} clips?`;
        confirmText.textContent = ids.length === 1
            ? 'Remove this clip from your library.'
            : `Remove ${ids.length} selected clips from your library.`;
        if (deleteWarning) deleteWarning.textContent = 'This can’t be undone.';
        confirmBtn.textContent = ids.length === 1 ? 'Delete' : `Delete ${ids.length}`;
        confirmBtn.disabled = false;

        if (confirmBtn._eventControllers) {
            Object.values(confirmBtn._eventControllers).forEach((ctrl) => {
                try { ctrl.abort(); } catch (_) {}
            });
            confirmBtn._eventControllers = {};
        }
        const controller = new AbortController();
        confirmBtn._eventControllers = { click: controller };
        confirmBtn.addEventListener('click', async () => {
            controller.abort();
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Deleting…';
            modal.classList.remove('show');
            try {
                await this.deleteSelectedClips();
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Delete';
            }
        }, { once: true, signal: controller.signal });

        modal.classList.add('show');
        const closeOnBackdropClick = (event) => {
            if (event.target === modal) {
                modal.classList.remove('show');
                document.removeEventListener('click', closeOnBackdropClick);
            }
        };
        document.addEventListener('click', closeOnBackdropClick);
    }

    async deleteSelectedClips() {
        const ids = [...(this._librarySelectedIds || [])];
        if (!ids.length) {
            this.setLibrarySelectMode(false);
            return;
        }

        showNotification(ids.length === 1 ? 'Deleting clip...' : `Deleting ${ids.length} clips...`, 'info');
        let deleted = 0;
        let failed = 0;

        for (const id of ids) {
            const item = (this.libraryItems || []).find((x) => String(x.id) === String(id));
            if (!item) {
                this._librarySelectedIds.delete(String(id));
                continue;
            }
            try {
                if (item.projectId) await this.deleteProjectFromServer(item.projectId);
                this._removeClipFromLocalState(id, item);
                await this._removeLibraryCardDom(id);
                deleted += 1;
            } catch (err) {
                failed += 1;
                safeLog(`Failed to delete ${id}:`, err);
            }
        }

        this.saveLibraryItems();
        this.saveProcessingItems();
        this.invalidateLibraryCache();
        this._writeLibrarySessionCache();
        if (typeof this.updateProcessingView === 'function') this.updateProcessingView();
        if (typeof this.updateRecentActivity === 'function') this.updateRecentActivity();
        this._maybeRefreshLibraryEmptyState();
        if (typeof updateStorageBadgeDisplay === 'function') {
            await updateStorageBadgeDisplay();
        } else if (typeof this.loadAndDisplayStorageInfo === 'function') {
            this.loadAndDisplayStorageInfo();
        }

        this.setLibrarySelectMode(false);

        if (failed && deleted) {
            showNotification(`Deleted ${deleted}, ${failed} failed`, 'warning');
        } else if (failed) {
            showNotification('Failed to delete selected clips', 'error');
        } else {
            showNotification(deleted === 1 ? 'Clip deleted' : `${deleted} clips deleted`, 'success');
        }
    }

    _librarySortLabel(mode = this.librarySortMode) {
        return ({
            newest: 'Newest',
            oldest: 'Oldest',
            ranking: 'Ranking',
            split: 'Split',
        })[mode] || 'Sort';
    }

    _libraryItemTemplateKey(item) {
        return `${item?.template || ''} ${item?.templateName || ''}`.toLowerCase();
    }

    _isRankingLibraryItem(item) {
        const key = this._libraryItemTemplateKey(item);
        return key.includes('rank') || key.includes('compilation');
    }

    _isSplitLibraryItem(item) {
        const key = this._libraryItemTemplateKey(item);
        return key.includes('split');
    }

    getSortedLibraryItems(items) {
        const list = Array.isArray(items) ? [...items] : [];
        const ts = (item) => {
            const t = item?.timestamp;
            if (t instanceof Date) return t.getTime();
            const n = Date.parse(t);
            return Number.isFinite(n) ? n : 0;
        };

        let filtered = list;
        if (this.librarySortMode === 'ranking') {
            filtered = list.filter((item) => this._isRankingLibraryItem(item));
        } else if (this.librarySortMode === 'split') {
            filtered = list.filter((item) => this._isSplitLibraryItem(item));
        }

        if (this.librarySortMode === 'oldest') {
            return filtered.sort((a, b) => ts(a) - ts(b));
        }
        // newest / ranking / split → newest first within the set
        return filtered.sort((a, b) => ts(b) - ts(a));
    }

    setLibrarySortMode(mode) {
        if (!['newest', 'oldest', 'ranking', 'split'].includes(mode)) return;
        this.librarySortMode = mode;
        try { localStorage.setItem('solisLibrarySort', mode); } catch (_) {}
        this._syncLibrarySortUI();
        this.closeLibrarySortMenu();
        this.updateLibraryView();
    }

    _syncLibrarySortUI() {
        const label = document.getElementById('sortLibraryLabel');
        if (label) label.textContent = this._librarySortLabel();
        document.querySelectorAll('.library-sort-option').forEach((btn) => {
            const on = btn.dataset.sort === this.librarySortMode;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }

    openLibrarySortMenu() {
        const wrap = document.getElementById('librarySortWrap');
        const btn = document.getElementById('sortLibraryBtn');
        if (!wrap || !btn) return;
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        this._syncLibrarySortUI();
    }

    closeLibrarySortMenu() {
        const wrap = document.getElementById('librarySortWrap');
        const btn = document.getElementById('sortLibraryBtn');
        if (wrap) wrap.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    toggleLibrarySortMenu() {
        const wrap = document.getElementById('librarySortWrap');
        if (!wrap) return;
        if (wrap.classList.contains('is-open')) this.closeLibrarySortMenu();
        else this.openLibrarySortMenu();
    }

    _initLibrarySortControls() {
        // Global entry points — HTML onclick wires through these
        window.toggleLibrarySortMenu = () => {
            try { this.toggleLibrarySortMenu(); } catch (err) { safeLog('toggleLibrarySortMenu', err); }
        };
        window.setLibrarySortMode = (mode) => {
            try { this.setLibrarySortMode(mode); } catch (err) { safeLog('setLibrarySortMode', err); }
        };
        window.closeLibrarySortMenu = () => {
            try { this.closeLibrarySortMenu(); } catch (_) {}
        };

        this._syncLibrarySortUI();
        this.closeLibrarySortMenu();

        // Outside click / Esc — once (button/options use inline onclick)
        if (!this._librarySortOutsideBound) {
            this._librarySortOutsideBound = true;
            document.addEventListener('click', (e) => {
                const wrap = document.getElementById('librarySortWrap');
                if (!wrap || !wrap.classList.contains('is-open')) return;
                if (wrap.contains(e.target)) return;
                this.closeLibrarySortMenu();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeLibrarySortMenu();
            });
        }
    }

    manualRefresh() {
        this.loadLibraryItems();
        this.loadProcessingItems();
        showNotification('Library refreshed', 'info');
    }

    // Note: showNotification is defined globally (see line 727)
    // This method delegates to the global function for consistency

    saveProcessingItems() {
        try {
            if (!this.processingItems || this.processingItems.length === 0) {
                localStorage.removeItem('clipsProcessing');
                return;
            }
            
            const data = JSON.stringify(this.processingItems);
            localStorage.setItem('clipsProcessing', data);
            safeLog(`✓ Saved ${this.processingItems.length} processing item(s)`);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                safeLog('Storage quota exceeded - clearing old data');
                this.clearOldProcessingData();
                try {
                    localStorage.setItem('clipsProcessing', JSON.stringify(this.processingItems));
                } catch (retryError) {
                    safeLog('Failed to save even after cleanup:', retryError);
                }
            } else {
                safeLog('Failed to save processing items:', e);
            }
        }
    }

    async loadProcessingItems() {
        try {
            const saved = localStorage.getItem('clipsProcessing');
            if (saved) {
                this.processingItems = JSON.parse(saved);
                const now = Date.now();
                const MAX_PROCESSING_TIME = 2 * 60 * 60 * 1000; // 2 hours — avoid zombie status polls
                
                // Filter out only genuinely old/completed items
                this.processingItems = this.processingItems.filter(item => {
                    // Remove only if explicitly marked as completed or failed
                    if (item.status === 'completed' || item.status === 'failed') {
                        safeLog(`🧹 Cleaning up ${item.status} item: ${item.name}`);
                        return false;
                    }
                    
                    // Check if item is too old (stale processing)
                    const itemAge = now - (item.timestamp ? new Date(item.timestamp).getTime() : now);
                    if (itemAge > MAX_PROCESSING_TIME) {
                        safeLog(`🧹 Removing stale processing item (${Math.round(itemAge/1000/60)} min old): ${item.name}`);
                        return false;
                    }
                    
                    // Keep everything else that is processing/waiting/pending
                    return true;
                });

                // Save the cleaned list back to localStorage
                this.saveProcessingItems();
                this.updateProcessingView();
                this.updateLibraryView();
                safeLog(`✓ Loaded ${this.processingItems.length} processing item(s)`);

                if (this.processingItems.length > 0) {
                    const spinner = typeof initGenerationProgressSpinner === 'function'
                        ? initGenerationProgressSpinner()
                        : window.generationProgressSpinner;
                    if (spinner) {
                        for (const item of this.processingItems) {
                            if (!item.projectId || !this.validateProjectId(item.projectId)) continue;
                            if (item.status === 'processing' || item.status === 'waiting' || item.status === 'pending') {
                                spinner.restoreGeneration(
                                    item.projectId,
                                    item.progress || 0,
                                    item.message || 'Resuming...',
                                    'processing'
                                );
                            }
                        }
                    }
                }
            }
        } catch (e) {
            safeLog('Failed to load processing items:', e);
            this.processingItems = [];
            this.saveProcessingItems();
            this.updateLibraryView();
        }
    }

    saveLibraryItems() {
        try {
            if (!this.libraryItems || this.libraryItems.length === 0) {
                localStorage.removeItem('clipsLibrary');
                this._clearLibrarySessionCache();
                return;
            }
            
            const data = JSON.stringify(this.libraryItems);
            localStorage.setItem('clipsLibrary', data);
            this._writeLibrarySessionCache();
            safeLog(`✓ Saved ${this.libraryItems.length} library item(s)`);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                safeLog('Storage quota exceeded - clearing old data');
                this.clearOldLibraryData();
                try {
                    localStorage.setItem('clipsLibrary', JSON.stringify(this.libraryItems));
                    this._writeLibrarySessionCache();
                } catch (retryError) {
                    safeLog('Failed to save even after cleanup:', retryError);
                }
            } else {
                safeLog('Failed to save library items:', e);
            }
        }
    }

    clearProcessingItems() {
        // Clear all stuck processing items - useful for debugging/manual cleanup
        safeLog(`🧹 Clearing ${this.processingItems.length} processing items`);
        this.processingItems = [];
        this.stopAllMonitoring();
        this.saveProcessingItems();
        this.updateLibraryView();
        showNotification('Cleared all processing items', 'info');
    }

    loadLibraryItemsFromStorage() {
        try {
            const saved = localStorage.getItem('clipsLibrary');
            if (saved) {
                this.libraryItems = JSON.parse(saved);
                this.updateLibraryView();
                this.updateRecentActivity();
                safeLog(`✓ Loaded ${this.libraryItems.length} library item(s)`);
            }
        } catch (e) {
            safeLog('Failed to load library items:', e);
            this.libraryItems = [];
        }
    }

    clearOldLibraryData() {
        // Keep only the 50 most recent items
        if (this.libraryItems.length > 50) {
            this.libraryItems = this.libraryItems
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 50);
            safeLog('Cleaned up old library items, keeping 50 most recent');
        }
    }

    clearOldProcessingData() {
        // Remove completed items older than 7 days
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        this.processingItems = this.processingItems.filter(item => {
            if (item.status === 'completed' && item.timestamp < sevenDaysAgo) {
                return false; // Remove old completed items
            }
            return true;
        });
        safeLog('Cleaned up old processing items');
    }

    setupWebSocketHandlers() {
        /**
         * Set up websocket handlers for real-time library updates
         * This allows processing cards to animate unblur when video completes
         * without requiring a page refresh
         */
        // ✅ PREVENT DUPLICATE REGISTRATIONS - Flag-based approach to avoid recursive retries
        if (this._webSocketHandlersSetup) {
            return;  // Already registered, skip to prevent memory leaks
        }
        
        if (!solisWSClient) {
            safeLog('WebSocket client not available yet, retrying in 1 second...');
            // Only retry once, don't create recursive chain
            if (!this._webSocketRetryScheduled) {
                this._webSocketRetryScheduled = true;
                setTimeout(() => {
                    this._webSocketRetryScheduled = false;  // Reset flag for next retry
                    this.setupWebSocketHandlers();
                }, 1000);
            }
            return;
        }
        
        // Mark as setup to prevent duplicate registrations
        this._webSocketHandlersSetup = true;

        // Handle progress updates
        solisWSClient.on('progress', (data) => {
            const { taskId, progress, step, status, project_id } = data;
            const projectId = project_id || taskId;
            
            // Validate progress is a valid number
            if (typeof progress !== 'number' || isNaN(progress) || progress < 0 || progress > 100) {
                safeLog(`⚠ï¸ Invalid progress value received: ${progress}`);
                return;
            }

            const spinner = typeof getGenerationProgressSpinner === 'function'
                ? getGenerationProgressSpinner()
                : window.generationProgressSpinner;
            if (spinner?.updateProgress && projectId) {
                const activeId = spinner._resolveActiveProjectId?.(projectId) || projectId;
                // Only update an already-tracked job — never spawn a ghost "Compiling" entry
                if (spinner.activeGenerations?.has?.(activeId) || spinner.activeGenerations?.has?.(projectId)) {
                    spinner.updateProgress(activeId, progress, step || status || 'Processing...', true);
                }
            }
        });

        // Handle completion - move card from processing to library with animation
        solisWSClient.on('complete', (data) => {
            const { taskId, result } = data;
            safeLog(`✅ Video ${taskId} completed, moving to library...`);
            
            // Find the processing item
            const processingIndex = this.processingItems.findIndex(item => item.id === taskId);
            if (processingIndex === -1) {
                safeLog(`âŒ Processing item not found: ${taskId}`);
                return;
            }

            const processingItem = this.processingItems[processingIndex];
            const processingCard = document.querySelector(`[data-processing-id="${taskId}"]`);

            const completeSpinner = typeof getGenerationProgressSpinner === 'function'
                ? getGenerationProgressSpinner()
                : window.generationProgressSpinner;
            const completedProjectId = result?.project_id || processingItem?.projectId;
            if (completeSpinner?.completeGeneration && completedProjectId) {
                completeSpinner.completeGeneration(completedProjectId);
            }

            const finishToLibrary = () => {
                // Remove from processing (index may have shifted)
                const idx = this.processingItems.findIndex(item => item.id === taskId);
                if (idx !== -1) this.processingItems.splice(idx, 1);
                this.saveProcessingItems();

                const libraryItem = {
                    id: result?.project_id || taskId,
                    projectId: result?.project_id || taskId,
                    name: processingItem.name,
                    // Prefer template id (ranked_compilation / splitscreen) over display name
                    template: processingItem.template || processingItem.templateName || 'Clip',
                    templateName: processingItem.templateName || processingItem.template || 'Clip',
                    thumbnailUrl: result?.thumbnail_url || processingItem.thumbnailUrl || '',
                    duration: result?.duration || processingItem.duration || '0s',
                    timestamp: new Date().toISOString(),
                    status: 'completed',
                    virality: result?.virality || processingItem.virality || null,
                    share_pack: result?.share_pack || processingItem.share_pack || null,
                    _optimistic: true,
                };

                // Avoid duplicate cards if refresh already added it
                this.libraryItems = this.libraryItems.filter(
                    (i) => String(i.projectId || i.id) !== String(libraryItem.projectId)
                );
                this.libraryItems.unshift(libraryItem);
                this.saveLibraryItems();
                this.updateLibraryView();
                // Open preview immediately — don't wait for a rendered card
                this.openLibraryPreviewWhenReady(libraryItem.id, libraryItem.projectId);
                this.loadStorageInfo();
                safeLog(`✅ Moved ${processingItem.name} to library`);
            };

            if (processingCard) {
                processingCard.classList.add('unblurring');
                setTimeout(finishToLibrary, 600);
            } else {
                // No processing card in library (spinner-only UX) — add immediately
                finishToLibrary();
            }
        });

        // Handle errors
        solisWSClient.on('error', (data) => {
            const { taskId, error } = data;
            safeLog(`âŒ Video ${taskId} failed: ${error}`);
            
            const processingCard = document.querySelector(`[data-processing-id="${taskId}"]`);
            if (processingCard) {
                processingCard.style.opacity = '0.5';
                const titleElement = processingCard.querySelector('.card-title');
                if (titleElement) {
                    titleElement.textContent = 'Failed - ' + titleElement.textContent;
                }
            }

            const failSpinner = typeof getGenerationProgressSpinner === 'function'
                ? getGenerationProgressSpinner()
                : window.generationProgressSpinner;
            if (failSpinner?.failGeneration && taskId) {
                failSpinner.failGeneration(taskId, error || 'There was an error — try again');
            }

            // Remove from processing items if present
            const processingIndex = this.processingItems.findIndex(item => item.id === taskId);
            if (processingIndex !== -1) {
                this.processingItems.splice(processingIndex, 1);
                this.saveProcessingItems();
            }
        });

        // Handle processing-specific errors from backend
        solisWSClient.on('processing_error', (data) => {
            const { taskId, error, message } = data;
            const errorMsg = message || error || 'Unknown processing error';
            safeLog(`âŒ Processing failed: ${errorMsg}`);
            
            const failSpinner = typeof getGenerationProgressSpinner === 'function'
                ? getGenerationProgressSpinner()
                : window.generationProgressSpinner;
            if (failSpinner?.failGeneration && taskId) {
                failSpinner.failGeneration(taskId, errorMsg);
            }
            
            // Show user-friendly error message
            const processingCard = document.querySelector(`[data-processing-id="${taskId}"]`);
            if (processingCard) {
                processingCard.style.opacity = '0.5';
                processingCard.style.borderColor = '#ef4444';
                processingCard.style.borderWidth = '2px';
                const titleElement = processingCard.querySelector('.card-title');
                if (titleElement) {
                    titleElement.textContent = 'âŒ Failed';
                }
                const statusElement = processingCard.querySelector('.card-subtitle') || processingCard.querySelector('.card-status');
                if (statusElement) {
                    // Parse error message to extract key info for tier limits
                    let displayError = errorMsg;
                    if (errorMsg.includes('Video is too long')) {
                        // Extract tier information
                        const tierMatch = errorMsg.match(/(\d+)\s*minute/g);
                        displayError = errorMsg;
                    }
                    statusElement.textContent = displayError.substring(0, 100); // Truncate for display
                    statusElement.title = displayError; // Full error on hover
                }
            }

            // Remove from processing items if present
            const processingIndex = this.processingItems.findIndex(item => item.id === taskId);
            if (processingIndex !== -1) {
                this.processingItems.splice(processingIndex, 1);
                this.saveProcessingItems();
            }
        });

        safeLog('✅ WebSocket handlers initialized');
    }

    // Safe event listener methods with AbortController for cleanup
    safeAddEventListener(selector, event, handler) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            // ðŸ” Use AbortController for proper cleanup without removing other listeners
            if (!element._eventControllers) element._eventControllers = {};
            const key = `${event}_${selector}`;
            
            // Abort previous listener for this event+selector combo
            if (element._eventControllers[key]) {
                element._eventControllers[key].abort();
            }
            
            // Create new AbortController for this listener
            const controller = new AbortController();
            element._eventControllers[key] = controller;
            element.addEventListener(event, handler, { signal: controller.signal });
        });
    }

    safeAddEventListenerById(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            safeLog(`✅ Found element with id: ${id}`);
            // ðŸ” Use AbortController for proper cleanup without removing other listeners
            if (!element._eventControllers) {
                element._eventControllers = {};
            }
            const key = `${event}_${id}`;
            // Cancel previous listener if exists
            if (element._eventControllers[key]) {
                element._eventControllers[key].abort();
            }
            const controller = new AbortController();
            element._eventControllers[key] = controller;
            element.addEventListener(event, handler, { signal: controller.signal });
        } else {
            safeLog(`⚠️ Element not found with id: ${id}`);
        }
    }

    _bindUseTemplateFabSync() {
        const main = document.getElementById('confirmUseTemplateBtn');
        if (!main || main.dataset.fabSyncBound === '1') {
            if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
            return;
        }
        main.dataset.fabSyncBound = '1';
        const sync = () => {
            if (typeof window.syncUseTemplateFab === 'function') window.syncUseTemplateFab();
        };
        sync();
        try {
            const obs = new MutationObserver(sync);
            obs.observe(main, {
                attributes: true,
                attributeFilter: ['disabled', 'class', 'aria-disabled'],
                childList: true,
                characterData: true,
                subtree: true,
            });
            this._useTemplateFabObserver = obs;
        } catch (_) {
            /* MutationObserver unavailable */
        }
    }

    _bindTemplateSheetDrag() {
        const handle = document.getElementById('templateSheetHandle');
        const sidebar = document.querySelector('.template-preview-sidebar');
        if (!handle || !sidebar || handle.dataset.dragBound === '1') return;
        handle.dataset.dragBound = '1';

        let dragging = false;
        let startY = 0;
        let startTY = 0;
        let lastY = 0;
        let lastT = 0;
        let velocity = 0;

        const peekY = () => Math.max(0, (sidebar.offsetHeight || 280) - 36);
        const readY = () => {
            const m = /translateY\(([-\d.]+)px\)/.exec(sidebar.style.transform || '');
            if (m) return parseFloat(m[1]);
            return sidebar.classList.contains('expanded') ? 0 : peekY();
        };

        const onDown = (e) => {
            if (window.innerWidth > 768) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            dragging = true;
            startY = e.clientY;
            lastY = e.clientY;
            lastT = performance.now();
            velocity = 0;
            startTY = readY();
            sidebar.classList.add('is-dragging');
            sidebar.style.transition = 'none';
            try { handle.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
        };

        const onMove = (e) => {
            if (!dragging) return;
            const now = performance.now();
            const dy = e.clientY - startY;
            const peek = peekY();
            let y = Math.min(peek, Math.max(0, startTY + dy));
            sidebar.style.transform = `translateY(${y}px)`;
            const dt = Math.max(1, now - lastT);
            velocity = (e.clientY - lastY) / dt;
            lastY = e.clientY;
            lastT = now;
        };

        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            sidebar.classList.remove('is-dragging');
            sidebar.style.transition = '';
            const peek = peekY();
            const y = readY();
            const flickOpen = velocity < -0.45;
            const flickClose = velocity > 0.45;
            const shouldOpen = flickOpen || (!flickClose && y < peek * 0.55);
            sidebar.style.transform = '';
            sidebar.classList.toggle('expanded', shouldOpen);
        };

        handle.addEventListener('pointerdown', onDown, { passive: false });
        handle.addEventListener('pointermove', onMove, { passive: true });
        handle.addEventListener('pointerup', onUp, { passive: true });
        handle.addEventListener('pointercancel', onUp, { passive: true });
        // Tap still toggles when barely moved
        handle.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            if (Math.abs(lastY - startY) > 10) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            sidebar.classList.toggle('expanded');
        });
    }
}

function initClipsStudio() {
    if (!window.clipsStudio) {
        clipsStudio = new ClipsStudio();
        clipsStudio.init();
        window.clipsStudio = clipsStudio;
        // Initialize websocket after user is loaded
        setTimeout(() => {
            // initWebSocket() - will be initialized when needed
        }, 500);
    }
    // Always re-bind sort globals to the live instance
    if (window.clipsStudio && typeof window.clipsStudio._initLibrarySortControls === 'function') {
        window.clipsStudio._initLibrarySortControls();
    }
}

// Early stubs so inline onclick never hits undefined before ClipsStudio boots
if (typeof window.toggleLibrarySortMenu !== 'function') {
    window.toggleLibrarySortMenu = function () {
        if (window.clipsStudio?.toggleLibrarySortMenu) window.clipsStudio.toggleLibrarySortMenu();
    };
}
if (typeof window.setLibrarySortMode !== 'function') {
    window.setLibrarySortMode = function (mode) {
        if (window.clipsStudio?.setLibrarySortMode) window.clipsStudio.setLibrarySortMode(mode);
    };
}

// Set up all event listeners
window._comprehensiveLogout = function logout() {
    if (window._logoutInProgress) return;
    window._logoutInProgress = true;

    
    // ✅ IMMEDIATELY STOP ALL BACKGROUND TASKS BEFORE LOGOUT REQUEST
    // This prevents any in-flight requests from using the old token
    
    // Stop token refresh interval FIRST
    stopTokenRefreshInterval();
    
    // Clear ALL user-specific memory state
    window.currentUser = null;
    currentUser = null;
    tokens = 1500; // Reset to default
    isRecording = false;
    mediaRecorder = null;
    audioChunks = [];
    isGenerating = false;
    currentChatId = null;
    currentAbortController = null;
    uploadedFiles = [];
    promptCount = 0;
    selectedGameplayClip = 'minecraft_1';
    splitscreenInverted = true;
    splitscreenSecondaryType = 'face_track';
    splitscreenContentRatio = 0.5;
    splitscreenSavedRatio = 0.5;
    splitscreenSecondaryCollapsed = false;
    gpPillAnchor = null;
    availableGameplayClips = [];
    
    // Clear UI state
    updateUIForGuest();
    
    // ✅ ABORT ANY PENDING FETCH REQUESTS (they might still be using old token)
    if (window.AbortController) {
        // Stop any ongoing library polling or other interval-based fetches
        if (window.libraryPollingAbort) {
            window.libraryPollingAbort.abort();
        }
    }
    
    // Clear menu cache to force fresh login on next visit
    if (typeof apiCache !== 'undefined' && apiCache) {
        apiCache.userProfile = null;
        apiCache.userProfileTime = 0;
        apiCache.userProfileETag = null;
        apiCache.clearPendingRequest();
    }
    
    // Dispatch user disconnected event for feature gatekeepers
    window.dispatchEvent(new CustomEvent('userDisconnected', { detail: {} }));
    
    // Show notification
    showNotification('Signed out successfully', 'success');
    
    // Clear localStorage before the network call so stale data can't leak back
    const savedTheme = localStorage.getItem('theme');
    localStorage.clear();
    sessionStorage.clear();
    if (savedTheme) localStorage.setItem('theme', savedTheme);

    // Fire server logout so cookies are cleared before login page loads
    const logoutBase = window.apiUrl ? window.apiUrl('/api/auth/logout') : (window.API_BASE_URL || (window.location.origin + '/api')) + '/auth/logout';
    sessionStorage.setItem('solis_just_logged_out', '1');
    sessionStorage.setItem('solis_skip_auth_redirect', '1');

    fetch(logoutBase, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    })
        .catch(() => {})
        .finally(() => {
            window.location.replace('/login.html?logout=1');
        });
}

function setupEventListeners() {
    // User profile menu - Now handled by menu.js, don't add listener here
    // if (userProfile) {
    //     userProfile.addEventListener('click', toggleUserMenu);
    // }
    
    // User settings button
    const userSettingsBtn = document.getElementById('userSettingsBtn');
    if (userSettingsBtn) {
        userSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserMenu(e);
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('dropdownLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            (window._comprehensiveLogout || logout)();
        });
    }

    // Settings from menu
    const menuSettings = document.getElementById('menuSettings');
    if (menuSettings) {
        menuSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            openSettings();
        });
    }

    // Settings
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }
    if (closeSettings) {
        closeSettings.addEventListener('click', closeSettingsPanel);
    }
    
    // ðŸ” SECURITY: Clear Chat History button listener
    const clearChatHistoryBtn = document.getElementById('clearChatHistoryBtn');
    if (clearChatHistoryBtn) {
        clearChatHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all chat history? This action cannot be undone.')) {
                clearChat();
                clipsStudio.showNotification('Chat history cleared', 'success');
            }
        });
    }
    
    // Close settings when backdrop is clicked
    const settingsBackdrop = document.querySelector('.settings-backdrop');
    if (settingsBackdrop) {
        settingsBackdrop.addEventListener('click', closeSettingsPanel);
    }
    
    // Load and apply saved theme, and set toggle state
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
        if (darkModeSettingsToggle) {
            darkModeSettingsToggle.checked = (savedTheme === 'dark');
        }
    }
    
    // Dark mode toggle in settings
    if (darkModeSettingsToggle) { // Check if the element exists
        safeLog('setupEventListeners(): darkModeSettingsToggle element found.');
        // Optional: Check if it's an input checkbox, which is expected for 'checked' property
        if (darkModeSettingsToggle.tagName !== 'INPUT' || darkModeSettingsToggle.type !== 'checkbox') {
            safeLog('setupEventListeners(): darkModeSettingsToggle is not an input checkbox. Dark mode functionality may be impaired.');
        }
        darkModeSettingsToggle.addEventListener('change', () => {
            const newTheme = darkModeSettingsToggle.checked ? 'dark' : 'light';
            safeLog('darkModeSettingsToggle change event fired. New theme:', newTheme);
            setTheme(newTheme); // Call setTheme with the new theme
        }); // End of event listener
    }

    // Input handling removed - AI section no longer needed
    
    // Shuffle button for video ideas
    const shuffleIdeasBtn = document.getElementById('shuffleIdeasBtn');
    if (shuffleIdeasBtn) {
        shuffleIdeasBtn.addEventListener('click', generateVideoIdeas);
    }

    // ✅ WATERMARK TOGGLE - Listener is already registered in setupWatermarkToggle() method (line 2750)
    // DO NOT register twice - causes duplicate event handlers and memory leaks!
    const watermarkToggle = document.getElementById('watermarkToggle');
    if (watermarkToggle) {
        const savedState = localStorage.getItem('watermarkEnabled');
        watermarkToggle.checked = savedState === 'true';
    }

    // YouTube Connect Button

   

    // Check YouTube connection on page load
    checkYouTubeConnection();
}
    // Stop generation button removed - AI section no longer needed

    // Upgrade modal
    if (upgradeSettingsBtn) {
        upgradeSettingsBtn.addEventListener('click', openUpgradeModal);
    }
    if (closeUpgrade) {
        closeUpgrade.addEventListener('click', closeUpgradeModal);
    }

    // Clips submenu toggle
    const clipsToggle = document.getElementById('clips-toggle');
    if (clipsToggle) {
        clipsToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const submenu = document.getElementById('clips-submenu');
            const chevron = this.querySelector('.chevron-icon');
            
            if (submenu) submenu.classList.toggle('open');
            if (chevron) chevron.classList.toggle('rotated');
        });
    }

    // Navigation items
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (!item.closest('.clips-submenu')) {
                navItems.forEach(i => {
                    if (i.id !== 'clips-toggle' && !i.closest('.clips-submenu')) {
                        i.classList.remove('active');
                    }
                });
                
                if (item.id !== 'clips-toggle') {
                    item.classList.add('active');
                }
            }
            
            const target = item.dataset.target;
            if (target) {
                navigateTo(target);
                
                if (window.innerWidth <= 768 && sidebar.classList.contains('expanded')) {
                    sidebar.classList.remove('expanded');
                }
            }
        });
    });

    // Close modals/menus when clicking outside
    document.addEventListener('click', (e) => {
        // Close user menu
        if (userMenu && !userMenu.contains(e.target) && userProfile && !userProfile.contains(e.target)) {
            userMenu.classList.remove('active');
            userProfile.classList.remove('menu-open');
        }
        
        // Close upgrade modal
        if (upgradeModal && !upgradeModal.contains(e.target) && e.target !== upgradeSettingsBtn) {
            closeUpgradeModal();
        }
        
        // Close feature modals when clicking outside
        if (e.target.classList.contains('feature-modal')) {
            e.target.style.display = 'none';
        }
    });

    // When user switches browser tabs, if an input was centered but already sent,
    // ensure it is docked so it doesn't remain stuck centered when returning.
    document.addEventListener('visibilitychange', () => {
        try {
            if (document.hidden) {
                // If the page is hidden, force-dock the input instantly so it won't remain centered
                dockInputInstantly();
            }
        } catch (err) {
            safeLog('visibilitychange handler error', err);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC to close modals - DISABLED
        // if (e.key === 'Escape') {
        //     if (userMenu && userMenu.classList.contains('active')) {
        //         userMenu.classList.remove('active');
        //         if (userProfile) userProfile.classList.remove('menu-open');
        //     }
        //     if (settingsPanel && settingsPanel.classList.contains('open')) {
        //         closeSettingsPanel();
        //     }
        //     if (upgradeModal && upgradeModal.classList.contains('active')) {
        //         closeUpgradeModal();
        //     }
        //     if (workspacePanel && workspacePanel.classList.contains('active')) {
        //         workspacePanel.classList.remove('active');
        //         document.body.classList.remove('modal-open');
        //     }
        // }
        
        // Ctrl/Cmd + K to toggle sidebar
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            toggleSidebar();
        }
    });


function toggleSidebar() {
    sidebar.classList.toggle('expanded');
    
    const isExpanded = sidebar.classList.contains('expanded');
    localStorage.setItem('sidebarExpanded', isExpanded);
}

// Toggle user menu
// User menu is now handled by menu.js
function toggleUserMenu(e) {
    // This function is deprecated - menu.js handles the new userMenuPanel
    safeLog('toggleUserMenu called but deprecated - use menu.js instead');
    if (!userMenu || !userProfile) return;
    
    e.stopPropagation();
    // userMenu.classList.toggle('active');
    // userProfile.classList.toggle('menu-open');
}

// Open settings panel
function openSettings() {
    if (!settingsPanel) return;
    
    // Add open class for slide animation
    settingsPanel.classList.add('open');
    
    // Also open the backdrop
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    if (settingsBackdrop) {
        settingsBackdrop.style.opacity = '1';
        settingsBackdrop.style.visibility = 'visible';
    }
    
    // Close user menu if it's open
    if (userMenu) userMenu.classList.remove('active');
    
    // Fetch and update subscription status when settings is opened
    if (currentUser) {
        fetchAndUpdateSubscriptionStatus();
    }
}

// Close settings panel
function closeSettingsPanel() {
    if (!settingsPanel) return;
    
    // Remove open class for slide animation
    settingsPanel.classList.remove('open');
    
    // Also close the backdrop
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    if (settingsBackdrop) {
        settingsBackdrop.style.opacity = '0';
        settingsBackdrop.style.visibility = 'hidden';
    }
}

// YouTube connect is disabled — keep analytics locked without calling /auth/youtube/status
async function checkYouTubeConnection() {
    const analyticsLockOverlay = document.getElementById('analyticsLockOverlay');
    const dashboardGrid = document.getElementById('dashboardGrid');
    const dashboardCharts = document.querySelector('.dashboard-charts');
    if (!analyticsLockOverlay) return;

    analyticsLockOverlay.style.display = 'flex';
    if (dashboardGrid) dashboardGrid.classList.add('analytics-locked');
    if (dashboardCharts) dashboardCharts.classList.add('analytics-locked');
    if (!currentUser) currentUser = {};
    currentUser.youtube_connected = false;
}
// Initiate YouTube Connection with CSRF Protection
function initiateYouTubeConnection() {
    if (window.__ytOAuthInFlight) {
        safeLog('YouTube OAuth already in progress, ignoring duplicate trigger');
        return;
    }

    if (!currentUser) {
        alert('Please log in first to connect YouTube');
        return;
    }

    window.__ytOAuthInFlight = true;
    
    fetch(`${window.API_BASE_URL}/auth/youtube/authorize`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.auth_url) {
            throw new Error('No authorization URL received from server');
        }
        
        safeLog('✓ Got OAuth URL from backend');
        
        // Open OAuth flow in popup with security hardening
        const width = 500;
        const height = 600;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        // SECURITY: Use rel="noopener noreferrer" to prevent reverse tabnabbing
        const oauthWindow = window.open(
            data.auth_url,
            'YouTubeOAuth',
            `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
        );
        
        if (!oauthWindow) {
            safeLog('⚠ï¸ Popup blocked, falling back to redirect');
            window.location.href = data.auth_url;
        } else {
            safeLog('✓ OAuth window opened');
            
            // Create message handler with proper scope and cleanup
            const handleOAuthMessage = function handleOAuthMessage(event) {
                // ðŸ” SECURITY: Strict origin whitelist - production domains only
                const allowedOrigins = [
                    window.location.origin,
                    // Add production domains here if needed
                    // 'https://yourapp.com',
                    // 'https://www.yourapp.com'
                ];
                
                if (!allowedOrigins.includes(event.origin)) {
                    safeLog('🔒 Blocked postMessage from untrusted origin:', event.origin);
                    return;
                }
                
                if (event.data.type === 'YOUTUBE_AUTH_SUCCESS') {
                    safeLog('✅ YouTube authentication successful!');
                    // Remove listener immediately
                    window.removeEventListener('message', handleOAuthMessage);
                    clearInterval(checkInterval);
                    window.__ytOAuthInFlight = false;
                    
                    // Refresh connection status
                    setTimeout(() => {
                        checkYouTubeConnection();
                        if (typeof analyticsManager !== 'undefined' && analyticsManager) {
                            analyticsManager.loadAnalyticsData();
                        }
                        showNotification('✅ YouTube connected successfully!', 'success');
                    }, 1000);
                } else if (event.data.type === 'YOUTUBE_AUTH_ERROR') {
                    safeLog('âœ— Authentication error:', event.data.error);
                    window.removeEventListener('message', handleOAuthMessage);
                    clearInterval(checkInterval);
                    window.__ytOAuthInFlight = false;
                    showNotification(`âœ— YouTube connection failed: ${event.data.error}`, 'error');
                }
            };
            
            // Listen for postMessage from OAuth callback
            window.addEventListener('message', handleOAuthMessage);
            
            // Also handle window close as fallback - with proper cleanup
            let checkInterval = setInterval(() => {
                try {
                    if (oauthWindow.closed) {
                        clearInterval(checkInterval);
                        safeLog('🔄 OAuth window closed, verifying connection...');
                        window.__ytOAuthInFlight = false;
                        // Clean up message listener
                        window.removeEventListener('message', handleOAuthMessage);
                        
                        // Wait for backend to process, then verify
                        setTimeout(() => {
                            verifyToken();
                            checkYouTubeConnection();
                        }, 2000);
                    }
                } catch (e) {
                    // Cross-origin error, ignore
                }
            }, 500);
        }
    })
    .catch(error => {
        window.__ytOAuthInFlight = false;
        safeLog('âŒ YouTube connection error:', error);
        showNotification(`âœ— Failed to initiate YouTube connection: ${error.message}`, 'error');
    });
}


// Set theme
function setTheme(theme) {
    currentTheme = theme;
    safeLog('setTheme(): Applying theme:', theme);
    document.documentElement.setAttribute('data-theme', theme); // Apply theme to HTML element
    localStorage.setItem('theme', theme); // Save theme to local storage
    safeLog('setTheme(): Theme saved to localStorage. Current stored theme:', localStorage.getItem('theme'));
}

// AI section removed - no longer needed

// Send message function removed - AI section no longer needed
// Stop generation function removed - AI section no longer needed
// Handle clip compilation requests from chat
async function handleClipCompilationRequest(userMessage, youtubeUrl) {
    try {
        // ðŸ” SECURITY: Check if user is logged in via currentUser (httpOnly cookie authenticated)
        if (!currentUser) {
            addMessageToChat('ai', 'âŒ Please log in to create clip compilations. Click the login button in the top right.');
            return;
        }
        
        // Show confirmation dialog first
        showClipConfirmationDialog(userMessage, youtubeUrl);
        
    } catch (error) {
        safeLog('Clip compilation error:', error);
        addMessageToChat('ai', `âŒ Error: ${error.message}`);
    }
}

// Show confirmation dialog for clip creation
function showClipConfirmationDialog(userMessage, youtubeUrl) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'clip-confirm-modal';
    modal.innerHTML = `
        <style>
            .clip-confirm-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .clip-confirm-dialog {
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 32px;
                max-width: 420px;
                animation: slideUp 0.3s ease;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .clip-confirm-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .clip-confirm-header h2 {
                margin: 0;
                font-size: 18px;
                color: var(--text);
                font-weight: 600;
            }
            
            .clip-confirm-content {
                margin-bottom: 24px;
            }
            
            .clip-confirm-content p {
                margin: 0 0 12px 0;
                color: var(--muted);
                font-size: 14px;
                line-height: 1.6;
            }
            
            .clip-confirm-url {
                padding: 12px;
                background: rgba(255, 107, 53, 0.1);
                border: 1px solid rgba(255, 107, 53, 0.2);
                border-radius: 6px;
                font-size: 12px;
                color: var(--muted);
                word-break: break-all;
                font-family: monospace;
            }
            
            .clip-confirm-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            .clip-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            
            .clip-btn-reject {
                background: rgba(255, 107, 53, 0.1);
                color: var(--muted);
            }
            
            .clip-btn-reject:hover {
                background: rgba(255, 107, 53, 0.2);
            }
            
            .clip-btn-accept {
                background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);
                color: white;
            }
            
            .clip-btn-accept:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
            }
        </style>
        
        <div class="clip-confirm-dialog">
            <div class="clip-confirm-header">
                <span style="font-size: 20px;">🎬</span>
                <h2>Create Clip Compilation</h2>
            </div>
            
            <div class="clip-confirm-content">
                <p>Ready to create a clip compilation from your YouTube video?</p>
                <div class="clip-confirm-url" id="urlDisplay"></div>
                <p style="margin-top: 12px; font-size: 12px; opacity: 0.7;">This may take a few minutes. You can monitor progress in the Processing tab.</p>
            </div>
            
            <div class="clip-confirm-actions">
                <button class="clip-btn clip-btn-reject" id="clipConfirmCancel">
                    ✕ Cancel
                </button>
                <button class="clip-btn clip-btn-accept" id="clipConfirmAccept">
                    ✓ Create Compilation
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // SECURITY: Use textContent instead of innerHTML to prevent XSS
    const urlDisplay = document.getElementById('urlDisplay');
    if (urlDisplay) {
        urlDisplay.textContent = youtubeUrl;
    }
    
    // Handle cancel button
    document.getElementById('clipConfirmCancel').addEventListener('click', () => {
        modal.remove();
    });
    
    // Handle accept button
    document.getElementById('clipConfirmAccept').addEventListener('click', async () => {
        modal.remove();
        window.location.hash = '#/clips';
        
        // Wait for navigation to complete
        setTimeout(() => {
            startClipCompilation(youtubeUrl);
        }, 500);
    });
    
    // Handle outside click to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Start actual clip compilation with processing screen
async function startClipCompilation(youtubeUrl) {
    try {
        const headers = getAuthHeaders();
        
        // Save processing state in case page refreshes
        // ðŸ” SECURITY: Do NOT store full URL - extract video ID only to prevent data leakage
        const videoId = clipsStudio ? clipsStudio.extractYouTubeVideoId(youtubeUrl) : null;
        sessionStorage.setItem('clipProcessing', JSON.stringify({
            videoId: videoId,  // Only the video ID, not full URL with parameters
            startTime: Date.now()
        }));
        
        // Create processing modal that spans the whole clips container
        const processingModal = document.createElement('div');
        processingModal.id = 'clip-processing-modal';
        processingModal.innerHTML = `
            <style>
                #clip-processing-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, #fff5eb 0%, #ffe4d1 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    overflow: hidden;
                }
                
                .clip-processing-container {
                    text-align: center;
                    position: relative;
                    z-index: 10;
                }
                
                .clip-atom {
                    width: 140px;
                    height: 140px;
                    margin: 0 auto 32px;
                }
                
                .clip-atom svg {
                    width: 100%;
                    height: 100%;
                    filter: drop-shadow(0 0 20px rgba(255, 107, 53, 0.3));
                }
                
                .clip-nucleus {
                    animation: nucleusPulse 1.5s ease-in-out infinite;
                    transform-origin: center;
                }
                
                @keyframes nucleusPulse {
                    0% { transform: scale(0.8); opacity: 0.6; }
                    50% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.8); opacity: 0.6; }
                }
                
                .clip-orbit {
                    transform-origin: 50px 50px;
                    stroke-dasharray: 300;
                    stroke-dashoffset: 300;
                }
                
                .clip-orbit-1 {
                    transform: rotate(75deg);
                    animation: drawOrbit 1.5s ease-in-out infinite;
                }
                
                .clip-orbit-2 {
                    transform: rotate(-20deg);
                    animation: drawOrbit 1.5s ease-in-out 0.3s infinite;
                }
                
                @keyframes drawOrbit {
                    0% { stroke-dashoffset: 300; opacity: 0.3; }
                    50% { stroke-dashoffset: 0; opacity: 0.7; }
                    100% { stroke-dashoffset: 300; opacity: 0.3; }
                }
                
                .clip-title {
                    font-size: 28px;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin-bottom: 8px;
                }
                
                .clip-subtitle {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 32px;
                }
                
                .clip-progress-container {
                    width: 280px;
                    margin: 0 auto 24px;
                }
                
                .clip-progress-bar {
                    width: 100%;
                    height: 4px;
                    background: rgba(255, 107, 53, 0.15);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-bottom: 12px;
                }
                
                .clip-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #ff6b35 0%, #ff8856 100%);
                    width: 0%;
                    transition: width 0.4s ease;
                    border-radius: 2px;
                }
                
                .clip-stats {
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                    margin-top: 24px;
                    padding: 16px;
                    background: rgba(255, 107, 53, 0.08);
                    border-radius: 8px;
                }
                
                .clip-stat {
                    text-align: center;
                }
                
                .clip-stat-value {
                    font-size: 20px;
                    font-weight: 700;
                    color: #ff6b35;
                }
                
                .clip-stat-label {
                    font-size: 11px;
                    color: #999;
                    margin-top: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
            </style>
            
            <div class="clip-processing-container">
                <div class="clip-atom">
                    <svg width="140" height="140" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g class="clip-nucleus">
                            <circle cx="50" cy="50" r="8" fill="#ff6b35"/>
                            <circle cx="50" cy="50" r="12" fill="#ff6b35" opacity="0.3"/>
                        </g>
                        <ellipse class="clip-orbit clip-orbit-1" rx="45" ry="25" cx="50" cy="50" stroke="#ff6b35" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>
                        <ellipse class="clip-orbit clip-orbit-2" rx="45" ry="25" cx="50" cy="50" stroke="#ff6b35" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>
                    </svg>
                </div>
                
                <h1 class="clip-title">Cooking!</h1>
                <p class="clip-subtitle" id="clipStatus">HAHAHAHA</p>
                
                <div class="clip-progress-container">
                    <div class="clip-progress-bar">
                        <div class="clip-progress-fill" id="clipProgressFill"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; gap: 12px;">
                        <span id="clipProgress" style="font-size: 12px; color: #999;">0%</span>
                        <span id="clipTimeLeft" style="font-size: 12px; color: #999;">--:--</span>
                    </div>
                </div>
                
                <div class="clip-stats">
                    <div class="clip-stat">
                        <div class="clip-stat-value" id="clipStatDownload">0%</div>
                        <div class="clip-stat-label">Downloading</div>
                    </div>
                    <div class="clip-stat">
                        <div class="clip-stat-value" id="clipStatProcessing">0%</div>
                        <div class="clip-stat-label">Processing</div>
                    </div>
                    <div class="clip-stat">
                        <div class="clip-stat-value" id="clipStatRendering">0%</div>
                        <div class="clip-stat-label">Rendering</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(processingModal);
        
        // Start clip processing
        const startResponse = await fetch(`${API_BASE_URL}/clips/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            credentials: 'include',  // ðŸ” Send httpOnly cookie
            body: JSON.stringify({
                url: youtubeUrl,
                template_id: 'splitscreen',
                gameplay_clip_id: splitscreenSecondaryType === 'gameplay' ? selectedGameplayClip : splitscreenSecondaryType,
                splitscreen_inverted: splitscreenInverted,
                splitscreen_secondary_type: splitscreenSecondaryType,
                splitscreen_content_ratio: splitscreenContentRatio,
                splitscreen_secondary_collapsed: splitscreenSecondaryCollapsed,
            })
        });
        
        if (!startResponse.ok) {
            let errorMsg = 'Failed to start processing';
            let errorCode = '';
            try {
                const errorData = await startResponse.json();
                errorMsg = errorData.error || errorMsg;
                errorCode = errorData.error_code || '';
            } catch (e) {
                errorMsg = `Server error: ${startResponse.status}`;
            }
            
            // Handle GENERATION_COOLDOWN specially
            if (errorCode === 'GENERATION_COOLDOWN') {
                const errorData = await startResponse.json();
                const remainingSeconds = errorData.remaining_seconds || errorData.cooldown_seconds || 30;
                const remainingMinutes = Math.floor(remainingSeconds / 60);
                const remainingSecsOnly = remainingSeconds % 60;
                
                // Start countdown timer on submit button
                startCooldownTimer(remainingSeconds);
                
                let timestr = '';
                if (remainingMinutes > 0) {
                    timestr = `in ${remainingMinutes}m ${remainingSecsOnly}s`;
                } else {
                    timestr = `in ${remainingSeconds}s`;
                }
                
                errorMsg = `You can generate another video ${timestr}.`;
            }
            
            processingModal.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">âŒ</div>
                    <h1 style="font-size: 24px; color: var(--text); margin-bottom: 8px;">Error</h1>
                    <p style="color: var(--muted); margin-bottom: 24px;">${errorMsg}</p>
                    <button onclick="this.closest('#clip-processing-modal').remove()" style="
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Close</button>
                </div>
            `;
            return;
        }
        
        const startData = await startResponse.json();
        const projectId = startData.project_id;
        
        // Start tracking generation with persistent spinner
        // This will save to localStorage and survive page refresh
        const legacySpinner = typeof getGenerationProgressSpinner === 'function'
            ? getGenerationProgressSpinner()
            : window.generationProgressSpinner;
        if (legacySpinner) {
            const source = (typeof clipsStudio?.resolveSourceVideoCardMeta === 'function'
                ? clipsStudio.resolveSourceVideoCardMeta(youtubeUrl)
                : {}) || {};
            const videoTitle = source.title || 'Your video';
            legacySpinner.startGeneration(projectId, 'Starting upload...', 'splitscreen', {
                secondaryType: splitscreenSecondaryType,
                videoTitle,
                title: videoTitle,
                thumbnailUrl: source.thumbnailUrl || null,
                videoId: source.videoId || null,
            });
        }
        
        // Poll for status updates
        let isComplete = false;
        let pollCount = 0;
        const maxPolls = 300; // 10 minutes max
        let startTime = Date.now();
        let estimatedTotalTime = null;
        
        while (!isComplete && pollCount < maxPolls) {
            pollCount++;
            
            try {
                const statusResponse = await fetch(`${API_BASE_URL}/clips/status/${projectId}`, {
                    headers: headers,
                    credentials: 'include'  // ðŸ” Send httpOnly cookie
                });
                
                if (statusResponse.ok) {
                    let statusData;
                    try {
                        statusData = await statusResponse.json();
                    } catch (e) {
                        safeLog('Status JSON parse error:', e);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        continue;
                    }
                    
                    const status = statusData.status || 'processing';
                    const progress = statusData.progress || 0;
                    
                    // Update spinner with current progress
                    const pollSpinner = typeof getGenerationProgressSpinner === 'function'
                        ? getGenerationProgressSpinner()
                        : window.generationProgressSpinner;
                    if (pollSpinner) {
                        const stepMessages = {
                            'downloading': 'Downloading video...',
                            'processing': 'Processing moments...',
                            'rendering': 'Rendering video...',
                            'completed': 'Complete!'
                        };
                        const message = stepMessages[status] || `${status}...`;
                        pollSpinner.updateProgress(projectId, progress, message);
                    }
                    
                    // Estimate total time based on current progress
                    const elapsedMs = Date.now() - startTime;
                    const elapsedSecs = elapsedMs / 1000;
                    if (progress > 0 && !estimatedTotalTime) {
                        estimatedTotalTime = (elapsedSecs / progress) * 100;
                    }
                    
                    const remainingMs = estimatedTotalTime ? (estimatedTotalTime * (100 - progress) / 100) * 1000 : 0;
                    const minutes = Math.floor(remainingMs / 60000);
                    const seconds = Math.floor((remainingMs % 60000) / 1000);
                    
                    // Update UI with fun messages
                    const statusEl = document.getElementById('clipStatus');
                    
                    // Update phase stats
                    if (status === 'downloading') {
                        document.getElementById('clipStatDownload').textContent = `${Math.min(progress, 99)}%`;
                    } else if (status === 'processing') {
                        document.getElementById('clipStatProcessing').textContent = `${Math.min(progress, 99)}%`;
                    } else if (status === 'rendering') {
                        document.getElementById('clipStatRendering').textContent = `${Math.min(progress, 99)}%`;
                    }
                    
                    if (status === 'completed') {
                        isComplete = true;
                        sessionStorage.removeItem('clipProcessing');
                        
                        // Mark spinner as complete
                        const doneSpinner = typeof getGenerationProgressSpinner === 'function'
                            ? getGenerationProgressSpinner()
                            : window.generationProgressSpinner;
                        if (doneSpinner) {
                            doneSpinner.completeGeneration(projectId);
                        }
                        
                        processingModal.innerHTML = `
                            <div style="text-align: center; animation: slideUp 0.3s ease;">
                                <div style="font-size: 80px; margin-bottom: 16px; animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">✅</div>
                                <h1 style="font-size: 32px; color: var(--text); margin-bottom: 8px; font-weight: 700;">Compilation Ready!</h1>
                                <p style="color: var(--muted); margin-bottom: 32px;">Your video is ready to edit and publish</p>
                                <button onclick="
                                    document.getElementById('clip-processing-modal').remove();
                                    window.location.hash = '#/clips';
                                " style="
                                    padding: 12px 24px;
                                    background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);
                                    color: white;
                                    border: none;
                                    border-radius: 8px;
                                    cursor: pointer;
                                    font-weight: 600;
                                    font-size: 14px;
                                    transition: all 0.2s;
                                " onmouseover="this.style.transform='translateY(-2px); this.style.boxShadow='0 4px 12px rgba(255, 107, 53, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'>
                                    📎 Open Project
                                </button>
                            </div>
                            <style>
                                @keyframes popIn {
                                    0% { transform: scale(0.3); opacity: 0; }
                                    70% { transform: scale(1.1); }
                                    100% { transform: scale(1); opacity: 1; }
                                }
                                @keyframes slideUp {
                                    from { transform: translateY(20px); opacity: 0; }
                                    to { transform: translateY(0); opacity: 1; }
                                }
                            </style>
                        `;
                        
                    } else if (status === 'failed') {
                        isComplete = true;
                        sessionStorage.removeItem('clipProcessing');
                        processingModal.innerHTML = `
                            <div style="text-align: center;">
                                <div style="font-size: 48px; margin-bottom: 16px;">âŒ</div>
                                <h1 style="font-size: 24px; color: var(--text); margin-bottom: 8px;">Processing Failed</h1>
                                <p style="color: var(--muted); margin-bottom: 24px;">${statusData.message || 'Unknown error'}</p>
                                <button onclick="this.closest('#clip-processing-modal').remove()" style="
                                    padding: 10px 20px;
                                    background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);
                                    color: white;
                                    border: none;
                                    border-radius: 8px;
                                    cursor: pointer;
                                    font-weight: 600;
                                ">Close</button>
                            </div>
                        `;
                    }
                }
            } catch (pollError) {
                safeLog('Status poll error:', pollError);
            }
            
            // Wait 2 seconds before next poll
            if (!isComplete) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        if (!isComplete) {
            sessionStorage.removeItem('clipProcessing');
            processingModal.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">â±ï¸</div>
                    <h1 style="font-size: 24px; color: var(--text); margin-bottom: 8px;">Processing Timeout</h1>
                    <p style="color: var(--muted); margin-bottom: 24px;">Your compilation is still being processed. Check back in a moment.</p>
                    <button onclick="this.closest('#clip-processing-modal').remove(); window.location.hash = '#/clips'" style="
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #ff6b35 0%, #ff8856 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    ">View in Clips</button>
                </div>
            `;
        }
        
    } catch (error) {
        safeLog('Clip compilation error:', error);
        document.getElementById('clip-processing-modal')?.remove();
        addMessageToChat('ai', `âŒ Error: ${error.message}`);
    }
}

// Generate video ideas with shuffle button
async function generateVideoIdeas() {

    const videoIdeas = [
        "Create a fast-paced gaming montage with epic plays and reactions",
        "Make a 30-second motivational workout compilation with trending music",
        "Put together viral dance clips from your latest YouTube video",
        "Compile your best commentary moments into shareable shorts",
        "Create a highlight reel of epic fails and funny moments",
        "Make a trending audio mashup with video clips synced to the beat",
        "Compile before and after transformation clips",
        "Create a speed painting or creation process video",
        "Make a \"Day in my life\" quick clips compilation",
        "Create a tutorial snippet series from your longer videos",
        "Compile your best one-liners and funny quotes",
        "Make a seasonal/holiday themed clip collection",
        "Create a reaction compilation video",
        "Compile jaw-dropping moments and plot twists",
        "Make a \"Top 10 moments\" video from your content"
    ];
    
    const randomIdea = videoIdeas[Math.floor(Math.random() * videoIdeas.length)];
    
    // Add the idea to the input field
    if (userInput) {
        userInput.value = randomIdea;
        userInput.focus();
        // Trigger input event to update button state
        userInput.dispatchEvent(new Event('input'));
    }
    
    // Add animation to shuffle button
    const shuffleBtn = document.getElementById('shuffleIdeasBtn');
    if (shuffleBtn) {
        shuffleBtn.style.animation = 'none';
        setTimeout(() => {
            shuffleBtn.style.animation = 'spin 0.6s ease-in-out';
        }, 10);
    }
}

// Add message to chat
function addMessageToChat(sender, content) {
    if (!chatContainer) return;
    
    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${sender}-message-row`;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    
    messageElement.innerHTML = `
        <div class="message-content">
            ${formatMessageContent(content)}
        </div>
        <div class="message-actions">
            <button class="message-action copy-btn" title="Copy">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
        </div>
    `;

    const copyButton = messageElement.querySelector('.copy-btn');
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
            copyButton.classList.add('copied');
            copyButton.innerHTML = '<i class="fas fa-check"></i>';
            
            setTimeout(() => {
                copyButton.classList.remove('copied');
                copyButton.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        }).catch(err => {
            safeLog('Failed to copy:', err);
        });
    });
    
    messageRow.appendChild(messageElement);
    chatContainer.appendChild(messageRow);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Dispatch custom event to update quick actions visibility
    window.dispatchEvent(new CustomEvent('messageAdded'));
    
    if (sender === 'user' || !isGenerating) {
        chatHistory.push({
            sender,
            content,
            timestamp: new Date().toISOString()
        });
        
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }
}

// Start new chat
function startNewChat() {
    if (chatContainer && chatContainer.children.length > 1 || (welcomeCard && !welcomeCard.classList.contains('hidden'))) {
        if (confirm('Start a new chat? Current chat will be cleared.')) {
            clearChat();
        }
    }
}

// Clear chat
function clearChat() {
    if (!chatContainer) return;
    
    while (chatContainer.firstChild) {
        chatContainer.removeChild(chatContainer.firstChild);
    }
    
    if (welcomeCard) {
        chatContainer.appendChild(welcomeCard);
        welcomeCard.classList.remove('hidden');
    }
    
    uploadedFiles = [];
    const filePreviewContainer = document.getElementById('filePreviewContainer');
    if (filePreviewContainer) {
        filePreviewContainer.innerHTML = '';
        filePreviewContainer.classList.remove('active');
    }
    
    // Reset prompt count and restore centered style for next conversation
    promptCount = 0;
    const inputSection = document.querySelector('.input-section');
    const inputContainer = inputSection ? inputSection.querySelector('.input-container') : null;
    if (inputContainer) {
        inputContainer.classList.add('first-prompt');
    }
    if (inputSection) {
        inputSection.classList.add('is-first-prompt');
    }
    
    chatHistory = [];
    localStorage.removeItem('chatHistory');
}

// Open upgrade modal
function openUpgradeModal() {
    if (!upgradeModal) return;
    upgradeModal.classList.add('active');
}

// Close upgrade modal
function closeUpgradeModal() {
    if (!upgradeModal) return;
    upgradeModal.classList.remove('active');
}

// Navigate to different sections
function navigateTo(section) {
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.target === section) {
            item.classList.add('active');
        }
    });
    
    switch(section) {
        case 'chat':
            // If returning to chat without sending any prompts, restore first-prompt styling
            if (promptCount === 0) {
                const inputSection = document.querySelector('.input-section');
                const inputContainer = inputSection ? inputSection.querySelector('.input-container') : null;
                if (inputContainer) {
                    inputContainer.classList.add('first-prompt');
                }
                if (inputSection) {
                    inputSection.classList.add('is-first-prompt');
                }
            }
            break;

        case 'history':
            openHistory();
            break;
        case 'saved':
            openSaved();
            break;
        default:
            break;
    }
}

// Update token display
function updateTokenDisplay() {
    if (tokenCount) {
        tokenCount.textContent = tokens.toLocaleString();
    }
}

// Show upgrade prompt when tokens are low
function showUpgradePrompt() {
    const message = `💡 You have ${tokens} tokens remaining. Running low? <a href="/premium.html" style="color: #ff6b35; font-weight: 700; text-decoration: underline;">Upgrade now</a> for unlimited access!`;
    addMessageToChat('ai', message);
}

// Feature Modal Functions
// Removed: openAdsGenerator, openTrendingProducts (deprecated features)

// ⚠ï¸ SECURITY: This only controls UI visibility. Backend MUST enforce plan restrictions!
// Never rely on this for actual feature access control - the backend must verify on every request.
function checkPremiumAccess() {
    if (!currentUser) {
        showNotification('Please sign in to access premium features', 'error');
        return false;
    }
    
    // Only show/hide UI elements - backend MUST enforce plan on actual API calls
    if (currentUser.plan === 'free') {
        showNotification('This is a premium feature. Please upgrade your plan.', 'error');
        return false;
    }
    return true;
}

// Load saved items
function loadSaved() {
    const savedList = document.getElementById('savedList');
    if (!savedList) return;
    
    // ⚠ï¸ SECURITY WARNING: savedResults contains user content stored in localStorage
    // localStorage is accessible to any script on the domain (XSS vulnerability)
    // TODO: Migrate to server-side storage or IndexedDB with encryption
    const savedResults = JSON.parse(localStorage.getItem('savedResults') || '[]');
    
    if (savedResults.length === 0) {
        savedList.innerHTML = '<p>No saved items.</p>';
        return;
    }
    
    savedList.innerHTML = savedResults.map((result, index) => `
        <div class="saved-item">
            <div class="saved-type">${result.type}</div>
            <div class="saved-preview">${result.content.substring(0, 100)}...</div>
            <div class="saved-date">${new Date(result.timestamp).toLocaleDateString()}</div>
            <button onclick="viewSavedItem(${index})">View</button>
        </div>
    `).join('');
}

// View saved item
function viewSavedItem(index) {
    // ⚠ï¸ SECURITY: savedResults in localStorage - should migrate to server storage
    const savedResults = JSON.parse(localStorage.getItem('savedResults') || '[]');
    const item = savedResults[index];
    
    if (item) {
        alert(`Saved ${item.type}:\n\n${item.content}`);
    }
}

// Removed: generateAds and analyzeTrendingProducts (deprecated AI features)

// Utility Functions
function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.style.display = 'block';
    // SECURITY: Use safe DOM manipulation instead of innerHTML to prevent XSS
    container.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.appendChild(errorDiv);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    });
}

function saveResult(type, content) {
    // ⚠ï¸ SECURITY: Storing user content in localStorage - should use server storage
    const savedResults = JSON.parse(localStorage.getItem('savedResults') || '[]');
    savedResults.push({
        type,
        content,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('savedResults', JSON.stringify(savedResults));
    showNotification('Saved successfully!', 'success');
}

// Apply theme immediately before DOM is fully loaded to prevent flash
(function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

// DEBUG FUNCTION - Test template preview elements
window.testTemplatePreview = function() {
    const nameEl = document.getElementById('previewTemplateName');
    const descEl = document.getElementById('previewTemplateDescription');
    const durationEl = document.getElementById('previewVideoDuration');
    const formatEl = document.getElementById('previewVideoFormat');
    
    safeLog('🧪 TEMPLATE PREVIEW TEST:');
    safeLog('  previewTemplateName:', nameEl ? '✅ FOUND' : 'âŒ NOT FOUND');
    safeLog('  previewTemplateDescription:', descEl ? '✅ FOUND' : 'âŒ NOT FOUND');
    safeLog('  previewVideoDuration:', durationEl ? '✅ FOUND' : 'âŒ NOT FOUND');
    safeLog('  previewVideoFormat:', formatEl ? '✅ FOUND' : 'âŒ NOT FOUND');
    
    if (nameEl) {
        nameEl.textContent = 'TEST: Ranking Moments';
        safeLog('  ✅ Updated template name');
    }
    if (descEl) {
        descEl.textContent = 'TEST: This is a test video title';
        safeLog('  ✅ Updated template description');
    }
    if (durationEl) {
        durationEl.textContent = '~3m 20s';
        safeLog('  ✅ Updated duration');
    }
    if (formatEl) {
        formatEl.textContent = 'YouTube Shorts';
        safeLog('  ✅ Updated format');
    }
    
    safeLog('If you see the TEST values in the template preview, the elements work!');
};

safeLog('✅ testTemplatePreview() is ready - run it in console');


/**
 * ✅ NEW: Restore generation state from server after hard refresh
 * This ensures the URL submit button stays disabled if a generation is in progress,
 * preventing the user from submitting multiple requests after a hard refresh
 */
async function restoreGenerationStateFromServer() {
    try {
        const headers = getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/clips/status`, {
            method: 'GET',
            headers: headers,
            credentials: 'include'
        });
        
        if (response.ok) {
            const limitData = await response.json();
            const submitBtn = document.getElementById('processUrlBtn');
            
            if (!submitBtn) return;
            
            if (limitData.is_generating) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.classList.add('is-generating');
                showNotification('A video is already being generated. Please wait for it to complete.', 'warning');
            } else {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.classList.remove('is-generating');
                sessionStorage.removeItem('urlButtonLocked');
                sessionStorage.removeItem('urlButtonLockeduntil');
            }
        } else {
            console.warn('[STATE RESTORE] Failed to check generation state:', response.status);
        }
    } catch (error) {
        console.warn('[STATE RESTORE] Could not restore generation state:', error);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // ✅ NEW: Check server-side generation state to restore UI after hard refresh
    // This prevents the race condition where a user hard-refreshes and can submit multiple requests
    restoreGenerationStateFromServer();
    
    // Check if we were in the middle of processing before page refresh
    const clipProcessingState = sessionStorage.getItem('clipProcessing');
    if (clipProcessingState) {
        try {
            const state = JSON.parse(clipProcessingState);
            // Resume the clip compilation
            setTimeout(() => {
                startClipCompilation(state.url);
            }, 500);
        } catch (e) {
            safeLog('Failed to restore clip processing:', e);
            sessionStorage.removeItem('clipProcessing');
        }
    }
    
    // Load available gameplay clips for splitscreen
    loadAvailableGameplayClips();
    
    // NOTE: loadTierInfo() is called inside verifyToken() which runs via initAuth().
    // Calling it again here would duplicate the /auth/subscription request.
    // The _subCache deduplicates in-flight calls, but we skip the redundant call entirely.

    // Await ClipsStudio.init() if available
    if (typeof clipsStudio !== 'undefined' && clipsStudio && typeof clipsStudio.init === 'function') {
        clipsStudio.init();
        // Setup watermark toggle after init
        if (typeof clipsStudio.setupWatermarkToggle === 'function') {
            clipsStudio.setupWatermarkToggle();
        }
    } else {
        init();
    }
});


window.getWatermarkState = function() {
    const toggle = document.getElementById('watermarkToggle');
    if (toggle) return Boolean(toggle.checked);
    const stored = localStorage.getItem('watermarkEnabled');
    if (stored != null) return stored === 'true';
    const plan = String(window.currentUser?.plan || 'free').toLowerCase();
    const isPremium = plan === 'basic' || plan === 'prime' || plan === 'elite';
    return !isPremium;
};

/** Portal Create Content → Clips Create / URL submit (global for inline onclick) */
window.goToCreateUrlSubmit = function() {
    if (window.clipsStudio && typeof window.clipsStudio.goToCreateUrlSubmit === 'function') {
        return window.clipsStudio.goToCreateUrlSubmit();
    }
    // Fallback before studio init
    const portal = document.getElementById('portalContainer');
    const clips = document.getElementById('clipsContainer');
    if (portal) { portal.style.display = 'none'; portal.classList.remove('active'); }
    if (clips) { clips.style.display = 'block'; clips.classList.add('active'); }
    try { localStorage.setItem('currentNavigationTarget', 'clips'); } catch (_) {}
    if (typeof window.switchClipsTab === 'function') {
        const btn = document.querySelector('.clips-sub-item[data-tab="create"]');
        window.switchClipsTab('create', btn);
    }
    setTimeout(() => {
        document.getElementById('urlInputStack')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Wait for Ctrl+V or click-into-field paste — don't focus/pulse as "locked"
    }, 80);
};


window.getWatermarkParams = function() {
    return {
        add_watermark: window.getWatermarkState()
    };
};

