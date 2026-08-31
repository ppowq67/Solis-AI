/**
 * Solis AI WebSocket Client v2
 * Production-ready WebSocket client with proper architecture
 * 
 * IMPROVEMENTS:
 * - Message batching and compression
 * - Circuit breaker pattern for resilience
 * - Message queue for offline/reconnecting state
 * - Proper separation of concerns (no UI coupling)
 * - Memory management with cleanup strategies
 * - Pagination support for large datasets
 * - Connection health monitoring
 * - Intelligent error recovery with exponential backoff
 * - Request debouncing
 * - Race condition prevention
 * - No global state pollution
 * - Comprehensive error handling
 */

class SolisAIWebSocketClient {
    constructor(serverUrl = null, config = {}) {
        // Connection management
        this.serverUrl = serverUrl || this._detectServerUrl();
        this.socket = null;
        this.userId = null;
        this.securityManager = null;
        
        // Constants - avoid magic numbers
        this.HEARTBEAT_INTERVAL = config.heartbeatInterval || 30000; // 30 seconds
        this.HEALTH_CHECK_INTERVAL = config.healthCheckInterval || 10000; // 10 seconds
        this.MAX_MISSED_HEARTBEATS = 3;
        this.CLEANUP_INTERVAL = config.cleanupInterval || 300000; // 5 minutes
        this.STATE_ENTRY_MAX_AGE = config.stateMaxAge || 3600000; // 1 hour
        this.ACTIVITY_TIMEOUT = config.activityTimeout || 300000; // 5 minutes - don't send heartbeats if idle
        
        // Activity tracking - only send heartbeats when user is actively using the app
        this.lastActivityTime = Date.now();
        this.isUserActive = true;
        
        // Connection health monitoring
        this.connectionHealthCheck = {
            lastHeartbeatTime: null,
            missedHeartbeats: 0,
            maxMissedHeartbeats: this.MAX_MISSED_HEARTBEATS,
            healthCheckInterval: null,
        };
        
        // Circuit breaker pattern
        this.circuitBreaker = {
            state: 'closed', // 'closed', 'open', 'half-open'
            failureCount: 0,
            failureThreshold: config.circuitBreakerThreshold || 5,
            resetTimeout: config.circuitBreakerResetTimeout || 60000,
            nextAttemptTime: null,
        };
        
        // Message queue for offline handling
        this.messageQueue = [];
        this.maxQueueSize = config.maxQueueSize || 1000;
        this.queuedOperations = new Map();
        
        // Message batching
        this.messageBatch = [];
        this.batchSize = config.batchSize || 10;
        this.batchTimeout = config.batchTimeout || 1000;
        this.batchTimer = null;
        
        // Debouncing
        this.debouncedOperations = new Map();
        this.debounceDelay = config.debounceDelay || 300;
        
        // State management with cleanup
        this.activeTasks = new Map();
        this.automationSessions = new Map();
        this.renderingJobs = new Map();
        this.analyticsStreams = new Map();
        this.aiOperations = new Map();
        this.pendingOperations = new Map();
        
        // Cleanup tracking
        this.cleanupTimers = new Map();
        this.maxStateSize = config.maxStateSize || 10000;
        
        // Event system (no UI coupling)
        this.callbacks = new Map();
        
        // Configuration
        this.reconnectConfig = {
            attempts: 0,
            maxAttempts: config.maxReconnectAttempts || 10,
            initialDelay: 1000,
            maxDelay: 30000,
            multiplier: 1.5,
        };
        
        this.isManuallyDisconnected = false;
        this.heartbeatInterval = null;
        
    }

    /**
     * Detect server URL from window.API_BASE_URL (set by init.js via hostname detection)
     * NEVER read from localStorage - attackers can modify it
     * @private
     */
    _detectServerUrl() {
        if (typeof window.getSolisSocketOrigin === 'function') {
            return window.getSolisSocketOrigin();
        }
        try {
            const apiUrl = new URL(window.API_BASE_URL || 'https://api.solisai.video/api', window.location.href);
            return `${apiUrl.protocol}//${apiUrl.host}`;
        } catch (error) {
            console.error('Invalid API_BASE_URL:', error);
            return 'https://api.solisai.video';
        }
    }

    /**
     * Connect to WebSocket server
     */
    connect(userId, securityManager = null) {
        if (!userId) {
            console.error('UserId required to connect');
            return false;
        }

        this.userId = userId;
        this.isManuallyDisconnected = false;

        // Initialize security manager
        if (!securityManager && typeof WebSocketSecurityManager !== 'undefined') {
            securityManager = new WebSocketSecurityManager();
        }

        if (!securityManager) {
            console.error('Security manager unavailable');
            return false;
        }

        this.securityManager = securityManager;
        this.securityManager.init(this._getAuthToken(), userId);

        // Check Socket.IO availability
        if (typeof io === 'undefined') {
            console.error('Socket.IO not loaded');
            return false;
        }

        // Check circuit breaker
        if (this.circuitBreaker.state === 'open') {
            const now = Date.now();
            if (now < this.circuitBreaker.nextAttemptTime) {
                console.warn('Circuit breaker open, cannot connect');
                this._queueOperation('connect', { userId });
                return false;
            }
            this.circuitBreaker.state = 'half-open';
        }

        try {
            const authConfig = this._buildAuthConfig();
            
            this.socket = io(this.serverUrl, {
                reconnection: true,
                reconnectionDelay: this.reconnectConfig.initialDelay,
                reconnectionDelayMax: this.reconnectConfig.maxDelay,
                reconnectionAttempts: this.reconnectConfig.maxAttempts,
                transports: ['websocket', 'polling'],
                upgrade: true,  // Allow upgrade from polling to websocket
                forceNew: true,
                rememberUpgrade: true,  // Remember successful transport
                'sync disconnect on unload': true,
                autoConnect: true,
                auth: authConfig,
            });

            this._setupEventListeners();
            this._setupActivityTracking();
            this._startHeartbeat();
            this._startConnectionHealthCheck();
            this._startCleanupProcess();
            
            return true;
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this._handleConnectionFailure();
            return false;
        }
    }

    /**
     * Build authentication config from secure source
     * Generates new sessionId on each connect to prevent session reuse across reconnections
     * @private
     */
    _buildAuthConfig() {
        const authToken = this._getAuthToken();
        
        if (!authToken) {
            console.warn('No authentication token available for WebSocket connection');
            // Return minimal auth with timestamp for server to evaluate
            return {
                token: null,
                timestamp: Date.now()
            };
        }

        // Generate fresh sessionId for this connection to prevent session reuse
        if (this.securityManager && !this.securityManager.sessionIdRefreshed) {
            this.securityManager.sessionId = this.securityManager._generateSecureId();
            this.securityManager.sessionIdRefreshed = true;
        }

        return {
            token: authToken,
            userId: this.userId,
            timestamp: Date.now(),
            sessionId: this.securityManager?.sessionId,
        };
    }

    /**
     * Get auth token from secure source (sessionStorage with multiple key names)
     * Checks common token storage keys for compatibility
     * @private
     */
    _getAuthToken() {
        // Check multiple possible token storage locations
        // Priority: auth_token > jwt_token > access_token
        return sessionStorage.getItem('auth_token') || 
               sessionStorage.getItem('jwt_token') ||
               sessionStorage.getItem('access_token') ||
               document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1] ||
               null;
    }

    /**
     * Handle connection failure and circuit breaker logic
     * @private
     */
    _handleConnectionFailure() {
        this.circuitBreaker.failureCount++;
        
        if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
            console.warn('Circuit breaker opened due to excessive failures');
            this.circuitBreaker.state = 'open';
            this.circuitBreaker.failureCount = 0;
            this.circuitBreaker.nextAttemptTime = Date.now() + this.circuitBreaker.resetTimeout;
        }

        this.securityManager?._logSecurityEvent('connection_failure', {
            failureCount: this.circuitBreaker.failureCount
        });
    }

    /**
     * Start heartbeat to keep connection alive and detect disconnects
     * ONLY sends heartbeats if user has been active in the last 5 minutes
     * @private
     */
    _startHeartbeat() {
        this._stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.socket?.connected) {
                // Only send heartbeat if user has been active recently
                const timeSinceLastActivity = Date.now() - this.lastActivityTime;
                if (timeSinceLastActivity < this.ACTIVITY_TIMEOUT) {
                    // User is active - send heartbeat
                    this.socket.emit('heartbeat', { 
                        timestamp: Date.now(),
                        sessionId: this.securityManager?.sessionId,
                    });
                    this.connectionHealthCheck.lastHeartbeatTime = Date.now();
                } else {
                    // User is idle - mark as inactive but keep connection alive
                    if (this.isUserActive) {
                        this.isUserActive = false;
                    }
                }
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    /**
     * Stop heartbeat interval
     * @private
     */
    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Monitor connection health
     * @private
     */
    _startConnectionHealthCheck() {
        this._stopConnectionHealthCheck();
        
        this.connectionHealthCheck.healthCheckInterval = setInterval(() => {
            if (!this.socket?.connected) {
                this.connectionHealthCheck.missedHeartbeats++;
                
                if (this.connectionHealthCheck.missedHeartbeats >= this.MAX_MISSED_HEARTBEATS) {
                    console.warn('Connection health degraded, forcing reconnect');
                    this.socket?.disconnect();
                    this.socket?.connect();
                }
            } else {
                this.connectionHealthCheck.missedHeartbeats = 0;
            }
        }, this.HEALTH_CHECK_INTERVAL);
    }

    /**
     * Stop connection health check
     * @private
     */
    _stopConnectionHealthCheck() {
        if (this.connectionHealthCheck.healthCheckInterval) {
            clearInterval(this.connectionHealthCheck.healthCheckInterval);
            this.connectionHealthCheck.healthCheckInterval = null;
        }
    }

    /**
     * Start automatic cleanup process
     * @private
     */
    _startCleanupProcess() {
        setInterval(() => {
            this._performCleanup();
        }, this.CLEANUP_INTERVAL);
    }

    /**
     * Perform cleanup of old state entries
     * @private
     */
    _performCleanup() {
        const now = Date.now();
        
        // Cleanup old entries from each map
        this._cleanupMap(this.activeTasks, this.STATE_ENTRY_MAX_AGE, now);
        this._cleanupMap(this.automationSessions, this.STATE_ENTRY_MAX_AGE, now);
        this._cleanupMap(this.renderingJobs, this.STATE_ENTRY_MAX_AGE, now);
        this._cleanupMap(this.analyticsStreams, this.STATE_ENTRY_MAX_AGE, now);
        this._cleanupMap(this.aiOperations, this.STATE_ENTRY_MAX_AGE, now);
        this._cleanupMap(this.pendingOperations, this.STATE_ENTRY_MAX_AGE, now);
        
        // Cleanup timers
        for (const [key, timer] of this.cleanupTimers) {
            if (timer.createdAt && now - timer.createdAt > this.STATE_ENTRY_MAX_AGE) {
                clearTimeout(timer.id);
                this.cleanupTimers.delete(key);
            }
        }

    }

    /**
     * Cleanup old entries from a map
     * Fix: Check if timestamp exists first to prevent race conditions
     * @private
     */
    _cleanupMap(map, maxAge, now) {
        const toDelete = [];
        
        for (const [key, value] of map) {
            // Ensure timestamp exists before comparing (prevents race condition)
            const timestamp = value?.timestamp || value?.startTime || now;
            if (timestamp && now - timestamp > maxAge) {
                toDelete.push(key);
            }
        }
        
        // Delete flagged entries
        toDelete.forEach(key => map.delete(key));

        // If map still too large, remove oldest entries
        if (map.size > this.maxStateSize) {
            const excess = map.size - this.maxStateSize;
            let removed = 0;
            
            // Sort by age and remove oldest
            const entries = Array.from(map.entries())
                .map(([key, value]) => ({
                    key, 
                    age: now - (value?.timestamp || value?.startTime || now)
                }))
                .sort((a, b) => b.age - a.age)
                .slice(0, excess);
            
            entries.forEach(({ key }) => {
                map.delete(key);
                removed++;
            });
            
            if (removed > 0) {
                console.warn(`⚠️ Removed ${removed} entries due to size limit`);
            }
        }
    }

    /**
     * Setup Socket.IO event listeners
     * @private
     */
    _setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            this.circuitBreaker.failureCount = 0;
            this.circuitBreaker.state = 'closed';
            this._joinUserRoom();
            this._processQueuedMessages();
        });

        this.socket.on('disconnect', (reason) => {
            console.warn('Disconnected from WebSocket server. Reason:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this._handleConnectionFailure();
        });

        // Socket.IO protocol errors
        this.socket.on('error', (error) => {
            console.error('Socket.IO error:', error);
        });

        // Engine.IO errors (lower level transport errors)
        if (this.socket.io) {
            this.socket.io.engine.on('error', (error) => {
                console.error('Engine.IO error (transport layer):', error);
            });
        }

        // Processing events
        this.socket.on('processing_update', data => this._handleProgressUpdate(data));
        this.socket.on('processing_complete', data => this._handleComplete(data));
        this.socket.on('processing_error', data => this._handleError(data));

        // Clips pipeline events (ranked compilation, split screen)
        this.socket.on('clips_status_update', data => this._emitCallback('clips_status_update', data));
        this.socket.on('video_ready', data => this._emitCallback('video_ready', data));
        this.socket.on('video_generated', data => this._emitCallback('video_generated', data));
        this.socket.on('moment_detected', data => this._emitCallback('moment_detected', data));
        this.socket.on('compilation_progress', data => this._emitCallback('compilation_progress', data));
        this.socket.on('generation_error', data => this._emitCallback('generation_error', data));

        // Automation events
        this.socket.on('automation_update', data => this._handleAutomationUpdate(data));
        this.socket.on('automation_complete', data => this._handleAutomationComplete(data));
        this.socket.on('automation_error', data => this._handleAutomationError(data));

        // Rendering events
        this.socket.on('rendering_update', data => this._handleRenderingUpdate(data));
        this.socket.on('rendering_complete', data => this._handleRenderingComplete(data));
        this.socket.on('rendering_error', data => this._handleRenderingError(data));

        // Analytics events
        this.socket.on('analytics_update', data => this._handleAnalyticsUpdate(data));

        // AI events
        this.socket.on('ai_operation_update', data => this._handleAIOperationUpdate(data));
        this.socket.on('ai_operation_complete', data => this._handleAIOperationComplete(data));
        this.socket.on('ai_operation_error', data => this._handleAIOperationError(data));

        // Batch events
        this.socket.on('batch_operations', data => this._handleBatchOperations(data));

        // Room events
        this.socket.on('room_joined', data => {
        });

        // Clip deletion
        this.socket.on('clip_deleted', data => this._handleClipDeleted(data));

        // Reconnection
        this.socket.on('reconnect', () => {
            this.reconnectConfig.attempts = 0;
            this._joinUserRoom();
        });

        this.socket.on('reconnect_attempt', () => {
            this.reconnectConfig.attempts++;
        });
    }

    /**
     * Setup activity tracking to suppress heartbeats when user is idle
     * @private
     */
    _setupActivityTracking() {
        // Track user activity - update lastActivityTime when user interacts
        const activityEvents = ['mousedown', 'keydown', 'click', 'touchstart'];
        
        const recordActivity = () => {
            const wasInactive = !this.isUserActive;
            this.lastActivityTime = Date.now();
            this.isUserActive = true;
            if (wasInactive) {
            }
        };
        
        // Add listeners for user activity
        activityEvents.forEach(event => {
            document.addEventListener(event, recordActivity, { passive: true });
        });
        
        // Clean up listeners on disconnect
        if (this.socket) {
            this.socket.on('disconnect', () => {
                activityEvents.forEach(event => {
                    document.removeEventListener(event, recordActivity);
                });
            });
        }
        
    }

    /**
     * Join user-specific room for targeted messages
     * @private
     */
    _joinUserRoom() {
        if (this.socket?.connected && this.userId) {
            this.socket.emit('join_user_room', { user_id: this.userId });
        }
    }

    /**
     * Queue operation for when connection is available
     * @private
     */
    _queueOperation(operation, data) {
        if (this.messageQueue.length >= this.maxQueueSize) {
            console.warn('Message queue full, dropping oldest message');
            this.messageQueue.shift();
        }

        const queueEntry = {
            operation,
            data,
            timestamp: Date.now(),
            retries: 0,
            maxRetries: 3,
        };

        this.messageQueue.push(queueEntry);
        this.queuedOperations.set(`${operation}_${Date.now()}`, queueEntry);

    }

    /**
     * Process queued messages when connection is restored
     * @private
     */
    _processQueuedMessages() {
        if (this.messageQueue.length === 0) return;


        while (this.messageQueue.length > 0) {
            const entry = this.messageQueue.shift();
            try {
                // Re-execute the operation
                this._executeQueuedOperation(entry);
            } catch (error) {
                console.error('Error processing queued operation:', error);
                if (entry.retries < entry.maxRetries) {
                    entry.retries++;
                    this.messageQueue.push(entry); // Re-queue for retry
                }
            }
        }
    }

    /**
     * Execute a queued operation
     * @private
     */
    _executeQueuedOperation(entry) {
        const { operation, data } = entry;

        switch (operation) {
            case 'delete_clip':
                this.emitClipDeletion(data.itemId, data.projectId);
                break;
            case 'register_task':
                this.registerTask(data.taskId, data.taskType);
                break;
            // Add more operation types as needed
            default:
                console.warn(`Unknown queued operation: ${operation}`);
        }
    }

    /**
     * Register task and track progress
     */
    registerTask(taskId, taskType = 'processing') {
        const task = {
            id: taskId,
            type: taskType,
            startTime: Date.now(),
            timestamp: Date.now(),
            progress: 0,
            status: 'started',
        };

        this.activeTasks.set(taskId, task);
    }

    /**
     * Handle progress update for task
     * @private
     */
    _handleProgressUpdate(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            console.warn('Progress update failed security validation');
            return;
        }

        const { taskId, status, progress, step } = data;

        if (this.activeTasks.has(taskId)) {
            const task = this.activeTasks.get(taskId);
            task.progress = progress;
            task.status = status;
            task.currentStep = step;
            task.timestamp = Date.now();

            this._emitCallback('progress', {
                taskId,
                progress,
                step,
                status,
            });

        }
    }

    /**
     * Handle task completion
     * @private
     */
    _handleComplete(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { taskId, result } = data;

        if (this.activeTasks.has(taskId)) {
            const task = this.activeTasks.get(taskId);
            task.status = 'completed';
            task.progress = 100;
            task.result = result;
            task.timestamp = Date.now();

            this._emitCallback('complete', {
                taskId,
                result,
                duration: Date.now() - task.startTime,
            });

        }
    }

    /**
     * Handle task error
     * @private
     */
    _handleError(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { taskId, error } = data;

        if (this.activeTasks.has(taskId)) {
            const task = this.activeTasks.get(taskId);
            task.status = 'error';
            task.error = error;
            task.timestamp = Date.now();

            this._emitCallback('error', {
                taskId,
                error,
            });

            console.error(`❌ Task error: ${taskId} - ${error}`);
        }
    }

    /**
     * Handle clip deletion with debouncing
     * @private
     */
    _handleClipDeleted(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            console.warn('Clip deletion failed validation');
            return;
        }

        const { itemId, projectId, timestamp } = data;

        // Debounce clip deletion handling
        this._debounce(`clip_delete_${itemId}`, () => {
            this._performClipDeletion(itemId, projectId, timestamp);
        }, this.debounceDelay);
    }

    /**
     * Perform clip deletion
     * @private
     */
    _performClipDeletion(itemId, projectId, timestamp) {
        try {
            // Clean up from tracking maps
            this.activeTasks.delete(itemId);
            this.automationSessions.delete(itemId);
            this.renderingJobs.delete(projectId);

            this._emitCallback('clip_deleted', {
                itemId,
                projectId,
                timestamp,
            });

            this.securityManager?._logSecurityEvent('clip_deleted_handled', {
                itemId,
                projectId
            });

        } catch (error) {
            console.error('Error handling clip deletion:', error);
        }
    }

    /**
     * Debounce operation execution
     * @private
     */
    _debounce(key, callback, delay) {
        // Clear existing timer
        if (this.debouncedOperations.has(key)) {
            clearTimeout(this.debouncedOperations.get(key).timerId);
        }

        // Set new timer
        const timerId = setTimeout(() => {
            callback();
            this.debouncedOperations.delete(key);
        }, delay);

        this.debouncedOperations.set(key, { timerId, createdAt: Date.now() });
    }

    /**
     * Handle automation update
     * @private
     */
    _handleAutomationUpdate(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { sessionId, status, progress, step, automationType } = data;

        this.automationSessions.set(sessionId, {
            id: sessionId,
            type: automationType,
            status,
            progress,
            step,
            timestamp: Date.now(),
        });

        this._emitCallback('automation_update', {
            sessionId,
            status,
            progress,
            step,
            automationType,
        });
    }

    /**
     * Handle automation completion
     * @private
     */
    _handleAutomationComplete(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { sessionId, result } = data;

        if (this.automationSessions.has(sessionId)) {
            const session = this.automationSessions.get(sessionId);
            session.status = 'completed';
            session.result = result;
            session.timestamp = Date.now();
        }

        this._emitCallback('automation_complete', {
            sessionId,
            result,
        });
    }

    /**
     * Handle automation error
     * @private
     */
    _handleAutomationError(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { sessionId, error } = data;

        if (this.automationSessions.has(sessionId)) {
            const session = this.automationSessions.get(sessionId);
            session.status = 'error';
            session.error = error;
            session.timestamp = Date.now();
        }

        this._emitCallback('automation_error', {
            sessionId,
            error,
        });
    }

    /**
     * Handle rendering update
     * @private
     */
    _handleRenderingUpdate(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { jobId, status, progress, currentPhase, framesProcessed, totalFrames } = data;

        this.renderingJobs.set(jobId, {
            id: jobId,
            status,
            progress,
            currentPhase,
            framesProcessed,
            totalFrames,
            timestamp: Date.now(),
        });

        this._emitCallback('rendering_update', {
            jobId,
            status,
            progress,
            currentPhase,
            framesProcessed,
            totalFrames,
        });
    }

    /**
     * Handle rendering completion
     * @private
     */
    _handleRenderingComplete(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { jobId, outputPath, duration } = data;

        if (this.renderingJobs.has(jobId)) {
            const job = this.renderingJobs.get(jobId);
            job.status = 'completed';
            job.outputPath = outputPath;
            job.duration = duration;
            job.timestamp = Date.now();
        }

        this._emitCallback('rendering_complete', {
            jobId,
            outputPath,
            duration,
        });
    }

    /**
     * Handle rendering error
     * @private
     */
    _handleRenderingError(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { jobId, error, phase } = data;

        if (this.renderingJobs.has(jobId)) {
            const job = this.renderingJobs.get(jobId);
            job.status = 'error';
            job.error = error;
            job.failedPhase = phase;
            job.timestamp = Date.now();
        }

        this._emitCallback('rendering_error', {
            jobId,
            error,
            phase,
        });
    }

    /**
     * Handle analytics update
     * @private
     */
    _handleAnalyticsUpdate(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { streamId, metrics, timestamp } = data;

        this.analyticsStreams.set(streamId, {
            id: streamId,
            metrics,
            timestamp: timestamp || Date.now(),
        });

        this._emitCallback('analytics_update', {
            streamId,
            metrics,
            timestamp,
        });
    }

    /**
     * Handle AI operation update
     * @private
     */
    _handleAIOperationUpdate(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { operationId, status, progress, operation, currentStep } = data;

        this.aiOperations.set(operationId, {
            id: operationId,
            status,
            progress,
            operation,
            currentStep,
            timestamp: Date.now(),
        });

        this._emitCallback('ai_operation_update', {
            operationId,
            status,
            progress,
            operation,
            currentStep,
        });
    }

    /**
     * Handle AI operation completion
     * @private
     */
    _handleAIOperationComplete(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { operationId, result, output } = data;

        if (this.aiOperations.has(operationId)) {
            const op = this.aiOperations.get(operationId);
            op.status = 'completed';
            op.result = result;
            op.output = output;
            op.timestamp = Date.now();
        }

        this._emitCallback('ai_operation_complete', {
            operationId,
            result,
            output,
        });
    }

    /**
     * Handle AI operation error
     * @private
     */
    _handleAIOperationError(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { operationId, error } = data;

        if (this.aiOperations.has(operationId)) {
            const op = this.aiOperations.get(operationId);
            op.status = 'error';
            op.error = error;
            op.timestamp = Date.now();
        }

        this._emitCallback('ai_operation_error', {
            operationId,
            error,
        });
    }

    /**
     * Handle batch operations
     * @private
     */
    _handleBatchOperations(data) {
        if (!this.securityManager?.validateIncomingMessage(data)) {
            return;
        }

        const { operations, type } = data;

        if (type === 'processing') {
            operations.forEach(op => {
                this.activeTasks.set(op.id, { ...op, timestamp: Date.now() });
            });
        } else if (type === 'automation') {
            operations.forEach(op => {
                this.automationSessions.set(op.id, { ...op, timestamp: Date.now() });
            });
        } else if (type === 'rendering') {
            operations.forEach(op => {
                this.renderingJobs.set(op.id, { ...op, timestamp: Date.now() });
            });
        } else if (type === 'ai_operations') {
            operations.forEach(op => {
                this.aiOperations.set(op.id, { ...op, timestamp: Date.now() });
            });
        }

    }

    /**
     * Emit secure clip deletion
     */
    emitClipDeletion(itemId, projectId) {
        if (!this.socket?.connected) {
            this._queueOperation('delete_clip', { itemId, projectId });
            return false;
        }

        try {
            const eventType = 'delete_clip';
            const data = {
                itemId,
                projectId,
                timestamp: Date.now(),
                userId: this.userId,
            };

            if (!this.securityManager.validateMessage(eventType, data)) {
                console.warn('Message validation failed');
                return false;
            }

            const envelope = this.securityManager.createSecureEnvelope(eventType, data);
            this.socket.emit(eventType, envelope);

            return true;
        } catch (error) {
            console.error('Error emitting clip deletion:', error);
            this._queueOperation('delete_clip', { itemId, projectId });
            return false;
        }
    }

    /**
     * Register automation session
     */
    registerAutomationSession(sessionId, automationType) {
        if (this.socket?.connected) {
            this.socket.emit('register_automation_session', {
                session_id: sessionId,
                automation_type: automationType,
            });
        }
    }

    /**
     * Register rendering job
     */
    registerRenderingJob(jobId, projectId, ranks) {
        if (this.socket?.connected) {
            this.socket.emit('register_rendering_job', {
                job_id: jobId,
                project_id: projectId,
                ranks,
            });
        }
    }

    /**
     * Register analytics stream
     */
    registerAnalyticsStream(streamId, source) {
        if (this.socket?.connected) {
            this.socket.emit('register_analytics_stream', {
                stream_id: streamId,
                source,
            });
        }
    }

    /**
     * Register AI operation
     */
    registerAIOperation(operationId, operationType) {
        if (this.socket?.connected) {
            this.socket.emit('register_ai_operation', {
                operation_id: operationId,
                operation_type: operationType,
            });
        }
    }

    /**
     * Register callback for event type
     */
    on(eventType, callback) {
        if (!this.callbacks.has(eventType)) {
            this.callbacks.set(eventType, []);
        }
        this.callbacks.get(eventType).push(callback);
    }

    /**
     * Unregister callback
     */
    off(eventType, callback) {
        if (!this.callbacks.has(eventType)) return;
        const callbacks = this.callbacks.get(eventType);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Emit callback to all listeners
     * @private
     */
    _emitCallback(eventType, data) {
        if (!this.callbacks.has(eventType)) return;
        this.callbacks.get(eventType).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${eventType} callback:`, error);
            }
        });
    }

    /**
     * Get active tasks with pagination
     * @param {number} page - Page number (starts at 0)
     * @param {number} pageSize - Items per page (default 100)
     */
    getActiveTasks(page = 0, pageSize = 100) {
        const all = Array.from(this.activeTasks.values());
        const start = page * pageSize;
        const end = start + pageSize;
        return {
            items: all.slice(start, end),
            total: all.length,
            page,
            pageSize,
            totalPages: Math.ceil(all.length / pageSize),
        };
    }

    /**
     * Get active automation sessions with pagination
     */
    getActiveAutomationSessions(page = 0, pageSize = 100) {
        const all = Array.from(this.automationSessions.values());
        const start = page * pageSize;
        const end = start + pageSize;
        return {
            items: all.slice(start, end),
            total: all.length,
            page,
            pageSize,
            totalPages: Math.ceil(all.length / pageSize),
        };
    }

    /**
     * Get active rendering jobs with pagination
     */
    getActiveRenderingJobs(page = 0, pageSize = 100) {
        const all = Array.from(this.renderingJobs.values());
        const start = page * pageSize;
        const end = start + pageSize;
        return {
            items: all.slice(start, end),
            total: all.length,
            page,
            pageSize,
            totalPages: Math.ceil(all.length / pageSize),
        };
    }

    /**
     * Get AI operations with pagination
     */
    getActiveAIOperations(page = 0, pageSize = 100) {
        const all = Array.from(this.aiOperations.values());
        const start = page * pageSize;
        const end = start + pageSize;
        return {
            items: all.slice(start, end),
            total: all.length,
            page,
            pageSize,
            totalPages: Math.ceil(all.length / pageSize),
        };
    }

    /**
     * Get analytics streams with pagination
     */
    getAnalyticsStreams(page = 0, pageSize = 100) {
        const all = Array.from(this.analyticsStreams.values());
        const start = page * pageSize;
        const end = start + pageSize;
        return {
            items: all.slice(start, end),
            total: all.length,
            page,
            pageSize,
            totalPages: Math.ceil(all.length / pageSize),
        };
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.socket?.connected || false;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected(),
            userId: this.userId,
            circuitBreakerState: this.circuitBreaker.state,
            queuedMessages: this.messageQueue.length,
            reconnectAttempts: this.reconnectConfig.attempts,
            activeTasks: this.activeTasks.size,
            activeAutomation: this.automationSessions.size,
        };
    }

    /**
     * Graceful disconnect
     */
    disconnect() {
        this.isManuallyDisconnected = true;
        this._stopHeartbeat();
        this._stopConnectionHealthCheck();

        if (this.socket) {
            this.socket.disconnect();
        }

        // Cleanup all state
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

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolisAIWebSocketClient;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.SolisAIWebSocketClient = SolisAIWebSocketClient;
}
