window.apiRequestCache = {
    cache: new Map(), // { url_method: { promise, timestamp, data, response } }
    CACHE_TTL_MS: 5000, // 5 second cache for GET requests (most are user profile/subscription data)

    async dedupFetch(url, options = {}) {
        const method = options.method || 'GET';
        const cacheKey = `${method}:${url}`;
        const now = Date.now();

        const cached = this.cache.get(cacheKey);
        if (cached && (now - cached.timestamp) < this.CACHE_TTL_MS) {
            if (cached.data) {
                return new Response(JSON.stringify(cached.data), {
                    status: 200,
                    statusText: 'OK (from cache)',
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            if (cached.response) {
                return cached.response.clone();
            }
        }

        const fetchPromise = fetch(url, options);
        this.cache.set(cacheKey, { promise: fetchPromise, timestamp: now, response: null, data: null });

        try {
            const response = await fetchPromise;
            const cached = this.cache.get(cacheKey);
            if (cached) cached.response = response.clone();

            if (response.ok && !options.method && method === 'GET') {
                try {
                    const data = await response.clone().json();
                    const cached = this.cache.get(cacheKey);
                    if (cached) cached.data = data;
                } catch (e) {
                }
            }
            return response;
        } finally {
            const keysToDelete = [];
            for (const [key, data] of this.cache.entries()) {
                if ((now - data.timestamp) > this.CACHE_TTL_MS * 2) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.cache.delete(key));
        }
    }
};

window.getApiBase = function() {
    return window.API_BASE_URL || 'https://api.solisai.video/api';
};

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
    return text.replace(/[&<>"'\/]/g, char => map[char] || char);
}

function getCsrfToken() {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (!token || typeof token !== 'string' || token.length < 10) {
        console.warn('CSRF token not found or invalid');
        return '';
    }
    return token.trim();
}

function validateUserId(userId) {
    if (typeof userId !== 'string' || userId.length === 0) return false;
    if (userId.length > 100) return false;
    return /^[a-zA-Z0-9_-]+$/.test(userId);
}

function validateAuthUrl(url) {
    if (typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return /^https?:$/.test(parsed.protocol);
    } catch {
        return false;
    }
}

function validateAuthResponse(data) {
    if (!data || typeof data !== 'object') return { valid: false };
    if (data.error) {
        return { valid: false, error: typeof data.error === 'string' ? data.error : 'Unknown error' };
    }
    if (!data.auth_url || typeof data.auth_url !== 'string') return { valid: false, error: 'Invalid auth URL format' };
    if (!validateAuthUrl(data.auth_url)) return { valid: false, error: 'Invalid auth URL protocol' };
    return { valid: true };
}

async function _signRequest(path, method = 'POST', body = '') {
    try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        const csrfToken = getCsrfToken();

        if (!csrfToken) return { timestamp, nonce };

        const encoder = new TextEncoder();
        const keyData = encoder.encode(csrfToken);
        const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

        const signatureData = encoder.encode(`${path}|${method}|${timestamp}|${nonce}`);
        const signature = await crypto.subtle.sign('HMAC', key, signatureData);
        const signatureHex = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        return { timestamp, nonce, signature: signatureHex };
    } catch (error) {
        console.error('Request signing error:', error);
        return {};
    }
}

class SetupModal {
    constructor() {
        this.isConnecting = false;
        this.setupComplete = false;
        this.apiBase = window.getApiBase();
        this.userId = this.generateUserId();  // Generate temporarily, will fetch from backend
        this.connections = {};
        this.initBanner();
        this.loadConnectionStatus();
    }

    async loadConnectionStatus() {
        try {
            const response = await fetch(`${this.apiBase}/analytics/status`, {
                method: 'GET',
                credentials: 'include'
            });
            const status = await response.json();
            this.connections = status;
            localStorage.setItem('platform_connections', JSON.stringify(status));
            window.platformConnections = status;
        } catch (error) {
            console.error('Error loading connection status:', error);
        }
    }

    initBanner() {
        const banner = document.getElementById('setupBanner');
        if (banner) {
            banner.addEventListener('click', () => this.openModal());
            if (this.setupComplete) {
            }
        }
    }

    async initiateYouTubeAuth() {
        if (window.__ytOAuthInFlight) {
            this.showError('YouTube connection already in progress');
            return;
        }
        if (this.isConnecting) return;
        this.isConnecting = true;
        window.__ytOAuthInFlight = true;
        const connectBtn = document.getElementById('connectYouTubeBtn');
        if (connectBtn) {
            connectBtn.textContent = 'Connecting...';
            connectBtn.disabled = true;
        }

        try {
            const userId = this.generateUserId();
            if (!validateUserId(userId)) {
                throw new Error('Invalid user ID format');
            }
            localStorage.setItem('youtube_user_id', userId);

            const csrfToken = getCsrfToken();
            const signData = await _signRequest('/analytics/youtube/auth', 'POST', JSON.stringify({ user_id: userId }));

            const response = await fetch(`${this.apiBase}/analytics/youtube/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                    'X-Request-Timestamp': signData.timestamp || '',
                    'X-Request-Nonce': signData.nonce || '',
                    'X-Request-Signature': signData.signature || ''
                },
                body: JSON.stringify({ user_id: userId }),
                credentials: 'include',
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > 50000) {
                throw new Error('Response too large');
            }

            const text = await response.text();
            if (!text || text.length === 0) {
                throw new Error('Empty response from server');
            }
            if (text.length > 50000) {
                throw new Error('Response too large');
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                throw new Error('Invalid JSON response');
            }

            const validation = validateAuthResponse(data);
            if (!validation.valid) {
                throw new Error(`Failed to initialize YouTube authentication: ${validation.error || 'No auth URL'}`);
            }

            if (data.auth_url && validateAuthUrl(data.auth_url)) {
                const authWindow = window.open(
                    data.auth_url,
                    'YouTubeAuth',
                    'width=600,height=700,left=100,top=100'
                );

                this.waitForAuth(authWindow);
            } else {
                this.showError('Failed to initialize YouTube authentication: invalid auth URL');
                this.isConnecting = false;
                window.__ytOAuthInFlight = false;
                if (connectBtn) {
                    connectBtn.textContent = 'Connect YouTube';
                    connectBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showError('Connection failed: ' + error.message);
            this.isConnecting = false;
            window.__ytOAuthInFlight = false;
            if (connectBtn) {
                connectBtn.textContent = 'Connect YouTube';
                connectBtn.disabled = false;
            }
        }
    }

    waitForAuth(authWindow) {
        const checkInterval = setInterval(() => {
            if (authWindow.closed) {
                clearInterval(checkInterval);
                window.__ytOAuthInFlight = false;

                setTimeout(() => {
                    if (localStorage.getItem('youtube_connected') === 'true') {
                        this.onAuthSuccess();
                    } else {
                        this.isConnecting = false;
                        window.__ytOAuthInFlight = false;
                        const connectBtn = document.getElementById('connectYouTubeBtn');
                        if (connectBtn) {
                            connectBtn.textContent = 'Connect YouTube';
                            connectBtn.disabled = false;
                        }
                    }
                }, 500);
            }
        }, 500);
    }

    onAuthSuccess() {
        this.setupComplete = true;
        this.connections.youtube = { connected: true, name: 'YouTube' };
        localStorage.setItem('platform_connections', JSON.stringify(this.connections));
        this.showSuccess('YouTube connected successfully!');

        const banner = document.getElementById('setupBanner');
        if (banner) {
            banner.style.display = 'none';
        }

        setTimeout(() => {
            const modal = document.getElementById('setupModal');
            if (modal) modal.remove();

            if (window.analyticsManager) {
                window.analyticsManager.isConnected = true;
                window.analyticsManager.userId = localStorage.getItem('youtube_user_id');
                window.analyticsManager.fetchAnalyticsFromServer();
            }
        }, 2000);
    }

    async unlinkPlatform(platform) {
        if (platform === 'youtube') {
            try {
                if (!validateUserId(this.userId)) {
                    throw new Error('Invalid user ID format');
                }

                const csrfToken = getCsrfToken();
                const signData = await _signRequest('/analytics/disconnect', 'POST', JSON.stringify({ user_id: this.userId }));

                const response = await fetch(`${this.apiBase}/analytics/disconnect`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                        'X-Request-Timestamp': signData.timestamp || '',
                        'X-Request-Nonce': signData.nonce || '',
                        'X-Request-Signature': signData.signature || ''
                    },
                    body: JSON.stringify({ user_id: this.userId }),
                    credentials: 'include',
                    signal: AbortSignal.timeout(30000)
                });

                if (!response.ok && response.status !== 200 && response.status !== 204) {
                    throw new Error(`Disconnect failed: ${response.status}`);
                }

                localStorage.removeItem('youtube_connected');
                localStorage.removeItem('youtube_token_time');
                localStorage.removeItem('youtube_token');

                this.setupComplete = false;
                this.connections.youtube = { connected: false, name: 'YouTube' };

                if (typeof this.connections === 'object') {
                    localStorage.setItem('platform_connections', JSON.stringify(this.connections));
                }

                const banner = document.getElementById('setupBanner');
                if (banner) banner.style.display = 'block';

                if (window.analyticsManager) {
                    window.analyticsManager.isConnected = false;
                    window.analyticsManager.loadAnalyticsData();
                }

                this.showSuccess('YouTube disconnected');

                setTimeout(() => {
                    const modal = document.getElementById('setupModal');
                    if (modal) {
                        modal.remove();
                        this.openModal();
                    }
                }, 1500);
            } catch (error) {
                this.showError('Failed to disconnect: ' + error.message);
            }
        }
    }

    openModal() {
        const existingModal = document.getElementById('setupModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'setupModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(5px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            padding: 20px;
        `;

        const youtubeConnected = this.connections.youtube?.connected;

 modal.innerHTML = `
  <style>
    :root {
      --modal-bg: #ffffff;
      --modal-card-bg: #fff8f3;
      --modal-text-primary: #1a1a1a;
      --modal-text-secondary: #5a5a5a;
      --modal-text-tertiary: #8a8a8a;
      --modal-border: #f5e6d3;
      --modal-accent: #ff7a56;
      --modal-accent-hover: #ff6542;
      --modal-shadow: 0 20px 60px rgba(255, 122, 86, 0.12);
    }

    :root.dark {
      --modal-bg: #1a1a1a;
      --modal-card-bg: #2d2520;
      --modal-text-primary: #f5f5f5;
      --modal-text-secondary: #c9c9c9;
      --modal-text-tertiary: #8a8a8a;
      --modal-border: #3d3530;
      --modal-accent: #ff8c66;
      --modal-accent-hover: #ff7a56;
      --modal-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    @keyframes modalFadeIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes modalFadeOut {
      from {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      to {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
    }

    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes checkmarkPop {
      0% {
        opacity: 0;
        transform: scale(0.8);
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    .onboarding-container {
      background: var(--modal-bg);
      box-shadow: var(--modal-shadow);
      border: 2px solid var(--modal-border);
      overflow: hidden;
      width: 100%;
      max-width: 850px;
      padding: 70px 80px;
      position: relative;
      max-height: 85vh;
      overflow-y: auto;
      animation: modalFadeIn 0.3s ease-out;
    }

    .onboarding-container.closing {
      animation: modalFadeOut 0.3s ease-out forwards;
    }

    .modal-close-btn {
      position: absolute;
      top: 28px;
      right: 28px;
      background: none;
      border: none;
      font-size: 32px;
      cursor: pointer;
      color: var(--modal-text-tertiary);
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .modal-close-btn:hover {
      background: var(--modal-card-bg);
      color: var(--modal-text-primary);
    }

    .modal-header {
      text-align: center;
      margin-bottom: 50px;
      animation: slideInUp 0.4s ease-out 0.1s both;
    }

    .modal-title {
      font-size: 36px;
      margin: 0 0 14px;
      color: var(--modal-text-primary);
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .modal-subtitle {
      color: var(--modal-text-secondary);
      font-size: 16px;
      margin: 0;
      line-height: 1.6;
    }

    .modal-section {
      background: var(--modal-card-bg);
      padding: 32px;
      margin-bottom: 28px;
      border: 2px solid var(--modal-border);
      animation: slideInUp 0.4s ease-out 0.2s both;
      transition: all 0.2s ease;
    }

    .modal-section:hover {
      border-color: var(--modal-accent);
    }

    .section-title {
      margin: 0 0 20px;
      color: var(--modal-text-primary);
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .features-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .feature-item {
      margin-bottom: 16px;
      color: var(--modal-text-secondary);
      display: flex;
      align-items: center;
      font-size: 15px;
      line-height: 1.7;
      animation: slideInUp 0.4s ease-out both;
    }

    .feature-item:nth-child(1) { animation-delay: 0.3s; }
    .feature-item:nth-child(2) { animation-delay: 0.35s; }
    .feature-item:nth-child(3) { animation-delay: 0.4s; }
    .feature-item:nth-child(4) { animation-delay: 0.45s; }

    .feature-item:last-child {
      margin-bottom: 0;
    }

    .checkmark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      background: var(--modal-accent);
      margin-right: 14px;
      color: white;
      font-size: 12px;
      font-weight: 700;
      animation: checkmarkPop 0.4s ease-out both;
    }

    .feature-item:nth-child(1) .checkmark { animation-delay: 0.3s; }
    .feature-item:nth-child(2) .checkmark { animation-delay: 0.35s; }
    .feature-item:nth-child(3) .checkmark { animation-delay: 0.4s; }
    .feature-item:nth-child(4) .checkmark { animation-delay: 0.45s; }

    .connect-btn {
      width: 100%;
      padding: 18px 24px;
      background: var(--modal-accent);
      color: white;
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 16px;
      animation: slideInUp 0.4s ease-out 0.5s both;
      position: relative;
      overflow: hidden;
      letter-spacing: 0.01em;
    }

    .connect-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s ease;
    }

    .connect-btn:hover::before {
      left: 100%;
    }

    .connect-btn:hover {
      background: var(--modal-accent-hover);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 122, 86, 0.3);
    }

    .connect-btn:active {
      transform: translateY(0);
    }

    .security-note {
      text-align: center;
      color: var(--modal-text-tertiary);
      font-size: 13px;
      margin: 0;
      animation: slideInUp 0.4s ease-out 0.55s both;
      line-height: 1.5;
    }

    .setup-notification {
      display: none;
      margin-top: 24px;
      padding: 18px;
      font-size: 15px;
      text-align: center;
      animation: slideInUp 0.3s ease-out;
    }
  </style>

  <div class="onboarding-container">
    <button id="closeSetupModal" class="modal-close-btn">×</button>

    <div class="modal-header">
      <h2 class="modal-title">
        ${youtubeConnected ? 'Analytics Dashboard' : 'Connect Your Channel'}
      </h2>
      <p class="modal-subtitle">
        ${youtubeConnected ? 'Manage and monitor all your platform connections' : 'Link your YouTube account to access real-time analytics and performance insights'}
      </p>
    </div>

    <div class="modal-section">
      <h3 class="section-title">Connected Platforms</h3>
      <div id="platformsList"></div>
    </div>

    ${!youtubeConnected ? `
    <div class="modal-section">
      <h3 class="section-title">Features You'll Unlock</h3>
      <ul class="features-list">
        <li class="feature-item">
          <span class="checkmark">✓</span>
          Live analytics streaming directly from your YouTube channel
        </li>
        <li class="feature-item">
          <span class="checkmark">✓</span>
          Comprehensive view tracking across daily, weekly, and monthly periods
        </li>
        <li class="feature-item">
          <span class="checkmark">✓</span>
          Detailed subscriber growth and revenue analytics
        </li>
        <li class="feature-item">
          <span class="checkmark">✓</span>
          Cross-platform performance comparison and insights
        </li>
      </ul>
    </div>

    <button id="connectYouTubeBtn" class="connect-btn">
      Connect YouTube Channel
    </button>

    <p class="security-note">
      Your data is protected with industry-standard OAuth 2.0 authentication. We never store your password.
    </p>
    ` : ''}

    <div id="setupNotification" class="setup-notification"></div>
  </div>
`;

        document.body.appendChild(modal);

        this.populatePlatformsList();

        document.getElementById('closeSetupModal').addEventListener('click', () => {
            const container = modal.querySelector('.onboarding-container');
            if(container) container.classList.add('closing');
            setTimeout(() => modal.remove(), 300);
        });

        if (!youtubeConnected) {
            document.getElementById('connectYouTubeBtn').addEventListener('click', () => {
                this.initiateYouTubeAuth();
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const container = modal.querySelector('.onboarding-container');
                if(container) container.classList.add('closing');
                setTimeout(() => modal.remove(), 300);
            }
        });
    }

    populatePlatformsList() {
        const platformsList = document.getElementById('platformsList');
        if (!platformsList) return;

        platformsList.innerHTML = `
            <div style="padding: 15px; border: 2px solid ${this.connections.youtube?.connected ? '#d4edda' : '#e9ecef'}; border-radius: 8px; background: ${this.connections.youtube?.connected ? '#f1f8f4' : '#f8f9fa'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="platform-icon" style="display:inline-flex;align-items:center;width:36px;height:24px;">
                          <svg width="24" height="24" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="YouTube" role="img" style="width:100%;height:100%;display:block;">
                            <path d="M27.4313 3.11C27.1213 1.89 26.1313 0.91 24.9113 0.6C22.7313 0 14.0013 0 14.0013 0C14.0013 0 5.27128 0 3.09128 0.6C1.87128 0.91 0.881281 1.89 0.571281 3.11C0.261281 4.33 0.00128174 6.6 0.00128174 10C0.00128174 13.4 0.261281 15.67 0.571281 16.89C0.881281 18.11 1.87128 19.09 3.09128 19.4C5.27128 20 14.0013 20 14.0013 20C14.0013 20 22.7313 20 24.9113 19.4C26.1313 19.09 27.1213 18.11 27.4313 16.89C27.7413 15.67 28.0013 13.4 28.0013 10C28.0013 6.6 27.7413 4.33 27.4313 3.11Z" fill="#FF0000"></path>
                            <path d="M11.2013 14.2V5.8L18.2013 10L11.2013 14.2Z" fill="white"></path>
                          </svg>
                        </span>
                        <div>
                            <div style="font-weight: 600; color: #333;">YouTube</div>
                            <div style="font-size: 12px; color: #666;">${this.connections.youtube?.connected ? '✓ Connected' : '○ Not connected'}</div>
                        </div>
                    </div>
                    ${this.connections.youtube?.connected ? `
                    <button id="unlinkYouTube" style="
                        padding: 8px 16px;
                        background: #f8d7da;
                        color: #721c24;
                        border: 1px solid #f5c6cb;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 600;
                        transition: all 0.3s ease;
                    ">
                        Unlink
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        if (this.connections.youtube?.connected) {
            document.getElementById('unlinkYouTube').addEventListener('click', () => {
                if (confirm('Are you sure you want to unlink YouTube?')) {
                    this.unlinkPlatform('youtube');
                }
            });
        }
    }

    generateUserId() {
        let userId = localStorage.getItem('youtube_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('youtube_user_id', userId);
        }
        return userId;
    }

    showSuccess(message) {
        const notification = document.getElementById('setupNotification');
        if (notification) {
            notification.textContent = message;
            notification.style.display = 'block';
            notification.style.background = '#d4edda';
            notification.style.color = '#155724';
        }
    }

    showError(message) {
        const notification = document.getElementById('setupNotification');
        if (notification) {
            notification.textContent = message;
            notification.style.display = 'block';
            notification.style.background = '#f8d7da';
            notification.style.color = '#721c24';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.setupModal = new SetupModal();

    setTimeout(() => {
        handleUpgradeCardVisibility();
    }, 500);

    setTimeout(() => {
        handleUpgradeCardVisibility();
    }, 1500);
});

if (document.readyState !== 'loading') {
    if (!window.setupModal) {
        window.setupModal = new SetupModal();
    }
    setTimeout(() => {
        handleUpgradeCardVisibility();
    }, 500);

    setTimeout(() => {
        handleUpgradeCardVisibility();
    }, 1500);
}

window.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        setTimeout(() => {
            handleUpgradeCardVisibility();
            const inputSection = document.querySelector('.input-section');
            if (inputSection) {
                inputSection.style.display = 'none';
                setTimeout(() => {
                    inputSection.style.display = 'flex';
                }, 10);
            }
        }, 100);
    }
}, false);

window.addEventListener('focus', () => {
    setTimeout(() => {
        handleUpgradeCardVisibility();
    }, 100);
}, false);

function handleUpgradeCardVisibility() {
    let userTier = window.tier || localStorage.getItem('userTier') || localStorage.getItem('tier');

    if (!userTier) {
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            userTier = currentUser.plan;
        } catch (e) {
        }
    }

    async function fetchAndManageUpgradeCards() {
        try {
            const data = await getOrFetchCurrentUser();
            if (!data || typeof data !== 'object' || !data.plan) {
                throw new Error('Invalid response structure');
            }

            const allowedPlans = ['free', 'prime', 'elite', 'basic'];
            const userTier = (typeof data.plan === 'string' && allowedPlans.includes(data.plan.toLowerCase()))
                ? data.plan.toLowerCase()
                : 'free';

            const premiumCard = document.querySelector('.premium-card');
            const upgradeUnlockCards = document.querySelectorAll('.upgrade-unlock-card');
            const upgradeContainer = document.querySelector('.upgrade-container');

            if (userTier === 'elite' || userTier === 'prime') {
                if (upgradeContainer) {
                    upgradeContainer.style.display = 'none !important';
                    upgradeContainer.style.visibility = 'hidden';
                    upgradeContainer.style.height = '0';
                    upgradeContainer.style.overflow = 'hidden';
                    upgradeContainer.style.padding = '0';
                    upgradeContainer.style.margin = '0';
                    upgradeContainer.classList.add('hidden-permanently');
                }
                if (premiumCard) {
                    premiumCard.style.display = 'none';
                    premiumCard.style.visibility = 'hidden';
                    premiumCard.style.height = '0';
                    premiumCard.style.padding = '0';
                    premiumCard.style.margin = '0';
                    premiumCard.style.overflow = 'hidden';
                    premiumCard.style.pointerEvents = 'none';
                }
                upgradeUnlockCards.forEach((card, idx) => {
                    card.style.display = 'none';
                    card.style.visibility = 'hidden';
                    card.style.height = '0';
                    card.style.overflow = 'hidden';
                });
            }
            else if (userTier === 'free' || userTier === 'basic') {
                if (upgradeContainer) {
                    upgradeContainer.classList.remove('hidden-permanently');
                    upgradeContainer.style.visibility = 'visible';
                    upgradeContainer.style.height = 'auto';
                    upgradeContainer.style.overflow = 'visible';
                    upgradeContainer.style.padding = '20px';
                    upgradeContainer.style.margin = '40px 0 0 0';
                }

                if (userTier === 'basic' && premiumCard) {
                    premiumCard.style.display = 'flex';
                    premiumCard.style.visibility = 'visible';
                    const cardContent = premiumCard.querySelector('.card-content');
                    if (cardContent && cardContent.querySelector('h2')) {
                        cardContent.querySelector('h2').textContent = 'Unlock Even More Power?';

                        const subtitle = cardContent.querySelector('.card-subtitle') || document.createElement('p');
                        if (!cardContent.querySelector('.card-subtitle')) {
                            subtitle.className = 'card-subtitle';
                            subtitle.style.cssText = 'font-size: 14px; color: #666; margin-top: 8px; margin-bottom: 16px;';
                            cardContent.insertBefore(subtitle, cardContent.querySelector('.features-list'));
                        }
                        subtitle.textContent = 'Upgrade to Prime or Elite for unlimited access, advanced automation, and exclusive features.';
                    }
                }
                else if (userTier === 'free' && premiumCard) {
                    premiumCard.style.display = 'flex';
                    premiumCard.style.visibility = 'visible';
                    const cardContent = premiumCard.querySelector('.card-content');
                    if (cardContent && cardContent.querySelector('h2')) {
                        cardContent.querySelector('h2').textContent = 'Reveal Your Earning Potential';
                    }
                }

                upgradeUnlockCards.forEach((card, idx) => {
                    card.style.display = 'flex';
                    card.style.visibility = 'visible';
                    card.style.height = 'auto';
                    card.style.overflow = 'visible';
                });
            }
        } catch (error) {
            console.error('Error fetching user plan for card management:', error);
            const upgradeUnlockCards = document.querySelectorAll('.upgrade-unlock-card');
            upgradeUnlockCards.forEach((card) => {
                card.style.display = 'flex';
                card.style.visibility = 'visible';
            });
        }
    }

    document.addEventListener('DOMContentLoaded', fetchAndManageUpgradeCards);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchAndManageUpgradeCards);
    } else {
        fetchAndManageUpgradeCards();
    }
}
