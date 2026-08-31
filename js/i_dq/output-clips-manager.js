/**
 * 🎬 Output Clips Manager
 * Manages download and re-customization of rendered clips (Prime/Elite only)
 * Features:
 * - Display available output clips for a project
 * - Download individual clips (clip_rank_1_overlay.mp4, etc.)
 * - Re-customize overlay graphics
 * - Track clip sizes and metadata
 */

class OutputClipsManager {
    constructor() {
        this.outputClipsCache = new Map(); // Cache output clips per project
        this.downloadingClips = new Set(); // Track in-progress downloads
    }

    /**
     * Load output clips for a project
     * 🔐 Only works for Prime/Elite users
     */
    async loadOutputClips(projectId) {
        try {
            // Check cache first
            if (this.outputClipsCache.has(projectId)) {
                return this.outputClipsCache.get(projectId);
            }

            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/clips/output/${projectId}`, {
                headers: headers,
                credentials: 'include'
            });

            if (response.status === 403) {
                return null;
            }

            if (!response.ok) {
                console.error('[OUTPUT-CLIPS] Failed to load output clips:', response.statusText);
                return null;
            }

            const data = await response.json();
            this.outputClipsCache.set(projectId, data);
            return data;

        } catch (error) {
            console.error('[OUTPUT-CLIPS] Error loading output clips:', error);
            return null;
        }
    }

    /**
     * Display output clips in a modal or panel
     */
    async displayOutputClips(projectId, projectName) {
        try {
            const clipsData = await this.loadOutputClips(projectId);
            
            if (!clipsData || clipsData.output_clips.length === 0) {
                return null; // No clips available
            }

            // Create modal HTML
            const modal = document.createElement('div');
            modal.className = 'output-clips-modal';
            modal.innerHTML = `
                <div class="output-clips-container">
                    <div class="output-clips-header">
                        <h2>🎬 Download Rendered Clips</h2>
                        <p class="output-clips-subtitle">${projectName}</p>
                        <button class="close-output-clips-modal" aria-label="Close">×</button>
                    </div>
                    
                    <div class="output-clips-grid">
                        ${clipsData.output_clips.map(clip => this.createClipCard(clip, projectId)).join('')}
                    </div>
                    
                    <div class="output-clips-footer">
                        <p class="output-clips-info">
                            ℹ️ ${clipsData.total_clips} rendered clips with ranking overlays
                        </p>
                    </div>
                </div>
            `;

            // Add to DOM
            document.body.appendChild(modal);

            // Add event listeners
            modal.querySelector('.close-output-clips-modal').addEventListener('click', () => {
                modal.remove();
            });

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

            // Add download listeners
            modal.querySelectorAll('.download-clip-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const clipFilename = btn.dataset.clipFilename;
                    await this.downloadClip(projectId, clipFilename, btn);
                });
            });

            return modal;

        } catch (error) {
            console.error('[OUTPUT-CLIPS] Error displaying clips:', error);
            return null;
        }
    }

    /**
     * Create a card for a single output clip
     */
    createClipCard(clip, projectId) {
        const rank = clip.rank || this.extractRankFromFilename(clip.filename);
        const sizeText = clip.size_mb ? `${clip.size_mb.toFixed(1)}MB` : 'Unknown';
        
        return `
            <div class="output-clip-card">
                <div class="clip-rank-badge">Rank ${rank}</div>
                <div class="clip-details">
                    <p class="clip-name">${sanitizeHTML(clip.filename)}</p>
                    <p class="clip-size">${sizeText}</p>
                </div>
                <button 
                    class="download-clip-btn" 
                    data-clip-filename="${sanitizeHTML(clip.filename)}"
                    data-project-id="${projectId}"
                    data-clip-rank="${rank}"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                </button>
            </div>
        `;
    }

    /**
     * Download a specific output clip
     */
    async downloadClip(projectId, clipFilename, button) {
        try {
            // Prevent duplicate downloads
            if (this.downloadingClips.has(`${projectId}-${clipFilename}`)) {
                return;
            }

            const downloadKey = `${projectId}-${clipFilename}`;
            this.downloadingClips.add(downloadKey);

            // Update button state
            const originalHTML = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `
                <svg class="download-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                Downloading...
            `;

            const response = await fetch(
                `${API_BASE_URL}/clips/output/${projectId}/download/${encodeURIComponent(clipFilename)}`,
                {
                    headers: getAuthHeaders(),
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = clipFilename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
                Downloaded!
            `;
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('[OUTPUT-CLIPS] Download error:', error);
            button.textContent = 'Download Failed';
            button.disabled = true;
        } finally {
            this.downloadingClips.delete(`${projectId}-${clipFilename}`);
        }
    }

    /**
     * Extract rank from filename (e.g., "clip_rank_3_overlay.mp4" -> 3)
     */
    extractRankFromFilename(filename) {
        const match = filename.match(/rank_(\d+)/);
        return match ? parseInt(match[1]) : '?';
    }

    /**
     * Clear cache for a project (when it's deleted, etc.)
     */
    clearCache(projectId) {
        this.outputClipsCache.delete(projectId);
    }

    /**
     * Clear all cache
     */
    clearAllCache() {
        this.outputClipsCache.clear();
    }
}

// Global instance
window.outputClipsManager = new OutputClipsManager();
