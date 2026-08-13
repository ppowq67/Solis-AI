(function() {
  const t = 3;
  const e = [];
  let n = 0;
  let r = null;
  function esc(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function formatClock(t) {
    if (t == null || t === "" || t === "—") return "00:00";
    const e = String(t).trim();
    const n = e.match(/^(\d+):(\d{2})$/);
    if (n) return `${String(n[1]).padStart(2, "0")}:${n[2]}`;
    const r = e.match(/^(\d+(?:\.\d+)?)\s*s$/i);
    if (r) {
      const t = Math.max(0, Math.round(Number(r[1])));
      return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    }
    const i = Number(e);
    if (Number.isFinite(i) && i >= 0) {
      const t = Math.round(i);
      return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    }
    return e;
  }
  function letterFrom(t) {
    const e = Number(t) || 0;
    if (e <= 0) return "";
    if (e >= .9) return "A+";
    if (e >= .8) return "A";
    if (e >= .7) return "B+";
    if (e >= .6) return "B";
    if (e >= .5) return "C+";
    if (e >= .4) return "C";
    if (e >= .3) return "D";
    return "F";
  }
  function metric(t, e) {
    const n = t && t[e] || {};
    const r = Number(n.n);
    const i = n.available !== false && Number.isFinite(r) && r > 0;
    if (!i) return {
      grade: "",
      note: "",
      n: 0
    };
    const c = String(n.grade || "").replace(/-/g, "").trim();
    return {
      grade: c || letterFrom(r),
      note: String(n.note || "").trim(),
      n: r
    };
  }
  function viralityOf(t) {
    const e = t && t.virality;
    if (!e || typeof e !== "object") return null;
    const n = Number(e.score);
    if (!Number.isFinite(n) || n <= 0 || e.available === false) return null;
    return {
      score: Math.round(n),
      hook: metric(e, "hook"),
      clip: metric(e, "clip"),
      video: metric(e, "video")
    };
  }
  function iconDl() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  }
  function iconTrash() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  }
  function tip(t) {
    return `<span class="scc-tip">${esc(t)}</span>`;
  }
  function gradeRows(t, e) {
    return [ [ "hook", "Hook" ], [ "clip", "Clip" ], [ "video", "Video" ] ].map(([n, r]) => {
      const i = t[n] || {};
      if (!(i.n > 0) || !i.grade) return "";
      const c = i.grade;
      const s = i.note || "";
      const o = s ? `<div class="scc-why"><strong>${esc(c)} ${r}</strong><p>${esc(s)}</p></div>` : "";
      return `<div class="${e}" tabindex="0">\n                <b>${esc(c)}</b><span>${r}</span>\n                ${o}\n            </div>`;
    }).join("");
  }
  function previewUrl(t) {
    if (window.clipsStudio && typeof clipsStudio.getLibraryPreviewVideoUrl === "function") {
      return clipsStudio.getLibraryPreviewVideoUrl(t, {
        bust: true
      });
    }
    const e = (window.API_BASE_URL || "/api").replace(/\/$/, "");
    return `${e}/clips/preview/${encodeURIComponent(t)}/1`;
  }
  function pumpQueue() {
    while (n < t && e.length) {
      const t = e.shift();
      n += 1;
      Promise.resolve().then(t).catch(() => {}).finally(() => {
        n -= 1;
        pumpQueue();
      });
    }
  }
  function enqueueLoad(t) {
    e.push(t);
    pumpQueue();
  }
  function buildHTML(t) {
    const e = viralityOf(t);
    const n = esc(t.name || t.video_title || "Clip");
    const r = esc(t.projectId || t.id || "");
    const i = formatClock(t.duration);
    const c = e ? `<div class="scc-viral" tabindex="0">\n                    <span class="scc-viral-n">${esc(e.score)}</span>\n                    ${tip("How likely this clip is to take off on Shorts, TikTok, and Reels.")}\n               </div>` : `<div class="scc-viral scc-viral-empty"></div>`;
    return `\n            <div class="scc-preview">\n                <div class="scc-skel" aria-hidden="true"></div>\n                <video class="scc-video" muted playsinline loop preload="auto" controlslist="nodownload nofullscreen noremoteplayback" disablepictureinpicture></video>\n                <div class="scc-time"><span class="scc-t0">00:00</span> <span class="scc-t1">${esc(i)}</span></div>\n                <div class="scc-bar"><i></i></div>\n            </div>\n            <div class="scc-meta">\n                <div class="scc-meta-row">\n                    ${c}\n                    <div class="scc-actions">\n                        <button type="button" class="scc-ico library-download-btn" data-project-id="${r}" aria-label="Download">\n                            ${iconDl()}${tip("Save this clip")}\n                        </button>\n                        <button type="button" class="scc-ico library-delete-btn" aria-label="Delete">\n                            ${iconTrash()}${tip("Delete this clip")}\n                        </button>\n                    </div>\n                </div>\n                <h2 class="card-title scc-title" title="${n}">${n}</h2>\n            </div>`;
  }
  function railHTML(t) {
    const e = viralityOf(t);
    if (!e) return "";
    return `<div class="pv-head"><b>${esc(e.score)}</b><small>/100</small></div>${gradeRows(e, "pv-grade")}`;
  }
  function bind(t, e, n) {
    if (!t || t.dataset.sccBound === "1") return;
    t.dataset.sccBound = "1";
    const i = e.projectId || e.id;
    const c = t.querySelector(".scc-preview");
    const s = t.querySelector(".scc-video");
    const o = t.querySelector(".scc-bar > i");
    const a = t.querySelector(".scc-t0");
    const l = t.querySelector(".scc-t1");
    let d = "";
    const tick = () => {
      if (!s) return;
      const t = s.duration;
      const e = s.currentTime || 0;
      if (a) a.textContent = formatClock(e);
      if (Number.isFinite(t) && t > 0) {
        if (l) l.textContent = formatClock(t);
        if (o) o.style.width = `${Math.min(100, e / t * 100)}%`;
      }
    };
    const hasFrame = () => s && s.videoWidth > 0 && s.videoHeight > 0;
    const showFrame = () => {
      if (!hasFrame()) return;
      c?.classList.add("has-clip");
      tick();
    };
    const paintStill = () => {
      if (!s) return;
      const t = s.currentTime > .05 ? s.currentTime : .08;
      const afterSeek = () => {
        showFrame();
        if (!c?.matches(":hover")) {
          try {
            s.pause();
          } catch (t) {}
        }
      };
      try {
        s.currentTime = t;
      } catch (t) {}
      s.addEventListener("seeked", afterSeek, {
        once: true
      });
      s.play().then(() => {
        showFrame();
        if (!c?.matches(":hover")) {
          s.pause();
          showFrame();
        }
      }).catch(() => showFrame());
    };
    const playClip = () => {
      if (!s) return;
      s.muted = true;
      if (r && r !== s) {
        try {
          r.pause();
        } catch (t) {}
      }
      r = s;
      s.play().then(showFrame).catch(() => {});
    };
    const attachSrc = t => {
      s.muted = true;
      s.playsInline = true;
      s.setAttribute("playsinline", "");
      s.preload = "auto";
      s.src = t;
      try {
        s.load();
      } catch (t) {}
    };
    const bindReady = t => {
      s.addEventListener("loadeddata", t);
      s.addEventListener("canplay", t);
      s.addEventListener("loadedmetadata", t);
    };
    const ensureSrc = () => {
      if (!s || s.dataset.srcReady === "1") return;
      s.dataset.srcReady = "1";
      const t = previewUrl(i);
      enqueueLoad(() => new Promise(e => {
        if (!s.isConnected) {
          s.dataset.srcReady = "";
          e();
          return;
        }
        let n = false;
        const finish = () => {
          if (!n) {
            n = true;
            e();
          }
        };
        const onReady = () => {
          if (!hasFrame()) return;
          paintStill();
          finish();
        };
        bindReady(onReady);
        s.addEventListener("error", () => {
          const e = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
          const tryBlob = n => {
            fetch(t, {
              credentials: "include",
              headers: e
            }).then(t => t.ok ? t.blob() : Promise.reject(new Error(String(t.status)))).then(t => {
              if (d) try {
                URL.revokeObjectURL(d);
              } catch (t) {}
              d = URL.createObjectURL(t);
              bindReady(onReady);
              attachSrc(d);
            }).catch(() => {
              if (n < 4) setTimeout(() => tryBlob(n + 1), 1600 * (n + 1)); else finish();
            });
          };
          tryBlob(0);
        }, {
          once: true
        });
        attachSrc(t);
        setTimeout(finish, 1e4);
      }));
    };
    s?.addEventListener("timeupdate", tick);
    s?.addEventListener("loadedmetadata", tick);
    s?.addEventListener("pause", () => {
      if (r === s) r = null;
    });
    if (s && "IntersectionObserver" in window) {
      const e = new IntersectionObserver(t => {
        const e = t.some(t => t.isIntersecting);
        if (e) ensureSrc(); else if (s && !s.paused) {
          s.pause();
          if (r === s) r = null;
        }
      }, {
        rootMargin: "120px",
        threshold: .2
      });
      e.observe(t);
    } else {
      ensureSrc();
    }
    c?.addEventListener("mouseenter", () => {
      ensureSrc();
      if (s && s.paused) playClip();
    });
    c?.addEventListener("mouseleave", () => {
      if (s) {
        s.pause();
        showFrame();
      }
    });
    t.addEventListener("click", r => {
      if (r.target.closest(".library-download-btn, .library-delete-btn, .scc-ico, .scc-viral")) return;
      r.preventDefault();
      r.stopPropagation();
      if (s && !s.paused) try {
        s.pause();
      } catch (t) {}
      const c = e.id || i;
      if (n && typeof n.openLibraryPreview === "function" && c) {
        n.openLibraryPreview(c, i, t);
      }
    });
  }
  function setDuration(t, e) {
    const n = formatClock(e);
    const r = t && t.querySelector(".scc-t1");
    if (r) r.textContent = n;
  }
  window.SolisClipCard = {
    buildHTML: buildHTML,
    bind: bind,
    formatClock: formatClock,
    viralityOf: viralityOf,
    railHTML: railHTML,
    setDuration: setDuration
  };
})();
