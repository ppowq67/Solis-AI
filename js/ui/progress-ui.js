class ProcessingProgressUI {
    constructor() {
        this.progressContainerId = "processing-progress-container";
        this.taskElements = new Map();
    }

    // 🔐 SECURITY: HTML entity escaping to prevent XSS
    _escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    
    init() {
        let container = document.getElementById(this.progressContainerId);

        if (!container) {
            container = document.createElement("div");
            container.id = this.progressContainerId;
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 400px;
                z-index: 10000;
                font-family: 'Poppins', sans-serif;
            `;
            document.body.appendChild(container);
        }

        return container;
    }

    
    showProgress(taskId, taskName = "Processing") {
        const container = this.init();

        const taskElement = document.createElement("div");
        taskElement.setAttribute("data-task-id", taskId);
        taskElement.style.cssText = `
            background: linear-gradient(135deg, rgba(20, 20, 40, 0.95) 0%, rgba(30, 30, 50, 0.95) 100%);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(100, 150, 255, 0.3);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            animation: slideIn 0.3s ease;
        `;

        // 🔐 SECURITY: Sanitize taskName to prevent XSS via innerHTML
        const safeName = this._escapeHtml(taskName);
        
        taskElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #6496ff; font-weight: 600; font-size: 13px;">${safeName}</span>
                <span class="status-text" style="color: #e0e0e0; font-size: 11px;">0%</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(100, 150, 255, 0.1); border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                <div class="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #6496ff 0%, #4980ff 100%); transition: width 0.3s ease; border-radius: 3px;"></div>
            </div>
            <div class="status-step" style="color: rgba(255, 255, 255, 0.6); font-size: 11px; min-height: 14px;">Initializing...</div>
        `;

        container.appendChild(taskElement);
        this.taskElements.set(taskId, taskElement);

        // Add CSS animation
        if (!document.querySelector("style[data-solis-progress]")) {
            const style = document.createElement("style");
            style.setAttribute("data-solis-progress", "true");
            style.textContent = `
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(400px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                .progress-bar.complete {
                    background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
                }
                
                .progress-bar.error {
                    background: linear-gradient(90deg, #f87171 0%, #ef4444 100%);
                }
            `;
            document.head.appendChild(style);
        }
    }

    
    updateProgress(taskId, progress, step = "") {
        const taskElement = this.taskElements.get(taskId);

        if (taskElement) {
            const progressBar = taskElement.querySelector(".progress-bar");
            const statusText = taskElement.querySelector(".status-text");
            const statusStep = taskElement.querySelector(".status-step");

            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }

            if (statusText) {
                statusText.textContent = `${progress}%`;
            }

            if (statusStep && step) {
                statusStep.textContent = step;
            }
        }
    }

    
    markComplete(taskId) {
        const taskElement = this.taskElements.get(taskId);

        if (taskElement) {
            const progressBar = taskElement.querySelector(".progress-bar");
            const statusText = taskElement.querySelector(".status-text");
            const statusStep = taskElement.querySelector(".status-step");

            if (progressBar) {
                progressBar.classList.add("complete");
            }

            if (statusText) {
                statusText.textContent = "100%";
            }

            if (statusStep) {
                statusStep.textContent = "✅ Complete!";
            }

            // Auto-remove after 3 seconds
            setTimeout(() => {
                this.removeTask(taskId);
            }, 3000);
        }
    }

    
    markError(taskId, errorMessage = "Error occurred") {
        const taskElement = this.taskElements.get(taskId);

        if (taskElement) {
            const progressBar = taskElement.querySelector(".progress-bar");
            const statusStep = taskElement.querySelector(".status-step");

            if (progressBar) {
                progressBar.classList.add("error");
            }

            if (statusStep) {
                statusStep.textContent = `❌ ${errorMessage}`;
            }

            // Auto-remove after 5 seconds
            setTimeout(() => {
                this.removeTask(taskId);
            }, 5000);
        }
    }

    
    removeTask(taskId) {
        const taskElement = this.taskElements.get(taskId);

        if (taskElement) {
            taskElement.style.animation = "slideIn 0.3s ease reverse";
            setTimeout(() => {
                taskElement.remove();
                this.taskElements.delete(taskId);
            }, 300);
        }
    }
}

// Create global instance
const progressUI = new ProcessingProgressUI();
