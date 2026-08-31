// Settings - Platform Connections Management
// SECURITY: CSRF protection, input validation, XSS prevention, request signing

// HTML entity escaping
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
    return text.replace(/[&<>"'\/]/g, char => map[char] || char);
}

// CSRF token extraction
function getCsrfToken() {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (!token || typeof token !== 'string' || token.length < 10) return '';
    return token.trim();
}

// Platform name validation
function validatePlatformName(name) {
    if (typeof name !== 'string') return false;
    if (name.length === 0 || name.length > 50) return false;
    return /^[a-zA-Z0-9_-]{1,50}$/.test(name);
}

// User ID validation
function validateUserId(userId) {
    if (typeof userId !== 'string') return false;
    if (userId.length === 0 || userId.length > 100) return false;
    return /^[a-zA-Z0-9_-]+$/.test(userId);
}

// Request signing with Web Crypto
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

// Safe DOM text manipulation
function safeSetHTML(element, html) {
    if (!element) return;
    // Only set if it's a string and reasonable length
    if (typeof html === 'string' && html.length < 50000) {
        element.innerHTML = html;
    }
}

class SettingsManager {
    constructor() {
        // Auto-detect backend server hostname
        this.apiBase = window.API_BASE_URL || 'https://api.solisai.video/api';
        this.userId = localStorage.getItem('youtube_user_id') || this.generateUserId();
        this.connections = JSON.parse(localStorage.getItem('platform_connections') || '{}');
        this.init();
    }

    init() {
        // Listen for connection changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'platform_connections') {
                this.connections = JSON.parse(e.newValue || '{}');
                this.updateConnectionsDisplay();
            }
        });

        // Initialize display
        this.updateConnectionsDisplay();

        // Setup manage connections button
        const manageBtn = document.getElementById('manageConnectionsBtn');
        if (manageBtn) {
            manageBtn.addEventListener('click', () => {
                if (window.setupModal) {
                    window.setupModal.openModal();
                }
            });
        }
    }

    updateConnectionsDisplay() {
        const container = document.getElementById('platformConnectionsContainer');
        const noPlatformsMsg = container?.parentElement.querySelector('div:last-child');
        
        // Check if any platform is connected
        const hasConnections = Object.values(this.connections).some(p => p.connected);

        if (container && noPlatformsMsg) {
            if (hasConnections) {
                container.style.display = 'block';
                noPlatformsMsg.style.display = 'none';
                this.populatePlatformsList();
            } else {
                container.style.display = 'none';
                noPlatformsMsg.style.display = 'block';
            }
        }
    }

    populatePlatformsList() {
        const platformsList = document.getElementById('platformsList');
        if (!platformsList) return;

        // Clear existing items safely
        while (platformsList.firstChild) {
            platformsList.removeChild(platformsList.firstChild);
        }

        const platforms = [{ key: 'youtube', name: 'YouTube' }];

        platforms.forEach(platform => {
            // Validate platform data
            if (!validatePlatformName(platform.key) || !validatePlatformName(platform.name)) {
                return;
            }

            const conn = this.connections[platform.key];
            const isConnected = conn?.connected === true;

            // Create container div
            const platformDiv = document.createElement('div');
            platformDiv.style.cssText = `padding: 15px; border: 2px solid ${isConnected ? '#d4edda' : '#e9ecef'}; border-radius: 8px; background: ${isConnected ? '#f1f8f4' : '#f8f9fa'}; margin-bottom: 10px;`;

            // Create flex container
            const flexContainer = document.createElement('div');
            flexContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

            // Create left side with icon and text
            const leftDiv = document.createElement('div');
            leftDiv.style.cssText = 'display: flex; align-items: center; gap: 12px;';

            // Create icon span
            const iconSpan = document.createElement('span');
            iconSpan.style.cssText = 'font-size: 20px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;';
            iconSpan.innerHTML = '<svg width="24" height="24" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M27.4313 3.11C27.1213 1.89 26.1313 0.91 24.9113 0.6C22.7313 0 14.0013 0 14.0013 0C14.0013 0 5.27128 0 3.09128 0.6C1.87128 0.91 0.881281 1.89 0.571281 3.11C0.261281 4.33 0.00128174 6.6 0.00128174 10C0.00128174 13.4 0.261281 15.67 0.571281 16.89C0.881281 18.11 1.87128 19.09 3.09128 19.4C5.27128 20 14.0013 20 14.0013 20C14.0013 20 22.7313 20 24.9113 19.4C26.1313 19.09 27.1213 18.11 27.4313 16.89C27.7413 15.67 28.0013 13.4 28.0013 10C28.0013 6.6 27.7413 4.33 27.4313 3.11Z" fill="#FF0000"/><path d="M11.2013 14.2V5.8L18.2013 10L11.2013 14.2Z" fill="white"/></svg>';

            // Create text container
            const textDiv = document.createElement('div');
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = "font-family: 'Archivo Black', sans-serif; font-weight: 700; color: #333; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;";
            titleDiv.textContent = escapeHtml(platform.name);

            const statusDiv = document.createElement('div');
            statusDiv.style.cssText = 'font-size: 11px; color: #666;';
            statusDiv.textContent = isConnected ? '✓ Connected' : '○ Not connected';

            textDiv.appendChild(titleDiv);
            textDiv.appendChild(statusDiv);

            leftDiv.appendChild(iconSpan);
            leftDiv.appendChild(textDiv);

            // Create right side with unlink button if connected
            if (isConnected) {
                const unlinkBtn = document.createElement('button');
                unlinkBtn.className = 'unlink-btn';
                unlinkBtn.setAttribute('data-platform', escapeHtml(platform.key));
                unlinkBtn.style.cssText = 'padding: 6px 12px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.3s ease;';
                unlinkBtn.textContent = 'Unlink';
                
                unlinkBtn.addEventListener('click', () => {
                    const platform = unlinkBtn.getAttribute('data-platform');
                    if (confirm(`Unlink ${escapeHtml(this.getPlatformName(platform))}?`)) {
                        this.unlinkPlatform(platform);
                    }
                });
                
                flexContainer.appendChild(leftDiv);
                flexContainer.appendChild(unlinkBtn);
            } else {
                flexContainer.appendChild(leftDiv);
            }

            platformDiv.appendChild(flexContainer);
            platformsList.appendChild(platformDiv);
        });
    }

    async unlinkPlatform(platform) {
        try {
            // Validate platform name
            if (!validatePlatformName(platform)) {
                throw new Error('Invalid platform name');
            }
            if (!validateUserId(this.userId)) {
                throw new Error('Invalid user ID');
            }

            // Prepare request data
            const requestBody = JSON.stringify({ user_id: this.userId });
            
            // Get CSRF token and sign request
            const csrfToken = getCsrfToken();
            const signData = await _signRequest('/analytics/disconnect', 'POST', requestBody);

            if (platform === 'youtube') {
                // Send disconnect request with security headers
                const response = await fetch(`${this.apiBase}/analytics/disconnect`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                        'X-Request-Timestamp': signData.timestamp || '',
                        'X-Request-Nonce': signData.nonce || '',
                        'X-Request-Signature': signData.signature || ''
                    },
                    body: requestBody,
                    credentials: 'include',
                    signal: AbortSignal.timeout(30000)
                });

                if (!response.ok && response.status !== 200 && response.status !== 204) {
                    throw new Error(`Disconnect failed: ${response.status}`);
                }

                // Clear sensitive tokens
                localStorage.removeItem('youtube_connected');
                localStorage.removeItem('youtube_token_time');
                localStorage.removeItem('youtube_token');
            }

            // Update state
            if (this.connections[platform]) {
                this.connections[platform].connected = false;
            }
            
            // Validate before saving
            if (typeof this.connections === 'object') {
                localStorage.setItem('platform_connections', JSON.stringify(this.connections));
            }

            // Show setup banner again
            const banner = document.getElementById('setupBanner');
            if (banner) banner.style.display = 'block';

            // Reload analytics
            if (window.analyticsManager) {
                window.analyticsManager.isConnected = false;
                window.analyticsManager.loadAnalyticsData();
            }

            this.updateConnectionsDisplay();
            this.showNotification(`${this.getPlatformName(platform)} disconnected successfully`);
        } catch (error) {
            this.showNotification(`Failed to disconnect: ${error.message}`, true);
        }
    }

    getPlatformName(platform) {
        const names = { youtube: 'YouTube' };
        return names[platform] || platform;
    }

    generateUserId() {
        let userId = localStorage.getItem('youtube_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('youtube_user_id', userId);
        }
        return userId;
    }

    showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${isError ? '#f8d7da' : '#d4edda'};
            color: ${isError ? '#721c24' : '#155724'};
            border: 1px solid ${isError ? '#f5c6cb' : '#c3e6cb'};
            border-radius: 8px;
            z-index: 9999;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});

// Add animations
const settingsStyle = document.createElement('style');
settingsStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(settingsStyle);
