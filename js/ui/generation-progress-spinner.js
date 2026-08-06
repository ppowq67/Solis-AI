const GENERATION_TASK_PIPELINES = {
    ranked_compilation: [
        { id: 'wait', label: 'Free queue · Processing soon', keywords: ['queued', 'queue', 'ahead of you', 'open slot', 'starting shortly', 'free queue', 'priority', 'processing soon'] },
        { id: 'install', label: 'Installing video', keywords: ['download', 'installing', 'preparing download', 'starting generation'] },
        { id: 'clip', label: 'Clipping moments', keywords: ['moment', 'detect', 'segment', 'highlight', 'analyz', 'clip', 'extract', 'audio', 'finding'] },
        { id: 'overlay', label: 'Overlaying ranking', keywords: ['overlay', 'ranking', 'title', 'progressive'] },
        { id: 'compile', label: 'Compiling video', keywords: ['compil', 'touch', 'custom', 'watermark', '9:16', 'vertical', 'finaliz'] },
        { id: 'export', label: 'Exporting', keywords: ['exporting video', 'encoding final'] },
    ],
    splitscreen: [
        { id: 'wait', label: 'Free queue · Processing soon', keywords: ['queued', 'queue', 'ahead of you', 'open slot', 'starting shortly', 'free queue', 'priority', 'processing soon'] },
        { id: 'install', label: 'Installing video', keywords: ['download', 'installing', 'preparing download', 'starting generation'] },
        { id: 'moment', label: 'Finding best moment', keywords: ['moment', 'audio', 'analyz', 'finding', 'extract', '30-second', '30 second', 'adaptive'] },
        { id: 'secondary', label: 'Preparing secondary panel', keywords: ['reframe', 'face', 'gameplay', 'minecraft', 'layout', 'secondary', 'panel'] },
        { id: 'compose', label: 'Building split screen', keywords: ['split-screen', 'split screen', 'compos', 'stack', 'creating split'] },
        { id: 'export', label: 'Exporting', keywords: ['exporting video', 'encoding final'] },
    ],
    library_apply: [
        { id: 'apply', label: 'Applying changes', keywords: ['apply', 'applying', 'recompose', 'layout', 'changes', 'reframe', 'split'] },
        { id: 'download', label: 'Downloading', keywords: ['download', 'export', 'saving', 'ready'] },
    ],
};

const DEFAULT_PIPELINE_TEMPLATE = 'ranked_compilation';

const ACTIVE_GENERATION_STATUSES = new Set(['queued', 'downloading', 'processing']);

class GenerationProgressSpinner {
    constructor() {
        this.wrapper = document.getElementById('generationProgressWrapper');
        this.launcher = document.getElementById('generationLauncher');
        this.progressCircle = document.getElementById('progressCircle');
        this.progressText = document.getElementById('generationProgressText');
        this.progressCheck = document.getElementById('generationProgressCheck');
        this.progressTooltip = document.getElementById('generationProgressTooltip');
        this.todoPanel = document.getElementById('generationTodoPanel');
        this.todoList = document.getElementById('generationTodoList');
        this.taskCounter = document.getElementById('generationTaskCounter');
        this.errorBanner = document.getElementById('generationErrorBanner');

        this.activeGenerations = new Map();
        this._projectAliases = new Map();
        this.generatingCount = 0;
        this.tasksInitialized = false;
        this.tasksIntroPlayed = false;
        this._introRevealTimers = [];
        this.panelOpen = false;
        this.currentTaskIndex = -1;
        this.completedTaskCount = 0;
        this.serverSyncDone = false;
        this.optimisticPending = false;
        this._syncRetryAttempt = 0;
        this._syncRetryMax = 5;
        this._userCancelledIds = new Set();
        this._lastKnownProjectId = null;

        this.CIRCLE_CIRCUMFERENCE = 126;
        this.STORAGE_KEY = 'solisAI_activeGenerations';
        this.TEMPLATE_META_KEY = 'solisAI_generationTemplateMeta';
        this.GENERATING_COUNT_KEY = 'solisAI_generatingCount';
        this.activeTemplateId = DEFAULT_PIPELINE_TEMPLATE;
        this.activeTemplateOptions = {};
        this.POLLING_INTERVAL = 4500; // HTTP backup only — WS carries live progress
        this.POLLING_INTERVAL_WS = 12000; // slower when socket is healthy
        this.WS_FRESH_MS = 10000; // skip HTTP if WS updated this job recently
        this.pollingTimer = null;
        this.wsHandlersSetup = false;
        this._completionHandled = false;
        this._errorDismissTimer = null;
        this._libraryRefreshQueued = false;
        this.showQueueWaitTask = false;

        this._ensureDomRefs();
        this._bindPanelEvents();
        this._restoreFromLocalStorageImmediate();
        this.startPolling();

        if (typeof solisWSClient !== 'undefined' && solisWSClient !== null) {
            this.setupWebSocketHandlers();
        }

        setTimeout(() => {
            if (typeof solisWSClient !== 'undefined' && solisWSClient !== null && !this.wsHandlersSetup) {
                this.setupWebSocketHandlers();
            }
        }, 1000);

        this._scheduleServerSync();
    }

    _ensureDomRefs() {
        if (!this.wrapper) this.wrapper = document.getElementById('generationProgressWrapper');
        if (!this.launcher) this.launcher = document.getElementById('generationLauncher');
        if (!this.progressCircle) this.progressCircle = document.getElementById('progressCircle');
        if (!this.progressText) this.progressText = document.getElementById('generationProgressText');
        if (!this.progressCheck) this.progressCheck = document.getElementById('generationProgressCheck');
        if (!this.progressTooltip) this.progressTooltip = document.getElementById('generationProgressTooltip');
        if (!this.todoPanel) this.todoPanel = document.getElementById('generationTodoPanel');
        if (!this.todoList) this.todoList = document.getElementById('generationTodoList');
        if (!this.taskCounter) this.taskCounter = document.getElementById('generationTaskCounter');
        if (!this.errorBanner) this.errorBanner = document.getElementById('generationErrorBanner');
    }

    _restoreFromLocalStorageImmediate() {
        try {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            for (const projectId of stored) {
                if (!this._isValidProjectId(projectId) || this.activeGenerations.has(projectId)) continue;
                this.activeGenerations.set(projectId, {
                    startTime: Date.now(),
                    progress: 0,
                    message: 'Resuming...',
                });
            }
            if (this.activeGenerations.size > 0) {
                this._ensureDomRefs();
                if (this.wrapper) this.wrapper.style.display = 'flex';
                this._ensureTaskList();
                this._syncDisplayFromActive();
                this._syncGeneratingBadge();
            }
        } catch (_) {}
    }

    _scheduleServerSync() {
        const delays = [0, 500, 1500, 3000, 5000];
        const attempt = this._syncRetryAttempt;
        if (attempt >= this._syncRetryMax) return;

        const delay = delays[Math.min(attempt, delays.length - 1)];
        setTimeout(async () => {
            if (this.serverSyncDone) return;
            const ok = await this._syncFromServerAttempt();
            if (!ok && !this.serverSyncDone) {
                this._syncRetryAttempt += 1;
                if (this._syncRetryAttempt < this._syncRetryMax) {
                    this._scheduleServerSync();
                }
            }
        }, delay);
    }

    _apiBase() {
        return window.API_BASE_URL || window.API_BASE || '/api';
    }

    _requestHeaders() {
        if (typeof getAuthHeaders === 'function') {
            return getAuthHeaders();
        }
        return { 'Content-Type': 'application/json' };
    }

    _isValidProjectId(projectId) {
        if (!projectId || typeof projectId !== 'string') return false;
        if (/[\.\/\\:|<>"'\x00]/.test(projectId)) return false;
        return /^prj_[A-Za-z0-9]{12,}$/.test(projectId) || /^[0-9]+_[a-zA-Z0-9-]+$/.test(projectId);
    }

    _normalizeTemplateId(templateId) {
        if (!templateId || typeof templateId !== 'string') return DEFAULT_PIPELINE_TEMPLATE;
        if (templateId === 'splitscreen') return 'splitscreen';
        if (templateId.includes('rank') || templateId === 'ranked_compilation' || templateId === 'ranking_moments') {
            return 'ranked_compilation';
        }
        return GENERATION_TASK_PIPELINES[templateId] ? templateId : DEFAULT_PIPELINE_TEMPLATE;
    }

    _getActiveTasks() {
        const pipelineId = this._normalizeTemplateId(this.activeTemplateId);
        let base = GENERATION_TASK_PIPELINES[pipelineId] || GENERATION_TASK_PIPELINES[DEFAULT_PIPELINE_TEMPLATE];
        if (!this.showQueueWaitTask) {
            base = base.filter((task) => task.id !== 'wait');
        }
        if (pipelineId !== 'splitscreen') return base;

        const secondaryLabel = this._splitscreenSecondaryTaskLabel(
            this.activeTemplateOptions?.secondaryType
                || this.activeTemplateOptions?.splitscreen_secondary_type
                || this.activeTemplateOptions?.gameplay_clip_id
        );
        return base.map((task) => {
            if (task.id !== 'secondary') return task;
            return {
                ...task,
                label: secondaryLabel.label,
                keywords: [...task.keywords, ...secondaryLabel.keywords],
            };
        });
    }

    _splitscreenSecondaryTaskLabel(secondaryType) {
        const id = String(secondaryType || '').toLowerCase();
        if (id === 'face_track' || id === 'reframe') {
            return {
                label: 'Reframing face',
                keywords: ['applying reframe', 'face track', 'reframe'],
            };
        }
        if (id === 'blank') {
            return {
                label: 'Preparing black panel',
                keywords: ['blank', 'black panel', 'canvas', 'solid'],
            };
        }
        if (id === 'blank_blur') {
            return {
                label: 'Preparing blur panel',
                keywords: ['blank', 'blur', 'canvas', 'backdrop'],
            };
        }
        if (id === 'gameplay' || (id && !['face_track', 'blank', 'blank_blur', 'reframe'].includes(id))) {
            return {
                label: 'Loading gameplay',
                keywords: ['creating split-screen video', 'gameplay clip'],
            };
        }
        return {
            label: 'Preparing secondary panel',
            keywords: ['secondary panel', 'layout'],
        };
    }

    _shouldShowQueueWaitTask(message = '', queueInfo = null) {
        if (queueInfo?.queue_status === 'running') return false;
        if (queueInfo?.queue_status === 'waiting') return true;
        const ahead = Number.isFinite(Number(queueInfo?.users_ahead))
            ? Number(queueInfo.users_ahead)
            : this._queueAheadFromMessage(message);
        if (ahead != null && ahead > 0) return true;
        const msg = String(message || '').toLowerCase();
        if (msg.includes('ahead of you') || msg.includes('open slot')) return true;
        if (msg.includes('queued') && msg.includes('waiting')) return true;
        return false;
    }

    _setQueueWaitVisible(visible) {
        const next = Boolean(visible);
        if (this.showQueueWaitTask === next) return false;
        const hadWait = this.showQueueWaitTask;
        this.showQueueWaitTask = next;
        this.tasksInitialized = false;
        this.tasksIntroPlayed = false;
        this._clearIntroRevealTimers();
        if (this.todoList) this.todoList.innerHTML = '';
        if (hadWait && !next && this.currentTaskIndex > 0) {
            this.currentTaskIndex = Math.max(0, this.currentTaskIndex - 1);
        } else if (!hadWait && next) {
            this.currentTaskIndex = 0;
        } else if (hadWait && !next && this.currentTaskIndex === 0) {
            this.currentTaskIndex = 0;
        }
        this._ensureTaskList();
        if (this.panelOpen) this._playTasksIntro();
        return true;
    }

    _setActivePipeline(templateId, options = {}) {
        const normalized = this._normalizeTemplateId(templateId);
        const prevTemplate = this.activeTemplateId;
        const prevOptions = JSON.stringify(this.activeTemplateOptions || {});
        const nextOptions = JSON.stringify(options || {});

        this.activeTemplateId = normalized;
        this.activeTemplateOptions = options || {};

        if (prevTemplate !== normalized || prevOptions !== nextOptions) {
            this.tasksInitialized = false;
            this.tasksIntroPlayed = false;
            this._resetTaskVisibility();
            if (this.todoList) this.todoList.innerHTML = '';
        }
    }

    _saveTemplateMeta(projectId, templateId, options = {}) {
        if (!this._isValidProjectId(projectId)) return;
        try {
            const meta = JSON.parse(localStorage.getItem(this.TEMPLATE_META_KEY) || '{}');
            meta[projectId] = {
                templateId: this._normalizeTemplateId(templateId),
                options: options || {},
            };
            localStorage.setItem(this.TEMPLATE_META_KEY, JSON.stringify(meta));
        } catch (_) {}
    }

    _getTemplateMeta(projectId) {
        if (!this._isValidProjectId(projectId)) return null;
        try {
            const meta = JSON.parse(localStorage.getItem(this.TEMPLATE_META_KEY) || '{}');
            return meta[projectId] || null;
        } catch (_) {
            return null;
        }
    }

    _removeTemplateMeta(projectId) {
        try {
            const meta = JSON.parse(localStorage.getItem(this.TEMPLATE_META_KEY) || '{}');
            if (!meta[projectId]) return;
            delete meta[projectId];
            if (Object.keys(meta).length) {
                localStorage.setItem(this.TEMPLATE_META_KEY, JSON.stringify(meta));
            } else {
                localStorage.removeItem(this.TEMPLATE_META_KEY);
            }
        } catch (_) {}
    }

    _applyPipelineFromGeneration(gen, projectId = null) {
        if (!gen) return;
        const meta = projectId ? this._getTemplateMeta(projectId) : null;
        const templateId = gen.templateId || meta?.templateId || this.activeTemplateId;
        const options = (gen.templateOptions && Object.keys(gen.templateOptions).length)
            ? gen.templateOptions
            : (meta?.options || this.activeTemplateOptions || {});
        this._setActivePipeline(templateId, options);
    }

    _isFailureStatus(status) {
        const normalized = (status || '').toLowerCase();
        return normalized === 'error' || normalized === 'failed' || normalized === 'timeout';
    }

    _isCancelledStatus(status) {
        const normalized = (status || '').toLowerCase();
        return normalized === 'cancelled' || normalized === 'canceled';
    }

    _markUserCancelled(projectId) {
        if (!projectId) return;
        if (!this._userCancelledIds) this._userCancelledIds = new Set();
        this._userCancelledIds.add(String(projectId));
        setTimeout(() => {
            try { this._userCancelledIds?.delete(String(projectId)); } catch (_) {}
        }, 120000);
    }

    _wasUserCancelled(projectId) {
        if (!projectId || !this._userCancelledIds?.size) return false;
        const id = String(projectId);
        if (this._userCancelledIds.has(id)) return true;
        for (const cancelled of this._userCancelledIds) {
            if (this._idsLikelySameJob?.(cancelled, id)) return true;
        }
        return false;
    }

    _idsLikelySameJob(a, b) {
        if (!a || !b) return false;
        if (String(a) === String(b)) return true;
        const resolved = this._resolveActiveProjectId?.(a) || a;
        const resolvedB = this._resolveActiveProjectId?.(b) || b;
        return String(resolved) === String(resolvedB);
    }

    _isSuccessStatus(status) {
        return (status || '').toLowerCase() === 'completed';
    }

    _clearErrorDismissTimer() {
        if (this._errorDismissTimer) {
            clearTimeout(this._errorDismissTimer);
            this._errorDismissTimer = null;
        }
    }

    _showErrorBanner(message = 'There was an error — try again') {
        this._ensureDomRefs();
        if (this.errorBanner) {
            this.errorBanner.textContent = message;
            this.errorBanner.hidden = false;
            this.errorBanner.classList.add('is-visible');
        }
        if (this.todoPanel) this.todoPanel.classList.add('is-error-state');
    }

    _hideErrorBanner() {
        if (this.errorBanner) {
            this.errorBanner.hidden = true;
            this.errorBanner.classList.remove('is-visible');
        }
        if (this.todoPanel) this.todoPanel.classList.remove('is-error-state');
    }

    async _resolveRemovedProject(projectId) {
        const data = await this._fetchProjectStatus(projectId);
        if (!data) {
            const gen = this.activeGenerations.get(projectId);
            const misses = (gen?._pollMisses || 0) + 1;
            if (gen) gen._pollMisses = misses;
            if (misses < 3) return;
            this.failGeneration(projectId, 'There was an error — try again');
            return;
        }
        const gen = this.activeGenerations.get(projectId);
        if (gen) gen._pollMisses = 0;
        if (this._isSuccessStatus(data.status)) {
            this.completeGeneration(projectId);
        } else if (this._isCancelledStatus(data.status)) {
            this.stopGeneration(projectId, data.message || 'Stopped');
        } else if (this._isFailureStatus(data.status)) {
            this.failGeneration(projectId, data.message || 'There was an error — try again');
        } else if (ACTIVE_GENERATION_STATUSES.has((data.status || '').toLowerCase())) {
            this.updateProgress(projectId, data.progress ?? 0, data.message || 'Processing...', true);
        } else {
            this.failGeneration(projectId, data.message || 'There was an error — try again');
        }
    }

    _statusUrl(projectId) {
        const safeId = encodeURIComponent(projectId);
        return `${this._apiBase()}/clips/status/${safeId}`;
    }

    _hasActiveGenerationUI() {
        return this.optimisticPending || this.activeGenerations.size > 0;
    }

    _bindPanelEvents() {
        if (this.launcher) {
            this.launcher.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this._hasActiveGenerationUI()) return;
                this.openPanel();
            });
        }

        document.addEventListener('click', (e) => {
            if (!this.panelOpen || !this.wrapper) return;
            if (this.wrapper.contains(e.target)) return;
            this.closePanel();
        });

        if (this.todoPanel) {
            this.todoPanel.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    _ensureTaskList() {
        if (this.tasksInitialized || !this.todoList) return;
        const tasks = this._getActiveTasks();
        this.todoList.innerHTML = tasks.map((task, i) => `
            <li class="generation-todo-item" id="generation-task-${i}" data-task-id="${task.id}">
                <div class="generation-task-indicator">
                    <div class="generation-task-circle generation-task-pending"></div>
                    <div class="generation-task-circle generation-task-active-wrap">
                        <svg class="generation-task-spinner" viewBox="0 0 50 50" aria-hidden="true">
                            <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(16,185,129,0.2)" stroke-width="4.5"></circle>
                            <circle cx="25" cy="25" r="20" fill="none" stroke="#10b981" stroke-width="4.5"
                                stroke-linecap="round" transform="rotate(-90 25 25)"></circle>
                        </svg>
                    </div>
                    <div class="generation-task-circle generation-task-done">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="generation-task-label-wrap">
                    <div class="generation-task-label">${task.label}</div>
                    ${task.id === 'wait' ? '<div class="generation-task-hint" hidden></div>' : ''}
                    <div class="generation-task-strikethrough"></div>
                </div>
            </li>
        `).join('');
        this.tasksInitialized = true;
        this._updateTaskCounter();
    }

    _clearIntroRevealTimers() {
        this._introRevealTimers.forEach((id) => clearTimeout(id));
        this._introRevealTimers = [];
    }

    _resetTaskVisibility() {
        if (!this.todoList) return;
        this.todoList.querySelectorAll('.generation-todo-item').forEach((el) => {
            el.classList.remove('is-revealed', 'is-instant');
            el.style.removeProperty('--reveal-delay');
        });
    }

    _showAllTasksInstant() {
        this._getActiveTasks().forEach((_, i) => {
            const el = document.getElementById(`generation-task-${i}`);
            if (!el) return;
            el.style.removeProperty('--reveal-delay');
            el.classList.add('is-revealed', 'is-instant');
        });
    }

    _playTasksIntro() {
        this._clearIntroRevealTimers();
        this._resetTaskVisibility();
        this.tasksIntroPlayed = true;

        this._showAllTasksInstant();
    }

    openPanel() {
        if (!this.todoPanel || !this.launcher) return;
        this._ensureTaskList();
        this.launcher.classList.add('is-panel-open');
        this.todoPanel.classList.add('is-open');
        this.panelOpen = true;

        requestAnimationFrame(() => {
            if (!this.tasksIntroPlayed) {
                this._playTasksIntro();
            } else {
                this._showAllTasksInstant();
            }
        });
    }

    closePanel() {
        if (!this.todoPanel || !this.launcher) return;
        this._clearIntroRevealTimers();
        this.launcher.classList.remove('is-panel-open');
        this.todoPanel.classList.remove('is-open');
        this.panelOpen = false;
    }

    _isQueueWaitingMessage(message = '') {
        const msg = (message || '').toLowerCase();
        return msg.includes('queued')
            || msg.includes('ahead of you')
            || msg.includes('open slot')
            || msg.includes('starting shortly')
            || msg.includes('free queue')
            || msg.includes('priority')
            || msg.includes('processing soon')
            || (msg.includes('queue') && !msg.includes('starting generation'));
    }

    _queueAheadFromMessage(message = '') {
        const match = String(message || '').match(/(\d+)\s+ahead/i);
        return match ? Number(match[1]) : null;
    }

    _queueLabelForInfo(message = '', queueInfo = null) {
        const msg = String(message || '').toLowerCase();
        const priority = queueInfo?.priority_lane === true
            || queueInfo?.lane === 'priority'
            || msg.includes('priority');
        if (priority) {
            return {
                label: 'Priority · Starting soon',
                hint: '',
            };
        }
        return {
            label: 'Free queue · Processing soon',
            hint: 'Upgrade for priority processing',
        };
    }

    _updateQueueTaskLabel(message = '', queueInfo = null) {
        const tasks = this._getActiveTasks();
        const waitIdx = tasks.findIndex((t) => t.id === 'wait');
        if (waitIdx < 0) return;
        const el = document.getElementById(`generation-task-${waitIdx}`);
        const labelEl = el?.querySelector('.generation-task-label');
        const hintEl = el?.querySelector('.generation-task-hint');
        if (!labelEl) return;

        if (this._isQueueWaitingMessage(message) || queueInfo?.queue_status === 'waiting') {
            const { label, hint } = this._queueLabelForInfo(message, queueInfo);
            labelEl.textContent = label;
            if (hintEl) {
                if (hint) {
                    hintEl.hidden = false;
                    hintEl.textContent = hint;
                } else {
                    hintEl.hidden = true;
                    hintEl.textContent = '';
                }
            }
            el.classList.add('is-waiting');
            el.classList.toggle('is-priority-lane', !hint);
            el.classList.toggle('is-free-lane', Boolean(hint));
        } else {
            labelEl.textContent = tasks[waitIdx].label;
            if (hintEl) {
                hintEl.hidden = true;
                hintEl.textContent = '';
            }
            el.classList.remove('is-waiting', 'is-priority-lane', 'is-free-lane');
        }
    }

    _resolveTaskIndex(progress, message = '') {
        const tasks = this._getActiveTasks();
        const msg = (message || '').toLowerCase();

        if (progress >= 100 || msg.includes('processing complete') || msg.includes('video ready')) {
            return Math.max(0, tasks.length - 1);
        }

        if (this.showQueueWaitTask && this._isQueueWaitingMessage(msg)) {
            const waitIdx = tasks.findIndex((t) => t.id === 'wait');
            return waitIdx >= 0 ? waitIdx : 0;
        }

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            if (task.id === 'wait') continue;
            if (task.keywords.some((kw) => msg.includes(kw))) {
                return i;
            }
        }

        if (tasks.length === 0) return 0;
        const usable = tasks[0]?.id === 'wait' ? tasks.length - 1 : tasks.length;
        const offset = tasks[0]?.id === 'wait' ? 1 : 0;
        const band = Math.floor((Math.max(0, Math.min(99, progress)) / 100) * Math.max(1, usable));
        return Math.min(offset + band, tasks.length - 1);
    }

    _updateTaskStates(progress, message = '', queueInfo = null) {
        this._ensureTaskList();
        const tasks = this._getActiveTasks();
        const waiting = this.showQueueWaitTask;
        let activeIndex = this._resolveTaskIndex(progress, message);

        if (waiting) {
            const waitIdx = tasks.findIndex((t) => t.id === 'wait');
            activeIndex = waitIdx >= 0 ? waitIdx : 0;
            this.currentTaskIndex = activeIndex;
        } else if (this.currentTaskIndex >= 0 && progress < 100) {
            activeIndex = Math.max(activeIndex, this.currentTaskIndex);
            this.currentTaskIndex = activeIndex;
        } else {
            this.currentTaskIndex = activeIndex;
        }

        tasks.forEach((_, i) => {
            const el = document.getElementById(`generation-task-${i}`);
            if (!el) return;
            el.classList.remove('is-active', 'is-done', 'is-failed', 'is-waiting');
            if (progress >= 100) {
                el.classList.add('is-done');
            } else if (i < activeIndex) {
                el.classList.add('is-done');
            } else if (i === activeIndex) {
                el.classList.add('is-active');
                if (waiting) el.classList.add('is-waiting');
            }
        });

        this._updateQueueTaskLabel(message, queueInfo);

        this.completedTaskCount = progress >= 100
            ? tasks.length
            : activeIndex;
        this._updateTaskCounter();
    }

    _updateTaskCounter() {
        if (!this.taskCounter) return;
        const total = this._getActiveTasks().length;
        const remaining = Math.max(0, total - this.completedTaskCount);
        if (remaining === 0) {
            this.taskCounter.textContent = 'All done';
        } else if (remaining === 1) {
            this.taskCounter.textContent = '1 remaining';
        } else {
            this.taskCounter.textContent = `${remaining} remaining`;
        }
    }

    _markTasksFailed() {
        this._ensureTaskList();
        const failIndex = Math.max(0, this.currentTaskIndex);
        const el = document.getElementById(`generation-task-${failIndex}`);
        if (el) {
            el.classList.remove('is-active', 'is-done');
            el.classList.add('is-failed');
            if (!el.classList.contains('is-revealed')) {
                el.classList.add('is-revealed', 'is-instant');
            }
        }
    }

    _syncGeneratingBadge() {
        const count = this.activeGenerations.size + (this.optimisticPending ? 1 : 0);
        this.generatingCount = count;
        try {
            localStorage.setItem(this.GENERATING_COUNT_KEY, String(count));
        } catch (_) {}
        if (count > 0) this.showLibraryBadge();
        else this.hideLibraryBadge();
    }

    saveToLocalStorage(projectId) {
        if (!this._isValidProjectId(projectId)) return;
        try {
            const activeProjects = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            if (!activeProjects.includes(projectId)) {
                activeProjects.push(projectId);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(activeProjects));
            }
        } catch (error) {
            console.warn('Failed to save generation to localStorage:', error);
        }
    }

    removeFromLocalStorage(projectId) {
        try {
            let activeProjects = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            activeProjects = activeProjects.filter((id) => id !== projectId);
            if (activeProjects.length > 0) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(activeProjects));
            } else {
                localStorage.removeItem(this.STORAGE_KEY);
            }
            this._removeTemplateMeta(projectId);
        } catch (error) {
            console.warn('Failed to remove generation from localStorage:', error);
        }
    }

    _writeLocalStorageFromActive() {
        try {
            const ids = [...this.activeGenerations.keys()].filter((id) => this._isValidProjectId(id));
            if (ids.length) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(ids));
            } else {
                localStorage.removeItem(this.STORAGE_KEY);
            }
        } catch (_) {}
    }

    showLibraryBadge() {
        const libraryTab = document.querySelector('[data-tab="library"]');
        if (!libraryTab) return;
        libraryTab.querySelector('.library-notification-badge')?.remove();
        const badge = document.createElement('div');
        badge.className = 'library-notification-badge';
        libraryTab.style.position = 'relative';
        libraryTab.appendChild(badge);
    }

    hideLibraryBadge() {
        document.querySelector('[data-tab="library"] .library-notification-badge')?.remove();
    }

    showVideoReadyNotification() {
        document.querySelector('.video-ready-notification')?.remove();
        const notification = document.createElement('div');
        notification.className = 'video-ready-notification';
        notification.innerHTML = 'Your video is ready to go! <span class="video-ready-badge">OFFICIAL</span>';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    restoreGeneration(projectId, progress = 0, message = 'Resuming...', status = 'processing', templateId = null, templateOptions = null) {
        if (!this._isValidProjectId(projectId)) return;
        if (this._wasUserCancelled(projectId)) return;

        const normalizedStatus = (status || 'processing').toLowerCase();
        if (normalizedStatus === 'completed') {
            this.completeGeneration(projectId);
            return;
        }
        if (normalizedStatus === 'error' || normalizedStatus === 'failed' || normalizedStatus === 'timeout') {
            this.removeFromLocalStorage(projectId);
            this.failGeneration(projectId, 'There was an error — try again');
            return;
        }
        if (!ACTIVE_GENERATION_STATUSES.has(normalizedStatus)) return;

        const meta = this._getTemplateMeta(projectId);
        const resolvedTemplateId = templateId || meta?.templateId || DEFAULT_PIPELINE_TEMPLATE;
        const resolvedOptions = templateOptions || meta?.options || {};

        if (this.activeGenerations.has(projectId)) {
            const gen = this.activeGenerations.get(projectId);
            gen.progress = Math.max(gen.progress, Math.max(0, Math.min(100, progress || 0)));
            if (message) gen.message = message;
            gen.templateId = resolvedTemplateId;
            gen.templateOptions = resolvedOptions;
        } else {
            this.activeGenerations.set(projectId, {
                startTime: Date.now(),
                progress: Math.max(0, Math.min(100, progress || 0)),
                message: message || 'Resuming...',
                templateId: resolvedTemplateId,
                templateOptions: resolvedOptions,
            });
        }
        this._saveTemplateMeta(projectId, resolvedTemplateId, resolvedOptions);
        this.saveToLocalStorage(projectId);

        this._ensureDomRefs();
        if (this.wrapper) this.wrapper.style.display = 'flex';
        this.tasksIntroPlayed = false;
        this._resetTaskVisibility();
        this._applyPipelineFromGeneration(this.activeGenerations.get(projectId), projectId);
        this._ensureTaskList();
        this._syncDisplayFromActive();
        this._syncGeneratingBadge();
        this.startPolling();
        this._refreshProjectStatus(projectId);
    }

    async _refreshProjectStatus(projectId) {
        if (!this._isValidProjectId(projectId)) return;
        const data = await this._fetchProjectStatus(projectId);
        if (!data) return;

        if (data.template_id || data.template) {
            const options = data.splitscreen_secondary_type
                ? { secondaryType: data.splitscreen_secondary_type }
                : {};
            this._saveTemplateMeta(projectId, data.template_id || data.template, options);
            if (this.activeGenerations.has(projectId)) {
                const gen = this.activeGenerations.get(projectId);
                gen.templateId = data.template_id || data.template;
                gen.templateOptions = options;
            }
        }

        const normalizedStatus = (data.status || '').toLowerCase();
        if (ACTIVE_GENERATION_STATUSES.has(normalizedStatus)) {
            this.updateProgress(
                projectId,
                data.progress ?? 0,
                data.message || 'Processing...',
                true,
                data.queue || null,
            );
        } else if (this._isSuccessStatus(normalizedStatus)) {
            this.completeGeneration(projectId);
        } else if (this._isCancelledStatus(normalizedStatus)) {
            this.stopGeneration(projectId, data.message || 'Stopped');
        } else if (this._isFailureStatus(normalizedStatus)) {
            this.failGeneration(projectId, data.message || 'There was an error — try again');
        }
    }

    _syncDisplayFromActive() {
        this._ensureDomRefs();
        if (!this.wrapper || !this.progressCircle || this.activeGenerations.size === 0) return;

        const maxGen = [...this.activeGenerations.entries()]
            .sort((a, b) => b[1].progress - a[1].progress)[0];

        if (maxGen) {
            const [projectId, gen] = maxGen;
            this._applyPipelineFromGeneration(gen, projectId);
            this.displayProgress(gen.progress, gen.message, gen.queueInfo || null);
        }
    }

    async syncFromServer(options = {}) {
        if (this.serverSyncDone && !options.force) return;
        if (options.force) {
            this.serverSyncDone = false;
            this._syncRetryAttempt = 0;
        }
        const ok = await this._syncFromServerAttempt();
        if (!ok && !this.serverSyncDone && this._syncRetryAttempt < this._syncRetryMax) {
            this._syncRetryAttempt += 1;
            this._scheduleServerSync();
        }
    }

    async _syncFromServerAttempt() {
        this._ensureDomRefs();

        try {
            const response = await fetch(`${this._apiBase()}/clips/status/active`, {
                method: 'GET',
                headers: this._requestHeaders(),
                credentials: 'include',
            });

            if (response.status === 401 || response.status === 403) {
                await this._syncFromLocalStorageFallback();
                return false;
            }
            if (!response.ok) {
                await this._syncFromLocalStorageFallback();
                return false;
            }

            const data = await response.json();
            if (!data.success || !Array.isArray(data.active_generations)) {
                await this._syncFromLocalStorageFallback();
                return false;
            }

            const serverIds = new Set();
            for (const gen of data.active_generations) {
                const projectId = gen.project_id;
                const status = (gen.status || '').toLowerCase();
                if (!projectId) continue;

                if (status === 'timeout') {
                    await this._abandonProject(projectId);
                    continue;
                }

                if (!ACTIVE_GENERATION_STATUSES.has(status)) continue;

                serverIds.add(projectId);
                const templateOptions = gen.splitscreen_secondary_type
                    ? { secondaryType: gen.splitscreen_secondary_type }
                    : {};
                this.restoreGeneration(
                    projectId,
                    gen.progress || 0,
                    gen.message || 'Processing...',
                    status,
                    gen.template_id || gen.template || null,
                    templateOptions
                );
            }

            for (const projectId of [...this.activeGenerations.keys()]) {
                if (!serverIds.has(projectId)) {
                    await this._resolveRemovedProject(projectId);
                }
            }

            this._writeLocalStorageFromActive();
            this._syncGeneratingBadge();

            if (this.activeGenerations.size === 0 && !this.optimisticPending) {
                this.hide();
                this._unlockUrlSubmitButton();
            }

            this.serverSyncDone = true;
            return true;
        } catch (error) {
            console.warn('[Spinner] Server sync failed, using local fallback:', error);
            await this._syncFromLocalStorageFallback();
            return false;
        }
    }

    async _abandonProject(projectId) {
        if (!this._isValidProjectId(projectId)) return;
        try {
            await fetch(`${this._apiBase()}/clips/${encodeURIComponent(projectId)}/cancel`, {
                method: 'POST',
                headers: this._requestHeaders(),
                credentials: 'include',
            });
        } catch (_) {
            try {
                await fetch(`${this._apiBase()}/clips/projects/${encodeURIComponent(projectId)}/abandon`, {
                    method: 'POST',
                    headers: this._requestHeaders(),
                    credentials: 'include',
                });
            } catch (__) {}
        }
        this.activeGenerations.delete(projectId);
        this.removeFromLocalStorage(projectId);
    }

    _unlockUrlSubmitButton() {
        const submitBtn = document.getElementById('processUrlBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.classList.remove('is-generating', 'is-cancelling', 'is-cancel-locked');
            submitBtn.setAttribute('aria-label', 'Continue');
            submitBtn.removeAttribute('title');
        }
        sessionStorage.removeItem('urlButtonLocked');
        sessionStorage.removeItem('urlButtonLockeduntil');

        const confirmBtn = document.getElementById('confirmUseTemplateBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.pointerEvents = '';
            confirmBtn.style.opacity = '';
        }
        if (window.clipsStudio) {
            window.clipsStudio._generationStartInFlight = false;
            window.clipsStudio._cancelGenerationInFlight = false;
        }
    }

    async _syncFromLocalStorageFallback() {
        try {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            for (const projectId of stored) {
                if (!this._isValidProjectId(projectId)) continue;
                const status = await this._fetchProjectStatus(projectId);
                if (status && ACTIVE_GENERATION_STATUSES.has(status.status)) {
                    this.restoreGeneration(projectId, status.progress, status.message, status.status);
                } else if (status && this._isSuccessStatus(status.status)) {
                    this.completeGeneration(projectId);
                } else if (status && this._isCancelledStatus(status.status)) {
                    this.stopGeneration(projectId, status.message || 'Stopped');
                } else if (status && this._isFailureStatus(status.status)) {
                    this.failGeneration(projectId, status.message || 'There was an error — try again');
                } else {
                    this.removeFromLocalStorage(projectId);
                }
            }
            if (this.activeGenerations.size > 0) {
                this._ensureDomRefs();
                if (this.wrapper) this.wrapper.style.display = 'flex';
                this._syncDisplayFromActive();
                this._syncGeneratingBadge();
                this.startPolling();
            } else if (!this.optimisticPending) {
                this.hide();
                this._unlockUrlSubmitButton();
            }
        } catch (_) {
            if (this.activeGenerations.size === 0) {
                localStorage.removeItem(this.STORAGE_KEY);
            }
        }
    }

    async _fetchProjectStatus(projectId) {
        if (!this._isValidProjectId(projectId)) return null;
        try {
            const response = await fetch(this._statusUrl(projectId), {
                method: 'GET',
                credentials: 'include',
                headers: this._requestHeaders(),
            });
            if (response.status === 401 || response.status === 403 || response.status === 404) {
                this.removeFromLocalStorage(projectId);
                return null;
            }
            if (!response.ok) return null;
            const data = await response.json();
            if (!data || !data.status || data.status === 'unknown') return null;
            return data;
        } catch (_) {
            return null;
        }
    }

    setupWebSocketHandlers() {
        if (this.wsHandlersSetup || typeof solisWSClient === 'undefined') return;
        this.wsHandlersSetup = true;

        solisWSClient.on('moment_detected', (data) => {
            const { project_id, moment_count, progress } = data;
            if (!this._isValidProjectId(project_id)) return;
            if (this._wasUserCancelled(project_id)) return;
            const activeId = this._resolveActiveProjectId(project_id);
            if (!activeId) return;
            this._markWsFresh(activeId);
            const countdownRank = Math.max(1, 6 - moment_count);
            const label = `Moment #${countdownRank} detected`;
            this.updateProgress(activeId, progress, label);
        });

        solisWSClient.on('compilation_progress', (data) => {
            const { project_id, progress, step } = data;
            if (!this._isValidProjectId(project_id)) return;
            if (this._wasUserCancelled(project_id)) return;
            const activeId = this._resolveActiveProjectId(project_id);
            if (!activeId) return;
            this._markWsFresh(activeId);
            this.updateProgress(activeId, progress, step || 'Processing...', true);
        });

        solisWSClient.on('clips_status_update', (data) => {
            const { project_id, status, progress, message, queue } = data;
            if (!this._isValidProjectId(project_id)) return;
            if (this._wasUserCancelled(project_id)) {
                const normalizedEarly = (status || '').toLowerCase();
                if (this._isCancelledStatus(normalizedEarly)) {
                    this.stopGeneration(project_id, message || 'Stopped');
                }
                return;
            }
            const activeId = this._resolveActiveProjectId(project_id) || project_id;
            const normalized = (status || '').toLowerCase();
            if (normalized === 'completed') {
                this.completeGeneration(activeId);
            } else if (this._isCancelledStatus(normalized)) {
                this.stopGeneration(activeId, message || 'Stopped');
            } else if (this._isFailureStatus(normalized)) {
                this.failGeneration(activeId, message || 'There was an error — try again');
            } else if (ACTIVE_GENERATION_STATUSES.has(normalized)) {
                if (!this._resolveActiveProjectId(project_id) && !this.activeGenerations.has(project_id)) return;
                this._markWsFresh(activeId);
                this.updateProgress(activeId, progress ?? 0, message || 'Processing...', true, queue || null);
            }
        });

        solisWSClient.on('generation_error', (data) => {
            const projectId = data?.project_id || data?.taskId;
            if (!this._isValidProjectId(projectId)) return;
            if (this._wasUserCancelled(projectId)) return;
            const activeId = this._resolveActiveProjectId(projectId) || projectId;
            this.failGeneration(activeId, data?.message || data?.error || 'There was an error — try again');
        });

        solisWSClient.on('processing_error', (data) => {
            const projectId = data?.taskId || data?.project_id;
            if (!this._isValidProjectId(projectId)) return;
            if (this._wasUserCancelled(projectId)) return;
            const activeId = this._resolveActiveProjectId(projectId) || projectId;
            this.failGeneration(activeId, data?.message || data?.error || 'There was an error — try again');
        });

        solisWSClient.on('video_ready', (data) => {
            const { project_id, output_path, video_title, thumbnail_url, template_name, template } = data || {};
            if (!this._isValidProjectId(project_id)) return;
            if (this._wasUserCancelled(project_id)) return;
            const activeId = this._resolveActiveProjectId(project_id) || project_id;

            try {
                const studio = window.clipsStudio;
                if (studio && Array.isArray(studio.libraryItems)) {
                    const pid = String(project_id);
                    let item = studio.libraryItems.find(
                        (i) => String(i.projectId || i.id) === pid
                    );
                    if (!item) {
                        item = {
                            id: project_id,
                            projectId: project_id,
                            status: 'completed',
                            timestamp: new Date(),
                            _optimistic: true,
                        };
                        studio.libraryItems.unshift(item);
                    }
                    if (video_title) item.name = video_title;
                    if (thumbnail_url) item.thumbnailUrl = thumbnail_url;
                    if (template_name) item.templateName = template_name;
                    if (template) item.template = template;
                    item.status = 'completed';
                    item._optimistic = false;
                    studio._libraryLastLoaded = 0;
                    if (!studio.libraryPreviewModalOpen) {
                        studio.updateLibraryView?.();
                    } else {
                        studio._libraryRefreshPending = true;
                    }
                }
            } catch (_) {}

            if (typeof window.notificationSystem?.showVideoGenerated === 'function') {
                window.notificationSystem.showVideoGenerated({
                    videoTitle: video_title || `Video ${String(project_id).substring(0, 8)}...`,
                    videoUrl: output_path || '#',
                    message: 'Your video has been generated successfully!',
                });
            }
            this._refreshLibrarySoon();
            this.completeGeneration(activeId);
        });

        solisWSClient.on('error', (data) => {
            const projectId = data?.taskId || data?.project_id;
            if (projectId && this._isValidProjectId(projectId)) {
                this.failGeneration(projectId, data?.error || data?.message || 'There was an error — try again');
            }
        });
    }

    beginOptimisticGeneration(message = 'Starting...', templateId = DEFAULT_PIPELINE_TEMPLATE, options = {}) {
        this._setActivePipeline(templateId, options);
        this.optimisticPending = true;
        this.currentTaskIndex = -1;
        this.completedTaskCount = 0;
        this.showQueueWaitTask = false;
        this._ensureDomRefs();
        if (this.wrapper) this.wrapper.style.display = 'flex';
        this.tasksIntroPlayed = false;
        this._resetTaskVisibility();
        this._ensureTaskList();
        this.displayProgress(0, this._cleanMessage(message));
        this._syncGeneratingBadge();
        this.openPanel();
    }

    cancelOptimisticGeneration() {
        if (!this.optimisticPending) return;
        this.optimisticPending = false;
        if (this.activeGenerations.size === 0) {
            this.stopPolling();
            this.hide();
        } else {
            this._syncGeneratingBadge();
        }
    }

    startGeneration(projectId, message = 'Queued — waiting for an open slot...', templateId = null, options = {}) {
        if (!this._isValidProjectId(projectId)) return;
        if (this._wasUserCancelled(projectId)) {
            return;
        }
        this._lastKnownProjectId = projectId;

        const meta = this._getTemplateMeta(projectId);
        const resolvedTemplateId = templateId || meta?.templateId || this.activeTemplateId || DEFAULT_PIPELINE_TEMPLATE;
        const resolvedOptions = (options && Object.keys(options).length)
            ? options
            : (meta?.options || this.activeTemplateOptions || {});
        this._setActivePipeline(resolvedTemplateId, resolvedOptions);
        this._saveTemplateMeta(projectId, resolvedTemplateId, resolvedOptions);
        this.currentTaskIndex = -1;
        this.completedTaskCount = 0;
        this._completionHandled = false;

        this._ensureDomRefs();
        if (this.wrapper) this.wrapper.style.display = 'flex';
        this._ensureTaskList();
        if (!this.panelOpen) this.openPanel();

        this.optimisticPending = false;
        this.activeGenerations.set(projectId, {
            startTime: Date.now(),
            progress: 0,
            message,
            templateId: resolvedTemplateId,
            templateOptions: resolvedOptions,
        });
        this.saveToLocalStorage(projectId);
        this._syncGeneratingBadge();
        this.updateProgress(projectId, 0, message);
        this.startPolling();

        this.verifyWebSocketAccess(projectId, (allowed) => {
            if (!allowed && this.activeGenerations.has(projectId)) {
                this.failGeneration(projectId);
            }
        });
    }

    verifyWebSocketAccess(projectId, callback) {
        if (!this._isValidProjectId(projectId)) {
            callback(false);
            return;
        }
        fetch(`${this._apiBase()}/clips/verify/${encodeURIComponent(projectId)}`, {
            method: 'GET',
            credentials: 'include',
            headers: this._requestHeaders(),
        })
        .then((response) => response.json())
        .then((data) => callback(!!data.allowed))
        .catch(() => callback(false));
    }

    updateProgress(projectId, progress, message = '', force = false, queueInfo = null) {
        if (!this._isValidProjectId(projectId)) return;
        progress = Math.max(0, Math.min(100, Math.floor(progress)));

        const resolvedId = this._resolveActiveProjectId(projectId) || projectId;
        if (resolvedId !== projectId) this._linkProjectAliases(projectId, resolvedId);

        if (!this.activeGenerations.has(resolvedId)) {
            if (this._completionHandled || this.activeGenerations.size === 0) {
                return;
            }
            return;
        }

        const waiting = this._shouldShowQueueWaitTask(message, queueInfo);
        if (waiting) {
            progress = Math.min(progress, 2);
        }
        this._setQueueWaitVisible(waiting);

        const gen = this.activeGenerations.get(resolvedId);
        const progressIncreased = progress > gen.progress;
        const messageChanged = message && message !== gen.message;
        const queueChanged = queueInfo && JSON.stringify(queueInfo) !== JSON.stringify(gen.queueInfo || null);
        if (!force && !progressIncreased && !messageChanged && !queueChanged) return;
        if (waiting) {
            gen.progress = Math.min(progress, 2);
        } else {
            gen.progress = Math.max(gen.progress, progress);
        }
        if (message) gen.message = message;
        if (queueInfo) gen.queueInfo = queueInfo;
        else if (!this._isQueueWaitingMessage(gen.message)) gen.queueInfo = null;

        this._syncCancelLockOnSubmitButton(progress, message);
        this._ensureDomRefs();
        this._syncDisplayFromActive();
    }

    _isCancelLockedStage(progress = 0, message = '') {
        const p = Number(progress) || 0;
        if (p >= 78) return true;
        const msg = String(message || '').toLowerCase();
        return (
            msg.includes('building split')
            || msg.includes('build split')
            || msg.includes('compil')
            || msg.includes('encoding final')
            || msg.includes('export')
            || msg.includes('finaliz')
            || msg.includes('watermark')
            || msg.includes('adding caption')
            || msg.includes('assembling')
        );
    }

    _syncCancelLockOnSubmitButton(progress, message) {
        const submitBtn = document.getElementById('processUrlBtn');
        if (!submitBtn || !submitBtn.classList.contains('is-generating')) return;
        const locked = this._isCancelLockedStage(progress, message);
        submitBtn.classList.toggle('is-cancel-locked', locked);
        if (locked) {
            submitBtn.setAttribute('aria-label', 'Finishing…');
            submitBtn.title = 'Almost done — can’t stop now';
        } else {
            submitBtn.setAttribute('aria-label', 'Stop generation');
            submitBtn.title = 'Stop generation';
        }
    }

    _cleanMessage(message) {
        if (!message || typeof message !== 'string') return '';
        let cleaned = message
            .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (/\b\d+(\.\d+)?\s*(MB\/s|MiB\/s|KB\/s|KiB\/s|Gbps|Mbps)\b/i.test(cleaned)
            || /\b\d+(\.\d+)?\s*(MB|MiB|GB|GiB)\b/i.test(cleaned)
            || /\bat\s+\d+(\.\d+)?\s*(MB|KB)/i.test(cleaned)) {
            if (/download|install/i.test(cleaned)) return 'Installing video...';
            return 'Working...';
        }

        cleaned = cleaned
            .replace(/\b\d+(\.\d+)?\s*(MB\/s|MiB\/s|KB\/s|KiB\/s|Gbps|Mbps)\b/gi, '')
            .replace(/\([^)]*\.(mp4|wav|webm|mkv)[^)]*\)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        return cleaned;
    }

    _friendlyProgressLabel(progress, message = '', queueInfo = null) {
        const cleaned = this._cleanMessage(message);
        if (this.showQueueWaitTask || this._shouldShowQueueWaitTask(cleaned, queueInfo)) {
            return this._queueLabelForInfo(cleaned, queueInfo).label;
        }
        const tasks = this._getActiveTasks();
        const idx = this._resolveTaskIndex(progress, cleaned);
        const taskLabel = tasks[idx]?.label;
        if (progress >= 100) return cleaned || 'Complete!';
        if (taskLabel && cleaned) {
            const msg = cleaned.toLowerCase();
            const matched = tasks[idx]?.keywords?.some((kw) => msg.includes(kw));
            if (matched) return taskLabel;
        }
        return cleaned || taskLabel || `${progress}% complete`;
    }

    displayProgress(progress, message = '', queueInfo = null) {
        this._ensureDomRefs();
        if (!this.wrapper || !this.progressCircle) return;

        const cleaned = this._cleanMessage(message);
        this._setQueueWaitVisible(this._shouldShowQueueWaitTask(cleaned, queueInfo));
        const waiting = this.showQueueWaitTask;
        const displayPct = waiting ? Math.min(progress, 2) : progress;
        const label = this._friendlyProgressLabel(displayPct, cleaned, queueInfo);

        this.wrapper.style.display = 'flex';

        const isComplete = displayPct >= 100;
        const offset = isComplete
            ? 0
            : this.CIRCLE_CIRCUMFERENCE - ((Math.max(0, Math.min(100, displayPct)) / 100) * this.CIRCLE_CIRCUMFERENCE);
        this.progressCircle.style.strokeDashoffset = String(offset);
        this.progressCircle.style.stroke = waiting ? '#f59e0b' : '#10b981';

        if (this.launcher) {
            this.launcher.classList.toggle('is-complete', isComplete);
            this.launcher.classList.toggle('is-queued', waiting && !isComplete);
            this.launcher.classList.remove('is-error', 'is-active');
        }

        if (this.progressText) {
            this.progressText.textContent = isComplete ? '' : (waiting ? '…' : `${Math.floor(displayPct)}%`);
        }

        if (this.progressTooltip) {
            this.progressTooltip.textContent = isComplete
                ? (label || 'Complete!')
                : (label || `${displayPct}% complete`);
        }

        this._updateTaskStates(displayPct, cleaned, queueInfo);
    }

    _linkProjectAliases(a, b) {
        if (!a || !b || a === b) return;
        if (!this._projectAliases) this._projectAliases = new Map();
        this._projectAliases.set(a, b);
        this._projectAliases.set(b, a);
    }

    _resolveActiveProjectId(projectId) {
        if (!projectId) return null;
        if (this.activeGenerations.has(projectId)) return projectId;

        const aliased = this._projectAliases?.get(projectId);
        if (aliased && this.activeGenerations.has(aliased)) return aliased;

        if (this.activeGenerations.size === 1) {
            const only = [...this.activeGenerations.keys()][0];
            this._linkProjectAliases(projectId, only);
            return only;
        }

        if (this.activeGenerations.size === 2) {
            const keys = [...this.activeGenerations.keys()];
            const prj = keys.find((k) => String(k).startsWith('prj_'));
            const internal = keys.find((k) => /^[0-9]+_/.test(String(k)));
            if (prj && internal) {
                this._linkProjectAliases(prj, internal);
                if (projectId === prj || projectId === internal) return projectId;
                if (String(projectId).startsWith('prj_')) return prj;
                if (/^[0-9]+_/.test(String(projectId))) return internal;
                return prj;
            }
        }

        return null;
    }

    _deleteGeneration(projectId) {
        if (!projectId) return;
        const resolved = this._resolveActiveProjectId(projectId) || projectId;
        const aliased = this._projectAliases?.get(resolved);
        this.activeGenerations.delete(resolved);
        this.removeFromLocalStorage(resolved);
        if (aliased) {
            this.activeGenerations.delete(aliased);
            this.removeFromLocalStorage(aliased);
        }
        this.activeGenerations.delete(projectId);
        this.removeFromLocalStorage(projectId);

        if (this.activeGenerations.size === 1) {
            const only = [...this.activeGenerations.keys()][0];
            const onlyIsPrj = String(only).startsWith('prj_');
            const pidIsPrj = String(projectId).startsWith('prj_');
            const pidIsInternal = /^[0-9]+_/.test(String(projectId));
            if ((onlyIsPrj && pidIsInternal) || (!onlyIsPrj && pidIsPrj)) {
                this.activeGenerations.delete(only);
                this.removeFromLocalStorage(only);
            }
        }
    }

    async runLibraryApplyFlow(projectId, { applyFn, downloadFn }) {
        const idOk = this._isValidProjectId(projectId)
            || (typeof projectId === 'string' && /^[a-zA-Z0-9_.-]{8,}$/.test(projectId));
        if (!idOk) {
            throw new Error('Invalid project');
        }

        const templateId = 'library_apply';
        this._setActivePipeline(templateId, {});
        this._completionHandled = false;
        this.optimisticPending = false;
        this.currentTaskIndex = -1;
        this.completedTaskCount = 0;

        this._ensureDomRefs();
        if (this.wrapper) this.wrapper.style.display = 'flex';
        this.tasksIntroPlayed = false;
        this._resetTaskVisibility();
        this._ensureTaskList();
        this.openPanel();

        this.activeGenerations.set(projectId, {
            startTime: Date.now(),
            progress: 0,
            message: 'Preparing download...',
            templateId,
            templateOptions: {},
        });
        this._syncGeneratingBadge();
        this.updateProgress(projectId, 8, 'Preparing download...', true);

        try {
            if (typeof applyFn === 'function') {
                this.updateProgress(projectId, 22, 'Saving edits...', true);
                await applyFn();
                this.updateProgress(projectId, 58, 'Ready to download', true);
            }

            if (typeof downloadFn === 'function') {
                this.updateProgress(projectId, 72, 'Downloading...', true);
                await downloadFn();
                this.updateProgress(projectId, 92, 'Download started', true);
            }

            const prevNotify = this.showVideoReadyNotification;
            this.showVideoReadyNotification = () => {};
            this.displayProgress(100, 'Download started!');
            this.completeGeneration(projectId);
            this.showVideoReadyNotification = prevNotify;
        } catch (error) {
            this.failGeneration(projectId, error?.message || 'Download failed');
            throw error;
        }
    }

    _refreshLibrarySoon() {
        if (this._libraryRefreshQueued) return;
        this._libraryRefreshQueued = true;
        const run = (attempt = 0) => {
            this._libraryRefreshQueued = attempt < 2; // allow one follow-up retry
            if (typeof updateStorageBadgeDisplay === 'function') {
                updateStorageBadgeDisplay();
            }
            if (window.clipsStudio?.loadLibraryItems) {
                window.clipsStudio._libraryLastLoaded = 0;
                window.clipsStudio.loadLibraryItems({ soft: true, force: true })
                    .catch(() => {})
                    .finally(() => {
                        if (attempt < 1) {
                            setTimeout(() => run(attempt + 1), 1200);
                        } else {
                            this._libraryRefreshQueued = false;
                        }
                    });
            } else {
                this._libraryRefreshQueued = false;
            }
        };
        setTimeout(() => run(0), 400);
    }

    completeGeneration(projectId) {
        if (this._completionHandled && this.activeGenerations.size === 0 && !this.optimisticPending) {
            return;
        }

        if (projectId && this._isValidProjectId(projectId)) {
            this._deleteGeneration(projectId);
        } else if (this.activeGenerations.size === 1) {
            const only = [...this.activeGenerations.keys()][0];
            this._deleteGeneration(only);
        }

        this.optimisticPending = false;
        this._completionHandled = true;
        this._syncGeneratingBadge();
        this.showVideoReadyNotification();
        this.displayProgress(100, 'Processing complete! Video ready!');
        this._unlockUrlSubmitButton();
        this._refreshLibrarySoon();

        if (this.activeGenerations.size === 0) {
            this.stopPolling();
            setTimeout(() => {
                this._completionHandled = false;
                this.closePanel();
                this.hide();
            }, 180);
        }
    }

    _notifyGenerationFailed(projectId, message) {
        try {
            window.dispatchEvent(new CustomEvent('solisGenerationFailed', {
                detail: { projectId, message },
            }));
        } catch (_) {}

        const studio = window.clipsStudio;
        if (!studio?.processingItems?.length) return;

        for (const item of studio.processingItems) {
            if (item.projectId !== projectId) continue;
            studio.stopMonitoring?.(item.id);
        }
        studio.processingItems = studio.processingItems.filter((i) => i.projectId !== projectId);
        studio.saveProcessingItems?.();
        studio.updateProcessingView?.();
        studio.updateLibraryView?.();
        if (studio.processingItems.length === 0) {
            studio.stopLibraryPolling?.();
        }
    }

    failGeneration(projectId, message = 'There was an error — try again') {
        this._notifyGenerationFailed(projectId, message);
        this._clearErrorDismissTimer();
        this.optimisticPending = false;
        this._completionHandled = false;

        if (projectId && this._isValidProjectId(projectId)) {
            this._deleteGeneration(projectId);
        } else if (this.activeGenerations.size > 0) {
            for (const id of [...this.activeGenerations.keys()]) {
                this._deleteGeneration(id);
            }
        }

        this._syncGeneratingBadge();
        this.stopPolling();
        this._unlockUrlSubmitButton();

        this._ensureDomRefs();
        if (this.wrapper) this.wrapper.style.display = 'flex';
        this._ensureTaskList();
        this._markTasksFailed();

        if (this.launcher) {
            this.launcher.classList.remove('is-complete');
            this.launcher.classList.add('is-error');
        }
        if (this.progressCircle) {
            this.progressCircle.style.strokeDashoffset = '0';
            this.progressCircle.style.stroke = '#ef4444';
        }
        if (this.progressText) {
            this.progressText.textContent = '✕';
        }
        if (this.progressTooltip) {
            this.progressTooltip.textContent = message;
        }
        if (this.taskCounter) {
            this.taskCounter.textContent = 'Failed';
        }

        this._showErrorBanner(message);
        this.openPanel();

        this._errorDismissTimer = setTimeout(() => {
            this._dismissErrorState();
        }, 2800);
    }

    stopGeneration(projectId, message = 'Stopped') {
        this._clearErrorDismissTimer();
        this.optimisticPending = false;
        this._completionHandled = false;
        if (projectId) this._markUserCancelled(projectId);

        if (projectId && this._isValidProjectId(projectId)) {
            this._deleteGeneration(projectId);
        } else if (this.activeGenerations.size > 0) {
            for (const id of [...this.activeGenerations.keys()]) {
                this._markUserCancelled(id);
                this._deleteGeneration(id);
            }
        }

        this._syncGeneratingBadge();
        this.stopPolling();
        this._unlockUrlSubmitButton();
        this._hideErrorBanner?.();

        if (this.launcher) {
            this.launcher.classList.remove('is-complete', 'is-error');
        }
        if (this.progressTooltip) {
            this.progressTooltip.textContent = message;
        }
        if (this.taskCounter) {
            this.taskCounter.textContent = message;
        }

        this.closePanel();
        if (this.activeGenerations.size === 0 && !this.optimisticPending) {
            this.hide();
        }
    }

    _dismissErrorState() {
        this._clearErrorDismissTimer();
        this._hideErrorBanner();
        this.closePanel();
        if (this.launcher) this.launcher.classList.remove('is-error');
        if (this.activeGenerations.size === 0 && !this.optimisticPending) {
            this.hide();
        }
    }

    hide() {
        if (this.activeGenerations.size > 0 || this.optimisticPending) return;

        this._clearErrorDismissTimer();
        this.optimisticPending = false;
        this._hideErrorBanner();
        if (this.wrapper) this.wrapper.style.display = 'none';
        this.closePanel();

        if (this.progressCircle) {
            this.progressCircle.style.strokeDashoffset = String(this.CIRCLE_CIRCUMFERENCE);
            this.progressCircle.style.stroke = '#10b981';
        }
        if (this.launcher) this.launcher.classList.remove('is-complete', 'is-panel-open', 'is-error', 'is-active', 'is-queued');
        if (this.progressText) this.progressText.textContent = '0%';
        if (this.progressTooltip) this.progressTooltip.textContent = 'Generating...';

        this.currentTaskIndex = -1;
        this.completedTaskCount = 0;
        this.tasksIntroPlayed = false;
        this.showQueueWaitTask = false;
        this._clearIntroRevealTimers();
        this.tasksInitialized = false;
        if (this.todoList) this.todoList.innerHTML = '';
    }

    startPolling() {
        if (this.pollingTimer) return;

        const poll = async () => {
            if (this.activeGenerations.size === 0) {
                this.stopPolling();
                return;
            }

            const now = Date.now();
            for (const [projectId, gen] of [...this.activeGenerations.entries()]) {
                if (gen._lastWsAt && (now - gen._lastWsAt) < this.WS_FRESH_MS) {
                    continue;
                }
                const data = await this._fetchProjectStatus(projectId);
                if (!data) {
                    const misses = (gen._pollMisses || 0) + 1;
                    gen._pollMisses = misses;
                    if (misses >= 3) {
                        await this._resolveRemovedProject(projectId);
                    }
                    continue;
                }
                gen._pollMisses = 0;

                const status = (data.status || '').toLowerCase();
                if (ACTIVE_GENERATION_STATUSES.has(status)) {
                    const progress = data.progress ?? 0;
                    const msg = data.message || 'Processing...';
                    this.updateProgress(projectId, progress, msg, true, data.queue || null);
                } else if (this._isSuccessStatus(status)) {
                    this.completeGeneration(projectId);
                } else if (this._isCancelledStatus(status)) {
                    this.stopGeneration(projectId, data.message || 'Stopped');
                } else {
                    this.failGeneration(projectId, data.message || 'There was an error — try again');
                }
            }

            if (this.activeGenerations.size === 0) {
                this.stopPolling();
                return;
            }

            let wsOk = false;
            try {
                wsOk = !!(typeof solisWSClient !== 'undefined'
                    && solisWSClient
                    && (solisWSClient.isConnected?.() || solisWSClient.connected));
            } catch (_) { /* ignore */ }
            const delay = wsOk ? this.POLLING_INTERVAL_WS : this.POLLING_INTERVAL;
            this.pollingTimer = setTimeout(poll, delay);
        };

        poll();
    }

    _markWsFresh(projectId) {
        const gen = this.activeGenerations.get(projectId);
        if (gen) gen._lastWsAt = Date.now();
    }

    stopPolling() {
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    getStatus() {
        return {
            isActive: this.activeGenerations.size > 0,
            activeCount: this.activeGenerations.size,
            generations: Object.fromEntries(this.activeGenerations),
        };
    }
}

let generationProgressSpinner = null;

function getGenerationProgressSpinner() {
    return window.generationProgressSpinner || generationProgressSpinner || null;
}

function initGenerationProgressSpinner() {
    if (getGenerationProgressSpinner()) return getGenerationProgressSpinner();
    const instance = new GenerationProgressSpinner();
    generationProgressSpinner = instance;
    window.generationProgressSpinner = instance;
    return instance;
}

window.getGenerationProgressSpinner = getGenerationProgressSpinner;
window.initGenerationProgressSpinner = initGenerationProgressSpinner;

function bootGenerationProgressSpinner() {
    if (document.getElementById('generationProgressWrapper')) {
        initGenerationProgressSpinner();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGenerationProgressSpinner);
} else {
    bootGenerationProgressSpinner();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GenerationProgressSpinner,
        generationProgressSpinner,
        getGenerationProgressSpinner,
        initGenerationProgressSpinner,
    };
}
