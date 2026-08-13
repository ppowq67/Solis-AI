(function() {
  const e = 3;
  const t = [];
  let n = 0;
  let r = null;
  function esc(e) {
    return String(e == null ? "" : e).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function formatClock(e) {
    if (e == null || e === "" || e === "—") return "00:00";
    const t = String(e).trim();
    const n = t.match(/^(\d+):(\d{2})$/);
    if (n) return `${String(n[1]).padStart(2, "0")}:${n[2]}`;
    const r = t.match(/^(\d+(?:\.\d+)?)\s*s$/i);
    if (r) {
      const e = Math.max(0, Math.round(Number(r[1])));
      return `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
    }
    const i = Number(t);
    if (Number.isFinite(i) && i >= 0) {
      const e = Math.round(i);
      return `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
    }
    return t;
  }
  function letterFrom(e) {
    const t = Number(e) || 0;
    if (t <= 0) return "";
    if (t >= .9) return "A+";
    if (t >= .8) return "A";
    if (t >= .7) return "B+";
    if (t >= .6) return "B";
    if (t >= .5) return "C+";
    if (t >= .4) return "C";
    if (t >= .3) return "D";
    return "F";
  }
  function metric(e, t) {
    const n = e && e[t] || {};
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
  function viralityOf(e) {
    const t = e && e.virality;
    if (!t || typeof t !== "object") return null;
    const n = Number(t.score);
    if (!Number.isFinite(n) || n <= 0 || t.available === false) return null;
    return {
      score: Math.round(n),
      hook: metric(t, "hook"),
      clip: metric(t, "clip"),
      video: metric(t, "video")
    };
  }
  function iconDl() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  }
  function iconTrash() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  }
  function tip(e) {
    return `<span class="scc-tip">${esc(e)}</span>`;
  }
  function gradeRows(e, t) {
    return [ [ "hook", "Hook" ], [ "clip", "Clip" ], [ "video", "Video" ] ].map(([n, r]) => {
      const i = e[n] || {};
      if (!(i.n > 0) || !i.grade) return "";
      const c = i.grade;
      const o = i.note || "";
      const s = o ? `<div class="scc-why"><strong>${esc(c)} ${r}</strong><p>${esc(o)}</p></div>` : "";
      return `<div class="${t}" tabindex="0">\n                <b>${esc(c)}</b><span>${r}</span>\n                ${s}\n            </div>`;
    }).join("");
  }
  function previewUrl(e) {
    if (window.clipsStudio && typeof clipsStudio.getLibraryPreviewVideoUrl === "function") {
      return clipsStudio.getLibraryPreviewVideoUrl(e, {
        bust: true
      });
    }
    const t = (window.API_BASE_URL || "/api").replace(/\/$/, "");
    return `${t}/clips/preview/${encodeURIComponent(e)}/1`;
  }
  function pumpQueue() {
    while (n < e && t.length) {
      const e = t.shift();
      n += 1;
      Promise.resolve().then(e).catch(() => {}).finally(() => {
        n -= 1;
        pumpQueue();
      });
    }
  }
  function enqueueLoad(e) {
    t.push(e);
    pumpQueue();
  }
  function buildHTML(e) {
    const t = viralityOf(e);
    const n = esc(e.name || e.video_title || "Clip");
    const r = esc(e.projectId || e.id || "");
    const i = formatClock(e.duration);
    const c = t ? `<div class="scc-viral" tabindex="0">\n                    <span class="scc-viral-n">${esc(t.score)}</span>\n                    ${tip("How likely this clip is to take off on Shorts, TikTok, and Reels.")}\n               </div>` : `<div class="scc-viral scc-viral-empty"></div>`;
    return `\n            <div class="scc-preview">\n                <div class="scc-skel" aria-hidden="true"></div>\n                <video class="scc-video" muted playsinline loop preload="auto" controlslist="nodownload nofullscreen noremoteplayback" disablepictureinpicture></video>\n                <div class="scc-time"><span class="scc-t0">00:00</span> <span class="scc-t1">${esc(i)}</span></div>\n                <div class="scc-bar"><i></i></div>\n            </div>\n            <div class="scc-meta">\n                <div class="scc-meta-row">\n                    ${c}\n                    <div class="scc-actions">\n                        <button type="button" class="scc-ico library-download-btn" data-project-id="${r}" aria-label="Download">\n                            ${iconDl()}${tip("Save this clip")}\n                        </button>\n                        <button type="button" class="scc-ico library-delete-btn" aria-label="Delete">\n                            ${iconTrash()}${tip("Delete this clip")}\n                        </button>\n                    </div>\n                </div>\n                <h2 class="card-title scc-title" title="${n}">${n}</h2>\n            </div>`;
  }
  function railHTML(e) {
    const t = viralityOf(e);
    if (!t) return "";
    return `<div class="pv-head"><b>${esc(t.score)}</b><small>/100</small></div>${gradeRows(t, "pv-grade")}`;
  }
  function bind(e, t, n) {
    if (!e || e.dataset.sccBound === "1") return;
    e.dataset.sccBound = "1";
    const i = t.projectId || t.id;
    const c = e.querySelector(".scc-preview");
    const o = e.querySelector(".scc-video");
    const s = e.querySelector(".scc-bar > i");
    const a = e.querySelector(".scc-t0");
    const l = e.querySelector(".scc-t1");
    let d = "";
    const tick = () => {
      if (!o) return;
      const e = o.duration;
      const t = o.currentTime || 0;
      if (a) a.textContent = formatClock(t);
      if (Number.isFinite(e) && e > 0) {
        if (l) l.textContent = formatClock(e);
        if (s) s.style.width = `${Math.min(100, t / e * 100)}%`;
      }
    };
    const hasFrame = () => o && o.videoWidth > 0 && o.videoHeight > 0;
    const showFrame = () => {
      if (!hasFrame()) return;
      c?.classList.add("has-clip");
      tick();
    };
    const paintStill = () => {
      if (!o) return;
      const e = o.currentTime > .05 ? o.currentTime : .08;
      const afterSeek = () => {
        showFrame();
        if (!c?.matches(":hover")) {
          try {
            o.pause();
          } catch (e) {}
        }
      };
      try {
        o.currentTime = e;
      } catch (e) {}
      o.addEventListener("seeked", afterSeek, {
        once: true
      });
      o.play().then(() => {
        showFrame();
        if (!c?.matches(":hover")) {
          o.pause();
          showFrame();
        }
      }).catch(() => showFrame());
    };
    const playClip = () => {
      if (!o) return;
      o.muted = true;
      if (r && r !== o) {
        try {
          r.pause();
        } catch (e) {}
      }
      r = o;
      o.play().then(showFrame).catch(() => {});
    };
    const attachSrc = e => {
      o.muted = true;
      o.playsInline = true;
      o.setAttribute("playsinline", "");
      o.preload = "auto";
      o.src = e;
      try {
        o.load();
      } catch (e) {}
    };
    const bindReady = e => {
      o.addEventListener("loadeddata", e);
      o.addEventListener("canplay", e);
      o.addEventListener("loadedmetadata", e);
    };
    const ensureSrc = () => {
      if (!o || o.dataset.srcReady === "1") return;
      o.dataset.srcReady = "1";
      const e = previewUrl(i);
      enqueueLoad(() => new Promise(t => {
        if (!o.isConnected) {
          o.dataset.srcReady = "";
          t();
          return;
        }
        let n = false;
        const finish = () => {
          if (!n) {
            n = true;
            t();
          }
        };
        const onReady = () => {
          if (!hasFrame()) return;
          paintStill();
          finish();
        };
        bindReady(onReady);
        o.addEventListener("error", () => {
          if (o.dataset.blobTried === "1") {
            finish();
            return;
          }
          o.dataset.blobTried = "1";
          const t = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
          fetch(e, {
            credentials: "include",
            headers: t
          }).then(e => e.ok ? e.blob() : Promise.reject()).then(e => {
            if (d) try {
              URL.revokeObjectURL(d);
            } catch (e) {}
            d = URL.createObjectURL(e);
            bindReady(onReady);
            attachSrc(d);
          }).catch(finish);
        }, {
          once: true
        });
        attachSrc(e);
        setTimeout(finish, 1e4);
      }));
    };
    o?.addEventListener("timeupdate", tick);
    o?.addEventListener("loadedmetadata", tick);
    o?.addEventListener("pause", () => {
      if (r === o) r = null;
    });
    if (o && "IntersectionObserver" in window) {
      const t = new IntersectionObserver(e => {
        const t = e.some(e => e.isIntersecting);
        if (t) ensureSrc(); else if (o && !o.paused) {
          o.pause();
          if (r === o) r = null;
        }
      }, {
        rootMargin: "120px",
        threshold: .2
      });
      t.observe(e);
    } else {
      ensureSrc();
    }
    c?.addEventListener("mouseenter", () => {
      ensureSrc();
      if (o && o.paused) playClip();
    });
    c?.addEventListener("mouseleave", () => {
      if (o) {
        o.pause();
        showFrame();
      }
    });
    e.addEventListener("click", r => {
      if (r.target.closest(".library-download-btn, .library-delete-btn, .scc-ico, .scc-viral")) return;
      r.preventDefault();
      r.stopPropagation();
      if (o && !o.paused) try {
        o.pause();
      } catch (e) {}
      const c = t.id || i;
      if (n && typeof n.openLibraryPreview === "function" && c) {
        n.openLibraryPreview(c, i, e);
      }
    });
  }
  function setDuration(e, t) {
    const n = formatClock(t);
    const r = e && e.querySelector(".scc-t1");
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
