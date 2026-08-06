document.addEventListener('DOMContentLoaded', function() {
    const platformConnectionsContainer = document.getElementById('platformConnectionsContainer');
    const platformOnboarding = document.getElementById('platformOnboarding');
    const connectFirstPlatformBtn = document.getElementById('connectFirstPlatformBtn');

    function getApiBase() {
        return window.API_BASE_URL || 'https://api.solisai.video/api';
    }

    const API_BASE = getApiBase();
    const hasConnectionsUi = !!platformConnectionsContainer;

    async function fetchConnectionStatus() {

        try {
            const response = await fetch(`${API_BASE}/analytics/status`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid response structure');
                }
                renderConnections(data);

                if (data.youtube?.connected) {
                    localStorage.setItem('youtube_connected', 'true');
                    if (window.analyticsManager) {
                        await window.analyticsManager.loadAnalyticsData();
                    } else {
                    }
                } else {
                }
            } else {
                throw new Error('Endpoint not available');
            }

        } catch (error) {
            const storedConnections = localStorage.getItem('platform_connections');
            if (storedConnections) {
                try {
                    const data = JSON.parse(storedConnections);
                    renderConnections(data);
                } catch (e) {
                    showOnboarding();
                }
            } else {
                showOnboarding();
            }
        }
    }

    function renderConnections(statusData) {
        if (!platformConnectionsContainer) return;
        platformConnectionsContainer.innerHTML = '';
        let hasConnections = false;

        if (!statusData || typeof statusData !== 'object') {
            console.error('Invalid statusData:', statusData);
            showOnboarding();
            return;
        }

        const platformsList = Object.values(statusData).filter(p => p && typeof p === 'object');

        platformsList.forEach(platform => {
            if (!platform || !platform.platform) {
                console.warn('Skipping invalid platform:', platform);
                return;
            }

            hasConnections = true;
            const item = document.createElement('div');
            item.className = 'settings-option platform-connection-item';
            item.dataset.platform = platform.platform.toLowerCase();
            item.dataset.connected = platform.connected ? 'true' : 'false';
            item.style.cursor = platform.connected ? 'default' : 'pointer';

            if (platform.connected) {
                item.innerHTML = `
                    <div class="settings-option-icon">${platform.icon || ''}</div>
                    <div class="option-info">
                        <div class="option-name">${platform.platform}</div>
                        <div class="option-description" style="color: #22c55e;">Connected</div>
                    </div>
                    <button class="disconnect-btn" data-platform="${platform.platform.toLowerCase()}">Disconnect</button>
                `;
            } else {
                item.innerHTML = `
                    <div class="settings-option-icon">${platform.icon || ''}</div>
                    <div class="option-info">
                        <div class="option-name">${platform.platform}</div>
                        <div class="option-description" style="color: #999;">Click to connect</div>
                    </div>
                    <button style="background: #0066ff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">Connect</button>
                `;
            }
            platformConnectionsContainer.appendChild(item);
        });

        if (hasConnections) {
            if (platformOnboarding) platformOnboarding.style.display = 'none';
            platformConnectionsContainer.style.display = 'block';
        } else {
            showOnboarding();
        }
    }

    function showOnboarding() {
        if (platformConnectionsContainer) platformConnectionsContainer.style.display = 'none';
        if (platformOnboarding) platformOnboarding.style.display = 'block';
    }

    window.connectYouTube = async function() {

        const messagePromise = new Promise((resolve) => {
            const messageHandler = (event) => {
                if (event.data && event.data.type === 'YOUTUBE_AUTH_SUCCESS') {
                    window.removeEventListener('message', messageHandler);
                    resolve(true);
                }
            };
            window.addEventListener('message', messageHandler);
        });

        try {
            const authUrl = `${API_BASE}/analytics/youtube/auth`;
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred.' }));
                console.error('[connectYouTube] Backend error:', errorData);
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.auth_url) {
                const authWindow = window.open(data.auth_url, 'authWindow', 'width=600,height=700');

                if (!authWindow) {
                    alert('Please allow popups to connect YouTube');
                    console.error('[connectYouTube] Popup was blocked!');
                    return;
                }

                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(false);
                    }, 3000);
                });

                Promise.race([messagePromise, timeoutPromise]).then(() => {
                    setTimeout(() => {
                        fetchConnectionStatus();
                    }, 500);
                });

            } else {
                console.error('[connectYouTube] No auth_url in response');
                alert('Failed to get authentication URL');
            }
        } catch (error) {
            console.error('[connectYouTube] Connection failed:', error);
            alert(`Connection failed: ${error.message}`);
        }
    };

    async function disconnectPlatform(platform) {
        if (!platform || typeof platform !== 'string' || platform.length === 0) {
            console.error('Invalid platform name');
            return;
        }

        const modal = document.getElementById('disconnectConfirmationModal');
        const confirmBtn = document.getElementById('confirmDisconnectBtn');
        const confirmText = document.getElementById('disconnectConfirmationText');

        const displayName = platform.replace(/[<>"']/g, '');
        confirmText.textContent = `Are you sure you want to disconnect ${displayName}?`;
        modal.classList.add('show');

        const handleConfirm = async () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            modal.classList.remove('show');

            const response = await fetch(`${API_BASE}/analytics/disconnect`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: platform })
            });

            if (response.ok) {
                showNotification(`${platform} disconnected successfully`, 'success');
                fetchConnectionStatus();
            } else {
                showNotification('Failed to disconnect. Please try again.', 'error');
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
    }

    if (hasConnectionsUi && connectFirstPlatformBtn) {
        connectFirstPlatformBtn.addEventListener('click', function() {
            window.connectYouTube();
        });
        showOnboarding();
    }

    if (platformConnectionsContainer) {
        platformConnectionsContainer.addEventListener('click', (e) => {
            const disconnectBtn = e.target.closest('.disconnect-btn');
            const connectionItem = e.target.closest('.platform-connection-item');

            if (disconnectBtn) {
                disconnectPlatform(disconnectBtn.dataset.platform);
            } else if (connectionItem && connectionItem.dataset.connected === 'false') {
                const platform = connectionItem.dataset.platform;
                if (platform === 'youtube') {
                    window.connectYouTube();
                }
            }
        });
    }

    const getStartedBadge = document.getElementById('getStartedBadge');
    if (getStartedBadge) {
        getStartedBadge.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const userMenuPanel = document.getElementById('userMenuPanel');
            const userMenuBackdrop = document.getElementById('userMenuBackdrop');
            if (userMenuPanel) {
                userMenuPanel.classList.remove('active');
            }
            if (userMenuBackdrop) {
                userMenuBackdrop.classList.remove('active');
            }

            if (window.setupModal) {
                window.setupModal.openModal();
            } else {
            }
        });
    } else {
    }

    if (hasConnectionsUi) {
        fetchConnectionStatus();
    }

    const paymentSuccess = sessionStorage.getItem('paymentSuccess');
    if (paymentSuccess) {
        try {
            const data = JSON.parse(paymentSuccess);

            showPaymentSuccessModal();
            createConfetti();

            if (window.clipsStudio) {
                clipsStudio.loadAndDisplayStorageInfo();
            }

            sessionStorage.removeItem('paymentSuccess');
        } catch (error) {
            console.error('Error parsing payment success data:', error);
        }
    } else {
    }

    const deleteAllBtn = document.getElementById('DeleteALLBtn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
            const processingList = document.getElementById('processingList');
            const itemsToDelete = processingList.querySelectorAll('.processing-item:not(.processing)');

            if (itemsToDelete.length === 0) {
                alert('No completed or failed items to delete.');
                return;
            }

            if (confirm(`Are you sure you want to delete ${itemsToDelete.length} item(s)? This action cannot be undone.`)) {
                itemsToDelete.forEach(item => {
                    item.remove();
                });

                const remainingItems = processingList.querySelectorAll('.processing-item');
                const emptyState = document.getElementById('emptyProcessingState');
                if (remainingItems.length === 0 && emptyState) {
                    emptyState.style.display = 'block';
                }
            }
        });
    }

    const processingList = document.getElementById('processingList');
    const emptyProcessingState = document.getElementById('emptyProcessingState');
    if (processingList && emptyProcessingState) {
        const observer = new MutationObserver(() => {
            const hasItems = processingList.querySelector('.processing-item');
            emptyProcessingState.style.display = hasItems ? 'none' : 'flex';
        });
        observer.observe(processingList, { childList: true });
    }
});
