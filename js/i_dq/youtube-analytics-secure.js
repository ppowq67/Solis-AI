class YouTubeAnalyticsManager {
    constructor() {
        this.isConnected = false;
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.userInfo = null;
        this.channels = [];
        this.apiBase = window.API_BASE_URL || 'https://api.solisai.video/api';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.loadStoredToken();
        this.checkConnectionStatus();
    }
    loadStoredToken() {
        try {
            const storedToken = sessionStorage.getItem('youtube_access_token');
            const tokenExpiry = sessionStorage.getItem('youtube_token_expiry');
            
            if (storedToken && tokenExpiry) {
                const expiry = new Date(tokenExpiry);
                if (expiry > new Date()) {
                    this.accessToken = storedToken;
                    this.tokenExpiry = tokenExpiry;
                    this.isConnected = true;
                    return true;
                } else {
                    // Token expired
                    this.clearStoredToken();
                }
            }
        } catch (error) {
            console.error('Error loading YouTube token:', error);
        }
        return false;
    }
    clearStoredToken() {
        sessionStorage.removeItem('youtube_access_token');
        sessionStorage.removeItem('youtube_token_expiry');
        sessionStorage.removeItem('youtube_refresh_token');
        localStorage.removeItem('youtube_connected');
        localStorage.removeItem('youtube_user_id');
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.isConnected = false;
    }
    async checkConnectionStatus() {
        // YouTube connect disabled — no /auth/youtube/status call
        this.isConnected = false;
    }
    async startOAuthFlow() {
        try {
            if (window.__ytOAuthInFlight) {
                return false;
            }
            window.__ytOAuthInFlight = true;

            // 🔐 SECURITY: User is authenticated via httpOnly cookie
            const response = await fetch(`${this.apiBase}/auth/youtube/authorize`, {
                method: 'POST',
                credentials: 'include',  // 🔐 Send httpOnly cookie with request
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`OAuth setup failed: ${response.status}`);
            }
            
            const data = await response.json();
            const { auth_url, token_id } = data;
            
            if (!auth_url) {
                throw new Error('No authorization URL received');
            }
            
            // Store token_id for callback validation
            sessionStorage.setItem('youtube_oauth_token_id', token_id);
            sessionStorage.setItem('youtube_oauth_timestamp', Date.now().toString());
            
            // Open in popup window
            this.openOAuthPopup(auth_url);
            
            return true;
            
        } catch (error) {
            window.__ytOAuthInFlight = false;
            console.error('Failed to start OAuth flow:', error);
            this.showNotification('Failed to start YouTube connection', 'error');
            return false;
        }
    }
    
    /**
     * Open OAuth popup
     */
    openOAuthPopup(authUrl) {
        const width = 500;
        const height = 600;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        const popup = window.open(
            authUrl,
            'youtube_oauth',
            `width=${width},height=${height},left=${left},top=${top}`
        );
        
        if (!popup) {
            this.showNotification('Please allow pop-ups to connect YouTube', 'error');
            return;
        }
        
        // Monitor popup
        const popupCheck = setInterval(() => {
            if (popup.closed) {
                clearInterval(popupCheck);
                window.__ytOAuthInFlight = false;
                setTimeout(() => this.checkConnectionStatus(), 1000);
            }
        }, 500);
    }
    
    /**
     * Handle OAuth callback from popup
     */
    async handleOAuthCallback(callbackData) {
        try {
            // Validate callback
            if (!callbackData || !callbackData.success) {
                console.error('OAuth callback failed');
                return false;
            }
            
            // Validate that this is our callback (token_id must match)
            const expectedTokenId = sessionStorage.getItem('youtube_oauth_token_id');
            if (callbackData.token_id !== expectedTokenId) {
                console.error('Token ID mismatch - possible CSRF attempt');
                return false;
            }
            
            // Store tokens securely
            sessionStorage.setItem('youtube_access_token', callbackData.access_token);
            sessionStorage.setItem('youtube_token_expiry', callbackData.expires_at);
            
            // Update state
            this.accessToken = callbackData.access_token;
            this.tokenExpiry = callbackData.expires_at;
            this.isConnected = true;
            
            // Update UI
            this.updateAnalyticsUI();
            this.showNotification(' YouTube connected successfully!', 'success');
            
            return true;

        } catch (error) {
            console.error('Error handling OAuth callback:', error);
            return false;
        }
    }   
    
    /**
     * Disconnect YouTube
     */
    async disconnect() {
        try {
            const response = await fetch(`${this.apiBase}/auth/youtube/disconnect`, {
                method: 'POST',
                credentials: 'include',  // 🔐 Send httpOnly cookie with request
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Disconnect failed: ${response.status}`);
            }
            
            // Clear local storage
            this.clearStoredToken();
            
            // Update UI
            this.updateAnalyticsUI();
            this.showNotification(' YouTube disconnected', 'success');
            
            return true;
            
        } catch (error) {
            console.error('Error disconnecting YouTube:', error);
            this.showNotification('Failed to disconnect YouTube', 'error');
            return false;
        }
    }
    
    /**
     * Check if token needs refresh
     */
    async checkTokenExpiry() {
        if (!this.tokenExpiry) return;
        
        const expiry = new Date(this.tokenExpiry);
        const now = new Date();
        const timeUntilExpiry = expiry - now;
        const fiveMinutes = 5 * 60 * 1000;
        
        // If expiring within 5 minutes, refresh
        if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
            await this.refreshToken();
        } else if (timeUntilExpiry <= 0) {
            this.clearStoredToken();
            this.isConnected = false;
        }
    }
    
    /**
     * Refresh access token
     */
    async refreshToken() {
        try {
            const response = await fetch(`${this.apiBase}/auth/youtube/refresh-token`, {
                method: 'POST',
                credentials: 'include',  // 🔐 Send httpOnly cookie with request
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update tokens
            sessionStorage.setItem('youtube_access_token', data.access_token);
            sessionStorage.setItem('youtube_token_expiry', data.expires_at);
            
            this.accessToken = data.access_token;
            this.tokenExpiry = data.expires_at;
            
            return true;
            
        } catch (error) {
            console.error('Error refreshing YouTube token:', error);
            this.clearStoredToken();
            return false;
        }
    }
    
    /**
     * Fetch YouTube analytics data
     */
    async fetchAnalyticsData(startDate = null, endDate = null) {
        try {
            if (!this.isConnected || !this.accessToken) {
                console.warn('Not connected to YouTube');
                return null;
            }
            
            // Check token expiry first
            await this.checkTokenExpiry();
            
            // Use provided dates or default to last 30 days
            if (!startDate) {
                const date = new Date();
                endDate = new Date();
                startDate = new Date(date.setDate(date.getDate() - 30));
            }
            
            const formatDate = (d) => d.toISOString().split('T')[0];
            
            const response = await fetch(`${this.apiBase}/analytics/dashboard`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({
                    start_date: formatDate(startDate),
                    end_date: formatDate(endDate)
                })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token might be invalid, try refresh
                    await this.refreshToken();
                }
                throw new Error(`Analytics fetch failed: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('Error fetching analytics:', error);
            return null;
        }
    }
    
    /**
     * Update analytics UI
     */
    updateAnalyticsUI() {
        const connectBtn = document.getElementById('connectYouTubeBtn');
        const disconnectBtn = document.getElementById('disconnectYouTubeBtn');
        const statusEl = document.getElementById('youtubeStatus');
        
        if (this.isConnected) {
            if (connectBtn) connectBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'flex';
            if (statusEl) {
                statusEl.innerHTML = '<span style="color: #4caf50;">✓ YouTube Connected</span>';
            }
        } else {
            if (connectBtn) connectBtn.style.display = 'flex';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (statusEl) {
                statusEl.innerHTML = '<span style="color: #999;">YouTube Not Connected</span>';
            }
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) {
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            padding: 16px;
            margin-bottom: 12px;
            background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#4caf50' : '#2196f3'};
            color: white;
            border-radius: 8px;
            animation: slideInRight 0.3s ease;
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
}

// Initialize global instance
window.youtubeAnalyticsManager = new YouTubeAnalyticsManager();

// Expose functions for HTML onclick handlers
window.connectYouTube = () => window.youtubeAnalyticsManager.startOAuthFlow();
window.disconnectYouTube = () => window.youtubeAnalyticsManager.disconnect();

// Check connection status periodically (every 5 minutes)
setInterval(() => {
    if (window.youtubeAnalyticsManager) {
        window.youtubeAnalyticsManager.checkTokenExpiry();
    }
}, 5 * 60 * 1000);

// Handle OAuth popup message
window.addEventListener('message', (event) => {
    // Validate origin for security
    const apiBase = window.API_BASE_URL || 'https://api.solisai.video/api';
    const allowedOrigin = apiBase.split('/api')[0];
    
    if (event.origin !== allowedOrigin) return;
    
    if (event.data.type === 'youtube_oauth_callback') {
        if (window.youtubeAnalyticsManager) {
            window.youtubeAnalyticsManager.handleOAuthCallback(event.data.payload);
        }
    }
});
