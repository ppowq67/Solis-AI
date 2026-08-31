

class VideoPreviewSystem {
    constructor() {
        this.currentVideoId = null;
        this.videoData = null;
        this.chapters = [];
        this.bestMoment = null;
        this.captionRemovalEnabled = false;
        this.configMode = false;
        this.previewMode = 'normal'; // normal, caption-removal, config, podcast, comparison
        this.isShortMode = false;
        this.cropZones = [];
    }

    
    loadYouTubeIframe(videoId, isShort = false) {
        this.currentVideoId = videoId;
        this.isShortMode = isShort;
        const previewEl = document.getElementById('templateVideoPreview');
        
        if (!previewEl) return;

        if (isShort) {
            // Side-by-side comparison for shorts
            previewEl.innerHTML = `
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; gap: 8px; border-radius: 8px; overflow: hidden; background: #000;">
                    <!-- LEFT: Original with native captions -->
                    <div style="flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0;">
                        <div style="font-size: 11px; color: #fff; padding: 6px 8px; background: rgba(0,0,0,0.8); text-align: center; font-weight: 600; flex-shrink: 0;">ORIGINAL</div>
                        <div style="flex: 1; position: relative; overflow: hidden; border-radius: 4px; min-height: 0;">
                            <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen
                                style="border-radius: 4px; display: block;"
                            ></iframe>
                        </div>
                    </div>

                    <!-- RIGHT: Captions removed + custom overlay -->
                    <div style="flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0;">
                        <div style="font-size: 11px; color: #fff; padding: 6px 8px; background: rgba(0,0,0,0.8); text-align: center; font-weight: 600; flex-shrink: 0;">MODIFIED</div>
                        <div style="flex: 1; position: relative; overflow: hidden; border-radius: 4px; min-height: 0;">
                            <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen
                                style="border-radius: 4px; display: block; position: relative; z-index: 1;"
                            ></iframe>
                            <div id="previewOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 4px; pointer-events: none; z-index: 10;"></div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            previewEl.innerHTML = `
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 8px; overflow: hidden;">
                    <iframe
                        width="100%"
                        height="100%"
                        src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        style="border-radius: 8px; position: relative; z-index: 1; display: block;"
                    ></iframe>
                    <div id="previewOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 8px; pointer-events: none; z-index: 10;"></div>
                </div>
            `;
        }

        // Fetch video metadata and chapters
        this.fetchVideoMetadata(videoId);
    }

    
    async fetchVideoMetadata(videoId) {
        try {
            const response = await fetch('/api/youtube/metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_id: videoId })
            });

            if (response.ok) {
                const data = await response.json();
                this.videoData = data;
                this.chapters = data.chapters || [];
                
                // Fetch and initialize captions
                this.initializeCaption();
                
                // Find best moment using Groq AI
                if (this.chapters.length > 0) {
                    this.findBestMoment();
                }
            }
        } catch (error) {
            console.error('Error fetching video metadata:', error);
        }
    }

    
    async initializeCaption() {
        if (typeof captionSystem !== 'undefined') {
            const subtitles = await captionSystem.fetchYouTubeSubtitles(this.currentVideoId);
            if (subtitles.length > 0) {
                // For comparison mode, apply captions to right panel
                if (this.isShortMode && this.previewMode === 'comparison') {
                    this.initializeComparisonCaptions(subtitles);
                } else {
                    // Normal caption initialization
                    captionSystem.initializeCaptions(subtitles);
                }
                
                // Update UI to show that subtitles are available
                const statusEl = document.getElementById('youtubeSubtitleStatus');
                if (statusEl) {
                    statusEl.innerHTML = `
                        <span style="color: #22c55e;">✓ Subtitles Available</span>
                        <small style="color: #888; display: block; margin-top: 4px;">${subtitles.length} words detected</small>
                    `;
                }
            }
        }
    }

    
    initializeComparisonCaptions(subtitleData) {
        // Find the right panel overlay
        const previewEl = document.getElementById('templateVideoPreview');
        if (!previewEl) return;

        // Find the right panel (second flex child)
        const panels = previewEl.querySelectorAll('[style*="flex: 1"]');
        if (panels.length < 2) return;

        const rightPanel = panels[1];
        let overlay = rightPanel.querySelector('[id="previewOverlay"]') || rightPanel.querySelector('div[data-overlay="right"]');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'previewOverlay';
            overlay.setAttribute('data-overlay', 'right');
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '10';
            rightPanel.appendChild(overlay);
        }

        // Parse subtitles
        const words = captionSystem.parseSubtitles(subtitleData);

        // Create caption content for right panel
        let captionContent = overlay.querySelector('#videoCaptionContent');
        if (!captionContent) {
            captionContent = document.createElement('div');
            captionContent.id = 'videoCaptionContent';
            captionContent.className = `video-caption-overlay style-${captionSystem.currentStyle}`;
            captionContent.style.position = 'absolute';
            captionContent.style.bottom = '15%';
            captionContent.style.width = '90%';
            captionContent.style.left = '5%';
            captionContent.style.textAlign = 'center';
            captionContent.style.zIndex = '15';
            overlay.appendChild(captionContent);
        }

        // Populate with words
        captionContent.innerHTML = '';
        words.forEach(wordObj => {
            const span = document.createElement('span');
            span.className = 'caption-word';
            span.textContent = wordObj.text;
            
            if (captionSystem.isHighlightWord(wordObj.text)) {
                span.classList.add('highlight');
            }
            
            captionContent.appendChild(span);
            captionContent.appendChild(document.createTextNode(' '));
        });
    }

    
    async findBestMoment() {
        try {
            const response = await fetch('/api/ai/analyze-chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_id: this.currentVideoId,
                    chapters: this.chapters,
                    video_data: this.videoData
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.bestMoment = result.best_moment;
                
                // Update UI with best moment info
                const momentInfo = document.getElementById('bestMomentInfo');
                if (momentInfo && this.bestMoment) {
                    momentInfo.innerHTML = `
                        <span style="color: #22c55e;">Best Moment:</span> 
                        ${this.bestMoment.title} (${this.formatTime(this.bestMoment.start)} - ${this.formatTime(this.bestMoment.end)})
                    `;
                }
            }
        } catch (error) {
            console.error('Error analyzing chapters:', error);
        }
    }

    
    enableCaptionRemoval() {
        this.captionRemovalEnabled = true;
        this.previewMode = 'caption-removal';
        
        const overlay = document.getElementById('previewOverlay');
        if (overlay) {
            overlay.innerHTML = `
                <div style="
                    position: absolute;
                    bottom: 0;
                    width: 100%;
                    height: 40%;
                    background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.9));
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    padding: 20px;
                    color: #22c55e;
                    font-size: 12px;
                    text-align: center;
                ">
                    <span>✓ Captions Removed</span>
                </div>
            `;
        }
    }

    
    showConfigOverlay() {
        this.previewMode = 'config';
        this.configMode = true;
        
        const overlay = document.getElementById('previewOverlay');
        if (overlay) {
            overlay.innerHTML = `
                <div style="
                    position: absolute;
                    bottom: 22%;
                    width: 90%;
                    left: 5%;
                    text-align: center;
                    z-index: 10;
                ">
                    <div style="
                        display: inline-block;
                        background: rgba(255, 255, 255, 0.95);
                        color: #000;
                        padding: 12px 20px;
                        border-radius: 8px;
                        font-weight: 800;
                        font-size: 18px;
                        text-transform: uppercase;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                        animation: pulse-config 1.5s ease-in-out infinite;
                    ">
                        CAPTION DESIGN PREVIEW
                    </div>
                </div>
                <style>
                    @keyframes pulse-config {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                </style>
            `;
        }

        // Initialize caption system
        if (typeof captionSystem !== 'undefined') {
            captionSystem.playAnimation();
        }
    }

    
    enablePodcastMode() {
        this.previewMode = 'podcast';
        
        if (!this.bestMoment) {
            alert('Analyzing video for best moment...');
            return;
        }

        const overlay = document.getElementById('previewOverlay');
        if (overlay) {
            overlay.innerHTML = `
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.8);
                    padding: 20px;
                    border-radius: 12px;
                    color: white;
                    text-align: center;
                    z-index: 10;
                ">
                    <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">🎙️ Best Moment</div>
                    <div style="font-size: 14px; margin-bottom: 15px;">${this.bestMoment.title}</div>
                    <div style="
                        background: rgba(34, 197, 94, 0.2);
                        padding: 10px;
                        border-radius: 8px;
                        border-left: 3px solid #22c55e;
                    ">
                        <div style="font-size: 12px; color: #22c55e;">
                            ⏱️ ${this.formatTime(this.bestMoment.start)} - ${this.formatTime(this.bestMoment.end)}
                        </div>
                        <div style="font-size: 11px; color: #ccc; margin-top: 5px;">
                            Duration: ${this.formatTime(this.bestMoment.end - this.bestMoment.start)}
                        </div>
                    </div>
                </div>
            `;
        }
    }

    
    formatTime(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    
    resetPreview() {
        this.previewMode = 'normal';
        this.captionRemovalEnabled = false;
        this.configMode = false;
        
        const overlay = document.getElementById('previewOverlay');
        if (overlay) {
            overlay.innerHTML = '';
        }
    }

    
    applyCropZones(zones) {
        this.cropZones = zones;
        
        if (zones.length === 0) {
            this.removeCropOverlay();
            return;
        }

        // Get right panel overlay for shorts, or main overlay
        let overlay = document.querySelector('[data-overlay="right"]') || document.getElementById('previewOverlay');
        if (!overlay) {
            const previewEl = document.getElementById('templateVideoPreview');
            if (!previewEl) return;
            overlay = document.createElement('div');
            overlay.id = 'previewOverlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '10';
            previewEl.appendChild(overlay);
        }

        // Create or update crop mask
        let cropMask = document.getElementById('captionCropMask');
        if (!cropMask) {
            cropMask = document.createElement('div');
            cropMask.id = 'captionCropMask';
            overlay.appendChild(cropMask);
        }

        // Create SVG mask for better rendering
        const maskSvg = `
            <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
                <defs>
                    <mask id="cropMask" x="0%" y="0%" width="100%" height="100%">
                        <rect width="100%" height="100%" fill="white"/>
                        ${zones.map((zone, i) => `
                            <rect x="${zone.x}%" y="${zone.y}%" width="${zone.width}%" height="${zone.height}%" fill="black"/>
                        `).join('')}
                    </mask>
                </defs>
                ${zones.map((zone, i) => `
                    <rect x="${zone.x}%" y="${zone.y}%" width="${zone.width}%" height="${zone.height}%" 
                          fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" stroke-width="1" stroke-dasharray="4,4"/>
                `).join('')}
            </svg>
        `;

        cropMask.innerHTML = maskSvg;
        this.captionRemovalEnabled = true;
    }

    
    removeCropOverlay() {
        const cropMask = document.getElementById('captionCropMask');
        if (cropMask) {
            cropMask.remove();
        }
        this.cropZones = [];
        this.captionRemovalEnabled = false;
    }
}

// Global instance
const videoPreviewSystem = new VideoPreviewSystem();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoPreviewSystem;
}
