/**
 * 🔌 WebSocket Manager - SaaS-Level Connection Management
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection pooling and deduplication
 * - Event queuing during disconnection
 * - Health monitoring
 * - Message batching for efficiency
 */

function solisResolveSocketOrigin() {
    const external = window.getSolisSocketOrigin;
    // Prefer init.js helper when present; never call ourselves (would recurse).
    if (typeof external === 'function' && external !== solisResolveSocketOrigin) {
        try {
            return external();
        } catch (_) { /* fall through */ }
    }
    try {
        const host = (window.location && window.location.hostname) || '';
        if (host === 'localhost' || host === '127.0.0.1') {
            const base = window.API_BASE_URL || `http://${host}:5500/api`;
            return String(base).replace(/\/api\/?$/, '') || window.location.origin;
        }
        return 'https://api.solisai.video';
    } catch (_) {
        return 'https://api.solisai.video';
    }
}
if (typeof window.getSolisSocketOrigin !== 'function') {
    window.getSolisSocketOrigin = solisResolveSocketOrigin;
}

class WebSocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        
        // Reconnection config
        this.reconnectConfig = {
            initialDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 1.5
        };
        
        // Event queue for messages while disconnected
        this.eventQueue = [];
        this.maxQueueSize = 100;
        
        // Message batching
        this.messageBatch = [];
        this.batchFlushInterval = 100;  // ms
        this.flushTimer = null;
        
        // Health monitoring
        this.lastHeartbeat = Date.now();
        this.heartbeatInterval = 30000;  // 30 seconds
        this.heartbeatTimer = null;
        
        // Request deduplication
        this.pendingRequests = new Map();
        this.requestTimeout = 30000;
        
        this.init();
    }
    
    /**
     * Initialize WebSocket connection
     */
    init() {
        
        // Check if Socket.IO instance already exists (from websocket-client.js)
        if (typeof window !== 'undefined' && window.socketioClient && window.socketioClient.socket) {
            this.socket = window.socketioClient.socket;
            this.connected = this.socket.connected;
            this.setupSocketIOListeners();
            return;
        }
        
        // Use Socket.IO if available, fallback to native WebSocket
        if (typeof io !== 'undefined') {
            this.initSocketIO();
        } else {
            this.initNativeWebSocket();
        }
    }
    
    /**
     * Initialize with Socket.IO (recommended)
     */
    initSocketIO() {
        if (!window.location.protocol.startsWith('http')) {
            console.warn('[WebSocketManager] Cannot initialize Socket.IO in non-HTTP context');
            return;
        }

        const origin = solisResolveSocketOrigin();
        
        this.socket = io(origin, {
            reconnection: true,
            reconnectionDelay: this.reconnectConfig.initialDelay,
            reconnectionDelayMax: this.reconnectConfig.maxDelay,
            reconnectionAttempts: this.maxReconnectAttempts,
            
            // Performance settings
            transports: ['websocket', 'polling'],  // Prefer WebSocket
            upgrade: true,
            path: '/socket.io/',
            withCredentials: true,
            
            // Security
            secure: String(origin).startsWith('https:'),
            rejectUnauthorized: true
        });
        
        this.setupSocketIOListeners();
    }
    
    /**
     * Setup Socket.IO event listeners
     */
    setupSocketIOListeners() {
        this.socket.on('connect', () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.flushEventQueue();
        });
        
        this.socket.on('disconnect', (reason) => {
            console.warn('[WebSocketManager] Socket.IO disconnected:', reason);
            this.connected = false;
            this.stopHeartbeat();
        });
        
        this.socket.on('error', (error) => {
            console.error('[WebSocketManager] Socket.IO error:', error);
        });
        
        // Reconnection events
        this.socket.on('reconnect_attempt', () => {
            this.reconnectAttempts++;
        });
        
        // Heartbeat response
        this.socket.on('pong', () => {
            this.lastHeartbeat = Date.now();
        });
    }
    
    /**
     * Initialize with native WebSocket
     */
    initNativeWebSocket() {
        const origin = solisResolveSocketOrigin();
        const wsUrl = origin.replace(/^http/, 'ws');
        
        try {
            this.socket = new WebSocket(wsUrl);
            this.socket.onopen = () => this.onWebSocketOpen();
            this.socket.onmessage = (event) => this.onWebSocketMessage(event);
            this.socket.onerror = (error) => this.onWebSocketError(error);
            this.socket.onclose = () => this.onWebSocketClose();
        } catch (error) {
            console.error('[WebSocketManager] Failed to create WebSocket:', error);
        }
    }
    
    /**
     * WebSocket event handlers
     */
    onWebSocketOpen() {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.flushEventQueue();
    }
    
    onWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        } catch (error) {
            console.warn('[WebSocketManager] Failed to parse message:', error);
        }
    }
    
    onWebSocketError(error) {
        console.error('[WebSocketManager] WebSocket error:', error);
    }
    
    onWebSocketClose() {
        console.warn('[WebSocketManager] WebSocket disconnected');
        this.connected = false;
        this.stopHeartbeat();
        this.attemptReconnect();
    }
    
    /**
     * Attempt to reconnect with exponential backoff
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocketManager] Max reconnection attempts reached');
            return;
        }
        
        const delay = Math.min(
            this.reconnectConfig.initialDelay * Math.pow(
                this.reconnectConfig.backoffMultiplier,
                this.reconnectAttempts
            ),
            this.reconnectConfig.maxDelay
        );
        
        
        setTimeout(() => {
            this.reconnectAttempts++;
            this.initNativeWebSocket();
        }, delay);
    }
    
    /**
     * 🎯 Main method to send events
     */
    emit(eventName, data = {}) {
        if (!this.connected) {
            // Queue event for later
            if (this.eventQueue.length < this.maxQueueSize) {
                this.eventQueue.push({ eventName, data, timestamp: Date.now() });
            } else {
                console.warn(`[WebSocketManager] Event queue full, dropping: ${eventName}`);
            }
            return false;
        }
        
        // Batch the message
        this.messageBatch.push({ eventName, data });
        
        // Schedule flush if not already scheduled
        if (!this.flushTimer && this.messageBatch.length > 0) {
            this.flushTimer = setTimeout(() => this.flushMessageBatch(), this.batchFlushInterval);
        }
        
        // Flush immediately if batch is large
        if (this.messageBatch.length >= 10) {
            this.flushMessageBatch();
        }
        
        return true;
    }
    
    /**
     * Flush message batch to server
     */
    flushMessageBatch() {
        if (this.messageBatch.length === 0) {
            this.flushTimer = null;
            return;
        }
        
        const batch = this.messageBatch.splice(0);
        this.flushTimer = null;
        
        if (this.socket && this.socket.emit) {
            // Socket.IO
            batch.forEach(({ eventName, data }) => {
                this.socket.emit(eventName, data);
            });
        } else if (this.socket && this.socket.send) {
            // Native WebSocket
            batch.forEach(({ eventName, data }) => {
                this.socket.send(JSON.stringify({ type: eventName, data }));
            });
        }
        
    }
    
    /**
     * Flush queued events when reconnected
     */
    flushEventQueue() {
        
        while (this.eventQueue.length > 0) {
            const { eventName, data } = this.eventQueue.shift();
            this.emit(eventName, data);
        }
    }
    
    /**
     * Handle incoming messages
     */
    handleMessage(data) {
        const { type, requestId, payload } = data;
        
        // Handle response to a pending request
        if (requestId && this.pendingRequests.has(requestId)) {
            const resolve = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            clearTimeout(resolve.timeout);
            resolve.callback(payload);
            return;
        }
        
        // Dispatch as regular event
        if (typeof this.onMessage === 'function') {
            this.onMessage(data);
        }
    }
    
    /**
     * Send request and wait for response
     */
    request(eventName, data = {}) {
        return new Promise((resolve, reject) => {
            const requestId = `${Date.now()}-${Math.random()}`;
            
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`WebSocket request timeout: ${eventName}`));
            }, this.requestTimeout);
            
            this.pendingRequests.set(requestId, {
                callback: resolve,
                timeout
            });
            
            this.emit(eventName, { ...data, requestId });
        });
    }
    
    /**
     * Start heartbeat to detect stale connections
     */
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
            
            if (timeSinceLastHeartbeat > this.heartbeatInterval * 2) {
                console.warn('[WebSocketManager] Heartbeat timeout, reconnecting...');
                if (this.socket) {
                    this.socket.disconnect?.();
                } else {
                    this.socket.close?.();
                }
                this.onWebSocketClose();
                return;
            }
            
            // Send ping
            if (this.socket?.emit) {
                this.socket.emit('ping');
            }
        }, this.heartbeatInterval);
    }
    
    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    
    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.connected,
            reconnectAttempts: this.reconnectAttempts,
            queuedEvents: this.eventQueue.length,
            pendingRequests: this.pendingRequests.size,
            timeSinceLastHeartbeat: Date.now() - this.lastHeartbeat
        };
    }
    
    /**
     * Graceful disconnect
     */
    disconnect() {
        this.stopHeartbeat();
        
        // Flush remaining messages
        this.flushMessageBatch();
        
        if (this.socket?.disconnect) {
            this.socket.disconnect();
        } else if (this.socket?.close) {
            this.socket.close();
        }
        
        this.connected = false;
    }
}

// Static bridge used by profile-notifications.js
WebSocketManager.connect = function () {
    if (!window.wsManager) {
        window.wsManager = new WebSocketManager();
    }
    return window.wsManager;
};

// Global instance
window.wsManager = new WebSocketManager();
window.WebSocketManager = WebSocketManager;
