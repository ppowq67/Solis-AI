class GenerationRecoverySystem {
  constructor() {
    this.API_BASE = window.API_BASE_URL || window.API_BASE || '/api';
    this.activeGenerations = new Map();
    this.socketListeners = new Map();
    this.recoveryInProgress = false;
  }

  get spinnerSystem() {
    return window.generationProgressSpinner || null;
  }

  async autoRecover() {
    if (this.recoveryInProgress) return;
    this.recoveryInProgress = true;

    try {
      const spinner = typeof initGenerationProgressSpinner === 'function'
        ? initGenerationProgressSpinner()
        : this.spinnerSystem;
      if (spinner && typeof spinner.syncFromServer === 'function') {
        await spinner.syncFromServer({ force: true });
        return;
      }

      const activeGenerations = await this.fetchActiveGenerations();
      if (!activeGenerations.length) return;

      for (const generation of activeGenerations) {
        await this.recoverGeneration(generation);
      }
    } catch (error) {
      console.error('[RECOVERY] Error during recovery:', error);
    } finally {
      this.recoveryInProgress = false;
    }
  }

  async fetchActiveGenerations() {
    try {
      const response = await fetch(`${this.API_BASE}/clips/status/active`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) return [];
      const data = await response.json();
      if (!data.success) return [];
      return data.active_generations || [];
    } catch (error) {
      console.error('[RECOVERY] Network error fetching active generations:', error);
      return [];
    }
  }

  async recoverGeneration(generation) {
    const { project_id, status, progress, message, template_id, template, splitscreen_secondary_type } = generation;
    if (!project_id) return;

    this.activeGenerations.set(project_id, generation);

    const templateOptions = splitscreen_secondary_type
      ? { secondaryType: splitscreen_secondary_type }
      : {};
    const spinner = this.spinnerSystem;
    if (spinner && typeof spinner.restoreGeneration === 'function') {
      spinner.restoreGeneration(
        project_id,
        progress || 0,
        message || 'Resuming...',
        status || 'processing',
        template_id || template || null,
        templateOptions
      );
    } else if (spinner && typeof spinner.updateProgress === 'function') {
      spinner.updateProgress(project_id, progress || 0, message || 'Resuming...');
    }

    this.attachWebSocketListener(project_id);
  }

  attachWebSocketListener(projectId) {
    if (this.socketListeners.has(projectId)) return;

    const socket = window.socket || (window.io && window.io());
    if (!socket) return;

    const listener = (data) => {
      if (data.project_id !== projectId) return;
      const spinner = this.spinnerSystem;

      if (data.status === 'completed') {
        if (spinner?.updateProgress) spinner.updateProgress(projectId, 100, data.message || 'Complete!');
        if (spinner?.completeGeneration) spinner.completeGeneration(projectId);
        this.handleGenerationComplete(projectId);
      } else if (data.status === 'error') {
        if (spinner?.failGeneration) spinner.failGeneration(projectId);
        this.handleGenerationError(projectId, data.message);
      } else if (spinner?.updateProgress) {
        spinner.updateProgress(projectId, data.progress, data.message);
      }

      if (this.activeGenerations.has(projectId)) {
        const gen = this.activeGenerations.get(projectId);
        gen.progress = data.progress;
        gen.message = data.message;
        gen.status = data.status;
      }
    };

    socket.on('clips_status_update', listener);
    this.socketListeners.set(projectId, { socket, listener, eventName: 'clips_status_update' });
  }

  handleGenerationComplete(projectId) {
    this.activeGenerations.delete(projectId);
    this.detachSocketListener(projectId);
    if (window.onGenerationComplete) window.onGenerationComplete(projectId);
  }

  handleGenerationError(projectId) {
    this.activeGenerations.delete(projectId);
    this.detachSocketListener(projectId);
  }

  detachSocketListener(projectId) {
    const listenerConfig = this.socketListeners.get(projectId);
    if (listenerConfig) {
      const { socket, listener, eventName } = listenerConfig;
      socket.off(eventName, listener);
      this.socketListeners.delete(projectId);
    }
  }

  getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
  }
}

window.generationRecovery = new GenerationRecoverySystem();

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    window.generationRecovery.autoRecover().then(() => {
      if (typeof restoreGenerationStateFromServer === 'function') {
        restoreGenerationStateFromServer();
      }
    });
  }, 800);
});

if (typeof window.socket !== 'undefined' && window.socket !== null) {
  window.socket.on('connect', () => {
    window.generationRecovery.autoRecover();
  });
}
