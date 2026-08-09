const GENERATION_TASK_PIPELINES = {
  ranked_compilation: [ {
    id: "wait",
    label: "Free queue · Processing soon",
    keywords: [ "queued", "queue", "ahead of you", "open slot", "starting shortly", "free queue", "priority", "processing soon" ],
    maxProgress: 8
  }, {
    id: "install",
    label: "Installing video",
    keywords: [ "download", "installing", "preparing download", "starting generation", "starting download", "fetching" ],
    maxProgress: 35
  }, {
    id: "clip",
    label: "Clipping moments",
    keywords: [ "moment", "detect", "segment", "highlight", "analyz", "extract", "audio", "finding", "post-process", "scene", "operator" ],
    maxProgress: 62
  }, {
    id: "overlay",
    label: "Overlaying ranking",
    keywords: [ "overlay", "ranking", "title", "progressive", "hook text", "writing ai" ],
    maxProgress: 78
  }, {
    id: "compile",
    label: "Compiling video",
    keywords: [ "compil", "concat", "timeline", "master extract", "encoding master", "assembling" ],
    maxProgress: 90
  }, {
    id: "export",
    label: "Exporting",
    keywords: [ "export", "encoding final", "finaliz", "final touch", "watermark", "caption", "ready", "complete", "done" ],
    maxProgress: 100
  } ],
  splitscreen: [ {
    id: "wait",
    label: "Free queue · Processing soon",
    keywords: [ "queued", "queue", "ahead of you", "open slot", "starting shortly", "free queue", "priority", "processing soon" ],
    maxProgress: 8
  }, {
    id: "install",
    label: "Installing video",
    keywords: [ "download", "installing", "preparing download", "starting generation", "starting download" ],
    maxProgress: 30
  }, {
    id: "moment",
    label: "Finding best moment",
    keywords: [ "moment", "audio", "analyz", "finding", "extract", "30-second", "30 second", "adaptive" ],
    maxProgress: 55
  }, {
    id: "secondary",
    label: "Preparing secondary panel",
    keywords: [ "reframe", "face", "gameplay", "minecraft", "layout", "secondary", "panel" ],
    maxProgress: 70
  }, {
    id: "compose",
    label: "Building split screen",
    keywords: [ "split-screen", "split screen", "compos", "stack", "creating split" ],
    maxProgress: 88
  }, {
    id: "export",
    label: "Exporting",
    keywords: [ "export", "encoding final", "finaliz", "final touch", "watermark", "caption", "ready", "complete", "done" ],
    maxProgress: 100
  } ],
  library_apply: [ {
    id: "apply",
    label: "Applying changes",
    keywords: [ "apply", "applying", "recompose", "layout", "changes", "reframe", "split" ],
    maxProgress: 70
  }, {
    id: "download",
    label: "Downloading",
    keywords: [ "download", "export", "saving", "ready", "finaliz", "complete" ],
    maxProgress: 100
  } ]
};

const DEFAULT_PIPELINE_TEMPLATE = "ranked_compilation";

const ACTIVE_GENERATION_STATUSES = new Set([ "queued", "downloading", "processing" ]);

class GenerationProgressSpinner {
  constructor() {
    this.wrapper = document.getElementById("generationProgressWrapper");
    this.launcher = document.getElementById("generationLauncher");
    this.progressCircle = document.getElementById("progressCircle");
    this.progressText = document.getElementById("generationProgressText");
    this.progressCheck = document.getElementById("generationProgressCheck");
    this.progressTooltip = document.getElementById("generationProgressTooltip");
    this.todoPanel = document.getElementById("generationTodoPanel");
    this.todoList = document.getElementById("generationTodoList");
    this.taskCounter = document.getElementById("generationTaskCounter");
    this.errorBanner = document.getElementById("generationErrorBanner");
    this.activeGenerations = new Map;
    this._projectAliases = new Map;
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
    this._userCancelledIds = new Set;
    this._lastKnownProjectId = null;
    this.CIRCLE_CIRCUMFERENCE = 126;
    this.STORAGE_KEY = "solisAI_activeGenerations";
    this.TEMPLATE_META_KEY = "solisAI_generationTemplateMeta";
    this.GENERATING_COUNT_KEY = "solisAI_generatingCount";
    this.activeTemplateId = DEFAULT_PIPELINE_TEMPLATE;
    this.activeTemplateOptions = {};
    this.POLLING_INTERVAL = 4500;
    this.POLLING_INTERVAL_WS = 12e3;
    this.WS_FRESH_MS = 1e4;
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
    if (typeof solisWSClient !== "undefined" && solisWSClient !== null) {
      this.setupWebSocketHandlers();
    }
    setTimeout(() => {
      if (typeof solisWSClient !== "undefined" && solisWSClient !== null && !this.wsHandlersSetup) {
        this.setupWebSocketHandlers();
      }
    }, 1e3);
    this._scheduleServerSync();
  }
  _ensureDomRefs() {
    if (!this.wrapper) this.wrapper = document.getElementById("generationProgressWrapper");
    if (!this.launcher) this.launcher = document.getElementById("generationLauncher");
    if (!this.progressCircle) this.progressCircle = document.getElementById("progressCircle");
    if (!this.progressText) this.progressText = document.getElementById("generationProgressText");
    if (!this.progressCheck) this.progressCheck = document.getElementById("generationProgressCheck");
    if (!this.progressTooltip) this.progressTooltip = document.getElementById("generationProgressTooltip");
    if (!this.todoPanel) this.todoPanel = document.getElementById("generationTodoPanel");
    if (!this.todoList) this.todoList = document.getElementById("generationTodoList");
    if (!this.taskCounter) this.taskCounter = document.getElementById("generationTaskCounter");
    if (!this.errorBanner) this.errorBanner = document.getElementById("generationErrorBanner");
  }
  _restoreFromLocalStorageImmediate() {
    try {
      const e = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]");
      for (const t of e) {
        if (!this._isValidProjectId(t) || this.activeGenerations.has(t)) continue;
        this.activeGenerations.set(t, {
          startTime: Date.now(),
          progress: 0,
          message: "Resuming..."
        });
      }
      if (this.activeGenerations.size > 0) {
        this._ensureDomRefs();
        if (this.wrapper) this.wrapper.style.display = "flex";
        this._ensureTaskList();
        this._syncDisplayFromActive();
        this._syncGeneratingBadge();
      }
    } catch (e) {}
  }
  _scheduleServerSync() {
    const e = [ 0, 500, 1500, 3e3, 5e3 ];
    const t = this._syncRetryAttempt;
    if (t >= this._syncRetryMax) return;
    const s = e[Math.min(t, e.length - 1)];
    setTimeout(async () => {
      if (this.serverSyncDone) return;
      const e = await this._syncFromServerAttempt();
      if (!e && !this.serverSyncDone) {
        this._syncRetryAttempt += 1;
        if (this._syncRetryAttempt < this._syncRetryMax) {
          this._scheduleServerSync();
        }
      }
    }, s);
  }
  _apiBase() {
    return window.API_BASE_URL || window.API_BASE || "/api";
  }
  _requestHeaders() {
    if (typeof getAuthHeaders === "function") {
      return getAuthHeaders();
    }
    return {
      "Content-Type": "application/json"
    };
  }
  _isValidProjectId(e) {
    if (!e || typeof e !== "string") return false;
    if (/[\.\/\\:|<>"'\x00]/.test(e)) return false;
    return /^prj_[A-Za-z0-9]{12,}$/.test(e) || /^[0-9]+_[a-zA-Z0-9-]+$/.test(e);
  }
  _normalizeTemplateId(e) {
    if (!e || typeof e !== "string") return DEFAULT_PIPELINE_TEMPLATE;
    if (e === "splitscreen") return "splitscreen";
    if (e.includes("rank") || e === "ranked_compilation" || e === "ranking_moments") {
      return "ranked_compilation";
    }
    return GENERATION_TASK_PIPELINES[e] ? e : DEFAULT_PIPELINE_TEMPLATE;
  }
  _getActiveTasks() {
    const e = this._normalizeTemplateId(this.activeTemplateId);
    let t = GENERATION_TASK_PIPELINES[e] || GENERATION_TASK_PIPELINES[DEFAULT_PIPELINE_TEMPLATE];
    if (!this.showQueueWaitTask) {
      t = t.filter(e => e.id !== "wait");
    }
    if (e !== "splitscreen") return t;
    const s = this._splitscreenSecondaryTaskLabel(this.activeTemplateOptions?.secondaryType || this.activeTemplateOptions?.splitscreen_secondary_type || this.activeTemplateOptions?.gameplay_clip_id);
    return t.map(e => {
      if (e.id !== "secondary") return e;
      return {
        ...e,
        label: s.label,
        keywords: [ ...e.keywords, ...s.keywords ]
      };
    });
  }
  _splitscreenSecondaryTaskLabel(e) {
    const t = String(e || "").toLowerCase();
    if (t === "face_track" || t === "reframe") {
      return {
        label: "Reframing face",
        keywords: [ "applying reframe", "face track", "reframe" ]
      };
    }
    if (t === "blank") {
      return {
        label: "Preparing black panel",
        keywords: [ "blank", "black panel", "canvas", "solid" ]
      };
    }
    if (t === "blank_blur") {
      return {
        label: "Preparing blur panel",
        keywords: [ "blank", "blur", "canvas", "backdrop" ]
      };
    }
    if (t === "gameplay" || t && ![ "face_track", "blank", "blank_blur", "reframe" ].includes(t)) {
      return {
        label: "Loading gameplay",
        keywords: [ "creating split-screen video", "gameplay clip" ]
      };
    }
    return {
      label: "Preparing secondary panel",
      keywords: [ "secondary panel", "layout" ]
    };
  }
  _shouldShowQueueWaitTask(e = "", t = null) {
    if (t?.queue_status === "running") return false;
    if (t?.queue_status === "waiting") return true;
    const s = Number.isFinite(Number(t?.users_ahead)) ? Number(t.users_ahead) : this._queueAheadFromMessage(e);
    if (s != null && s > 0) return true;
    const i = String(e || "").toLowerCase();
    if (i.includes("ahead of you") || i.includes("open slot")) return true;
    if (i.includes("queued") && i.includes("waiting")) return true;
    return false;
  }
  _setQueueWaitVisible(e) {
    const t = Boolean(e);
    if (this.showQueueWaitTask === t) return false;
    const s = this.showQueueWaitTask;
    this.showQueueWaitTask = t;
    this.tasksInitialized = false;
    this.tasksIntroPlayed = false;
    this._clearIntroRevealTimers();
    if (this.todoList) this.todoList.innerHTML = "";
    if (s && !t && this.currentTaskIndex > 0) {
      this.currentTaskIndex = Math.max(0, this.currentTaskIndex - 1);
    } else if (!s && t) {
      this.currentTaskIndex = 0;
    } else if (s && !t && this.currentTaskIndex === 0) {
      this.currentTaskIndex = 0;
    }
    this._ensureTaskList();
    if (this.panelOpen) this._playTasksIntro();
    return true;
  }
  _setActivePipeline(e, t = {}) {
    const s = this._normalizeTemplateId(e);
    const i = this.activeTemplateId;
    const r = JSON.stringify(this.activeTemplateOptions || {});
    const n = JSON.stringify(t || {});
    this.activeTemplateId = s;
    this.activeTemplateOptions = t || {};
    if (i !== s || r !== n) {
      this.tasksInitialized = false;
      this.tasksIntroPlayed = false;
      this._resetTaskVisibility();
      if (this.todoList) this.todoList.innerHTML = "";
    }
  }
  _saveTemplateMeta(e, t, s = {}) {
    if (!this._isValidProjectId(e)) return;
    try {
      const i = JSON.parse(localStorage.getItem(this.TEMPLATE_META_KEY) || "{}");
      i[e] = {
        templateId: this._normalizeTemplateId(t),
        options: s || {}
      };
      localStorage.setItem(this.TEMPLATE_META_KEY, JSON.stringify(i));
    } catch (e) {}
  }
  _getTemplateMeta(e) {
    if (!this._isValidProjectId(e)) return null;
    try {
      const t = JSON.parse(localStorage.getItem(this.TEMPLATE_META_KEY) || "{}");
      return t[e] || null;
    } catch (e) {
      return null;
    }
  }
  _removeTemplateMeta(e) {
    try {
      const t = JSON.parse(localStorage.getItem(this.TEMPLATE_META_KEY) || "{}");
      if (!t[e]) return;
      delete t[e];
      if (Object.keys(t).length) {
        localStorage.setItem(this.TEMPLATE_META_KEY, JSON.stringify(t));
      } else {
        localStorage.removeItem(this.TEMPLATE_META_KEY);
      }
    } catch (e) {}
  }
  _applyPipelineFromGeneration(e, t = null) {
    if (!e) return;
    const s = t ? this._getTemplateMeta(t) : null;
    const i = e.templateId || s?.templateId || this.activeTemplateId;
    const r = e.templateOptions && Object.keys(e.templateOptions).length ? e.templateOptions : s?.options || this.activeTemplateOptions || {};
    this._setActivePipeline(i, r);
  }
  _isFailureStatus(e) {
    const t = (e || "").toLowerCase();
    return t === "error" || t === "failed" || t === "timeout";
  }
  _isCancelledStatus(e) {
    const t = (e || "").toLowerCase();
    return t === "cancelled" || t === "canceled";
  }
  _markUserCancelled(e) {
    if (!e) return;
    if (!this._userCancelledIds) this._userCancelledIds = new Set;
    this._userCancelledIds.add(String(e));
    setTimeout(() => {
      try {
        this._userCancelledIds?.delete(String(e));
      } catch (e) {}
    }, 12e4);
  }
  _wasUserCancelled(e) {
    if (!e || !this._userCancelledIds?.size) return false;
    const t = String(e);
    if (this._userCancelledIds.has(t)) return true;
    for (const e of this._userCancelledIds) {
      if (this._idsLikelySameJob?.(e, t)) return true;
    }
    return false;
  }
  _idsLikelySameJob(e, t) {
    if (!e || !t) return false;
    if (String(e) === String(t)) return true;
    const s = this._resolveActiveProjectId?.(e) || e;
    const i = this._resolveActiveProjectId?.(t) || t;
    return String(s) === String(i);
  }
  _isSuccessStatus(e) {
    return (e || "").toLowerCase() === "completed";
  }
  _clearErrorDismissTimer() {
    if (this._errorDismissTimer) {
      clearTimeout(this._errorDismissTimer);
      this._errorDismissTimer = null;
    }
  }
  _showErrorBanner(e = "There was an error — try again") {
    this._ensureDomRefs();
    if (this.errorBanner) {
      this.errorBanner.textContent = e;
      this.errorBanner.hidden = false;
      this.errorBanner.classList.add("is-visible");
    }
    if (this.todoPanel) this.todoPanel.classList.add("is-error-state");
  }
  _hideErrorBanner() {
    if (this.errorBanner) {
      this.errorBanner.hidden = true;
      this.errorBanner.classList.remove("is-visible");
    }
    if (this.todoPanel) this.todoPanel.classList.remove("is-error-state");
  }
  async _resolveRemovedProject(e) {
    const t = await this._fetchProjectStatus(e);
    if (!t) {
      const t = this.activeGenerations.get(e);
      const s = (t?._pollMisses || 0) + 1;
      if (t) t._pollMisses = s;
      if (s < 3) return;
      this.failGeneration(e, "There was an error — try again");
      return;
    }
    const s = this.activeGenerations.get(e);
    if (s) s._pollMisses = 0;
    if (this._isSuccessStatus(t.status)) {
      this.completeGeneration(e);
    } else if (this._isCancelledStatus(t.status)) {
      this.stopGeneration(e, t.message || "Stopped");
    } else if (this._isFailureStatus(t.status)) {
      this.failGeneration(e, t.message || "There was an error — try again");
    } else if (ACTIVE_GENERATION_STATUSES.has((t.status || "").toLowerCase())) {
      this.updateProgress(e, t.progress ?? 0, t.message || "Processing...", true);
    } else {
      this.failGeneration(e, t.message || "There was an error — try again");
    }
  }
  _statusUrl(e) {
    const t = encodeURIComponent(e);
    return `${this._apiBase()}/clips/status/${t}`;
  }
  _hasActiveGenerationUI() {
    return this.optimisticPending || this.activeGenerations.size > 0;
  }
  _bindPanelEvents() {
    if (this.launcher) {
      this.launcher.addEventListener("click", e => {
        e.stopPropagation();
        if (!this._hasActiveGenerationUI()) return;
        this.openPanel();
      });
    }
    document.addEventListener("click", e => {
      if (!this.panelOpen || !this.wrapper) return;
      if (this.wrapper.contains(e.target)) return;
      this.closePanel();
    });
    if (this.todoPanel) {
      this.todoPanel.addEventListener("click", e => e.stopPropagation());
    }
  }
  _ensureTaskList() {
    if (this.tasksInitialized || !this.todoList) return;
    const e = this._getActiveTasks();
    this.todoList.innerHTML = e.map((e, t) => `\n            <li class="generation-todo-item" id="generation-task-${t}" data-task-id="${e.id}">\n                <div class="generation-task-indicator">\n                    <div class="generation-task-circle generation-task-pending"></div>\n                    <div class="generation-task-circle generation-task-active-wrap">\n                        <svg class="generation-task-spinner" viewBox="0 0 50 50" aria-hidden="true">\n                            <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(16,185,129,0.2)" stroke-width="4.5"></circle>\n                            <circle cx="25" cy="25" r="20" fill="none" stroke="#10b981" stroke-width="4.5"\n                                stroke-linecap="round" transform="rotate(-90 25 25)"></circle>\n                        </svg>\n                    </div>\n                    <div class="generation-task-circle generation-task-done">\n                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" aria-hidden="true">\n                            <polyline points="20 6 9 17 4 12"></polyline>\n                        </svg>\n                    </div>\n                </div>\n                <div class="generation-task-label-wrap">\n                    <div class="generation-task-label">${e.label}</div>\n                    ${e.id === "wait" ? '<div class="generation-task-hint" hidden></div>' : ""}\n                    <div class="generation-task-strikethrough"></div>\n                </div>\n            </li>\n        `).join("");
    this.tasksInitialized = true;
    this._updateTaskCounter();
  }
  _clearIntroRevealTimers() {
    this._introRevealTimers.forEach(e => clearTimeout(e));
    this._introRevealTimers = [];
  }
  _resetTaskVisibility() {
    if (!this.todoList) return;
    this.todoList.querySelectorAll(".generation-todo-item").forEach(e => {
      e.classList.remove("is-revealed", "is-instant");
      e.style.removeProperty("--reveal-delay");
    });
  }
  _showAllTasksInstant() {
    this._getActiveTasks().forEach((e, t) => {
      const s = document.getElementById(`generation-task-${t}`);
      if (!s) return;
      s.style.removeProperty("--reveal-delay");
      s.classList.add("is-revealed", "is-instant");
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
    this.launcher.classList.add("is-panel-open");
    this.todoPanel.classList.add("is-open");
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
    this.launcher.classList.remove("is-panel-open");
    this.todoPanel.classList.remove("is-open");
    this.panelOpen = false;
  }
  _isQueueWaitingMessage(e = "") {
    const t = (e || "").toLowerCase();
    return t.includes("queued") || t.includes("ahead of you") || t.includes("open slot") || t.includes("starting shortly") || t.includes("free queue") || t.includes("priority") || t.includes("processing soon") || t.includes("queue") && !t.includes("starting generation");
  }
  _queueAheadFromMessage(e = "") {
    const t = String(e || "").match(/(\d+)\s+ahead/i);
    return t ? Number(t[1]) : null;
  }
  _queueLabelForInfo(e = "", t = null) {
    const s = String(e || "").toLowerCase();
    const i = t?.priority_lane === true || t?.lane === "priority" || s.includes("priority");
    if (i) {
      return {
        label: "Priority · Starting soon",
        hint: ""
      };
    }
    return {
      label: "Free queue · Processing soon",
      hint: "Upgrade for priority processing"
    };
  }
  _updateQueueTaskLabel(e = "", t = null) {
    const s = this._getActiveTasks();
    const i = s.findIndex(e => e.id === "wait");
    if (i < 0) return;
    const r = document.getElementById(`generation-task-${i}`);
    const n = r?.querySelector(".generation-task-label");
    const a = r?.querySelector(".generation-task-hint");
    if (!n) return;
    if (this._isQueueWaitingMessage(e) || t?.queue_status === "waiting") {
      const {label: s, hint: i} = this._queueLabelForInfo(e, t);
      n.textContent = s;
      if (a) {
        if (i) {
          a.hidden = false;
          a.textContent = i;
        } else {
          a.hidden = true;
          a.textContent = "";
        }
      }
      r.classList.add("is-waiting");
      r.classList.toggle("is-priority-lane", !i);
      r.classList.toggle("is-free-lane", Boolean(i));
    } else {
      n.textContent = s[i].label;
      if (a) {
        a.hidden = true;
        a.textContent = "";
      }
      r.classList.remove("is-waiting", "is-priority-lane", "is-free-lane");
    }
  }
  _resolveTaskIndex(e, t = "") {
    const s = this._getActiveTasks();
    if (!s.length) return 0;
    const i = (t || "").toLowerCase();
    const r = Math.max(0, Math.min(100, Number(e) || 0));
    if (r >= 100 || i.includes("processing complete") || i.includes("video ready")) {
      return s.length - 1;
    }
    if (this.showQueueWaitTask && this._isQueueWaitingMessage(i)) {
      const e = s.findIndex(e => e.id === "wait");
      return e >= 0 ? e : 0;
    }
    let n = -1;
    for (let e = s.length - 1; e >= 0; e--) {
      const t = s[e];
      if (t.id === "wait") continue;
      if ((t.keywords || []).some(e => i.includes(e))) {
        n = e;
        break;
      }
    }
    let a = 0;
    for (let e = 0; e < s.length; e++) {
      const t = s[e];
      if (t.id === "wait" && !this.showQueueWaitTask) continue;
      const i = Number(t.maxProgress);
      a = e;
      if (Number.isFinite(i) && r <= i) break;
    }
    if (n < 0) return a;
    return Math.max(n, a);
  }
  _updateTaskStates(e, t = "", s = null) {
    this._ensureTaskList();
    const i = this._getActiveTasks();
    const r = this.showQueueWaitTask;
    let n = this._resolveTaskIndex(e, t);
    if (r) {
      const e = i.findIndex(e => e.id === "wait");
      n = e >= 0 ? e : 0;
      this.currentTaskIndex = n;
    } else if (this.currentTaskIndex >= 0 && e < 100) {
      n = Math.max(n, this.currentTaskIndex);
      this.currentTaskIndex = n;
    } else {
      this.currentTaskIndex = n;
    }
    i.forEach((t, s) => {
      const i = document.getElementById(`generation-task-${s}`);
      if (!i) return;
      i.classList.remove("is-active", "is-done", "is-failed", "is-waiting");
      if (e >= 100) {
        i.classList.add("is-done");
      } else if (s < n) {
        i.classList.add("is-done");
      } else if (s === n) {
        i.classList.add("is-active");
        if (r) i.classList.add("is-waiting");
      }
    });
    this._updateQueueTaskLabel(t, s);
    this.completedTaskCount = e >= 100 ? i.length : n;
    this._updateTaskCounter();
  }
  _updateTaskCounter() {
    if (!this.taskCounter) return;
    const e = this._getActiveTasks().length;
    const t = Math.max(0, e - this.completedTaskCount);
    if (t === 0) {
      this.taskCounter.textContent = "All done";
    } else if (t === 1) {
      this.taskCounter.textContent = "1 remaining";
    } else {
      this.taskCounter.textContent = `${t} remaining`;
    }
  }
  _markTasksFailed() {
    this._ensureTaskList();
    const e = Math.max(0, this.currentTaskIndex);
    const t = document.getElementById(`generation-task-${e}`);
    if (t) {
      t.classList.remove("is-active", "is-done");
      t.classList.add("is-failed");
      if (!t.classList.contains("is-revealed")) {
        t.classList.add("is-revealed", "is-instant");
      }
    }
  }
  _syncGeneratingBadge() {
    const e = this.activeGenerations.size + (this.optimisticPending ? 1 : 0);
    this.generatingCount = e;
    try {
      localStorage.setItem(this.GENERATING_COUNT_KEY, String(e));
    } catch (e) {}
    if (e > 0) this.showLibraryBadge(); else this.hideLibraryBadge();
  }
  saveToLocalStorage(e) {
    if (!this._isValidProjectId(e)) return;
    try {
      const t = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]");
      if (!t.includes(e)) {
        t.push(e);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(t));
      }
    } catch (e) {
      console.warn("Failed to save generation to localStorage:", e);
    }
  }
  removeFromLocalStorage(e) {
    try {
      let t = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]");
      t = t.filter(t => t !== e);
      if (t.length > 0) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(t));
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
      this._removeTemplateMeta(e);
    } catch (e) {
      console.warn("Failed to remove generation from localStorage:", e);
    }
  }
  _writeLocalStorageFromActive() {
    try {
      const e = [ ...this.activeGenerations.keys() ].filter(e => this._isValidProjectId(e));
      if (e.length) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(e));
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (e) {}
  }
  showLibraryBadge() {
    const e = document.querySelector('[data-tab="library"]');
    if (!e) return;
    e.querySelector(".library-notification-badge")?.remove();
    const t = document.createElement("div");
    t.className = "library-notification-badge";
    e.style.position = "relative";
    e.appendChild(t);
  }
  hideLibraryBadge() {
    document.querySelector('[data-tab="library"] .library-notification-badge')?.remove();
  }
  showVideoReadyNotification() {
    document.querySelector(".video-ready-notification")?.remove();
    const e = document.createElement("div");
    e.className = "video-ready-notification";
    e.innerHTML = 'Your video is ready to go! <span class="video-ready-badge">OFFICIAL</span>';
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 5e3);
  }
  restoreGeneration(e, t = 0, s = "Resuming...", i = "processing", r = null, n = null) {
    if (!this._isValidProjectId(e)) return;
    if (this._wasUserCancelled(e)) return;
    const a = (i || "processing").toLowerCase();
    if (a === "completed") {
      this.completeGeneration(e);
      return;
    }
    if (a === "error" || a === "failed" || a === "timeout") {
      this.removeFromLocalStorage(e);
      this.failGeneration(e, "There was an error — try again");
      return;
    }
    if (!ACTIVE_GENERATION_STATUSES.has(a)) return;
    const o = this._getTemplateMeta(e);
    const l = r || o?.templateId || DEFAULT_PIPELINE_TEMPLATE;
    const c = n || o?.options || {};
    if (this.activeGenerations.has(e)) {
      const i = this.activeGenerations.get(e);
      i.progress = Math.max(i.progress, Math.max(0, Math.min(100, t || 0)));
      if (s) i.message = s;
      i.templateId = l;
      i.templateOptions = c;
    } else {
      this.activeGenerations.set(e, {
        startTime: Date.now(),
        progress: Math.max(0, Math.min(100, t || 0)),
        message: s || "Resuming...",
        templateId: l,
        templateOptions: c
      });
    }
    this._saveTemplateMeta(e, l, c);
    this.saveToLocalStorage(e);
    this._ensureDomRefs();
    if (this.wrapper) this.wrapper.style.display = "flex";
    this.tasksIntroPlayed = false;
    this._resetTaskVisibility();
    this._applyPipelineFromGeneration(this.activeGenerations.get(e), e);
    this._ensureTaskList();
    this._syncDisplayFromActive();
    this._syncGeneratingBadge();
    this.startPolling();
    this._refreshProjectStatus(e);
  }
  async _refreshProjectStatus(e) {
    if (!this._isValidProjectId(e)) return;
    const t = await this._fetchProjectStatus(e);
    if (!t) return;
    if (t.template_id || t.template) {
      const s = t.splitscreen_secondary_type ? {
        secondaryType: t.splitscreen_secondary_type
      } : {};
      this._saveTemplateMeta(e, t.template_id || t.template, s);
      if (this.activeGenerations.has(e)) {
        const i = this.activeGenerations.get(e);
        i.templateId = t.template_id || t.template;
        i.templateOptions = s;
      }
    }
    const s = (t.status || "").toLowerCase();
    if (ACTIVE_GENERATION_STATUSES.has(s)) {
      this.updateProgress(e, t.progress ?? 0, t.message || "Processing...", true, t.queue || null);
    } else if (this._isSuccessStatus(s)) {
      this.completeGeneration(e);
    } else if (this._isCancelledStatus(s)) {
      this.stopGeneration(e, t.message || "Stopped");
    } else if (this._isFailureStatus(s)) {
      this.failGeneration(e, t.message || "There was an error — try again");
    }
  }
  _syncDisplayFromActive() {
    this._ensureDomRefs();
    if (!this.wrapper || !this.progressCircle || this.activeGenerations.size === 0) return;
    const e = [ ...this.activeGenerations.entries() ].sort((e, t) => t[1].progress - e[1].progress)[0];
    if (e) {
      const [t, s] = e;
      this._applyPipelineFromGeneration(s, t);
      this.displayProgress(s.progress, s.message, s.queueInfo || null);
    }
  }
  async syncFromServer(e = {}) {
    if (this.serverSyncDone && !e.force) return;
    if (e.force) {
      this.serverSyncDone = false;
      this._syncRetryAttempt = 0;
    }
    const t = await this._syncFromServerAttempt();
    if (!t && !this.serverSyncDone && this._syncRetryAttempt < this._syncRetryMax) {
      this._syncRetryAttempt += 1;
      this._scheduleServerSync();
    }
  }
  async _syncFromServerAttempt() {
    this._ensureDomRefs();
    try {
      const e = await fetch(`${this._apiBase()}/clips/status/active`, {
        method: "GET",
        headers: this._requestHeaders(),
        credentials: "include"
      });
      if (e.status === 401 || e.status === 403) {
        await this._syncFromLocalStorageFallback();
        return false;
      }
      if (!e.ok) {
        await this._syncFromLocalStorageFallback();
        return false;
      }
      const t = await e.json();
      if (!t.success || !Array.isArray(t.active_generations)) {
        await this._syncFromLocalStorageFallback();
        return false;
      }
      const s = new Set;
      for (const e of t.active_generations) {
        const t = e.project_id;
        const i = (e.status || "").toLowerCase();
        if (!t) continue;
        if (i === "timeout") {
          await this._abandonProject(t);
          continue;
        }
        if (!ACTIVE_GENERATION_STATUSES.has(i)) continue;
        s.add(t);
        const r = e.splitscreen_secondary_type ? {
          secondaryType: e.splitscreen_secondary_type
        } : {};
        this.restoreGeneration(t, e.progress || 0, e.message || "Processing...", i, e.template_id || e.template || null, r);
      }
      for (const e of [ ...this.activeGenerations.keys() ]) {
        if (!s.has(e)) {
          await this._resolveRemovedProject(e);
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
    } catch (e) {
      console.warn("[Spinner] Server sync failed, using local fallback:", e);
      await this._syncFromLocalStorageFallback();
      return false;
    }
  }
  async _abandonProject(e) {
    if (!this._isValidProjectId(e)) return;
    try {
      await fetch(`${this._apiBase()}/clips/${encodeURIComponent(e)}/cancel`, {
        method: "POST",
        headers: this._requestHeaders(),
        credentials: "include"
      });
    } catch (t) {
      try {
        await fetch(`${this._apiBase()}/clips/projects/${encodeURIComponent(e)}/abandon`, {
          method: "POST",
          headers: this._requestHeaders(),
          credentials: "include"
        });
      } catch (e) {}
    }
    this.activeGenerations.delete(e);
    this.removeFromLocalStorage(e);
  }
  _unlockUrlSubmitButton() {
    const e = document.getElementById("processUrlBtn");
    if (e) {
      e.disabled = false;
      e.style.opacity = "1";
      e.style.cursor = "pointer";
      e.classList.remove("is-generating", "is-cancelling", "is-cancel-locked");
      e.setAttribute("aria-label", "Continue");
      e.removeAttribute("title");
    }
    sessionStorage.removeItem("urlButtonLocked");
    sessionStorage.removeItem("urlButtonLockeduntil");
    const t = document.getElementById("confirmUseTemplateBtn");
    if (t) {
      t.disabled = false;
      t.style.pointerEvents = "";
      t.style.opacity = "";
    }
    if (window.clipsStudio) {
      window.clipsStudio._generationStartInFlight = false;
      window.clipsStudio._cancelGenerationInFlight = false;
    }
  }
  async _syncFromLocalStorageFallback() {
    try {
      const e = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]");
      for (const t of e) {
        if (!this._isValidProjectId(t)) continue;
        const e = await this._fetchProjectStatus(t);
        if (e && ACTIVE_GENERATION_STATUSES.has(e.status)) {
          this.restoreGeneration(t, e.progress, e.message, e.status);
        } else if (e && this._isSuccessStatus(e.status)) {
          this.completeGeneration(t);
        } else if (e && this._isCancelledStatus(e.status)) {
          this.stopGeneration(t, e.message || "Stopped");
        } else if (e && this._isFailureStatus(e.status)) {
          this.failGeneration(t, e.message || "There was an error — try again");
        } else {
          this.removeFromLocalStorage(t);
        }
      }
      if (this.activeGenerations.size > 0) {
        this._ensureDomRefs();
        if (this.wrapper) this.wrapper.style.display = "flex";
        this._syncDisplayFromActive();
        this._syncGeneratingBadge();
        this.startPolling();
      } else if (!this.optimisticPending) {
        this.hide();
        this._unlockUrlSubmitButton();
      }
    } catch (e) {
      if (this.activeGenerations.size === 0) {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }
  async _fetchProjectStatus(e) {
    if (!this._isValidProjectId(e)) return null;
    try {
      if (window.solisApiGate && !window.solisApiGate.allowPoll()) return null;
      const t = await fetch(this._statusUrl(e), {
        method: "GET",
        credentials: "include",
        headers: this._requestHeaders(),
        solisOptionalPoll: true
      });
      if (t.status === 401 || t.status === 403 || t.status === 404) {
        this.removeFromLocalStorage(e);
        return null;
      }
      if (!t.ok) return null;
      const s = await t.json();
      if (!s || !s.status || s.status === "unknown") return null;
      return s;
    } catch (e) {
      return null;
    }
  }
  setupWebSocketHandlers() {
    if (this.wsHandlersSetup || typeof solisWSClient === "undefined") return;
    this.wsHandlersSetup = true;
    solisWSClient.on("moment_detected", e => {
      const {project_id: t, moment_count: s, progress: i} = e;
      if (!this._isValidProjectId(t)) return;
      if (this._wasUserCancelled(t)) return;
      const r = this._resolveActiveProjectId(t);
      if (!r) return;
      this._markWsFresh(r);
      const n = Math.max(1, 6 - s);
      const a = `Moment #${n} detected`;
      this.updateProgress(r, i, a);
    });
    solisWSClient.on("compilation_progress", e => {
      const {project_id: t, progress: s, step: i} = e;
      if (!this._isValidProjectId(t)) return;
      if (this._wasUserCancelled(t)) return;
      const r = this._resolveActiveProjectId(t);
      if (!r) return;
      this._markWsFresh(r);
      this.updateProgress(r, s, i || "Processing...", true);
    });
    solisWSClient.on("clips_status_update", e => {
      const {project_id: t, status: s, progress: i, message: r, queue: n} = e;
      if (!this._isValidProjectId(t)) return;
      if (this._wasUserCancelled(t)) {
        const e = (s || "").toLowerCase();
        if (this._isCancelledStatus(e)) {
          this.stopGeneration(t, r || "Stopped");
        }
        return;
      }
      const a = this._resolveActiveProjectId(t) || t;
      const o = (s || "").toLowerCase();
      if (o === "completed") {
        this.completeGeneration(a);
      } else if (this._isCancelledStatus(o)) {
        this.stopGeneration(a, r || "Stopped");
      } else if (this._isFailureStatus(o)) {
        this.failGeneration(a, r || "There was an error — try again");
      } else if (ACTIVE_GENERATION_STATUSES.has(o)) {
        if (!this._resolveActiveProjectId(t) && !this.activeGenerations.has(t)) return;
        this._markWsFresh(a);
        this.updateProgress(a, i ?? 0, r || "Processing...", true, n || null);
      }
    });
    solisWSClient.on("generation_error", e => {
      const t = e?.project_id || e?.taskId;
      if (!this._isValidProjectId(t)) return;
      if (this._wasUserCancelled(t)) return;
      const s = this._resolveActiveProjectId(t) || t;
      this.failGeneration(s, e?.message || e?.error || "There was an error — try again");
    });
    solisWSClient.on("processing_error", e => {
      const t = e?.taskId || e?.project_id;
      if (!this._isValidProjectId(t)) return;
      if (this._wasUserCancelled(t)) return;
      const s = this._resolveActiveProjectId(t) || t;
      this.failGeneration(s, e?.message || e?.error || "There was an error — try again");
    });
    solisWSClient.on("video_ready", e => {
      const {project_id: t, output_path: s, video_title: i, thumbnail_url: r, template_name: n, template: a} = e || {};
      if (!this._isValidProjectId(t)) return;
      if (this._wasUserCancelled(t)) return;
      const o = this._resolveActiveProjectId(t) || t;
      try {
        const e = window.clipsStudio;
        if (e && Array.isArray(e.libraryItems)) {
          const s = String(t);
          let o = e.libraryItems.find(e => String(e.projectId || e.id) === s);
          if (!o) {
            o = {
              id: t,
              projectId: t,
              status: "completed",
              timestamp: new Date,
              _optimistic: true
            };
            e.libraryItems.unshift(o);
          }
          if (i) o.name = i;
          if (r) o.thumbnailUrl = r;
          if (n) o.templateName = n;
          if (a) o.template = a;
          o.status = "completed";
          o._optimistic = false;
          e._libraryLastLoaded = 0;
          if (!e.libraryPreviewModalOpen) {
            e.updateLibraryView?.();
          } else {
            e._libraryRefreshPending = true;
          }
        }
      } catch (e) {}
      if (typeof window.notificationSystem?.showVideoGenerated === "function") {
        window.notificationSystem.showVideoGenerated({
          videoTitle: i || `Video ${String(t).substring(0, 8)}...`,
          videoUrl: s || "#",
          message: "Your video has been generated successfully!"
        });
      }
      this._refreshLibrarySoon();
      this.completeGeneration(o);
    });
    solisWSClient.on("error", e => {
      const t = e?.taskId || e?.project_id;
      if (t && this._isValidProjectId(t)) {
        this.failGeneration(t, e?.error || e?.message || "There was an error — try again");
      }
    });
  }
  beginOptimisticGeneration(e = "Starting...", t = DEFAULT_PIPELINE_TEMPLATE, s = {}) {
    this._setActivePipeline(t, s);
    this.optimisticPending = true;
    this.currentTaskIndex = -1;
    this.completedTaskCount = 0;
    this.showQueueWaitTask = false;
    this._ensureDomRefs();
    if (this.wrapper) this.wrapper.style.display = "flex";
    this.tasksIntroPlayed = false;
    this._resetTaskVisibility();
    this._ensureTaskList();
    this.displayProgress(0, this._cleanMessage(e));
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
  startGeneration(e, t = "Queued — waiting for an open slot...", s = null, i = {}) {
    if (!this._isValidProjectId(e)) return;
    if (this._wasUserCancelled(e)) {
      return;
    }
    this._lastKnownProjectId = e;
    const r = this._getTemplateMeta(e);
    const n = s || r?.templateId || this.activeTemplateId || DEFAULT_PIPELINE_TEMPLATE;
    const a = i && Object.keys(i).length ? i : r?.options || this.activeTemplateOptions || {};
    this._setActivePipeline(n, a);
    this._saveTemplateMeta(e, n, a);
    this.currentTaskIndex = -1;
    this.completedTaskCount = 0;
    this._completionHandled = false;
    this._ensureDomRefs();
    if (this.wrapper) this.wrapper.style.display = "flex";
    this._ensureTaskList();
    if (!this.panelOpen) this.openPanel();
    this.optimisticPending = false;
    this.activeGenerations.set(e, {
      startTime: Date.now(),
      progress: 0,
      message: t,
      templateId: n,
      templateOptions: a
    });
    this.saveToLocalStorage(e);
    this._syncGeneratingBadge();
    this.updateProgress(e, 0, t);
    this.startPolling();
    this.verifyWebSocketAccess(e, t => {
      if (!t) {
        console.warn("[GENERATION] WebSocket verify soft-failed; continuing with polling", e);
      }
    });
  }
  verifyWebSocketAccess(e, t) {
    if (!this._isValidProjectId(e)) {
      t(false);
      return;
    }
    fetch(`${this._apiBase()}/clips/verify/${encodeURIComponent(e)}`, {
      method: "GET",
      credentials: "include",
      headers: this._requestHeaders()
    }).then(async e => {
      let s = null;
      try {
        s = await e.json();
      } catch (e) {
        s = null;
      }
      if (!e.ok) {
        console.warn("[GENERATION] verify HTTP", e.status, s);
        t(false);
        return;
      }
      t(!!s?.allowed);
    }).catch(e => {
      console.warn("[GENERATION] verify network error", e);
      t(false);
    });
  }
  updateProgress(e, t, s = "", i = false, r = null) {
    if (!this._isValidProjectId(e)) return;
    t = Math.max(0, Math.min(100, Math.floor(t)));
    const n = this._resolveActiveProjectId(e) || e;
    if (n !== e) this._linkProjectAliases(e, n);
    if (!this.activeGenerations.has(n)) {
      if (this._completionHandled || this.activeGenerations.size === 0) {
        return;
      }
      return;
    }
    const a = this._shouldShowQueueWaitTask(s, r);
    if (a) {
      t = Math.min(t, 2);
    }
    this._setQueueWaitVisible(a);
    const o = this.activeGenerations.get(n);
    const l = t > o.progress;
    const c = s && s !== o.message;
    const h = r && JSON.stringify(r) !== JSON.stringify(o.queueInfo || null);
    if (!i && !l && !c && !h) return;
    if (a) {
      o.progress = Math.min(t, 2);
    } else {
      o.progress = Math.max(o.progress, t);
    }
    if (s) o.message = s;
    if (r) o.queueInfo = r; else if (!this._isQueueWaitingMessage(o.message)) o.queueInfo = null;
    this._syncCancelLockOnSubmitButton(t, s);
    this._ensureDomRefs();
    this._syncDisplayFromActive();
  }
  _isCancelLockedStage(e = 0, t = "") {
    const s = Number(e) || 0;
    if (s >= 78) return true;
    const i = String(t || "").toLowerCase();
    return i.includes("building split") || i.includes("build split") || i.includes("compil") || i.includes("encoding final") || i.includes("export") || i.includes("finaliz") || i.includes("watermark") || i.includes("adding caption") || i.includes("assembling");
  }
  _syncCancelLockOnSubmitButton(e, t) {
    const s = document.getElementById("processUrlBtn");
    if (!s || !s.classList.contains("is-generating")) return;
    const i = this._isCancelLockedStage(e, t);
    s.classList.toggle("is-cancel-locked", i);
    if (i) {
      s.setAttribute("aria-label", "Finishing…");
      s.title = "Almost done — can’t stop now";
    } else {
      s.setAttribute("aria-label", "Stop generation");
      s.title = "Stop generation";
    }
  }
  _cleanMessage(e) {
    if (!e || typeof e !== "string") return "";
    let t = e.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "").replace(/\s+/g, " ").trim();
    const s = t.toLowerCase();
    const i = /\b(vast\.?ai|modal\.com|runpod|serverless|rtx\s*\d+|gtx\s*\d+|a100|h100|l40|dph|\$\/hr)\b/i.test(t) || /\b(gpu|cpu)\s+worker\b/i.test(t) || /\bqueued on (vast|modal|cloud)\b/i.test(t) || /\binstance[=\s#:]?\s*\d{5,}\b/i.test(t) || /\b\d+(\.\d+)?\s*(MB\/s|MiB\/s|KB\/s|KiB\/s|Gbps|Mbps)\b/i.test(t) || /\b\d+(\.\d+)?\s*(MB|MiB|GB|GiB)\b/i.test(t) || /\bat\s+\d+(\.\d+)?\s*(MB|KB)/i.test(t) || /\b(traceback|exception|errno|http\/?\d|status[=\s]\d{3})\b/i.test(t);
    if (i) {
      if (/download|install/i.test(s)) return "Installing video...";
      if (/fail|error|crash|exception/i.test(s)) return "Something went wrong — try again";
      if (/queue|wait|slot|priority|starting|start|worker|rent|boot|load/i.test(s)) {
        return "Starting...";
      }
      return "";
    }
    t = t.replace(/\b\d+(\.\d+)?\s*(MB\/s|MiB\/s|KB\/s|KiB\/s|Gbps|Mbps)\b/gi, "").replace(/\([^)]*\.(mp4|wav|webm|mkv)[^)]*\)/gi, "").replace(/\s+/g, " ").trim();
    return t;
  }
  _friendlyErrorMessage(e = "") {
    const t = this._cleanMessage(e);
    if (!t) return "Something went wrong — try again";
    const s = t.toLowerCase();
    if (s.includes("youtube") && (s.includes("proxy") || s.includes("cookie") || s.includes("bot"))) {
      return "YouTube blocked the download — refresh cookies and set YTDLP_PROXY, then retry.";
    }
    if (/\b(vast|modal|gpu|rtx|serverless|traceback|exception|errno)\b/i.test(t) || s.includes("failed:") || s.length > 140) {
      return "Something went wrong — try again";
    }
    return t;
  }
  _friendlyProgressLabel(e, t = "", s = null) {
    const i = this._cleanMessage(t);
    if (this.showQueueWaitTask || this._shouldShowQueueWaitTask(i, s)) {
      return this._queueLabelForInfo(i, s).label;
    }
    const r = this._getActiveTasks();
    const n = this._resolveTaskIndex(e, i);
    const a = r[n]?.label;
    if (e >= 100) {
      if (!i || /complete|done|ready|success/i.test(i)) return "Complete!";
      return i;
    }
    if (a) return a;
    return i || `${e}% complete`;
  }
  displayProgress(e, t = "", s = null) {
    this._ensureDomRefs();
    if (!this.wrapper || !this.progressCircle) return;
    const i = this._cleanMessage(t);
    this._setQueueWaitVisible(this._shouldShowQueueWaitTask(i, s));
    const r = this.showQueueWaitTask;
    const n = r ? Math.min(e, 2) : e;
    const a = this._friendlyProgressLabel(n, i, s);
    this.wrapper.style.display = "flex";
    const o = n >= 100;
    const l = o ? 0 : this.CIRCLE_CIRCUMFERENCE - Math.max(0, Math.min(100, n)) / 100 * this.CIRCLE_CIRCUMFERENCE;
    this.progressCircle.style.strokeDashoffset = String(l);
    this.progressCircle.style.stroke = r ? "#f59e0b" : "#10b981";
    if (this.launcher) {
      this.launcher.classList.toggle("is-complete", o);
      this.launcher.classList.toggle("is-queued", r && !o);
      this.launcher.classList.remove("is-error", "is-active");
    }
    if (this.progressText) {
      this.progressText.textContent = o ? "" : r ? "…" : `${Math.floor(n)}%`;
    }
    if (this.progressTooltip) {
      this.progressTooltip.textContent = o ? a || "Complete!" : a || `${n}% complete`;
    }
    this._updateTaskStates(n, i, s);
  }
  _linkProjectAliases(e, t) {
    if (!e || !t || e === t) return;
    if (!this._projectAliases) this._projectAliases = new Map;
    this._projectAliases.set(e, t);
    this._projectAliases.set(t, e);
  }
  _resolveActiveProjectId(e) {
    if (!e) return null;
    if (this.activeGenerations.has(e)) return e;
    const t = this._projectAliases?.get(e);
    if (t && this.activeGenerations.has(t)) return t;
    if (this.activeGenerations.size === 1) {
      const t = [ ...this.activeGenerations.keys() ][0];
      this._linkProjectAliases(e, t);
      return t;
    }
    if (this.activeGenerations.size === 2) {
      const t = [ ...this.activeGenerations.keys() ];
      const s = t.find(e => String(e).startsWith("prj_"));
      const i = t.find(e => /^[0-9]+_/.test(String(e)));
      if (s && i) {
        this._linkProjectAliases(s, i);
        if (e === s || e === i) return e;
        if (String(e).startsWith("prj_")) return s;
        if (/^[0-9]+_/.test(String(e))) return i;
        return s;
      }
    }
    return null;
  }
  _deleteGeneration(e) {
    if (!e) return;
    const t = this._resolveActiveProjectId(e) || e;
    const s = this._projectAliases?.get(t);
    this.activeGenerations.delete(t);
    this.removeFromLocalStorage(t);
    if (s) {
      this.activeGenerations.delete(s);
      this.removeFromLocalStorage(s);
    }
    this.activeGenerations.delete(e);
    this.removeFromLocalStorage(e);
    if (this.activeGenerations.size === 1) {
      const t = [ ...this.activeGenerations.keys() ][0];
      const s = String(t).startsWith("prj_");
      const i = String(e).startsWith("prj_");
      const r = /^[0-9]+_/.test(String(e));
      if (s && r || !s && i) {
        this.activeGenerations.delete(t);
        this.removeFromLocalStorage(t);
      }
    }
  }
  async runLibraryApplyFlow(e, {applyFn: t, downloadFn: s}) {
    const i = this._isValidProjectId(e) || typeof e === "string" && /^[a-zA-Z0-9_.-]{8,}$/.test(e);
    if (!i) {
      throw new Error("Invalid project");
    }
    const r = "library_apply";
    this._setActivePipeline(r, {});
    this._completionHandled = false;
    this.optimisticPending = false;
    this.currentTaskIndex = -1;
    this.completedTaskCount = 0;
    this._ensureDomRefs();
    if (this.wrapper) this.wrapper.style.display = "flex";
    this.tasksIntroPlayed = false;
    this._resetTaskVisibility();
    this._ensureTaskList();
    this.openPanel();
    this.activeGenerations.set(e, {
      startTime: Date.now(),
      progress: 0,
      message: "Preparing download...",
      templateId: r,
      templateOptions: {}
    });
    this._syncGeneratingBadge();
    this.updateProgress(e, 8, "Preparing download...", true);
    try {
      if (typeof t === "function") {
        this.updateProgress(e, 22, "Saving edits...", true);
        await t();
        this.updateProgress(e, 58, "Ready to download", true);
      }
      if (typeof s === "function") {
        this.updateProgress(e, 72, "Downloading...", true);
        await s();
        this.updateProgress(e, 92, "Download started", true);
      }
      const i = this.showVideoReadyNotification;
      this.showVideoReadyNotification = () => {};
      this.displayProgress(100, "Download started!");
      this.completeGeneration(e);
      this.showVideoReadyNotification = i;
    } catch (t) {
      this.failGeneration(e, t?.message || "Download failed");
      throw t;
    }
  }
  _refreshLibrarySoon() {
    if (this._libraryRefreshQueued) return;
    this._libraryRefreshQueued = true;
    const run = (e = 0) => {
      this._libraryRefreshQueued = e < 2;
      if (typeof updateStorageBadgeDisplay === "function") {
        updateStorageBadgeDisplay();
      }
      if (window.clipsStudio?.loadLibraryItems) {
        window.clipsStudio._libraryLastLoaded = 0;
        window.clipsStudio.loadLibraryItems({
          soft: true,
          force: true
        }).catch(() => {}).finally(() => {
          if (e < 1) {
            setTimeout(() => run(e + 1), 1200);
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
  completeGeneration(e) {
    if (this._completionHandled && this.activeGenerations.size === 0 && !this.optimisticPending) {
      return;
    }
    if (e && this._isValidProjectId(e)) {
      this._deleteGeneration(e);
    } else if (this.activeGenerations.size === 1) {
      const e = [ ...this.activeGenerations.keys() ][0];
      this._deleteGeneration(e);
    }
    this.optimisticPending = false;
    this._completionHandled = true;
    this._syncGeneratingBadge();
    this.showVideoReadyNotification();
    this.displayProgress(100, "Processing complete! Video ready!");
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
  _notifyGenerationFailed(e, t) {
    try {
      window.dispatchEvent(new CustomEvent("solisGenerationFailed", {
        detail: {
          projectId: e,
          message: t
        }
      }));
    } catch (e) {}
    const s = window.clipsStudio;
    if (!s?.processingItems?.length) return;
    for (const t of s.processingItems) {
      if (t.projectId !== e) continue;
      s.stopMonitoring?.(t.id);
    }
    s.processingItems = s.processingItems.filter(t => t.projectId !== e);
    s.saveProcessingItems?.();
    s.updateProcessingView?.();
    s.updateLibraryView?.();
    if (s.processingItems.length === 0) {
      s.stopLibraryPolling?.();
    }
  }
  failGeneration(e, t = "There was an error — try again") {
    const s = this._friendlyErrorMessage(t);
    this._notifyGenerationFailed(e, s);
    this._clearErrorDismissTimer();
    this.optimisticPending = false;
    this._completionHandled = false;
    if (e && this._isValidProjectId(e)) {
      this._deleteGeneration(e);
    } else if (this.activeGenerations.size > 0) {
      for (const e of [ ...this.activeGenerations.keys() ]) {
        this._deleteGeneration(e);
      }
    }
    this._syncGeneratingBadge();
    this.stopPolling();
    this._unlockUrlSubmitButton();
    this._ensureDomRefs();
    if (this.wrapper) this.wrapper.style.display = "flex";
    this._ensureTaskList();
    this._markTasksFailed();
    if (this.launcher) {
      this.launcher.classList.remove("is-complete");
      this.launcher.classList.add("is-error");
    }
    if (this.progressCircle) {
      this.progressCircle.style.strokeDashoffset = "0";
      this.progressCircle.style.stroke = "#ef4444";
    }
    if (this.progressText) {
      this.progressText.textContent = "✕";
    }
    if (this.progressTooltip) {
      this.progressTooltip.textContent = s;
    }
    if (this.taskCounter) {
      this.taskCounter.textContent = "Failed";
    }
    this._showErrorBanner(s);
    this.openPanel();
    const i = /youtube|proxy|cookie/i.test(s) ? 12e3 : 2800;
    this._errorDismissTimer = setTimeout(() => {
      this._dismissErrorState();
    }, i);
  }
  stopGeneration(e, t = "Stopped") {
    this._clearErrorDismissTimer();
    this.optimisticPending = false;
    this._completionHandled = false;
    if (e) this._markUserCancelled(e);
    if (e && this._isValidProjectId(e)) {
      this._deleteGeneration(e);
    } else if (this.activeGenerations.size > 0) {
      for (const e of [ ...this.activeGenerations.keys() ]) {
        this._markUserCancelled(e);
        this._deleteGeneration(e);
      }
    }
    this._syncGeneratingBadge();
    this.stopPolling();
    this._unlockUrlSubmitButton();
    this._hideErrorBanner?.();
    if (this.launcher) {
      this.launcher.classList.remove("is-complete", "is-error");
    }
    if (this.progressTooltip) {
      this.progressTooltip.textContent = "Stopped";
    }
    if (this.taskCounter) {
      this.taskCounter.textContent = "Stopped";
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
    if (this.launcher) this.launcher.classList.remove("is-error");
    if (this.activeGenerations.size === 0 && !this.optimisticPending) {
      this.hide();
    }
  }
  hide() {
    if (this.activeGenerations.size > 0 || this.optimisticPending) return;
    this._clearErrorDismissTimer();
    this.optimisticPending = false;
    this._hideErrorBanner();
    if (this.wrapper) this.wrapper.style.display = "none";
    this.closePanel();
    if (this.progressCircle) {
      this.progressCircle.style.strokeDashoffset = String(this.CIRCLE_CIRCUMFERENCE);
      this.progressCircle.style.stroke = "#10b981";
    }
    if (this.launcher) this.launcher.classList.remove("is-complete", "is-panel-open", "is-error", "is-active", "is-queued");
    if (this.progressText) this.progressText.textContent = "0%";
    if (this.progressTooltip) this.progressTooltip.textContent = "Generating...";
    this.currentTaskIndex = -1;
    this.completedTaskCount = 0;
    this.tasksIntroPlayed = false;
    this.showQueueWaitTask = false;
    this._clearIntroRevealTimers();
    this.tasksInitialized = false;
    if (this.todoList) this.todoList.innerHTML = "";
  }
  startPolling() {
    if (this.pollingTimer) return;
    const poll = async () => {
      if (this.activeGenerations.size === 0) {
        this.stopPolling();
        return;
      }
      const e = Date.now();
      for (const [t, s] of [ ...this.activeGenerations.entries() ]) {
        if (s._lastWsAt && e - s._lastWsAt < this.WS_FRESH_MS) {
          continue;
        }
        const i = await this._fetchProjectStatus(t);
        if (!i) {
          const e = (s._pollMisses || 0) + 1;
          s._pollMisses = e;
          if (e >= 3) {
            await this._resolveRemovedProject(t);
          }
          continue;
        }
        s._pollMisses = 0;
        const r = (i.status || "").toLowerCase();
        if (ACTIVE_GENERATION_STATUSES.has(r)) {
          const e = i.progress ?? 0;
          const s = i.message || "Processing...";
          this.updateProgress(t, e, s, true, i.queue || null);
        } else if (this._isSuccessStatus(r)) {
          this.completeGeneration(t);
        } else if (this._isCancelledStatus(r)) {
          this.stopGeneration(t, i.message || "Stopped");
        } else {
          this.failGeneration(t, i.message || "There was an error — try again");
        }
      }
      if (this.activeGenerations.size === 0) {
        this.stopPolling();
        return;
      }
      let t = false;
      try {
        t = !!(typeof solisWSClient !== "undefined" && solisWSClient && (solisWSClient.isConnected?.() || solisWSClient.connected));
      } catch (e) {}
      let s = t ? this.POLLING_INTERVAL_WS : this.POLLING_INTERVAL;
      try {
        if (window.solisApiGate && !window.solisApiGate.allowPoll()) {
          s = Math.max(s, 2e4);
        }
      } catch (e) {}
      this.pollingTimer = setTimeout(poll, s);
    };
    poll();
  }
  _markWsFresh(e) {
    const t = this.activeGenerations.get(e);
    if (t) t._lastWsAt = Date.now();
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
      generations: Object.fromEntries(this.activeGenerations)
    };
  }
}

let generationProgressSpinner = null;

function getGenerationProgressSpinner() {
  return window.generationProgressSpinner || generationProgressSpinner || null;
}

function initGenerationProgressSpinner() {
  if (getGenerationProgressSpinner()) return getGenerationProgressSpinner();
  const e = new GenerationProgressSpinner;
  generationProgressSpinner = e;
  window.generationProgressSpinner = e;
  return e;
}

window.getGenerationProgressSpinner = getGenerationProgressSpinner;

window.initGenerationProgressSpinner = initGenerationProgressSpinner;

function bootGenerationProgressSpinner() {
  if (document.getElementById("generationProgressWrapper")) {
    initGenerationProgressSpinner();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGenerationProgressSpinner);
} else {
  bootGenerationProgressSpinner();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GenerationProgressSpinner: GenerationProgressSpinner,
    generationProgressSpinner: generationProgressSpinner,
    getGenerationProgressSpinner: getGenerationProgressSpinner,
    initGenerationProgressSpinner: initGenerationProgressSpinner
  };
}
