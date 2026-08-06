class OutputClipsManager {
  constructor() {
    this.outputClipsCache = new Map;
    this.downloadingClips = new Set;
  }
  async loadOutputClips(t) {
    try {
      if (this.outputClipsCache.has(t)) {
        return this.outputClipsCache.get(t);
      }
      const n = getAuthHeaders();
      const e = await fetch(`${API_BASE_URL}/clips/output/${t}`, {
        headers: n,
        credentials: "include"
      });
      if (e.status === 403) {
        return null;
      }
      if (!e.ok) {
        console.error("[OUTPUT-CLIPS] Failed to load output clips:", e.statusText);
        return null;
      }
      const i = await e.json();
      this.outputClipsCache.set(t, i);
      return i;
    } catch (t) {
      console.error("[OUTPUT-CLIPS] Error loading output clips:", t);
      return null;
    }
  }
  async displayOutputClips(t, n) {
    try {
      const e = await this.loadOutputClips(t);
      if (!e || e.output_clips.length === 0) {
        return null;
      }
      const i = document.createElement("div");
      i.className = "output-clips-modal";
      i.innerHTML = `\n                <div class="output-clips-container">\n                    <div class="output-clips-header">\n                        <h2>🎬 Download Rendered Clips</h2>\n                        <p class="output-clips-subtitle">${n}</p>\n                        <button class="close-output-clips-modal" aria-label="Close">×</button>\n                    </div>\n\n                    <div class="output-clips-grid">\n                        ${e.output_clips.map(n => this.createClipCard(n, t)).join("")}\n                    </div>\n\n                    <div class="output-clips-footer">\n                        <p class="output-clips-info">\n                            ℹ️ ${e.total_clips} rendered clips with ranking overlays\n                        </p>\n                    </div>\n                </div>\n            `;
      document.body.appendChild(i);
      i.querySelector(".c6o").addEventListener("click", () => {
        i.remove();
      });
      i.addEventListener("click", t => {
        if (t.target === i) {
          i.remove();
        }
      });
      i.querySelectorAll(".cal").forEach(n => {
        n.addEventListener("click", async e => {
          e.preventDefault();
          const i = n.dataset.clipFilename;
          await this.downloadClip(t, i, n);
        });
      });
      return i;
    } catch (t) {
      console.error("[OUTPUT-CLIPS] Error displaying clips:", t);
      return null;
    }
  }
  createClipCard(t, n) {
    const e = t.rank || this.extractRankFromFilename(t.filename);
    const i = t.size_mb ? `${t.size_mb.toFixed(1)}MB` : "Unknown";
    return `\n            <div class="output-clip-card">\n                <div class="clip-rank-badge">Rank ${e}</div>\n                <div class="clip-details">\n                    <p class="clip-name">${sanitizeHTML(t.filename)}</p>\n                    <p class="clip-size">${i}</p>\n                </div>\n                <button\n                    class="download-clip-btn"\n                    data-clip-filename="${sanitizeHTML(t.filename)}"\n                    data-project-id="${n}"\n                    data-clip-rank="${e}"\n                >\n                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">\n                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>\n                        <polyline points="7 10 12 15 17 10"/>\n                        <line x1="12" y1="15" x2="12" y2="3"/>\n                    </svg>\n                    Download\n                </button>\n            </div>\n        `;
  }
  async downloadClip(t, n, e) {
    try {
      if (this.downloadingClips.has(`${t}-${n}`)) {
        return;
      }
      const i = `${t}-${n}`;
      this.downloadingClips.add(i);
      const l = e.innerHTML;
      e.disabled = true;
      e.innerHTML = `\n                <svg class="download-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">\n                    <circle cx="12" cy="12" r="10"/>\n                    <polyline points="12 6 12 12 16 14"/>\n                </svg>\n                Downloading...\n            `;
      const o = await fetch(`${API_BASE_URL}/clips/output/${t}/download/${encodeURIComponent(n)}`, {
        headers: getAuthHeaders(),
        credentials: "include"
      });
      if (!o.ok) {
        throw new Error(`Download failed: ${o.statusText}`);
      }
      const a = await o.blob();
      const s = window.URL.createObjectURL(a);
      const r = document.createElement("a");
      r.href = s;
      r.download = n;
      document.body.appendChild(r);
      r.click();
      window.URL.revokeObjectURL(s);
      document.body.removeChild(r);
      e.innerHTML = `\n                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">\n                    <path d="M20 6L9 17l-5-5"/>\n                </svg>\n                Downloaded!\n            `;
      setTimeout(() => {
        e.innerHTML = l;
        e.disabled = false;
      }, 2e3);
    } catch (t) {
      console.error("[OUTPUT-CLIPS] Download error:", t);
      e.textContent = "Download Failed";
      e.disabled = true;
    } finally {
      this.downloadingClips.delete(`${t}-${n}`);
    }
  }
  extractRankFromFilename(t) {
    const n = t.match(/rank_(\d+)/);
    return n ? parseInt(n[1]) : "?";
  }
  clearCache(t) {
    this.outputClipsCache.delete(t);
  }
  clearAllCache() {
    this.outputClipsCache.clear();
  }
}

window.outputClipsManager = new OutputClipsManager;
