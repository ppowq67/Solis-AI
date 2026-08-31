class OptimizedVideoStreamingManager {
    constructor() {
        this.videoCache = new Map(); // Cache metadata, not full videos
        this.activeStreams = new Map(); // Track active streaming requests
        this.chunkSize = 1024 * 1024; // 1MB chunks
        this.maxConcurrentRequests = 3;
        this.maxCacheSize = 50 * 1024 * 1024; // 50MB max cache
        this.currentCacheSize = 0;
        this.networkTimeout = 30000; // 30 second timeout
        this.retryAttempts = 3;
        this.videoLoadStrategies = new Map();
        this.preloadQueue = [];
    }

    /**
     * Initialize video streams for gameplay clips
     */
    async initializeVideoStreams() {
        const videos = [
            { id: 'minecraft_1', src: '/assets/Minecraft_1.mp4', name: 'Minecraft Clip 1' },
            { id: 'minecraft_2', src: '/assets/Minecraft_2.mp4', name: 'Minecraft Clip 2' },
            { id: 'minecraft_3', src: '/assets/Minecraft_3.mp4', name: 'Minecraft Clip 3' },
            { id: 'minecraft_4', src: '/assets/Minecraft_4.mp4', name: 'Minecraft Clip 4' },
        ];

        const promises = videos.map(video => this.fetchVideoMetadata(video));
        await Promise.all(promises);
        this.setupPreloadingStrategy(videos);

        return videos;
    }

    /**
     * Fetch video metadata without loading full content
     */
    async fetchVideoMetadata(videoInfo) {
        try {
            const response = await fetch(videoInfo.src, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const metadata = {
                id: videoInfo.id,
                src: videoInfo.src,
                name: videoInfo.name,
                size: parseInt(response.headers.get('content-length') || 0),
                type: response.headers.get('content-type'),
                supportsRangeRequests: response.headers.get('accept-ranges') === 'bytes',
                eTag: response.headers.get('etag'),
                lastModified: response.headers.get('last-modified'),
                timestamp: Date.now(),
                cached: false,
                cachedSize: 0,
            };

            this.videoCache.set(videoInfo.id, metadata);

            return metadata;
        } catch (error) {
            console.error(`❌ Failed to load metadata for ${videoInfo.id}:`, error);
            return null;
        }
    }

    /**
     * Setup intelligent preloading strategy
     */
    setupPreloadingStrategy(videos) {
        // Preload only metadata and first chunk of most relevant video
        const strategyMap = {
            primary: videos[0], // Minecraft_1 - preload first chunk
            secondary: videos[1], // Minecraft_2 - metadata only
            tertiary: [videos[2], videos[3]], // Others - on-demand
        };

        this.videoLoadStrategies = strategyMap;

        // Start preloading primary video's first chunk
        if (strategyMap.primary) {
            this.preloadFirstChunk(strategyMap.primary.id);
        }
    }
    async preloadFirstChunk(videoId) {
        try {
            const metadata = this.videoCache.get(videoId);
            if (!metadata || !metadata.supportsRangeRequests) {
                console.warn(`⚠️ Video ${videoId} doesn't support range requests`);
                return;
            }


            const chunkSize = Math.min(256 * 1024, metadata.size);
            const response = await fetch(metadata.src, {
                headers: {
                    'Range': `bytes=0-${chunkSize - 1}`,
                },
                signal: AbortSignal.timeout(this.networkTimeout),
            });

            if (response.status === 206 || response.status === 200) {
                const blob = await response.blob();
                this.cacheVideoChunk(videoId, 0, blob);
                metadata.cached = true;
                metadata.cachedSize = blob.size;
            }
        } catch (error) {
            console.warn(`⚠️ Preload failed for ${videoId}:`, error);
        }
    }

    /**
     * Optimized video loading with streaming support
     */
    async loadVideoStream(videoId, onProgress = null) {
        const metadata = this.videoCache.get(videoId);
        if (!metadata) {
            throw new Error(`Video ${videoId} not found`);
        }

        // Check if already loading
        if (this.activeStreams.has(videoId)) {
            console.warn(`⚠️ Video ${videoId} is already loading`);
            return this.activeStreams.get(videoId);
        }

        const streamPromise = this._performStreamLoad(videoId, metadata, onProgress);
        this.activeStreams.set(videoId, streamPromise);

        try {
            const result = await streamPromise;
            return result;
        } finally {
            this.activeStreams.delete(videoId);
        }
    }

    /**
     * Internal stream loading with range requests
     */
    async _performStreamLoad(videoId, metadata, onProgress) {
        if (!metadata.supportsRangeRequests) {
            return this._loadWithoutRangeRequests(videoId, metadata, onProgress);
        }

        const totalSize = metadata.size;
        const chunks = Math.ceil(totalSize / this.chunkSize);
        const loadedChunks = [];


        for (let i = 0; i < chunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize - 1, totalSize - 1);

            try {
                const response = await fetch(metadata.src, {
                    headers: {
                        'Range': `bytes=${start}-${end}`,
                    },
                    signal: AbortSignal.timeout(this.networkTimeout),
                });

                if (response.status !== 206) {
                    throw new Error(`Expected 206, got ${response.status}`);
                }

                const chunk = await response.blob();
                loadedChunks.push(chunk);

                // Update progress
                const progress = ((i + 1) / chunks) * 100;
                if (onProgress) {
                    onProgress({ 
                        percent: Math.round(progress),
                        chunk: i + 1,
                        totalChunks: chunks,
                        bytesLoaded: (i + 1) * this.chunkSize,
                        totalBytes: totalSize,
                    });
                }


                // Limit concurrent requests
                if ((i + 1) % this.maxConcurrentRequests === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                }
            } catch (error) {
                console.error(`❌ Chunk ${i} load failed:`, error);
                throw error;
            }
        }

        this.cacheVideoMetadata(videoId, { chunksLoaded: chunks });
        return new Blob(loadedChunks, { type: 'video/mp4' });
    }

    /**
     * Fallback loading without range request support
     */
    async _loadWithoutRangeRequests(videoId, metadata, onProgress) {
        console.warn(`⚠️ ${videoId} doesn't support range requests, using standard loading`);

        try {
            const response = await fetch(metadata.src, {
                signal: AbortSignal.timeout(this.networkTimeout),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;
            const totalLength = parseInt(response.headers.get('content-length') || 0);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedLength += value.length;

                if (onProgress && totalLength > 0) {
                    onProgress({
                        percent: Math.round((receivedLength / totalLength) * 100),
                        bytesLoaded: receivedLength,
                        totalBytes: totalLength,
                    });
                }
            }

            return new Blob(chunks, { type: 'video/mp4' });
        } catch (error) {
            console.error(`❌ Load failed for ${videoId}:`, error);
            throw error;
        }
    }

    /**
     * Get video element with optimized settings
     */
    getOptimizedVideoElement(videoId, options = {}) {
        const video = document.createElement('video');
        video.id = videoId;
        video.controls = true;
        video.preload = 'none'; // Don't preload everything
        
        // Optimized attributes
        Object.assign(video, {
            controlsList: 'nodownload',
            crossOrigin: 'anonymous',
            playsinline: true,
        });

        // Apply custom options
        Object.assign(video, options);

        return video;
    }

    /**
     * Switch videos efficiently (cache switching without reload)
     */
    async switchVideo(fromVideoId, toVideoId, videoElement) {
        try {
            const toMetadata = this.videoCache.get(toVideoId);
            if (!toMetadata) {
                throw new Error(`Video ${toVideoId} not found`);
            }


            // Pause and stop current video
            if (videoElement.src) {
                videoElement.pause();
                videoElement.src = '';
            }

            // Load new video with progress
            const blob = await this.loadVideoStream(toVideoId, (progress) => {
                this._updateLoadingUI(toVideoId, progress);
            });

            // Set new source
            const blobUrl = URL.createObjectURL(blob);
            videoElement.src = blobUrl;
            
            // Cleanup old URL after some time
            setTimeout(() => {
                if (videoElement.src === blobUrl) {
                    URL.revokeObjectURL(blobUrl);
                }
            }, 5000);

            return videoElement;
        } catch (error) {
            console.error(`❌ Video switch failed:`, error);
            throw error;
        }
    }

    /**
     * Cache management
     */
    cacheVideoChunk(videoId, chunkIndex, blob) {
        const cacheKey = `${videoId}-chunk-${chunkIndex}`;
        const blobSize = blob.size;

        // Check cache size
        if (this.currentCacheSize + blobSize > this.maxCacheSize) {
            this._evictLRUCacheEntries(blobSize);
        }

        this.videoCache.set(cacheKey, {
            type: 'chunk',
            blob,
            timestamp: Date.now(),
        });

        this.currentCacheSize += blobSize;
    }

    cacheVideoMetadata(videoId, metadata) {
        const existing = this.videoCache.get(videoId) || {};
        this.videoCache.set(videoId, { ...existing, ...metadata });
    }

    /**
     * LRU cache eviction when memory is tight
     */
    _evictLRUCacheEntries(requiredSpace) {
        const entries = Array.from(this.videoCache.entries())
            .filter(([key]) => key.includes('chunk'))
            .map(([key, value]) => ({ key, timestamp: value.timestamp || 0 }))
            .sort((a, b) => a.timestamp - b.timestamp);

        let freedSpace = 0;
        for (const { key } of entries) {
            if (freedSpace >= requiredSpace) break;
            const chunk = this.videoCache.get(key);
            if (chunk?.blob) {
                freedSpace += chunk.blob.size;
            }
            this.videoCache.delete(key);
        }

    }

    /**
     * Clear all cache
     */
    clearCache(videoId = null) {
        if (videoId) {
            const keysToDelete = Array.from(this.videoCache.keys())
                .filter(key => key.startsWith(videoId));
            keysToDelete.forEach(key => this.videoCache.delete(key));
        } else {
            this.videoCache.clear();
            this.currentCacheSize = 0;
        }
    }

    /**
     * Update loading UI (can be overridden by consumer)
     */
    _updateLoadingUI(videoId, progress) {
        const loadingEl = document.getElementById(`${videoId}-loading`);
        if (loadingEl) {
            loadingEl.textContent = `Loading: ${progress.percent}%`;
        }
    }

    /**
     * Utility: Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cachedVideos: Array.from(this.videoCache.keys()).filter(k => !k.includes('chunk')),
            cachedChunks: Array.from(this.videoCache.keys()).filter(k => k.includes('chunk')).length,
            cacheSize: this.formatBytes(this.currentCacheSize),
            maxCacheSize: this.formatBytes(this.maxCacheSize),
            utilizationPercent: Math.round((this.currentCacheSize / this.maxCacheSize) * 100),
        };
    }
}

// Create global instance
window.OptimizedVideoStreamingManager = OptimizedVideoStreamingManager;
window.videoStreamingManager = null;
