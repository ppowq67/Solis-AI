window.ws = {
    emit(eventName, data = {}) {
        if (window.wsManager) {
            return window.wsManager.emit(eventName, data);
        } else if (window.solisWSClient && window.solisWSClient.socket) {
            window.solisWSClient.socket.emit(eventName, data);
            return true;
        }
        console.warn(`[ws.emit] WebSocket not available for event: ${eventName}`);
        return false;
    },

    async request(eventName, data = {}) {
        if (window.wsManager) {
            return window.wsManager.request(eventName, data);
        } else if (window.solisWSClient && window.solisWSClient.socket) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`WebSocket request timeout: ${eventName}`));
                }, 30000);

                window.solisWSClient.socket.emit(eventName, { ...data, _requestId: Date.now() });
                setTimeout(() => {
                    clearTimeout(timeout);
                    resolve({});
                }, 100);
            });
        }
        console.error(`[ws.request] WebSocket not available`);
        throw new Error('WebSocket not available');
    },

    getStatus() {
        if (window.wsManager) {
            return window.wsManager.getStatus();
        } else if (window.solisWSClient) {
            return {
                connected: window.solisWSClient.socket?.connected || false,
                userId: window.solisWSClient.userId
            };
        }
        return { connected: false };
    },

    events: {
        customization_changed: 'customization_changed',
        element_selected: 'element_selected',
        template_updated: 'template_updated',

        video_generated: 'video_generated',
        processing_complete: 'processing_complete',

        notification_read: 'notification_read',
        message_received: 'message_received',

        interaction_logged: 'interaction_logged',
        event_tracked: 'event_tracked'
    }
};
