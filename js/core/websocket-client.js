class SolisAIWebSocketClient {
  constructor(e = null, t = {}) {
    this.serverUrl = e || this._detectServerUrl();
    this.socket = null;
    this.userId = null;
    this.securityManager = null;
    this.HEARTBEAT_INTERVAL = t.heartbeatInterval || 3e4;
    this.HEALTH_CHECK_INTERVAL = t.healthCheckInterval || 1e4;
    this.MAX_MISSED_HEARTBEATS = 3;
    this.CLEANUP_INTERVAL = t.cleanupInterval || 3e5;
    this.STATE_ENTRY_MAX_AGE = t.stateMaxAge || 36e5;
    this.ACTIVITY_TIMEOUT = t.activityTimeout || 3e5;
    this.lastActivityTime = Date.now();
    this.isUserActive = true;
    this.connectionHealthCheck = {
      lastHeartbeatTime: null,
      missedHeartbeats: 0,
      maxMissedHeartbeats: this.MAX_MISSED_HEARTBEATS,
      healthCheckInterval: null
    };
    this.circuitBreaker = {
      state: "closed",
      failureCount: 0,
      failureThreshold: t.circuitBreakerThreshold || 5,
      resetTimeout: t.circuitBreakerResetTimeout || 6e4,
      nextAttemptTime: null
    };
    this.messageQueue = [];
    this.maxQueueSize = t.maxQueueSize || 1e3;
    this.queuedOperations = new Map;
    this.messageBatch = [];
    this.batchSize = t.batchSize || 10;
    this.batchTimeout = t.batchTimeout || 1e3;
    this.batchTimer = null;
    this.debouncedOperations = new Map;
    this.debounceDelay = t.debounceDelay || 300;
    this.activeTasks = new Map;
    this.automationSessions = new Map;
    this.renderingJobs = new Map;
    this.analyticsStreams = new Map;
    this.aiOperations = new Map;
    this.pendingOperations = new Map;
    this.cleanupTimers = new Map;
    this.maxStateSize = t.maxStateSize || 1e4;
    this.callbacks = new Map;
    this.reconnectConfig = {
      attempts: 0,
      maxAttempts: t.maxReconnectAttempts || 10,
      initialDelay: 1e3,
      maxDelay: 3e4,
      multiplier: 1.5
    };
    this.isManuallyDisconnected = false;
    this.heartbeatInterval = null;
  }
  _detectServerUrl() {
    if (typeof window.getSolisSocketOrigin === "function") {
      return window.getSolisSocketOrigin();
    }
    try {
      const e = new URL(window.API_BASE_URL || "https://api.solisai.video/api", window.location.href);
      return `${e.protocol}//${e.host}`;
    } catch (e) {
      console.error("Invalid API_BASE_URL:", e);
      return "https://api.solisai.video";
    }
  }
  connect(e, t = null) {
    if (!e) {
      console.error("UserId required to connect");
      return false;
    }
    this.userId = e;
    this.isManuallyDisconnected = false;
    if (!t && typeof WebSocketSecurityManager !== "undefined") {
      t = new WebSocketSecurityManager;
    }
    if (!t) {
      console.error("Security manager unavailable");
      return false;
    }
    this.securityManager = t;
    this.securityManager.init(this._getAuthToken(), e);
    if (typeof io === "undefined") {
      console.error("Socket.IO not loaded");
      return false;
    }
    if (this.circuitBreaker.state === "open") {
      const t = Date.now();
      if (t < this.circuitBreaker.nextAttemptTime) {
        console.warn("Circuit breaker open, cannot connect");
        this._queueOperation("connect", {
          userId: e
        });
        return false;
      }
      this.circuitBreaker.state = "half-open";
    }
    try {
      const e = this._buildAuthConfig();
      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionDelay: this.reconnectConfig.initialDelay,
        reconnectionDelayMax: this.reconnectConfig.maxDelay,
        reconnectionAttempts: this.reconnectConfig.maxAttempts,
        transports: [ "websocket", "polling" ],
        upgrade: true,
        forceNew: true,
        rememberUpgrade: true,
        "sync disconnect on unload": true,
        autoConnect: true,
        auth: e
      });
      this._setupEventListeners();
      this._setupActivityTracking();
      this._startHeartbeat();
      this._startConnectionHealthCheck();
      this._startCleanupProcess();
      return true;
    } catch (e) {
      console.error("WebSocket connection failed:", e);
      this._handleConnectionFailure();
      return false;
    }
  }
  _buildAuthConfig() {
    const e = this._getAuthToken();
    if (!e) {
      console.warn("No authentication token available for WebSocket connection");
      return {
        token: null,
        timestamp: Date.now()
      };
    }
    if (this.securityManager && !this.securityManager.sessionIdRefreshed) {
      this.securityManager.sessionId = this.securityManager._generateSecureId();
      this.securityManager.sessionIdRefreshed = true;
    }
    return {
      token: e,
      userId: this.userId,
      timestamp: Date.now(),
      sessionId: this.securityManager?.sessionId
    };
  }
  _getAuthToken() {
    return sessionStorage.getItem("auth_token") || sessionStorage.getItem("jwt_token") || sessionStorage.getItem("access_token") || document.cookie.split("; ").find(e => e.startsWith("auth_token="))?.split("=")[1] || null;
  }
  _handleConnectionFailure() {
    this.circuitBreaker.failureCount++;
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      console.warn("Circuit breaker opened due to excessive failures");
      this.circuitBreaker.state = "open";
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.nextAttemptTime = Date.now() + this.circuitBreaker.resetTimeout;
    }
    this.securityManager?._logSecurityEvent("connection_failure", {
      failureCount: this.circuitBreaker.failureCount
    });
  }
  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        const e = Date.now() - this.lastActivityTime;
        if (e < this.ACTIVITY_TIMEOUT) {
          this.socket.emit("heartbeat", {
            timestamp: Date.now(),
            sessionId: this.securityManager?.sessionId
          });
          this.connectionHealthCheck.lastHeartbeatTime = Date.now();
        } else {
          if (this.isUserActive) {
            this.isUserActive = false;
          }
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  _startConnectionHealthCheck() {
    this._stopConnectionHealthCheck();
    this.connectionHealthCheck.healthCheckInterval = setInterval(() => {
      if (!this.socket?.connected) {
        this.connectionHealthCheck.missedHeartbeats++;
        if (this.connectionHealthCheck.missedHeartbeats >= this.MAX_MISSED_HEARTBEATS) {
          console.warn("Connection health degraded, forcing reconnect");
          this.socket?.disconnect();
          this.socket?.connect();
        }
      } else {
        this.connectionHealthCheck.missedHeartbeats = 0;
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }
  _stopConnectionHealthCheck() {
    if (this.connectionHealthCheck.healthCheckInterval) {
      clearInterval(this.connectionHealthCheck.healthCheckInterval);
      this.connectionHealthCheck.healthCheckInterval = null;
    }
  }
  _startCleanupProcess() {
    setInterval(() => {
      this._performCleanup();
    }, this.CLEANUP_INTERVAL);
  }
  _performCleanup() {
    const e = Date.now();
    this._cleanupMap(this.activeTasks, this.STATE_ENTRY_MAX_AGE, e);
    this._cleanupMap(this.automationSessions, this.STATE_ENTRY_MAX_AGE, e);
    this._cleanupMap(this.renderingJobs, this.STATE_ENTRY_MAX_AGE, e);
    this._cleanupMap(this.analyticsStreams, this.STATE_ENTRY_MAX_AGE, e);
    this._cleanupMap(this.aiOperations, this.STATE_ENTRY_MAX_AGE, e);
    this._cleanupMap(this.pendingOperations, this.STATE_ENTRY_MAX_AGE, e);
    for (const [t, s] of this.cleanupTimers) {
      if (s.createdAt && e - s.createdAt > this.STATE_ENTRY_MAX_AGE) {
        clearTimeout(s.id);
        this.cleanupTimers.delete(t);
      }
    }
  }
  _cleanupMap(e, t, s) {
    const i = [];
    for (const [a, n] of e) {
      const e = n?.timestamp || n?.startTime || s;
      if (e && s - e > t) {
        i.push(a);
      }
    }
    i.forEach(t => e.delete(t));
    if (e.size > this.maxStateSize) {
      const t = e.size - this.maxStateSize;
      let i = 0;
      const a = Array.from(e.entries()).map(([e, t]) => ({
        key: e,
        age: s - (t?.timestamp || t?.startTime || s)
      })).sort((e, t) => t.age - e.age).slice(0, t);
      a.forEach(({key: t}) => {
        e.delete(t);
        i++;
      });
      if (i > 0) {
        console.warn(`⚠️ Removed ${i} entries due to size limit`);
      }
    }
  }
  _setupEventListeners() {
    this.socket.on("connect", () => {
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.state = "closed";
      this._joinUserRoom();
      this._processQueuedMessages();
    });
    this.socket.on("disconnect", e => {
      console.warn("Disconnected from WebSocket server. Reason:", e);
    });
    this.socket.on("connect_error", e => {
      console.error("Connection error:", e);
      this._handleConnectionFailure();
    });
    this.socket.on("error", e => {
      console.error("Socket.IO error:", e);
    });
    if (this.socket.io) {
      this.socket.io.engine.on("error", e => {
        console.error("Engine.IO error (transport layer):", e);
      });
    }
    this.socket.on("processing_update", e => this._handleProgressUpdate(e));
    this.socket.on("processing_complete", e => this._handleComplete(e));
    this.socket.on("processing_error", e => this._handleError(e));
    this.socket.on("clips_status_update", e => this._emitCallback("clips_status_update", e));
    this.socket.on("video_ready", e => this._emitCallback("video_ready", e));
    this.socket.on("video_generated", e => this._emitCallback("video_generated", e));
    this.socket.on("moment_detected", e => this._emitCallback("moment_detected", e));
    this.socket.on("compilation_progress", e => this._emitCallback("compilation_progress", e));
    this.socket.on("generation_error", e => this._emitCallback("generation_error", e));
    this.socket.on("automation_update", e => this._handleAutomationUpdate(e));
    this.socket.on("automation_complete", e => this._handleAutomationComplete(e));
    this.socket.on("automation_error", e => this._handleAutomationError(e));
    this.socket.on("rendering_update", e => this._handleRenderingUpdate(e));
    this.socket.on("rendering_complete", e => this._handleRenderingComplete(e));
    this.socket.on("rendering_error", e => this._handleRenderingError(e));
    this.socket.on("analytics_update", e => this._handleAnalyticsUpdate(e));
    this.socket.on("ai_operation_update", e => this._handleAIOperationUpdate(e));
    this.socket.on("ai_operation_complete", e => this._handleAIOperationComplete(e));
    this.socket.on("ai_operation_error", e => this._handleAIOperationError(e));
    this.socket.on("batch_operations", e => this._handleBatchOperations(e));
    this.socket.on("room_joined", e => {});
    this.socket.on("clip_deleted", e => this._handleClipDeleted(e));
    this.socket.on("reconnect", () => {
      this.reconnectConfig.attempts = 0;
      this._joinUserRoom();
    });
    this.socket.on("reconnect_attempt", () => {
      this.reconnectConfig.attempts++;
    });
  }
  _setupActivityTracking() {
    const e = [ "mousedown", "keydown", "click", "touchstart" ];
    const recordActivity = () => {
      const e = !this.isUserActive;
      this.lastActivityTime = Date.now();
      this.isUserActive = true;
      if (e) {}
    };
    e.forEach(e => {
      document.addEventListener(e, recordActivity, {
        passive: true
      });
    });
    if (this.socket) {
      this.socket.on("disconnect", () => {
        e.forEach(e => {
          document.removeEventListener(e, recordActivity);
        });
      });
    }
  }
  _joinUserRoom() {
    if (this.socket?.connected && this.userId) {
      this.socket.emit("join_user_room", {
        user_id: this.userId
      });
    }
  }
  _queueOperation(e, t) {
    if (this.messageQueue.length >= this.maxQueueSize) {
      console.warn("Message queue full, dropping oldest message");
      this.messageQueue.shift();
    }
    const s = {
      operation: e,
      data: t,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3
    };
    this.messageQueue.push(s);
    this.queuedOperations.set(`${e}_${Date.now()}`, s);
  }
  _processQueuedMessages() {
    if (this.messageQueue.length === 0) return;
    while (this.messageQueue.length > 0) {
      const e = this.messageQueue.shift();
      try {
        this._executeQueuedOperation(e);
      } catch (t) {
        console.error("Error processing queued operation:", t);
        if (e.retries < e.maxRetries) {
          e.retries++;
          this.messageQueue.push(e);
        }
      }
    }
  }
  _executeQueuedOperation(e) {
    const {operation: t, data: s} = e;
    switch (t) {
     case "delete_clip":
      this.emitClipDeletion(s.itemId, s.projectId);
      break;

     case "register_task":
      this.registerTask(s.taskId, s.taskType);
      break;

     default:
      console.warn(`Unknown queued operation: ${t}`);
    }
  }
  registerTask(e, t = "processing") {
    const s = {
      id: e,
      type: t,
      startTime: Date.now(),
      timestamp: Date.now(),
      progress: 0,
      status: "started"
    };
    this.activeTasks.set(e, s);
  }
  _handleProgressUpdate(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      console.warn("Progress update failed security validation");
      return;
    }
    const {taskId: t, status: s, progress: i, step: a} = e;
    if (this.activeTasks.has(t)) {
      const e = this.activeTasks.get(t);
      e.progress = i;
      e.status = s;
      e.currentStep = a;
      e.timestamp = Date.now();
      this._emitCallback("progress", {
        taskId: t,
        progress: i,
        step: a,
        status: s
      });
    }
  }
  _handleComplete(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {taskId: t, result: s} = e;
    if (this.activeTasks.has(t)) {
      const e = this.activeTasks.get(t);
      e.status = "completed";
      e.progress = 100;
      e.result = s;
      e.timestamp = Date.now();
      this._emitCallback("complete", {
        taskId: t,
        result: s,
        duration: Date.now() - e.startTime
      });
    }
  }
  _handleError(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {taskId: t, error: s} = e;
    if (this.activeTasks.has(t)) {
      const e = this.activeTasks.get(t);
      e.status = "error";
      e.error = s;
      e.timestamp = Date.now();
      this._emitCallback("error", {
        taskId: t,
        error: s
      });
      console.error(`❌ Task error: ${t} - ${s}`);
    }
  }
  _handleClipDeleted(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      console.warn("Clip deletion failed validation");
      return;
    }
    const {itemId: t, projectId: s, timestamp: i} = e;
    this._debounce(`clip_delete_${t}`, () => {
      this._performClipDeletion(t, s, i);
    }, this.debounceDelay);
  }
  _performClipDeletion(e, t, s) {
    try {
      this.activeTasks.delete(e);
      this.automationSessions.delete(e);
      this.renderingJobs.delete(t);
      this._emitCallback("clip_deleted", {
        itemId: e,
        projectId: t,
        timestamp: s
      });
      this.securityManager?._logSecurityEvent("clip_deleted_handled", {
        itemId: e,
        projectId: t
      });
    } catch (e) {
      console.error("Error handling clip deletion:", e);
    }
  }
  _debounce(e, t, s) {
    if (this.debouncedOperations.has(e)) {
      clearTimeout(this.debouncedOperations.get(e).timerId);
    }
    const i = setTimeout(() => {
      t();
      this.debouncedOperations.delete(e);
    }, s);
    this.debouncedOperations.set(e, {
      timerId: i,
      createdAt: Date.now()
    });
  }
  _handleAutomationUpdate(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {sessionId: t, status: s, progress: i, step: a, automationType: n} = e;
    this.automationSessions.set(t, {
      id: t,
      type: n,
      status: s,
      progress: i,
      step: a,
      timestamp: Date.now()
    });
    this._emitCallback("automation_update", {
      sessionId: t,
      status: s,
      progress: i,
      step: a,
      automationType: n
    });
  }
  _handleAutomationComplete(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {sessionId: t, result: s} = e;
    if (this.automationSessions.has(t)) {
      const e = this.automationSessions.get(t);
      e.status = "completed";
      e.result = s;
      e.timestamp = Date.now();
    }
    this._emitCallback("automation_complete", {
      sessionId: t,
      result: s
    });
  }
  _handleAutomationError(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {sessionId: t, error: s} = e;
    if (this.automationSessions.has(t)) {
      const e = this.automationSessions.get(t);
      e.status = "error";
      e.error = s;
      e.timestamp = Date.now();
    }
    this._emitCallback("automation_error", {
      sessionId: t,
      error: s
    });
  }
  _handleRenderingUpdate(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {jobId: t, status: s, progress: i, currentPhase: a, framesProcessed: n, totalFrames: o} = e;
    this.renderingJobs.set(t, {
      id: t,
      status: s,
      progress: i,
      currentPhase: a,
      framesProcessed: n,
      totalFrames: o,
      timestamp: Date.now()
    });
    this._emitCallback("rendering_update", {
      jobId: t,
      status: s,
      progress: i,
      currentPhase: a,
      framesProcessed: n,
      totalFrames: o
    });
  }
  _handleRenderingComplete(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {jobId: t, outputPath: s, duration: i} = e;
    if (this.renderingJobs.has(t)) {
      const e = this.renderingJobs.get(t);
      e.status = "completed";
      e.outputPath = s;
      e.duration = i;
      e.timestamp = Date.now();
    }
    this._emitCallback("rendering_complete", {
      jobId: t,
      outputPath: s,
      duration: i
    });
  }
  _handleRenderingError(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {jobId: t, error: s, phase: i} = e;
    if (this.renderingJobs.has(t)) {
      const e = this.renderingJobs.get(t);
      e.status = "error";
      e.error = s;
      e.failedPhase = i;
      e.timestamp = Date.now();
    }
    this._emitCallback("rendering_error", {
      jobId: t,
      error: s,
      phase: i
    });
  }
  _handleAnalyticsUpdate(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {streamId: t, metrics: s, timestamp: i} = e;
    this.analyticsStreams.set(t, {
      id: t,
      metrics: s,
      timestamp: i || Date.now()
    });
    this._emitCallback("analytics_update", {
      streamId: t,
      metrics: s,
      timestamp: i
    });
  }
  _handleAIOperationUpdate(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {operationId: t, status: s, progress: i, operation: a, currentStep: n} = e;
    this.aiOperations.set(t, {
      id: t,
      status: s,
      progress: i,
      operation: a,
      currentStep: n,
      timestamp: Date.now()
    });
    this._emitCallback("ai_operation_update", {
      operationId: t,
      status: s,
      progress: i,
      operation: a,
      currentStep: n
    });
  }
  _handleAIOperationComplete(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {operationId: t, result: s, output: i} = e;
    if (this.aiOperations.has(t)) {
      const e = this.aiOperations.get(t);
      e.status = "completed";
      e.result = s;
      e.output = i;
      e.timestamp = Date.now();
    }
    this._emitCallback("ai_operation_complete", {
      operationId: t,
      result: s,
      output: i
    });
  }
  _handleAIOperationError(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {operationId: t, error: s} = e;
    if (this.aiOperations.has(t)) {
      const e = this.aiOperations.get(t);
      e.status = "error";
      e.error = s;
      e.timestamp = Date.now();
    }
    this._emitCallback("ai_operation_error", {
      operationId: t,
      error: s
    });
  }
  _handleBatchOperations(e) {
    if (!this.securityManager?.validateIncomingMessage(e)) {
      return;
    }
    const {operations: t, type: s} = e;
    if (s === "processing") {
      t.forEach(e => {
        this.activeTasks.set(e.id, {
          ...e,
          timestamp: Date.now()
        });
      });
    } else if (s === "automation") {
      t.forEach(e => {
        this.automationSessions.set(e.id, {
          ...e,
          timestamp: Date.now()
        });
      });
    } else if (s === "rendering") {
      t.forEach(e => {
        this.renderingJobs.set(e.id, {
          ...e,
          timestamp: Date.now()
        });
      });
    } else if (s === "ai_operations") {
      t.forEach(e => {
        this.aiOperations.set(e.id, {
          ...e,
          timestamp: Date.now()
        });
      });
    }
  }
  emitClipDeletion(e, t) {
    if (!this.socket?.connected) {
      this._queueOperation("delete_clip", {
        itemId: e,
        projectId: t
      });
      return false;
    }
    try {
      const s = "delete_clip";
      const i = {
        itemId: e,
        projectId: t,
        timestamp: Date.now(),
        userId: this.userId
      };
      if (!this.securityManager.validateMessage(s, i)) {
        console.warn("Message validation failed");
        return false;
      }
      const a = this.securityManager.createSecureEnvelope(s, i);
      this.socket.emit(s, a);
      return true;
    } catch (s) {
      console.error("Error emitting clip deletion:", s);
      this._queueOperation("delete_clip", {
        itemId: e,
        projectId: t
      });
      return false;
    }
  }
  registerAutomationSession(e, t) {
    if (this.socket?.connected) {
      this.socket.emit("register_automation_session", {
        session_id: e,
        automation_type: t
      });
    }
  }
  registerRenderingJob(e, t, s) {
    if (this.socket?.connected) {
      this.socket.emit("register_rendering_job", {
        job_id: e,
        project_id: t,
        ranks: s
      });
    }
  }
  registerAnalyticsStream(e, t) {
    if (this.socket?.connected) {
      this.socket.emit("register_analytics_stream", {
        stream_id: e,
        source: t
      });
    }
  }
  registerAIOperation(e, t) {
    if (this.socket?.connected) {
      this.socket.emit("register_ai_operation", {
        operation_id: e,
        operation_type: t
      });
    }
  }
  on(e, t) {
    if (!this.callbacks.has(e)) {
      this.callbacks.set(e, []);
    }
    this.callbacks.get(e).push(t);
  }
  off(e, t) {
    if (!this.callbacks.has(e)) return;
    const s = this.callbacks.get(e);
    const i = s.indexOf(t);
    if (i > -1) {
      s.splice(i, 1);
    }
  }
  _emitCallback(e, t) {
    if (!this.callbacks.has(e)) return;
    this.callbacks.get(e).forEach(s => {
      try {
        s(t);
      } catch (t) {
        console.error(`Error in ${e} callback:`, t);
      }
    });
  }
  getActiveTasks(e = 0, t = 100) {
    const s = Array.from(this.activeTasks.values());
    const i = e * t;
    const a = i + t;
    return {
      items: s.slice(i, a),
      total: s.length,
      page: e,
      pageSize: t,
      totalPages: Math.ceil(s.length / t)
    };
  }
  getActiveAutomationSessions(e = 0, t = 100) {
    const s = Array.from(this.automationSessions.values());
    const i = e * t;
    const a = i + t;
    return {
      items: s.slice(i, a),
      total: s.length,
      page: e,
      pageSize: t,
      totalPages: Math.ceil(s.length / t)
    };
  }
  getActiveRenderingJobs(e = 0, t = 100) {
    const s = Array.from(this.renderingJobs.values());
    const i = e * t;
    const a = i + t;
    return {
      items: s.slice(i, a),
      total: s.length,
      page: e,
      pageSize: t,
      totalPages: Math.ceil(s.length / t)
    };
  }
  getActiveAIOperations(e = 0, t = 100) {
    const s = Array.from(this.aiOperations.values());
    const i = e * t;
    const a = i + t;
    return {
      items: s.slice(i, a),
      total: s.length,
      page: e,
      pageSize: t,
      totalPages: Math.ceil(s.length / t)
    };
  }
  getAnalyticsStreams(e = 0, t = 100) {
    const s = Array.from(this.analyticsStreams.values());
    const i = e * t;
    const a = i + t;
    return {
      items: s.slice(i, a),
      total: s.length,
      page: e,
      pageSize: t,
      totalPages: Math.ceil(s.length / t)
    };
  }
  isConnected() {
    return this.socket?.connected || false;
  }
  getConnectionStatus() {
    return {
      connected: this.isConnected(),
      userId: this.userId,
      circuitBreakerState: this.circuitBreaker.state,
      queuedMessages: this.messageQueue.length,
      reconnectAttempts: this.reconnectConfig.attempts,
      activeTasks: this.activeTasks.size,
      activeAutomation: this.automationSessions.size
    };
  }
  disconnect() {
    this.isManuallyDisconnected = true;
    this._stopHeartbeat();
    this._stopConnectionHealthCheck();
    if (this.socket) {
      this.socket.disconnect();
    }
    this.activeTasks.clear();
    this.automationSessions.clear();
    this.renderingJobs.clear();
    this.analyticsStreams.clear();
    this.aiOperations.clear();
    this.pendingOperations.clear();
    this.messageQueue = [];
    this.debouncedOperations.clear();
    this.securityManager?.destroy();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SolisAIWebSocketClient;
}

if (typeof window !== "undefined") {
  window.SolisAIWebSocketClient = SolisAIWebSocketClient;
}
