class VideoPreviewSystem {
  constructor() {
    this.currentVideoId = null;
    this.videoData = null;
    this.chapters = [];
    this.bestMoment = null;
    this.captionRemovalEnabled = false;
    this.configMode = false;
    this.previewMode = "normal";
    this.isShortMode = false;
    this.cropZones = [];
  }
  loadYouTubeIframe(e, t = false) {
    this.currentVideoId = e;
    this.isShortMode = t;
    const n = document.getElementById("i24g");
    if (!n) return;
    if (t) {
      n.innerHTML = `\n                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; gap: 8px; border-radius: 8px; overflow: hidden; background: #000;">\n                    \x3c!-- LEFT: Original with native captions --\x3e\n                    <div style="flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0;">\n                        <div style="font-size: 11px; color: #fff; padding: 6px 8px; background: rgba(0,0,0,0.8); text-align: center; font-weight: 600; flex-shrink: 0;">ORIGINAL</div>\n                        <div style="flex: 1; position: relative; overflow: hidden; border-radius: 4px; min-height: 0;">\n                            <iframe\n                                width="100%"\n                                height="100%"\n                                src="https://www.youtube.com/embed/${e}?rel=0&modestbranding=1"\n                                frameborder="0"\n                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"\n                                allowfullscreen\n                                style="border-radius: 4px; display: block;"\n                            ></iframe>\n                        </div>\n                    </div>\n\n                    \x3c!-- RIGHT: Captions removed + custom overlay --\x3e\n                    <div style="flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0;">\n                        <div style="font-size: 11px; color: #fff; padding: 6px 8px; background: rgba(0,0,0,0.8); text-align: center; font-weight: 600; flex-shrink: 0;">MODIFIED</div>\n                        <div style="flex: 1; position: relative; overflow: hidden; border-radius: 4px; min-height: 0;">\n                            <iframe\n                                width="100%"\n                                height="100%"\n                                src="https://www.youtube.com/embed/${e}?rel=0&modestbranding=1"\n                                frameborder="0"\n                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"\n                                allowfullscreen\n                                style="border-radius: 4px; display: block; position: relative; z-index: 1;"\n                            ></iframe>\n                            <div id="previewOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 4px; pointer-events: none; z-index: 10;"></div>\n                        </div>\n                    </div>\n                </div>\n            `;
    } else {
      n.innerHTML = `\n                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 8px; overflow: hidden;">\n                    <iframe\n                        width="100%"\n                        height="100%"\n                        src="https://www.youtube.com/embed/${e}?rel=0&modestbranding=1"\n                        frameborder="0"\n                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"\n                        allowfullscreen\n                        style="border-radius: 8px; position: relative; z-index: 1; display: block;"\n                    ></iframe>\n                    <div id="previewOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 8px; pointer-events: none; z-index: 10;"></div>\n                </div>\n            `;
    }
    this.fetchVideoMetadata(e);
  }
  async fetchVideoMetadata(e) {
    try {
      const t = await fetch("/api/youtube/metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          video_id: e
        })
      });
      if (t.ok) {
        const e = await t.json();
        this.videoData = e;
        this.chapters = e.chapters || [];
        this.initializeCaption();
        if (this.chapters.length > 0) {
          this.findBestMoment();
        }
      }
    } catch (e) {
      console.error("Error fetching video metadata:", e);
    }
  }
  async initializeCaption() {
    if (typeof captionSystem !== "undefined") {
      const e = await captionSystem.fetchYouTubeSubtitles(this.currentVideoId);
      if (e.length > 0) {
        if (this.isShortMode && this.previewMode === "comparison") {
          this.initializeComparisonCaptions(e);
        } else {
          captionSystem.initializeCaptions(e);
        }
        const t = document.getElementById("youtubeSubtitleStatus");
        if (t) {
          t.innerHTML = `\n                        <span style="color: #22c55e;">✓ Subtitles Available</span>\n                        <small style="color: #888; display: block; margin-top: 4px;">${e.length} words detected</small>\n                    `;
        }
      }
    }
  }
  initializeComparisonCaptions(e) {
    const t = document.getElementById("i24g");
    if (!t) return;
    const n = t.querySelectorAll('[style*="flex: 1"]');
    if (n.length < 2) return;
    const i = n[1];
    let o = i.querySelector('[id="previewOverlay"]') || i.querySelector('div[data-overlay="right"]');
    if (!o) {
      o = document.createElement("div");
      o.id = "previewOverlay";
      o.setAttribute("data-overlay", "right");
      o.style.position = "absolute";
      o.style.top = "0";
      o.style.left = "0";
      o.style.width = "100%";
      o.style.height = "100%";
      o.style.pointerEvents = "none";
      o.style.zIndex = "10";
      i.appendChild(o);
    }
    const s = captionSystem.parseSubtitles(e);
    let r = o.querySelector("#videoCaptionContent");
    if (!r) {
      r = document.createElement("div");
      r.id = "videoCaptionContent";
      r.className = `video-caption-overlay style-${captionSystem.currentStyle}`;
      r.style.position = "absolute";
      r.style.bottom = "15%";
      r.style.width = "90%";
      r.style.left = "5%";
      r.style.textAlign = "center";
      r.style.zIndex = "15";
      o.appendChild(r);
    }
    r.innerHTML = "";
    s.forEach(e => {
      const t = document.createElement("span");
      t.className = "caption-word";
      t.textContent = e.text;
      if (captionSystem.isHighlightWord(e.text)) {
        t.classList.add("highlight");
      }
      r.appendChild(t);
      r.appendChild(document.createTextNode(" "));
    });
  }
  async findBestMoment() {
    try {
      const e = await fetch("/api/ai/analyze-chapters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          video_id: this.currentVideoId,
          chapters: this.chapters,
          video_data: this.videoData
        })
      });
      if (e.ok) {
        const t = await e.json();
        this.bestMoment = t.best_moment;
        const n = document.getElementById("bestMomentInfo");
        if (n && this.bestMoment) {
          n.innerHTML = `\n                        <span style="color: #22c55e;">Best Moment:</span>\n                        ${this.bestMoment.title} (${this.formatTime(this.bestMoment.start)} - ${this.formatTime(this.bestMoment.end)})\n                    `;
        }
      }
    } catch (e) {
      console.error("Error analyzing chapters:", e);
    }
  }
  enableCaptionRemoval() {
    this.captionRemovalEnabled = true;
    this.previewMode = "caption-removal";
    const e = document.getElementById("previewOverlay");
    if (e) {
      e.innerHTML = `\n                <div style="\n                    position: absolute;\n                    bottom: 0;\n                    width: 100%;\n                    height: 40%;\n                    background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.9));\n                    display: flex;\n                    align-items: flex-end;\n                    justify-content: center;\n                    padding: 20px;\n                    color: #22c55e;\n                    font-size: 12px;\n                    text-align: center;\n                ">\n                    <span>✓ Captions Removed</span>\n                </div>\n            `;
    }
  }
  showConfigOverlay() {
    this.previewMode = "config";
    this.configMode = true;
    const e = document.getElementById("previewOverlay");
    if (e) {
      e.innerHTML = `\n                <div style="\n                    position: absolute;\n                    bottom: 22%;\n                    width: 90%;\n                    left: 5%;\n                    text-align: center;\n                    z-index: 10;\n                ">\n                    <div style="\n                        display: inline-block;\n                        background: rgba(255, 255, 255, 0.95);\n                        color: #000;\n                        padding: 12px 20px;\n                        border-radius: 8px;\n                        font-weight: 800;\n                        font-size: 18px;\n                        text-transform: uppercase;\n                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);\n                        animation: pulse-config 1.5s ease-in-out infinite;\n                    ">\n                        CAPTION DESIGN PREVIEW\n                    </div>\n                </div>\n                <style>\n                    @keyframes pulse-config {\n                        0%, 100% { transform: scale(1); }\n                        50% { transform: scale(1.05); }\n                    }\n                </style>\n            `;
    }
    if (typeof captionSystem !== "undefined") {
      captionSystem.playAnimation();
    }
  }
  enablePodcastMode() {
    this.previewMode = "podcast";
    if (!this.bestMoment) {
      alert("Analyzing video for best moment...");
      return;
    }
    const e = document.getElementById("previewOverlay");
    if (e) {
      e.innerHTML = `\n                <div style="\n                    position: absolute;\n                    top: 50%;\n                    left: 50%;\n                    transform: translate(-50%, -50%);\n                    background: rgba(0, 0, 0, 0.8);\n                    padding: 20px;\n                    border-radius: 12px;\n                    color: white;\n                    text-align: center;\n                    z-index: 10;\n                ">\n                    <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">🎙️ Best Moment</div>\n                    <div style="font-size: 14px; margin-bottom: 15px;">${this.bestMoment.title}</div>\n                    <div style="\n                        background: rgba(34, 197, 94, 0.2);\n                        padding: 10px;\n                        border-radius: 8px;\n                        border-left: 3px solid #22c55e;\n                    ">\n                        <div style="font-size: 12px; color: #22c55e;">\n                            ⏱️ ${this.formatTime(this.bestMoment.start)} - ${this.formatTime(this.bestMoment.end)}\n                        </div>\n                        <div style="font-size: 11px; color: #ccc; margin-top: 5px;">\n                            Duration: ${this.formatTime(this.bestMoment.end - this.bestMoment.start)}\n                        </div>\n                    </div>\n                </div>\n            `;
    }
  }
  formatTime(e) {
    if (!e) return "0:00";
    const t = Math.floor(e / 60);
    const n = Math.floor(e % 60);
    return `${t}:${n.toString().padStart(2, "0")}`;
  }
  resetPreview() {
    this.previewMode = "normal";
    this.captionRemovalEnabled = false;
    this.configMode = false;
    const e = document.getElementById("previewOverlay");
    if (e) {
      e.innerHTML = "";
    }
  }
  applyCropZones(e) {
    this.cropZones = e;
    if (e.length === 0) {
      this.removeCropOverlay();
      return;
    }
    let t = document.querySelector('[data-overlay="right"]') || document.getElementById("previewOverlay");
    if (!t) {
      const e = document.getElementById("i24g");
      if (!e) return;
      t = document.createElement("div");
      t.id = "previewOverlay";
      t.style.position = "absolute";
      t.style.top = "0";
      t.style.left = "0";
      t.style.width = "100%";
      t.style.height = "100%";
      t.style.pointerEvents = "none";
      t.style.zIndex = "10";
      e.appendChild(t);
    }
    let n = document.getElementById("captionCropMask");
    if (!n) {
      n = document.createElement("div");
      n.id = "captionCropMask";
      t.appendChild(n);
    }
    const i = `\n            <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">\n                <defs>\n                    <mask id="cropMask" x="0%" y="0%" width="100%" height="100%">\n                        <rect width="100%" height="100%" fill="white"/>\n                        ${e.map((e, t) => `\n                            <rect x="${e.x}%" y="${e.y}%" width="${e.width}%" height="${e.height}%" fill="black"/>\n                        `).join("")}\n                    </mask>\n                </defs>\n                ${e.map((e, t) => `\n                    <rect x="${e.x}%" y="${e.y}%" width="${e.width}%" height="${e.height}%"\n                          fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" stroke-width="1" stroke-dasharray="4,4"/>\n                `).join("")}\n            </svg>\n        `;
    n.innerHTML = i;
    this.captionRemovalEnabled = true;
  }
  removeCropOverlay() {
    const e = document.getElementById("captionCropMask");
    if (e) {
      e.remove();
    }
    this.cropZones = [];
    this.captionRemovalEnabled = false;
  }
}

const videoPreviewSystem = new VideoPreviewSystem;

if (typeof module !== "undefined" && module.exports) {
  module.exports = VideoPreviewSystem;
}
