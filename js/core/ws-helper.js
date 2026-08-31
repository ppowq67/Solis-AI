/**
 * 🔌 WebSocket Emit Helper - Unified event emission through wsManager
 * 
 * Provides convenient methods to emit WebSocket events with automatic:
 * - Message batching
 * - Event queuing during disconnection
 * - Deduplication of responses
 */

window.ws = {
    /**
     * 🎯 Emit an event (automatically batched and queued if disconnected)
     */
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
    
    /**
     * 🎯 Send request and wait for response
     */
    async request(eventName, data = {}) {
        if (window.wsManager) {
            return window.wsManager.request(eventName, data);
        } else if (window.solisWSClient && window.solisWSClient.socket) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`WebSocket request timeout: ${eventName}`));
                }, 30000);
                
                window.solisWSClient.socket.emit(eventName, { ...data, _requestId: Date.now() });
                // This is a simplified version - full implementation would track responses
                setTimeout(() => {
                    clearTimeout(timeout);
                    resolve({});
                }, 100);
            });
        }
        console.error(`[ws.request] WebSocket not available`);
        throw new Error('WebSocket not available');
    },
    
    /**
     * 📊 Get connection status
     */
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
    
    /**
     * Common events - use these instead of remember event names
     */
    events: {
        // Customization events
        customization_changed: 'customization_changed',
        element_selected: 'element_selected',
        template_updated: 'template_updated',
        
        // Status events
        video_generated: 'video_generated',
        processing_complete: 'processing_complete',
        
        // Notification events
        notification_read: 'notification_read',
        message_received: 'message_received',
        
        // Analytics events
        interaction_logged: 'interaction_logged',
        event_tracked: 'event_tracked'
    }
};

