function getSolisSocketOrigin() {
  try {
    const e = window.location && window.location.hostname || "";
    if (e === "localhost" || e === "127.0.0.1") {
      return window.location.origin;
    }
    const t = (window.API_BASE_URL || window.API_BASE || "https://api.solisai.video/api").toString();
    return t.replace(/\/api\/?$/, "") || "https://api.solisai.video";
  } catch (e) {
    return "https://api.solisai.video";
  }
}

window.getSolisSocketOrigin = getSolisSocketOrigin;

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectConfig = {
      initialDelay: 1e3,
      maxDelay: 3e4,
      backoffMultiplier: 1.5
    };
    this.eventQueue = [];
    this.maxQueueSize = 100;
    this.messageBatch = [];
    this.batchFlushInterval = 100;
    this.flushTimer = null;
    this.lastHeartbeat = Date.now();
    this.heartbeatInterval = 3e4;
    this.heartbeatTimer = null;
    this.pendingRequests = new Map;
    this.requestTimeout = 3e4;
    this.init();
  }
  init() {
    if (typeof window !== "undefined" && window.socketioClient && window.socketioClient.socket) {
      this.socket = window.socketioClient.socket;
      this.connected = this.socket.connected;
      this.setupSocketIOListeners();
      return;
    }
    if (typeof io !== "undefined") {
      this.initSocketIO();
    } else {
      this.initNativeWebSocket();
    }
  }
  initSocketIO() {
    if (!window.location.protocol.startsWith("http")) {
      console.warn("[WebSocketManager] Cannot initialize Socket.IO in non-HTTP context");
      return;
    }
    const e = getSolisSocketOrigin();
    this.socket = io(e, {
      reconnection: true,
      reconnectionDelay: this.reconnectConfig.initialDelay,
      reconnectionDelayMax: this.reconnectConfig.maxDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: [ "websocket", "polling" ],
      upgrade: true,
      path: "/socket.io/",
      withCredentials: true,
      secure: String(e).startsWith("https:"),
      rejectUnauthorized: true
    });
    this.setupSocketIOListeners();
  }
  setupSocketIOListeners() {
    this.socket.on("connect", () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.flushEventQueue();
    });
    this.socket.on("disconnect", e => {
      console.warn("[WebSocketManager] Socket.IO disconnected:", e);
      this.connected = false;
      this.stopHeartbeat();
    });
    this.socket.on("error", e => {
      console.error("[WebSocketManager] Socket.IO error:", e);
    });
    this.socket.on("reconnect_attempt", () => {
      this.reconnectAttempts++;
    });
    this.socket.on("pong", () => {
      this.lastHeartbeat = Date.now();
    });
  }
  initNativeWebSocket() {
    const e = getSolisSocketOrigin();
    const t = e.replace(/^http/, "ws");
    try {
      this.socket = new WebSocket(t);
      this.socket.onopen = () => this.onWebSocketOpen();
      this.socket.onmessage = e => this.onWebSocketMessage(e);
      this.socket.onerror = e => this.onWebSocketError(e);
      this.socket.onclose = () => this.onWebSocketClose();
    } catch (e) {
      console.error("[WebSocketManager] Failed to create WebSocket:", e);
    }
  }
  onWebSocketOpen() {
    this.connected = true;
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.flushEventQueue();
  }
  onWebSocketMessage(e) {
    try {
      const t = JSON.parse(e.data);
      this.handleMessage(t);
    } catch (e) {
      console.warn("[WebSocketManager] Failed to parse message:", e);
    }
  }
  onWebSocketError(e) {
    console.error("[WebSocketManager] WebSocket error:", e);
  }
  onWebSocketClose() {
    console.warn("[WebSocketManager] WebSocket disconnected");
    this.connected = false;
    this.stopHeartbeat();
    this.attemptReconnect();
  }
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WebSocketManager] Max reconnection attempts reached");
      return;
    }
    const e = Math.min(this.reconnectConfig.initialDelay * Math.pow(this.reconnectConfig.backoffMultiplier, this.reconnectAttempts), this.reconnectConfig.maxDelay);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.initNativeWebSocket();
    }, e);
  }
  emit(e, t = {}) {
    if (!this.connected) {
      if (this.eventQueue.length < this.maxQueueSize) {
        this.eventQueue.push({
          eventName: e,
          data: t,
          timestamp: Date.now()
        });
      } else {
        console.warn(`[WebSocketManager] Event queue full, dropping: ${e}`);
      }
      return false;
    }
    this.messageBatch.push({
      eventName: e,
      data: t
    });
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
    const e = this.messageBatch.splice(0);
    this.flushTimer = null;
    if (this.socket && this.socket.emit) {
      e.forEach(({eventName: e, data: t}) => {
        this.socket.emit(e, t);
      });
    } else if (this.socket && this.socket.send) {
      e.forEach(({eventName: e, data: t}) => {
        this.socket.send(JSON.stringify({
          type: e,
          data: t
        }));
      });
    }
  }
  flushEventQueue() {
    while (this.eventQueue.length > 0) {
      const {eventName: e, data: t} = this.eventQueue.shift();
      this.emit(e, t);
    }
  }
  handleMessage(e) {
    const {type: t, requestId: s, payload: n} = e;
    if (s && this.pendingRequests.has(s)) {
      const e = this.pendingRequests.get(s);
      this.pendingRequests.delete(s);
      clearTimeout(e.timeout);
      e.callback(n);
      return;
    }
    if (typeof this.onMessage === "function") {
      this.onMessage(e);
    }
  }
  request(e, t = {}) {
    return new Promise((s, n) => {
      const i = `${Date.now()}-${Math.random()}`;
      const o = setTimeout(() => {
        this.pendingRequests.delete(i);
        n(new Error(`WebSocket request timeout: ${e}`));
      }, this.requestTimeout);
      this.pendingRequests.set(i, {
        callback: s,
        timeout: o
      });
      this.emit(e, {
        ...t,
        requestId: i
      });
    });
  }
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const e = Date.now() - this.lastHeartbeat;
      if (e > this.heartbeatInterval * 2) {
        console.warn("[WebSocketManager] Heartbeat timeout, reconnecting...");
        if (this.socket) {
          this.socket.disconnect?.();
        } else {
          this.socket.close?.();
        }
        this.onWebSocketClose();
        return;
      }
      if (this.socket?.emit) {
        this.socket.emit("ping");
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

WebSocketManager.connect = function() {
  if (!window.wsManager) {
    window.wsManager = new WebSocketManager;
  }
  return window.wsManager;
};

window.wsManager = new WebSocketManager;

window.WebSocketManager = WebSocketManager;
