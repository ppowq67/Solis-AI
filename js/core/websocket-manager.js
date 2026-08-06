class WebSocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;

        this.reconnectConfig = {
            initialDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 1.5
        };

        this.eventQueue = [];
        this.maxQueueSize = 100;

        this.messageBatch = [];
        this.batchFlushInterval = 100;  // ms
        this.flushTimer = null;

        this.lastHeartbeat = Date.now();
        this.heartbeatInterval = 30000;  // 30 seconds
        this.heartbeatTimer = null;

        this.pendingRequests = new Map();
        this.requestTimeout = 30000;

        this.init();
    }

    init() {

        if (typeof window !== 'undefined' && window.socketioClient && window.socketioClient.socket) {
            this.socket = window.socketioClient.socket;
            this.connected = this.socket.connected;
            this.setupSocketIOListeners();
            return;
        }

        if (typeof io !== 'undefined') {
            this.initSocketIO();
        } else {
            this.initNativeWebSocket();
        }
    }

    initSocketIO() {
        if (!window.location.protocol.startsWith('http')) {
            console.warn('[WebSocketManager] Cannot initialize Socket.IO in non-HTTP context');
            return;
        }

        this.socket = io(window.location.origin, {
            reconnection: true,
            reconnectionDelay: this.reconnectConfig.initialDelay,
            reconnectionDelayMax: this.reconnectConfig.maxDelay,
            reconnectionAttempts: this.maxReconnectAttempts,

            transports: ['websocket', 'polling'],  // Prefer WebSocket
            upgrade: true,

            secure: window.location.protocol === 'https:',
            rejectUnauthorized: true
        });

        this.setupSocketIOListeners();
    }

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

        this.socket.on('reconnect_attempt', () => {
            this.reconnectAttempts++;
        });

        this.socket.on('pong', () => {
            this.lastHeartbeat = Date.now();
        });
    }

    initNativeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

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

    emit(eventName, data = {}) {
        if (!this.connected) {
            if (this.eventQueue.length < this.maxQueueSize) {
                this.eventQueue.push({ eventName, data, timestamp: Date.now() });
            } else {
                console.warn(`[WebSocketManager] Event queue full, dropping: ${eventName}`);
            }
            return false;
        }

        this.messageBatch.push({ eventName, data });

        if (!this.flushTimer && this.messageBatch.length > 0) {
            this.flushTimer = setTimeout(() => this.flushMessageBatch(), this.batchFlushInterval);
        }

        if (this.messageBatch.length >= 10) {
            this.flushMessageBatch();
        }

        return true;
    }

    flushMessageBatch() {
        if (this.messageBatch.length === 0) {
            this.flushTimer = null;
            return;
        }

        const batch = this.messageBatch.splice(0);
        this.flushTimer = null;

        if (this.socket && this.socket.emit) {
            batch.forEach(({ eventName, data }) => {
                this.socket.emit(eventName, data);
            });
        } else if (this.socket && this.socket.send) {
            batch.forEach(({ eventName, data }) => {
                this.socket.send(JSON.stringify({ type: eventName, data }));
            });
        }

    }

    flushEventQueue() {

        while (this.eventQueue.length > 0) {
            const { eventName, data } = this.eventQueue.shift();
            this.emit(eventName, data);
        }
    }

    handleMessage(data) {
        const { type, requestId, payload } = data;

        if (requestId && this.pendingRequests.has(requestId)) {
            const resolve = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            clearTimeout(resolve.timeout);
            resolve.callback(payload);
            return;
        }

        if (typeof this.onMessage === 'function') {
            this.onMessage(data);
        }
    }

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

            if (this.socket?.emit) {
                this.socket.emit('ping');
            }
        }, this.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    getStatus() {
        return {
            connected: this.connected,
            reconnectAttempts: this.reconnectAttempts,
            queuedEvents: this.eventQueue.length,
            pendingRequests: this.pendingRequests.size,
            timeSinceLastHeartbeat: Date.now() - this.lastHeartbeat
        };
    }

    disconnect() {
        this.stopHeartbeat();

        this.flushMessageBatch();

        if (this.socket?.disconnect) {
            this.socket.disconnect();
        } else if (this.socket?.close) {
            this.socket.close();
        }

        this.connected = false;
    }
}

window.wsManager = new WebSocketManager();
