const GENERATION_TASK_PIPELINES = {
    ranked_compilation: [
        { id: 'wait', label: 'High demand · Almost there', keywords: ['high demand', 'will be ready', 'queued', 'waiting', 'starting shortly', 'processing soon'], maxProgress: 8 },
        { id: 'install', label: 'Fetch video', keywords: ['download', 'installing', 'preparing download', 'starting generation', 'starting download', 'fetching', 'fetch &', 'source video', 'video info', 'streaming', 'stream', 'starting', 'processing'], maxProgress: 35 },
        { id: 'clip', label: 'Clipping moments', keywords: ['moment', 'detect', 'segment', 'highlight', 'analyz', 'extract', 'audio', 'finding', 'post-process', 'scene', 'operator', 'clipping'], maxProgress: 62 },
        { id: 'overlay', label: 'Overlaying ranking', keywords: ['overlay', 'ranking', 'hook text', 'writing ai', 'overlaying'], maxProgress: 78 },
        { id: 'compile', label: 'Compiling video', keywords: ['compil', 'concat', 'timeline', 'master extract', 'encoding master', 'assembling'], maxProgress: 90 },
        { id: 'export', label: 'Exporting', keywords: ['encoding final', 'finaliz', 'final touch', 'watermark', 'adding caption', 'exporting', 'uploading to storage'], maxProgress: 100 },
    ],
    splitscreen: [
        { id: 'wait', label: 'High demand · Almost there', keywords: ['high demand', 'will be ready', 'queued', 'waiting', 'starting shortly', 'processing soon'], maxProgress: 8 },
        { id: 'install', label: 'Fetch video', keywords: ['download', 'installing', 'preparing download', 'starting generation', 'starting download', 'fetching', 'streaming', 'stream', 'starting', 'processing'], maxProgress: 30 },
        { id: 'moment', label: 'Finding best moment', keywords: ['moment', 'audio', 'analyz', 'finding', 'extract', '30-second', '30 second', 'adaptive'], maxProgress: 55 },
        { id: 'secondary', label: 'Preparing secondary panel', keywords: ['reframe', 'face', 'gameplay', 'minecraft', 'layout', 'secondary', 'panel'], maxProgress: 70 },
        { id: 'compose', label: 'Building split screen', keywords: ['split-screen', 'split screen', 'compos', 'stack', 'creating split'], maxProgress: 88 },
        { id: 'export', label: 'Exporting', keywords: ['encoding final', 'finaliz', 'final touch', 'watermark', 'adding caption', 'exporting', 'uploading to storage'], maxProgress: 100 },
    ],
    library_apply: [
        { id: 'apply', label: 'Applying changes', keywords: ['apply', 'applying', 'recompose', 'layout', 'changes', 'reframe', 'split'], maxProgress: 70 },
        { id: 'download', label: 'Downloading', keywords: ['download', 'saving', 'finaliz', 'exporting'], maxProgress: 100 },
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
        /** Public/internal ids the user stopped — block WS/poll from reviving them. */
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
        this.STUCK_PROGRESS_MS = 6 * 60 * 1000; // no % movement → yellow "servers busy"
        this.STUCK_FAIL_MS = 32 * 60 * 1000; // only fail after long silence (GPU cold start)
        this.GPU_WARMUP_FAIL_MS = 30 * 60 * 1000; // never fail early during server spin-up
        this.pollingTimer = null;
        this.wsHandlersSetup = false;
        this._completionHandled = false;
        this._errorDismissTimer = null;
        this._libraryRefreshQueued = false;
        // Wait-step only appears while actually queued (Basic/Prime/Elite usually skip it)
        this.showQueueWaitTask = false;
        this.genStageOpen = false;
        this._completeSoundUnlocked = false;
        this._completeSoundPlayedFor = new Set();
        this._previewOpenedFor = new Set();
        this._completeAudio = null;
        this._audioCtx = null;
        this._terminalCheckTimers = new Map();

        this._ensureDomRefs();
        this._bindPanelEvents();
        this._bindSoundUnlock();
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
        // Hide "Waiting in queue" unless the server says we're actually waiting
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
        // Explicit gameplay mode, or a concrete clip id (minecraft_1, …)
        if (id === 'gameplay' || (id && !['face_track', 'blank', 'blank_blur', 'reframe'].includes(id))) {
            return {
                label: 'Loading gameplay',
                keywords: ['creating split-screen video', 'gameplay clip'],
            };
        }
        // Missing secondary type — don't invent gameplay
        return {
            label: 'Preparing secondary panel',
            keywords: ['secondary panel', 'layout'],
        };
    }

    _shouldShowQueueWaitTask(message = '', queueInfo = null) {
        if (queueInfo?.queue_status === 'running') return false;
        if (queueInfo?.queue_status === 'waiting') return true;
        const msg = String(message || '').toLowerCase();
        if (msg.includes('high demand') || msg.includes('will be ready')) return true;
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
            // Left the wait step — next active is install at index 0
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
        // Merge so startGeneration({ secondaryType }) doesn't wipe videoTitle/thumbnail
        const merged = {
            ...(this.activeTemplateOptions || {}),
            ...(options || {}),
        };
        const nextOptions = JSON.stringify(merged);

        this.activeTemplateId = normalized;
        this.activeTemplateOptions = merged;

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
        // Keep a short TTL so a new generate with a new id isn't blocked forever
        setTimeout(() => {
            try { this._userCancelledIds?.delete(String(projectId)); } catch (_) {}
        }, 120000);
    }

    _wasUserCancelled(projectId) {
        if (!projectId || !this._userCancelledIds?.size) return false;
        const id = String(projectId);
        if (this._userCancelledIds.has(id)) return true;
        // Also match public↔internal aliases when possible
        for (const cancelled of this._userCancelledIds) {
            if (this._idsLikelySameJob?.(cancelled, id)) return true;
        }
        return false;
    }

    _idsLikelySameJob(a, b) {
        if (!a || !b) return false;
        if (String(a) === String(b)) return true;
        // One public prj_* and one internal user_uuid — treat as same only via resolve map
        const resolved = this._resolveActiveProjectId?.(a) || a;
        const resolvedB = this._resolveActiveProjectId?.(b) || b;
        return String(resolved) === String(resolvedB);
    }

    _isSuccessStatus(status) {
        return (status || '').toLowerCase() === 'completed';
    }

    _shouldForceStatusPoll(gen) {
        if (!gen) return false;
        const progress = Number(gen.progress) || 0;
        const msg = String(gen.message || '').toLowerCase();
        if (progress >= 88) return true;
        return /export|upload|storage|finaliz|encoding final|watermark|uploading/.test(msg);
    }

    _clearTerminalStatusCheck(projectId) {
        if (!this._terminalCheckTimers?.size) return;
        const resolved = this._resolveActiveProjectId(projectId) || projectId;
        for (const key of [resolved, projectId]) {
            const timer = this._terminalCheckTimers.get(key);
            if (timer) clearTimeout(timer);
            this._terminalCheckTimers.delete(key);
        }
    }

    _looksLikeFinishedMessage(message = '', progress = 0) {
        const pct = Number(progress) || 0;
        if (pct >= 100) return true;
        const msg = String(message || '').toLowerCase();
        if (!msg) return false;
        return (
            /\b(done|video ready|processing complete|clip(?:s)? (?:are |is )?ready|compilation complete)\b/.test(msg)
            && !/\b(error|failed|upload(?:ing)? to storage|finalizing upload)\b/.test(msg)
        );
    }

    _scheduleTerminalStatusCheck(projectId) {
        if (!this._isValidProjectId(projectId)) return;
        const resolved = this._resolveActiveProjectId(projectId) || projectId;
        if (this._terminalCheckTimers.has(resolved)) return;

        const run = async (attempt = 0) => {
            if (!this.activeGenerations.has(resolved)) {
                this._terminalCheckTimers.delete(resolved);
                return;
            }
            const gen = this.activeGenerations.get(resolved);
            const data = await this._fetchProjectStatus(resolved);

            if (!data) {
                // Late 404 after export — try library reconcile before giving up
                if (attempt >= 8 && (gen?.progress || 0) >= 88) {
                    try {
                        await this._refreshLibrarySoon?.();
                    } catch (_) { /* ignore */ }
                }
            } else if (this._isSuccessStatus(data.status) || this._looksLikeFinishedMessage(data.message, data.progress)) {
                this._clearTerminalStatusCheck(resolved);
                this.completeGeneration(resolved);
                return;
            } else if (this._isFailureStatus(data.status)) {
                this._clearTerminalStatusCheck(resolved);
                this.failGeneration(resolved, data.message || 'There was an error — try again');
                return;
            } else if (ACTIVE_GENERATION_STATUSES.has((data.status || '').toLowerCase())) {
                this.updateProgress(
                    resolved,
                    data.progress ?? 0,
                    data.message || 'Processing...',
                    true,
                    data.queue || null,
                );
                // Soft-complete: stuck at 98 "Finalizing/Uploading" for many polls
                // while library already has the clip → complete anyway.
                if (
                    attempt >= 10
                    && (data.progress ?? 0) >= 95
                    && /upload|finaliz|storage/i.test(String(data.message || ''))
                ) {
                    const found = await this._libraryHasCompletedProject(resolved);
                    if (found) {
                        this._clearTerminalStatusCheck(resolved);
                        this.completeGeneration(resolved);
                        return;
                    }
                }
            }

            // Keep polling export for ~5 minutes, then fail visibly (never silent stop)
            if (attempt >= 80) {
                this._terminalCheckTimers.delete(resolved);
                this.failGeneration(
                    resolved,
                    'Export is taking too long — refresh Library or try again.',
                );
                return;
            }
            const delay = attempt < 6 ? 1000 : (attempt < 20 ? 2000 : 4000);
            const timer = setTimeout(() => run(attempt + 1), delay);
            this._terminalCheckTimers.set(resolved, timer);
        };

        const kickoff = setTimeout(() => run(0), 400);
        this._terminalCheckTimers.set(resolved, kickoff);
    }

    async _libraryHasCompletedProject(projectId) {
        try {
            const studio = window.clipsStudio;
            if (!studio) return false;
            const ids = new Set([
                String(projectId || ''),
                String(this._resolveActiveProjectId(projectId) || ''),
                String(this._projectAliases?.get(projectId) || ''),
            ].filter(Boolean));
            const pools = [
                ...(studio.libraryItems || []),
                ...(studio.completedItems || []),
                ...(studio.processingItems || []),
            ];
            for (const item of pools) {
                const itemId = String(item?.projectId || item?.id || item?.project_id || '');
                if (!itemId || !ids.has(itemId)) continue;
                const st = String(item?.status || '').toLowerCase();
                if (st === 'completed' || item?._justCompleted) return true;
            }
            if (typeof studio.loadLibrary === 'function') {
                await studio.loadLibrary({ silent: true });
            } else if (typeof studio.refreshLibrary === 'function') {
                await studio.refreshLibrary();
            }
            const pools2 = [
                ...(studio.libraryItems || []),
                ...(studio.completedItems || []),
            ];
            for (const item of pools2) {
                const itemId = String(item?.projectId || item?.id || item?.project_id || '');
                if (itemId && ids.has(itemId)) {
                    const st = String(item?.status || '').toLowerCase();
                    if (st === 'completed' || !st) return true;
                }
            }
        } catch (_) { /* ignore */ }
        return false;
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
            this.errorBanner.title = 'Click to dismiss';
            this.errorBanner.style.cursor = 'pointer';
            if (!this.errorBanner.dataset.dismissBound) {
                this.errorBanner.dataset.dismissBound = '1';
                this.errorBanner.addEventListener('click', () => this._dismissErrorState());
            }
        }
        if (this.todoPanel) this.todoPanel.classList.add('is-error-state');
    }

    _showStuckBanner(message) {
        this._ensureDomRefs();
        const text = message || (
            "We're having some server issues right now — sorry about that. "
            + 'Your generation is still running. First start can take up to 15 minutes.'
        );
        if (this.errorBanner) {
            this.errorBanner.textContent = text;
            this.errorBanner.hidden = false;
            this.errorBanner.classList.add('is-visible', 'is-stuck');
        }
        if (this.todoPanel) {
            this.todoPanel.classList.remove('is-error-state');
            this.todoPanel.classList.add('is-stuck-state');
        }
        if (this.launcher) {
            this.launcher.classList.remove('is-error', 'is-complete');
            this.launcher.classList.add('is-stuck', 'is-active');
        }
        if (this.progressCircle) {
            this.progressCircle.style.stroke = '#eab308';
        }
        if (this.progressTooltip) {
            this.progressTooltip.textContent = 'Still working…';
        }
        if (this.taskCounter) {
            this.taskCounter.textContent = 'Hang tight';
        }
        if (this.genStageOpen && typeof this._showGenStageAlert === 'function') {
            this._showGenStageAlert('warn', 'Still exporting — this can take a minute. Hang tight.');
        }
    }

    _clearStuckBanner() {
        if (this.errorBanner) {
            this.errorBanner.classList.remove('is-stuck');
        }
        if (this.todoPanel) {
            this.todoPanel.classList.remove('is-stuck-state');
        }
        if (this.launcher) {
            this.launcher.classList.remove('is-stuck');
        }
        if (this.genStageOpen && typeof this._showGenStageAlert === 'function') {
            this._showGenStageAlert('', '');
        }
    }

    _hideErrorBanner() {
        if (this.errorBanner) {
            this.errorBanner.hidden = true;
            this.errorBanner.classList.remove('is-visible', 'is-stuck');
        }
        if (this.todoPanel) {
            this.todoPanel.classList.remove('is-error-state', 'is-stuck-state');
        }
        if (this.launcher) {
            this.launcher.classList.remove('is-stuck');
        }
    }

    _maybeMarkStuck(projectId, gen) {
        if (!gen) return;
        const now = Date.now();
        const lastAt = gen._lastProgressAt || gen.startTime || now;
        const lastVal = gen._lastProgressValue ?? gen.progress ?? 0;
        const stale = (now - lastAt) >= this.STUCK_PROGRESS_MS;
        const pollMisses = gen._pollMisses || 0;
        if (stale && gen.progress < 100 && gen.progress === lastVal) {
            this._showStuckBanner();
            if (gen.progress >= 88) this._scheduleTerminalStatusCheck(projectId);
            return;
        }
        if (pollMisses >= 2) {
            this._showStuckBanner();
            if (gen.progress >= 88) this._scheduleTerminalStatusCheck(projectId);
        }
    }

    _shouldFailFromStuck(gen) {
        if (!gen) return false;
        const now = Date.now();
        const lastAt = gen._lastProgressAt || gen.startTime || now;
        const elapsed = now - lastAt;
        const progress = gen.progress ?? 0;
        // GPU cold start sits at low % — do not kill the job early.
        if (progress < 15 && (now - (gen.startTime || now)) < this.GPU_WARMUP_FAIL_MS) {
            return false;
        }
        return elapsed >= this.STUCK_FAIL_MS || (gen._pollMisses || 0) >= 16;
    }

    async _resolveRemovedProject(projectId) {
        const data = await this._fetchProjectStatus(projectId);
        if (!data) {
            const gen = this.activeGenerations.get(projectId);
            const misses = (gen?._pollMisses || 0) + 1;
            if (gen) gen._pollMisses = misses;
            this._maybeMarkStuck(projectId, gen);
            if (this._shouldFailFromStuck(gen)) {
                this.failGeneration(projectId, 'There was an error — try again');
            }
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
                            <circle class="generation-task-spinner-track" cx="25" cy="25" r="20" fill="none" stroke="#f3f4f6" stroke-width="4"></circle>
                            <circle class="generation-task-spinner-arc" cx="25" cy="25" r="20" fill="none" stroke="#ff6b3d" stroke-width="4"
                                stroke-linecap="round" stroke-dasharray="80 126" transform="rotate(-90 25 25)"></circle>
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

        requestAnimationFrame(() => {
            this._getActiveTasks().forEach((_, i) => {
                const el = document.getElementById(`generation-task-${i}`);
                if (!el) return;
                el.style.setProperty('--reveal-delay', `${i * 80}ms`);
                el.classList.add('is-revealed');
            });
        });
    }

    openPanel() {
        if (!this.todoPanel || !this.launcher) return;
        this._ensureTaskList();
        this.launcher.classList.add('is-panel-open');
        this.todoPanel.classList.add('is-open');
        this.panelOpen = true;
        // Full stage opens on generate start / More — not every spinner click

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
        return msg.includes('high demand')
            || msg.includes('will be ready')
            || msg.includes('queued')
            || msg.includes('ahead of you')
            || msg.includes('open slot')
            || msg.includes('starting shortly')
            || msg.includes('processing soon')
            || (msg.includes('queue') && !msg.includes('starting generation'));
    }

    _queueAheadFromMessage(message = '') {
        return null;
    }

    _queueLabelForInfo(message = '', queueInfo = null) {
        return {
            label: 'High demand · Almost there',
            hint: '',
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
        if (!tasks.length) return 0;
        const msg = (message || '').toLowerCase();
        const p = Math.max(0, Math.min(100, Number(progress) || 0));

        if (p >= 100 || msg.includes('processing complete') || msg.includes('video ready')) {
            return tasks.length - 1;
        }

        // Explicit queue wait — pin to the first task and don't advance by %
        if (this.showQueueWaitTask && this._isQueueWaitingMessage(msg)) {
            const waitIdx = tasks.findIndex((t) => t.id === 'wait');
            return waitIdx >= 0 ? waitIdx : 0;
        }

        // Keyword match — late stages first, but never skip ahead of the % band.
        // "Worker ready" / "Download complete" used to match Export and strike every task.
        let byKeyword = -1;
        for (let i = tasks.length - 1; i >= 0; i--) {
            const task = tasks[i];
            if (task.id === 'wait') continue;
            if (!(task.keywords || []).some((kw) => msg.includes(kw))) continue;
            const prevCap = i > 0 ? Number(tasks[i - 1].maxProgress) : 0;
            const canTakeLate = i <= 1 || p >= Math.max(0, prevCap - 8);
            if (!canTakeLate) continue;
            byKeyword = i;
            break;
        }

        // Progress bands — keep ring % and checklist in sync even when messages are vague
        let byBand = 0;
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            if (task.id === 'wait' && !this.showQueueWaitTask) continue;
            const cap = Number(task.maxProgress);
            byBand = i;
            if (Number.isFinite(cap) && p <= cap) break;
        }

        if (byKeyword < 0) return byBand;
        // Keyword may confirm the current/% stage, not jump 3 steps ahead
        if (byKeyword > byBand + 1) return byBand;
        return Math.max(byKeyword, byBand);
    }

    _updateTaskStates(progress, message = '', queueInfo = null) {
        this._ensureTaskList();
        const tasks = this._getActiveTasks();
        const waiting = this.showQueueWaitTask;
        let activeIndex = this._resolveTaskIndex(progress, message);

        // While queued, stay on wait — don't crawl forward from stale %
        if (waiting) {
            const waitIdx = tasks.findIndex((t) => t.id === 'wait');
            activeIndex = waitIdx >= 0 ? waitIdx : 0;
            this.currentTaskIndex = activeIndex;
        } else if (this.currentTaskIndex >= 0 && progress < 100) {
            // Don't crawl backward on noisy messages — unless we clearly skipped
            // ahead (e.g. Export at 8% from "Worker ready").
            const pct = Math.max(0, Number(progress) || 0);
            if (this.currentTaskIndex > activeIndex) {
                const stuckFloor = this.currentTaskIndex > 0
                    ? Number(tasks[this.currentTaskIndex - 1]?.maxProgress) || 0
                    : 0;
                if (pct + 5 < stuckFloor) {
                    this.currentTaskIndex = activeIndex;
                } else {
                    activeIndex = this.currentTaskIndex;
                }
            } else {
                this.currentTaskIndex = activeIndex;
            }
        } else {
            this.currentTaskIndex = activeIndex;
        }

        tasks.forEach((_, i) => {
            const el = document.getElementById(`generation-task-${i}`);
            if (!el) return;
            const wasActive = el.classList.contains('is-active');
            const wasDone = el.classList.contains('is-done');
            el.classList.remove('is-active', 'is-done', 'is-failed', 'is-waiting', 'is-step-pulse');
            if (progress >= 100) {
                el.classList.add('is-done');
            } else if (i < activeIndex) {
                el.classList.add('is-done');
            } else if (i === activeIndex) {
                el.classList.add('is-active');
                if (waiting) el.classList.add('is-waiting');
                if (!wasActive && !wasDone) el.classList.add('is-step-pulse');
            }
            if (el.classList.contains('is-done') && !wasDone) {
                el.classList.add('is-check-pop');
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

    _resolveCompletedProjectId(projectId) {
        const pid = String(projectId || '').trim();
        if (pid && this._isValidProjectId(pid)) return pid;
        if (this.activeGenerations.size === 1) {
            const only = [...this.activeGenerations.keys()][0];
            if (this._isValidProjectId(only)) return only;
        }
        return pid || null;
    }

    _openCompletedClipPreview(projectId) {
        const pid = this._resolveCompletedProjectId(projectId);
        if (!pid || !this._isValidProjectId(pid)) return;
        if (this._previewOpenedFor.has(pid)) return;
        this._previewOpenedFor.add(pid);

        const studio = window.clipsStudio;
        if (!studio) return;

        const openDelay = this.genStageOpen ? 700 : 320;
        setTimeout(() => {
            try {
                if (typeof studio.openLibraryPreviewWhenReady === 'function') {
                    studio.openLibraryPreviewWhenReady(pid, pid);
                } else if (typeof studio.openLibraryPreview === 'function') {
                    studio.openLibraryPreview(pid, pid, null, { fast: true });
                }
            } catch (err) {
                safeLog?.('Auto-open clip preview failed:', err);
            }
        }, openDelay);
    }

    showVideoReadyNotification(projectId) {
        const opts = this.activeTemplateOptions || {};
        const pid = this._resolveCompletedProjectId(projectId);
        const title = String(opts.videoTitle || opts.title || 'Your video').trim() || 'Your video';
        const payload = {
            videoTitle: title,
            videoUrl: '#',
            thumbnailUrl: opts.thumbnailUrl || null,
            message: `${title} is ready`,
            projectId: pid || undefined,
        };
        if (typeof window.notificationSystem?.showVideoGenerated === 'function') {
            window.notificationSystem.showVideoGenerated(payload);
            return;
        }
        if (typeof window.showNotification === 'function') {
            window.showNotification(`${title} is ready`, 'success');
        }
    }

    _notificationSoundCandidates() {
        const base = (typeof window !== 'undefined' && window.location?.origin)
            ? window.location.origin
            : '';
        return [
            '/assets/notification.mp3',
            '/frontend/assets/notification.mp3',
        ].map((p) => `${base}${p}`);
    }

    _ensureCompleteSound() {
        if (this._completeAudio) return this._completeAudio;
        try {
            const audio = new Audio(this._notificationSoundCandidates()[0]);
            audio.preload = 'auto';
            audio.volume = 0.75;
            audio.addEventListener('error', () => {
                const candidates = this._notificationSoundCandidates();
                const idx = candidates.indexOf(audio.src);
                const next = candidates[idx + 1];
                if (next) {
                    audio.src = next;
                    audio.load();
                }
            }, { once: true });
            this._completeAudio = audio;
        } catch (_) {
            this._completeAudio = null;
        }
        return this._completeAudio;
    }

    _bindSoundUnlock() {
        if (this._soundUnlockBound) return;
        this._soundUnlockBound = true;
        const unlock = () => {
            this._unlockCompleteSound();
            if (this._completeSoundUnlocked) {
                document.removeEventListener('pointerdown', unlock, true);
                document.removeEventListener('keydown', unlock, true);
            }
        };
        document.addEventListener('pointerdown', unlock, true);
        document.addEventListener('keydown', unlock, true);
    }

    /** Unlock autoplay after a user gesture (generate click). */
    _unlockCompleteSound() {
        if (this._completeSoundUnlocked) return;
        const audio = this._ensureCompleteSound();
        const resumeCtx = () => {
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (Ctx && !this._audioCtx) this._audioCtx = new Ctx();
                if (this._audioCtx?.state === 'suspended') {
                    this._audioCtx.resume().catch(() => {});
                }
            } catch (_) { /* ignore */ }
        };
        resumeCtx();
        if (!audio) {
            this._completeSoundUnlocked = true;
            return;
        }
        try {
            const prevVol = audio.volume;
            audio.volume = 0;
            const playPromise = audio.play();
            const settle = () => {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.volume = prevVol || 0.75;
                } catch (_) { /* ignore */ }
                this._completeSoundUnlocked = true;
            };
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(settle).catch(() => {
                    try { audio.volume = prevVol || 0.75; } catch (_) { /* ignore */ }
                    this._completeSoundUnlocked = true;
                });
            } else {
                settle();
            }
        } catch (_) {
            this._completeSoundUnlocked = true;
        }
    }

    _playSynthCompleteSound() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return false;
            if (!this._audioCtx) this._audioCtx = new Ctx();
            const ctx = this._audioCtx;
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            const t = ctx.currentTime;
            const tone = (freq, start, dur, vol = 0.12) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(vol, start + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + dur + 0.04);
            };
            tone(880, t, 0.11, 0.1);
            tone(1174.66, t + 0.12, 0.2, 0.09);
            tone(1567.98, t + 0.28, 0.22, 0.07);
            return true;
        } catch (_) {
            return false;
        }
    }

    _playGenerationCompleteSoundOnce(projectId) {
        const key = String(projectId || this._lastKnownProjectId || '_global');
        if (this._completeSoundPlayedFor.has(key)) return;
        this._completeSoundPlayedFor.add(key);
        this._playGenerationCompleteSound();
    }

    _playGenerationCompleteSound() {
        // Synth is reliable after gesture unlock; MP3 is a nicer layer when cached.
        const playedSynth = this._playSynthCompleteSound();
        const tryMp3 = () => {
            const audio = this._ensureCompleteSound();
            if (!audio) return Promise.reject(new Error('no audio'));
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0.75;
            return audio.play();
        };
        if (!playedSynth) {
            tryMp3().catch(() => {});
        } else {
            tryMp3().catch(() => {});
        }
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
                _lastProgressAt: Date.now(),
                _lastProgressValue: Math.max(0, Math.min(100, progress || 0)),
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
        if (!this.wrapper || !this.progressCircle) return;
        if (this.activeGenerations.size === 0) {
            if (this.optimisticPending) {
                this.displayProgress(
                    this._optimisticProgress || 0,
                    this._optimisticMessage || 'Starting…',
                );
            }
            return;
        }

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

        // Also unlock Use Template — was left disabled after the first generation
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
            if (window.solisApiGate && !window.solisApiGate.allowPoll()) return null;
            const response = await fetch(this._statusUrl(projectId), {
                method: 'GET',
                credentials: 'include',
                headers: this._requestHeaders(),
                solisOptionalPoll: true,
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
            if (
                normalized === 'completed'
                || this._looksLikeFinishedMessage(message, progress)
            ) {
                this._ensureCompletedLibraryItem(activeId, data || {});
                this.completeGeneration(activeId);
            } else if (this._isCancelledStatus(normalized)) {
                this.stopGeneration(activeId, message || 'Stopped');
            } else if (this._isFailureStatus(normalized)) {
                this.failGeneration(activeId, message || 'There was an error — try again');
            } else if (ACTIVE_GENERATION_STATUSES.has(normalized)) {
                if (!this._resolveActiveProjectId(project_id) && !this.activeGenerations.has(project_id)) return;
                this._markWsFresh(activeId);
                this.updateProgress(activeId, progress ?? 0, message || 'Processing...', true, queue || null);
                if ((progress ?? 0) >= 88) {
                    this._scheduleTerminalStatusCheck(activeId);
                }
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

            this._ensureCompletedLibraryItem(project_id, {
                video_title,
                thumbnail_url,
                template_name,
                template,
                virality: data?.virality,
            });

            if (typeof window.notificationSystem?.showVideoGenerated === 'function') {
                window.notificationSystem.showVideoGenerated({
                    videoTitle: video_title || `Video ${String(project_id).substring(0, 8)}...`,
                    videoUrl: output_path || '#',
                    thumbnailUrl: thumbnail_url || null,
                    message: 'Your video has been generated successfully!',
                    projectId: project_id,
                });
            } else if (typeof window.showNotification === 'function') {
                window.showNotification('Your video has been generated successfully!', 'success');
            }
            this._refreshLibrarySoon();
            // Avoid double toast from completeGeneration → showVideoReadyNotification
            const prevNotify = this.showVideoReadyNotification;
            this.showVideoReadyNotification = () => {};
            this.completeGeneration(activeId);
            this.showVideoReadyNotification = prevNotify.bind(this);
        });

        solisWSClient.on('error', (data) => {
            const projectId = data?.taskId || data?.project_id;
            if (projectId && this._isValidProjectId(projectId)) {
                this.failGeneration(projectId, data?.error || data?.message || 'There was an error — try again');
            }
        });
    }

    beginOptimisticGeneration(message = 'Fetching video...', templateId = DEFAULT_PIPELINE_TEMPLATE, options = {}) {
        this._unlockCompleteSound();
        this._setActivePipeline(templateId, options);
        this.optimisticPending = true;
        this._optimisticProgress = 0;
        this._optimisticMessage = this._cleanMessage(message) || 'Fetching video…';
        this.currentTaskIndex = -1;
        this.completedTaskCount = 0;
        this.showQueueWaitTask = false;
        this._ensureDomRefs();
        this._unlockCompleteSound();
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

    /**
     * Start never got a project_id (API rejected / network / limit).
     * Show the Solis Tasks error state instead of silently vanishing.
     */
    failOptimisticStart(message = 'Could not start generation — try again') {
        const safeMessage = this._cleanMessage(message)
            || 'Could not start generation — try again';
        this._clearErrorDismissTimer();
        this.optimisticPending = false;
        this._optimisticProgress = 0;
        this._optimisticMessage = '';
        this._completionHandled = false;
        this.stopPolling();
        this._unlockUrlSubmitButton();

        if (typeof this.openGenStage === 'function' && !this.genStageOpen) {
            try { this.openGenStage({ reveal: false }); } catch (_) { /* ignore */ }
        }

        this._ensureDomRefs();
        if (this.wrapper) this.wrapper.style.display = 'flex';
        this._ensureTaskList();
        this._markTasksFailed();
        this._clearStuckBanner();

        if (this.launcher) {
            this.launcher.classList.remove('is-complete', 'is-stuck', 'is-queued');
            this.launcher.classList.add('is-error', 'is-active');
        }
        if (this.progressCircle) {
            this.progressCircle.style.strokeDashoffset = '0';
            this.progressCircle.style.stroke = '#ef4444';
        }
        if (this.progressText) {
            this.progressText.textContent = '✕';
        }
        if (this.progressTooltip) {
            this.progressTooltip.textContent = safeMessage;
        }
        if (this.genStageOpen && typeof this._syncGenStageOutcome === 'function') {
            this._syncGenStageOutcome('error', safeMessage);
        }
        if (this.taskCounter) {
            this.taskCounter.textContent = 'Failed';
        }

        this._showErrorBanner(safeMessage);
        this.openPanel();
        try {
            const toast = window.__solisShowNotification || window.showNotification;
            if (typeof toast === 'function') toast(safeMessage, 'error');
            if (typeof window.notificationSystem?.add === 'function') {
                window.notificationSystem.add({
                    title: 'Could not start',
                    message: safeMessage,
                    icon: 'error',
                });
            }
        } catch (_) { /* ignore */ }

        // Keep start-failures visible — silent hide made it look like nothing happened
        this._errorDismissTimer = setTimeout(() => {
            this._dismissErrorState();
        }, 16000);
    }

    startGeneration(projectId, message = 'Fetching video...', templateId = null, options = {}) {
        if (!this._isValidProjectId(projectId)) return;
        if (this._wasUserCancelled(projectId)) {
            // User stopped before startGeneration registered — don't revive
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
        this._unlockCompleteSound();
        if (this.wrapper) this.wrapper.style.display = 'flex';
        this._ensureTaskList();
        if (!this.panelOpen) this.openPanel();

        // Register immediately — don't wait on verify (that was a multi-hundred-ms stall)
        this.optimisticPending = false;
        this._optimisticProgress = 0;
        this._optimisticMessage = '';
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
            // Soft check only — never kill an in-flight generation if verify flakes
            if (!allowed) {
                console.warn('[GENERATION] WebSocket verify soft-failed; continuing with polling', projectId);
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
        .then(async (response) => {
            let data = null;
            try { data = await response.json(); } catch (_) { data = null; }
            if (!response.ok) {
                console.warn('[GENERATION] verify HTTP', response.status, data);
                callback(false);
                return;
            }
            callback(!!data?.allowed);
        })
        .catch((err) => {
            console.warn('[GENERATION] verify network error', err);
            callback(false);
        });
    }

    updateProgress(projectId, progress, message = '', force = false, queueInfo = null) {
        if (!this._isValidProjectId(projectId)) return;
        progress = Math.max(0, Math.min(100, Math.floor(progress)));

        // Map public prj_* ↔ internal ids onto the tracked entry
        const resolvedId = this._resolveActiveProjectId(projectId) || projectId;
        if (resolvedId !== projectId) this._linkProjectAliases(projectId, resolvedId);

        // Never resurrect a finished job from late WS/poll noise (left UI on "Compiling")
        if (!this.activeGenerations.has(resolvedId)) {
            if (this.optimisticPending) {
                this._optimisticProgress = Math.max(this._optimisticProgress || 0, progress);
                if (message) this._optimisticMessage = message;
                this.displayProgress(
                    this._optimisticProgress,
                    this._optimisticMessage || message || 'Starting…',
                    queueInfo,
                );
                return;
            }
            if (this._completionHandled || this.activeGenerations.size === 0) {
                return;
            }
            return;
        }

        // Don't fake progress while sitting in the worker queue
        const waiting = this._shouldShowQueueWaitTask(message, queueInfo);
        if (waiting) {
            progress = Math.min(progress, 2);
        }
        this._setQueueWaitVisible(waiting);

        const gen = this.activeGenerations.get(resolvedId);
        const progressIncreased = progress > gen.progress;
        const messageChanged = message && message !== gen.message;
        const queueChanged = queueInfo && JSON.stringify(queueInfo) !== JSON.stringify(gen.queueInfo || null);
        if (!force && !progressIncreased && !messageChanged && !queueChanged) {
            this._maybeMarkStuck(resolvedId, gen);
            return;
        }
        if (waiting) {
            gen.progress = Math.min(progress, 2);
        } else {
            gen.progress = Math.max(gen.progress, progress);
        }
        if (message) gen.message = message;
        if (queueInfo) gen.queueInfo = queueInfo;
        else if (!this._isQueueWaitingMessage(gen.message)) gen.queueInfo = null;

        if (progressIncreased || messageChanged) {
            gen._lastProgressAt = Date.now();
            gen._lastProgressValue = gen.progress;
            gen._pollMisses = 0;
            this._clearStuckBanner();
        }

        if (gen.progress >= 88 || progress >= 100) {
            this._scheduleTerminalStatusCheck(resolvedId);
        }

        this._syncCancelLockOnSubmitButton(progress, message);
        this._ensureDomRefs();
        this._syncDisplayFromActive();
    }

    /** Late encode — cancel UI removed; keep button in generating state. */
    _isCancelLockedStage(progress = 0, message = '') {
        return false;
    }

    _syncCancelLockOnSubmitButton(progress, message) {
        const submitBtn = document.getElementById('processUrlBtn');
        if (!submitBtn || !submitBtn.classList.contains('is-generating')) return;
        submitBtn.classList.remove('is-cancel-locked');
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-label', 'Generating…');
        submitBtn.title = 'Generating…';
    }

    _cleanMessage(message) {
        if (!message || typeof message !== 'string') return '';
        let cleaned = message
            .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();

        const lower = cleaned.toLowerCase();

        // Infra / compute / network meter — never show to users
        const leak =
            /\b(vast\.?ai|modal\.com|runpod|serverless|rtx\s*\d+|gtx\s*\d+|a100|h100|l40|dph|\$\/hr)\b/i.test(cleaned)
            || /\b(gpu|cpu)\s+worker\b/i.test(cleaned)
            || /\bqueued on (vast|modal|cloud)\b/i.test(cleaned)
            || /\binstance[=\s#:]?\s*\d{5,}\b/i.test(cleaned)
            || /\b\d+(\.\d+)?\s*(MB\/s|MiB\/s|KB\/s|KiB\/s|Gbps|Mbps)\b/i.test(cleaned)
            || /\b\d+(\.\d+)?\s*(MB|MiB|GB|GiB)\b/i.test(cleaned)
            || /\bat\s+\d+(\.\d+)?\s*(MB|KB)/i.test(cleaned)
            || /\b(traceback|exception|errno|http\/?\d|status[=\s]\d{3})\b/i.test(cleaned);

        if (leak) {
            if (/download|install|fetch|stream/i.test(lower)) return 'Fetching video...';
            if (/fail|error|crash|exception/i.test(lower)) return 'Something went wrong — try again';
            if (/queue|wait|slot|priority|high demand|will be ready/i.test(lower)) {
                return 'We’re experiencing very high demand — your generation will be ready soon.';
            }
            if (/starting|start|processing|worker|boot|load/i.test(lower)) return 'Fetching video...';
            return '';
        }

        cleaned = cleaned
            .replace(/\b\d+(\.\d+)?\s*(MB\/s|MiB\/s|KB\/s|KiB\/s|Gbps|Mbps)\b/gi, '')
            .replace(/\([^)]*\.(mp4|wav|webm|mkv)[^)]*\)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        return cleaned;
    }

    _friendlyErrorMessage(message = '') {
        const cleaned = this._cleanMessage(message);
        if (!cleaned) return 'Something went wrong — try again';
        const lower = cleaned.toLowerCase();
        if (
            lower.includes('youtube')
            && (lower.includes('proxy') || lower.includes('cookie') || lower.includes('bot'))
        ) {
            return 'YouTube blocked the download — tokens auto-refresh on retry; wait a moment and try again.';
        }
        if (
            /\b(vast|modal|gpu|rtx|serverless|traceback|exception|errno)\b/i.test(cleaned)
            || lower.includes('failed:')
            || lower.length > 140
        ) {
            return 'Something went wrong — try again';
        }
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
        if (progress >= 100) {
            // Prefer short success copy over raw backend strings
            if (!cleaned || /complete|done|ready|success/i.test(cleaned)) return 'Complete!';
            return cleaned;
        }
        // Always prefer pipeline stage labels — never flash raw backend chatter
        if (taskLabel) return taskLabel;
        return cleaned || `${progress}% complete`;
    }

    displayProgress(progress, message = '', queueInfo = null) {
        this._ensureDomRefs();
        if (!this.wrapper || !this.progressCircle) return;

        const cleaned = this._cleanMessage(message);
        this._setQueueWaitVisible(this._shouldShowQueueWaitTask(cleaned, queueInfo));
        const waiting = this.showQueueWaitTask;
        // Keep the ring nearly idle while waiting for a worker slot
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
        if (this.genStageOpen) {
            try {
                if (typeof this._syncGenStageSteps === 'function') {
                    this._syncGenStageSteps(displayPct, cleaned);
                }
                if (typeof this._fillGenStageVideoMeta === 'function') {
                    this._fillGenStageVideoMeta();
                }
            } catch (_) { /* stage sync must never break the launcher */ }
        }
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

        // One live job: treat any valid id (public prj_* or internal) as that job
        if (this.activeGenerations.size === 1) {
            const only = [...this.activeGenerations.keys()][0];
            this._linkProjectAliases(projectId, only);
            return only;
        }

        // Dual-track bug: both prj_* and internal id registered for the same run
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
        this._clearTerminalStatusCheck(projectId);
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

        // Same-run dual ids left behind after a partial delete
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

    /**
     * Local-only progress for library edits (recompose + download) — no server polling.
     */
    async runLibraryApplyFlow(projectId, { applyFn, downloadFn }) {
        // Library public ids are prj_*; also allow legacy user_uuid. Don't hard-block apply.
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

    _ensureCompletedLibraryItem(projectId, extra = {}) {
        const studio = window.clipsStudio;
        if (!studio) return;
        if (!Array.isArray(studio.libraryItems)) studio.libraryItems = [];
        const pid = String(projectId || '').trim();
        if (!pid || !this._isValidProjectId(pid)) return;

        const same = (item) => {
            const id = String(item?.projectId || item?.id || '');
            return id === pid || this._idsLikelySameJob(id, pid);
        };
        let item = studio.libraryItems.find(same);
        if (!item) {
            item = {
                id: pid,
                projectId: pid,
                name: extra.video_title || extra.name || extra.template_name || 'Clip',
                template: extra.template || this.activeTemplateId,
                templateName: extra.template_name || extra.templateName || '',
                timestamp: extra.created_at ? new Date(extra.created_at) : new Date(),
                status: 'completed',
                thumbnailUrl: extra.thumbnail_url || extra.thumbnailUrl || null,
                virality: extra.virality || null,
                _optimistic: true,
                _justCompleted: true,
            };
            studio.libraryItems.unshift(item);
        } else {
            item.status = 'completed';
            item._justCompleted = true;
            if (extra.video_title) item.name = extra.video_title;
            if (extra.thumbnail_url || extra.thumbnailUrl) {
                item.thumbnailUrl = extra.thumbnail_url || extra.thumbnailUrl;
            }
            if (extra.template) item.template = extra.template;
            if (extra.template_name || extra.templateName) {
                item.templateName = extra.template_name || extra.templateName;
            }
            if (extra.virality) item.virality = extra.virality;
        }
        studio._libraryLastLoaded = 0;
        try { studio.saveLibraryItems?.(); } catch (_) {}
        if (!studio.libraryPreviewModalOpen) {
            studio.updateLibraryView?.();
        } else {
            studio._libraryRefreshPending = true;
        }
    }

    _refreshLibrarySoon() {
        if (this._libraryRefreshQueued) return;
        this._libraryRefreshQueued = true;
        const gaps = [800, 5000];
        const run = (attempt = 0) => {
            this._libraryRefreshQueued = attempt < gaps.length - 1;
            if (typeof updateStorageBadgeDisplay === 'function') {
                updateStorageBadgeDisplay();
            }
            if (window.clipsStudio?.loadLibraryItems) {
                if (attempt === 0) window.clipsStudio._libraryLastLoaded = 0;
                window.clipsStudio.loadLibraryItems({ soft: true, force: attempt === 0 })
                    .catch(() => {})
                    .finally(() => {
                        // Railway/R2 metadata often lands after status=completed
                        if (attempt < gaps.length - 1) {
                            setTimeout(() => run(attempt + 1), gaps[attempt + 1]);
                        } else {
                            this._libraryRefreshQueued = false;
                        }
                    });
            } else {
                this._libraryRefreshQueued = false;
            }
        };
        setTimeout(() => run(0), gaps[0]);
    }

    completeGeneration(projectId) {
        // Always pin a library card + refetch — even if this completion is a duplicate.
        // Modal jobs emit clips_status_update without video_ready; a too-early
        // /clips/projects miss used to drop the clip entirely.
        this._ensureCompletedLibraryItem(projectId);
        this._refreshLibrarySoon();

        const skipStateMutation = this._completionHandled
            && this.activeGenerations.size === 0
            && !this.optimisticPending;

        if (!skipStateMutation) {
            if (projectId && this._isValidProjectId(projectId)) {
                this._deleteGeneration(projectId);
            } else if (this.activeGenerations.size === 1) {
                const only = [...this.activeGenerations.keys()][0];
                this._deleteGeneration(only);
            }

            this.optimisticPending = false;
            this._completionHandled = true;
            this._syncGeneratingBadge();
        }

        this._playGenerationCompleteSoundOnce(projectId);
        if (!skipStateMutation) {
            this.showVideoReadyNotification(projectId);
        }
        this.displayProgress(100, 'Processing complete! Video ready!');
        if (this.genStageOpen && typeof this._syncGenStageOutcome === 'function') {
            this._syncGenStageOutcome('complete', 'Your clip is ready — opening preview…');
        }
        this._openCompletedClipPreview(projectId);
        this._unlockUrlSubmitButton();

        if (skipStateMutation) {
            return;
        }

        if (this.activeGenerations.size === 0) {
            this.stopPolling();
            // Hold the ready state so the user sees completion in the gen stage
            const delay = this.genStageOpen ? 4200 : 900;
            setTimeout(() => {
                this._completionHandled = false;
                if (typeof this.closeGenStage === 'function') this.closeGenStage();
                this.closePanel();
                this.hide();
            }, delay);
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
        const safeMessage = this._friendlyErrorMessage(message);
        this._notifyGenerationFailed(projectId, safeMessage);
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
        this._clearStuckBanner();

        if (this.launcher) {
            this.launcher.classList.remove('is-complete', 'is-stuck');
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
            this.progressTooltip.textContent = safeMessage;
        }
        if (this.genStageOpen && typeof this._syncGenStageOutcome === 'function') {
            this._syncGenStageOutcome('error', safeMessage);
        }
        if (this.taskCounter) {
            this.taskCounter.textContent = 'Failed';
        }

        this._showErrorBanner(safeMessage);
        this.openPanel();
        try {
            const toast = window.__solisShowNotification || window.showNotification;
            if (typeof toast === 'function') toast(safeMessage, 'error');
            if (typeof window.notificationSystem?.add === 'function') {
                window.notificationSystem.add({
                    title: 'Generation failed',
                    message: safeMessage,
                    icon: 'error',
                });
            }
        } catch (_) { /* ignore */ }

        // Keep failures visible long enough to notice (was 2.8s — looked like a no-op)
        const dismissMs = /youtube|proxy|cookie|start|could not/i.test(safeMessage)
            ? 16000
            : 10000;
        this._errorDismissTimer = setTimeout(() => {
            this._dismissErrorState();
        }, dismissMs);
    }

    /** User stopped generation — unlock quietly without a red error flash. */
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
            this.progressTooltip.textContent = 'Stopped';
        }
        if (this.taskCounter) {
            this.taskCounter.textContent = 'Stopped';
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
                // Prefer websocket progress — but always verify terminal/export stages via HTTP
                const forcePoll = this._shouldForceStatusPoll(gen);
                if (gen._lastWsAt && (now - gen._lastWsAt) < this.WS_FRESH_MS && !forcePoll) {
                    continue;
                }
                const data = await this._fetchProjectStatus(projectId);
                if (!data) {
                    const misses = (gen._pollMisses || 0) + 1;
                    gen._pollMisses = misses;
                    this._maybeMarkStuck(projectId, gen);
                    if (this._shouldFailFromStuck(gen)) {
                        await this._resolveRemovedProject(projectId);
                    }
                    continue;
                }
                gen._pollMisses = 0;

                const status = (data.status || '').toLowerCase();
                if (this._isSuccessStatus(status) || this._looksLikeFinishedMessage(data.message, data.progress)) {
                    this.completeGeneration(projectId);
                } else if (ACTIVE_GENERATION_STATUSES.has(status)) {
                    const progress = data.progress ?? 0;
                    const msg = data.message || 'Processing...';
                    this.updateProgress(projectId, progress, msg, true, data.queue || null);
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
            let delay = wsOk ? this.POLLING_INTERVAL_WS : this.POLLING_INTERVAL;
            // Backend restart / circuit open — slow way down instead of retry storms
            try {
                if (window.solisApiGate && !window.solisApiGate.allowPoll()) {
                    delay = Math.max(delay, 20000);
                }
            } catch (_) { /* ignore */ }
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
