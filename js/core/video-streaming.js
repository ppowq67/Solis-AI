class OptimizedVideoStreamingManager {
  constructor() {
    this.videoCache = new Map;
    this.activeStreams = new Map;
    this.chunkSize = 1024 * 1024;
    this.maxConcurrentRequests = 3;
    this.maxCacheSize = 50 * 1024 * 1024;
    this.currentCacheSize = 0;
    this.networkTimeout = 3e4;
    this.retryAttempts = 3;
    this.videoLoadStrategies = new Map;
    this.preloadQueue = [];
  }
  async initializeVideoStreams() {
    const e = [ {
      id: "minecraft_1",
      src: "/assets/Minecraft_1.mp4",
      name: "Minecraft Clip 1"
    }, {
      id: "minecraft_2",
      src: "/assets/Minecraft_2.mp4",
      name: "Minecraft Clip 2"
    }, {
      id: "minecraft_3",
      src: "/assets/Minecraft_3.mp4",
      name: "Minecraft Clip 3"
    }, {
      id: "minecraft_4",
      src: "/assets/Minecraft_4.mp4",
      name: "Minecraft Clip 4"
    } ];
    const t = e.map(e => this.fetchVideoMetadata(e));
    await Promise.all(t);
    this.setupPreloadingStrategy(e);
    return e;
  }
  async fetchVideoMetadata(e) {
    try {
      const t = await fetch(e.src, {
        method: "HEAD",
        signal: AbortSignal.timeout(5e3)
      });
      if (!t.ok) throw new Error(`HTTP ${t.status}`);
      const a = {
        id: e.id,
        src: e.src,
        name: e.name,
        size: parseInt(t.headers.get("content-length") || 0),
        type: t.headers.get("content-type"),
        supportsRangeRequests: t.headers.get("accept-ranges") === "bytes",
        eTag: t.headers.get("etag"),
        lastModified: t.headers.get("last-modified"),
        timestamp: Date.now(),
        cached: false,
        cachedSize: 0
      };
      this.videoCache.set(e.id, a);
      return a;
    } catch (t) {
      console.error(`❌ Failed to load metadata for ${e.id}:`, t);
      return null;
    }
  }
  setupPreloadingStrategy(e) {
    const t = {
      primary: e[0],
      secondary: e[1],
      tertiary: [ e[2], e[3] ]
    };
    this.videoLoadStrategies = t;
    if (t.primary) {
      this.preloadFirstChunk(t.primary.id);
    }
  }
  async preloadFirstChunk(e) {
    try {
      const t = this.videoCache.get(e);
      if (!t || !t.supportsRangeRequests) {
        console.warn(`⚠️ Video ${e} doesn't support range requests`);
        return;
      }
      const a = Math.min(256 * 1024, t.size);
      const i = await fetch(t.src, {
        headers: {
          Range: `bytes=0-${a - 1}`
        },
        signal: AbortSignal.timeout(this.networkTimeout)
      });
      if (i.status === 206 || i.status === 200) {
        const a = await i.blob();
        this.cacheVideoChunk(e, 0, a);
        t.cached = true;
        t.cachedSize = a.size;
      }
    } catch (t) {
      console.warn(`⚠️ Preload failed for ${e}:`, t);
    }
  }
  async loadVideoStream(e, t = null) {
    const a = this.videoCache.get(e);
    if (!a) {
      throw new Error(`Video ${e} not found`);
    }
    if (this.activeStreams.has(e)) {
      console.warn(`⚠️ Video ${e} is already loading`);
      return this.activeStreams.get(e);
    }
    const i = this._performStreamLoad(e, a, t);
    this.activeStreams.set(e, i);
    try {
      const e = await i;
      return e;
    } finally {
      this.activeStreams.delete(e);
    }
  }
  async _performStreamLoad(e, t, a) {
    if (!t.supportsRangeRequests) {
      return this._loadWithoutRangeRequests(e, t, a);
    }
    const i = t.size;
    const s = Math.ceil(i / this.chunkSize);
    const r = [];
    for (let e = 0; e < s; e++) {
      const o = e * this.chunkSize;
      const n = Math.min(o + this.chunkSize - 1, i - 1);
      try {
        const c = await fetch(t.src, {
          headers: {
            Range: `bytes=${o}-${n}`
          },
          signal: AbortSignal.timeout(this.networkTimeout)
        });
        if (c.status !== 206) {
          throw new Error(`Expected 206, got ${c.status}`);
        }
        const h = await c.blob();
        r.push(h);
        const d = (e + 1) / s * 100;
        if (a) {
          a({
            percent: Math.round(d),
            chunk: e + 1,
            totalChunks: s,
            bytesLoaded: (e + 1) * this.chunkSize,
            totalBytes: i
          });
        }
        if ((e + 1) % this.maxConcurrentRequests === 0) {
          await new Promise(e => setTimeout(e, 100));
        }
      } catch (t) {
        console.error(`❌ Chunk ${e} load failed:`, t);
        throw t;
      }
    }
    this.cacheVideoMetadata(e, {
      chunksLoaded: s
    });
    return new Blob(r, {
      type: "video/mp4"
    });
  }
  async _loadWithoutRangeRequests(e, t, a) {
    console.warn(`⚠️ ${e} doesn't support range requests, using standard loading`);
    try {
      const e = await fetch(t.src, {
        signal: AbortSignal.timeout(this.networkTimeout)
      });
      if (!e.ok) throw new Error(`HTTP ${e.status}`);
      const i = e.body.getReader();
      const s = [];
      let r = 0;
      const o = parseInt(e.headers.get("content-length") || 0);
      while (true) {
        const {done: e, value: t} = await i.read();
        if (e) break;
        s.push(t);
        r += t.length;
        if (a && o > 0) {
          a({
            percent: Math.round(r / o * 100),
            bytesLoaded: r,
            totalBytes: o
          });
        }
      }
      return new Blob(s, {
        type: "video/mp4"
      });
    } catch (t) {
      console.error(`❌ Load failed for ${e}:`, t);
      throw t;
    }
  }
  getOptimizedVideoElement(e, t = {}) {
    const a = document.createElement("video");
    a.id = e;
    a.controls = true;
    a.preload = "none";
    Object.assign(a, {
      controlsList: "nodownload",
      crossOrigin: "anonymous",
      playsinline: true
    });
    Object.assign(a, t);
    return a;
  }
  async switchVideo(e, t, a) {
    try {
      const e = this.videoCache.get(t);
      if (!e) {
        throw new Error(`Video ${t} not found`);
      }
      if (a.src) {
        a.pause();
        a.src = "";
      }
      const i = await this.loadVideoStream(t, e => {
        this._updateLoadingUI(t, e);
      });
      const s = URL.createObjectURL(i);
      a.src = s;
      setTimeout(() => {
        if (a.src === s) {
          URL.revokeObjectURL(s);
        }
      }, 5e3);
      return a;
    } catch (e) {
      console.error(`❌ Video switch failed:`, e);
      throw e;
    }
  }
  cacheVideoChunk(e, t, a) {
    const i = `${e}-chunk-${t}`;
    const s = a.size;
    if (this.currentCacheSize + s > this.maxCacheSize) {
      this._evictLRUCacheEntries(s);
    }
    this.videoCache.set(i, {
      type: "chunk",
      blob: a,
      timestamp: Date.now()
    });
    this.currentCacheSize += s;
  }
  cacheVideoMetadata(e, t) {
    const a = this.videoCache.get(e) || {};
    this.videoCache.set(e, {
      ...a,
      ...t
    });
  }
  _evictLRUCacheEntries(e) {
    const t = Array.from(this.videoCache.entries()).filter(([e]) => e.includes("chunk")).map(([e, t]) => ({
      key: e,
      timestamp: t.timestamp || 0
    })).sort((e, t) => e.timestamp - t.timestamp);
    let a = 0;
    for (const {key: i} of t) {
      if (a >= e) break;
      const t = this.videoCache.get(i);
      if (t?.blob) {
        a += t.blob.size;
      }
      this.videoCache.delete(i);
    }
  }
  clearCache(e = null) {
    if (e) {
      const t = Array.from(this.videoCache.keys()).filter(t => t.startsWith(e));
      t.forEach(e => this.videoCache.delete(e));
    } else {
      this.videoCache.clear();
      this.currentCacheSize = 0;
    }
  }
  _updateLoadingUI(e, t) {
    const a = document.getElementById(`${e}-loading`);
    if (a) {
      a.textContent = `Loading: ${t.percent}%`;
    }
  }
  formatBytes(e) {
    if (e === 0) return "0 Bytes";
    const t = 1024;
    const a = [ "Bytes", "KB", "MB", "GB" ];
    const i = Math.floor(Math.log(e) / Math.log(t));
    return Math.round(e / Math.pow(t, i) * 100) / 100 + " " + a[i];
  }
  getCacheStats() {
    return {
      cachedVideos: Array.from(this.videoCache.keys()).filter(e => !e.includes("chunk")),
      cachedChunks: Array.from(this.videoCache.keys()).filter(e => e.includes("chunk")).length,
      cacheSize: this.formatBytes(this.currentCacheSize),
      maxCacheSize: this.formatBytes(this.maxCacheSize),
      utilizationPercent: Math.round(this.currentCacheSize / this.maxCacheSize * 100)
    };
  }
}

window.OptimizedVideoStreamingManager = OptimizedVideoStreamingManager;

window.videoStreamingManager = null;
