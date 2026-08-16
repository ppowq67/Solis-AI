(function() {
  const e = 3;
  const t = [];
  let n = 0;
  let i = null;
  function esc(e) {
    return String(e == null ? "" : e).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function formatClock(e) {
    if (e == null || e === "" || e === "—") return "00:00";
    const t = String(e).trim();
    const n = t.match(/^(\d+):(\d{2})$/);
    if (n) return `${String(n[1]).padStart(2, "0")}:${n[2]}`;
    const i = t.match(/^(\d+(?:\.\d+)?)\s*s$/i);
    if (i) {
      const e = Math.max(0, Math.round(Number(i[1])));
      return `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
    }
    const r = Number(t);
    if (Number.isFinite(r) && r >= 0) {
      const e = Math.round(r);
      return `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
    }
    return t;
  }
  function fmtHundred(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t <= 0) return 0;
    if (t > 10) return Math.max(0, Math.min(100, Math.round(t)));
    return Math.max(0, Math.min(100, Math.round(t * 10)));
  }
  const r = {
    high: {
      label: "High potential."
    },
    solid: {
      label: "Worth posting."
    },
    average: {
      label: "Average."
    },
    low: {
      label: "Skip it."
    }
  };
  const s = {
    "S+": 100,
    S: 92,
    A: 82,
    B: 68,
    C: 52,
    D: 30
  };
  function bandOf(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t <= 0) return "";
    if (t >= 80) return "high";
    if (t >= 60) return "solid";
    if (t >= 40) return "average";
    return "low";
  }
  function scoreToHundred(e, t) {
    if (!e || typeof e !== "object") return 0;
    if (e.n100 != null && Number.isFinite(Number(e.n100))) return fmtHundred(e.n100);
    if (e.score_100 != null && Number.isFinite(Number(e.score_100))) return fmtHundred(e.score_100);
    if (Number(e.score_max) === 100 && e.score != null) return fmtHundred(e.score);
    const n = e.score_10 != null ? e.score_10 : e.n != null ? e.n : e.score;
    if (n != null && Number.isFinite(Number(n))) return fmtHundred(n);
    const i = String(t || e.tier || e.grade || "").toUpperCase().replace(/\s+/g, "");
    return s[i === "S+" ? "S+" : i] || 0;
  }
  function dimOf(e, t) {
    const n = e && e[t] || {};
    const i = Number(n.n != null ? n.n : n.score);
    const r = n.available !== false && Number.isFinite(i) && i > 0;
    const s = r ? scoreToHundred(n, n.band || n.grade) : 0;
    const c = n.band || bandOf(s);
    return {
      n: r ? i : 0,
      n100: s,
      display: s ? String(s) : "",
      band: c,
      note: String(n.note || n.why || "").trim(),
      available: r || s > 0
    };
  }
  function viralityOf(e) {
    const t = e && e.virality;
    if (!t || typeof t !== "object") return null;
    if (t.available === false) return null;
    const n = scoreToHundred(t, t.tier || t.band);
    let i = String(t.band || "").toLowerCase();
    if (!r[i]) {
      const e = String(t.tier || "").toLowerCase();
      i = r[e] ? e : bandOf(n);
    }
    if (!r[i] || n <= 0) return null;
    const s = Array.isArray(t.clips) ? t.clips : [];
    const c = t.lone_clip === true || s.length <= 1;
    if (n < 60 && !c) return null;
    const a = t.tag && typeof t.tag === "object" ? t.tag : null;
    const o = a ? Number(a.confidence) : 0;
    const l = r[i] || r.solid;
    return {
      band: i,
      score100: n,
      scoreDisplay: String(n),
      label: String(t.label || l.label),
      why: String(t.why || "").trim(),
      fix: String(t.fix || "").trim(),
      tag: a && a.label && o >= .8 ? {
        label: String(a.label),
        confidence: o
      } : null,
      hook: dimOf(t, "hook"),
      subtitles: dimOf(t, "subtitles"),
      clip: dimOf(t, "clip"),
      video: dimOf(t, "video")
    };
  }
  function iconDl() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  }
  function iconShare() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
  }
  function iconTrash() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  }
  function tip(e) {
    return `<span class="scc-tip">${esc(e)}</span>`;
  }
  function dimBandClass(e) {
    const t = String(e || "");
    return t ? "pv-band-" + t : "";
  }
  function gradeRows(e) {
    return [ [ "hook", "Hook" ], [ "clip", "Clip" ], [ "video", "Video" ] ].map(([t, n]) => {
      const i = e[t] || {};
      const r = i.n100 || 0;
      if (!r) return "";
      const s = i.band || bandOf(r);
      const c = i.note || "";
      const a = c ? `<div class="scc-why"><p>${esc(c)}</p></div>` : "";
      return `<div class="pv-grade" data-dim="${esc(t)}">\n                <b class="pv-dim-tier ${dimBandClass(s)}">${esc(String(r))}</b>\n                <span class="pv-dim-label">${esc(n)}</span>\n                ${a}\n            </div>`;
    }).join("");
  }
  function previewUrl(e) {
    if (window.clipsStudio && typeof clipsStudio.getLibraryPreviewVideoUrl === "function") {
      return clipsStudio.getLibraryPreviewVideoUrl(e, {
        bust: false
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
  function bandClass(e) {
    return "scc-band-" + String(e || "solid");
  }
  function buildHTML(e) {
    const t = viralityOf(e);
    const n = esc(e.name || e.video_title || "Clip");
    const i = esc(e.projectId || e.id || "");
    const r = formatClock(e.duration);
    const s = t ? `<div class="scc-viral ${bandClass(t.band)}">\n                    <span class="scc-viral-n">${esc(t.scoreDisplay)}</span>\n                    ${tip(`${t.scoreDisplay}/100 · ${t.label}`)}\n               </div>` : `<div class="scc-viral scc-viral-empty"></div>`;
    return `\n            <div class="scc-preview">\n                <div class="scc-skel" aria-hidden="true"></div>\n                <video class="scc-video" muted playsinline loop preload="none" controlslist="nodownload nofullscreen noremoteplayback" disablepictureinpicture></video>\n                <div class="scc-time"><span class="scc-t0">00:00</span> <span class="scc-t1">${esc(r)}</span></div>\n                <div class="scc-bar"><i></i></div>\n            </div>\n            <div class="scc-meta">\n                <div class="scc-meta-row">\n                    ${s}\n                    <div class="scc-actions">\n                        <button type="button" class="scc-ico library-share-btn" data-project-id="${i}" aria-label="Share preview">\n                            ${iconShare()}${tip("Copy public preview link")}\n                        </button>\n                        <button type="button" class="scc-ico library-download-btn" data-project-id="${i}" aria-label="Download">\n                            ${iconDl()}${tip("Save this clip")}\n                        </button>\n                        <button type="button" class="scc-ico library-delete-btn" aria-label="Delete">\n                            ${iconTrash()}${tip("Delete this clip")}\n                        </button>\n                    </div>\n                </div>\n                <h2 class="card-title scc-title" title="${n}">${n}</h2>\n            </div>`;
  }
  function railHTML(e) {
    const t = viralityOf(e);
    if (!t) return "";
    const n = gradeRows(t);
    const i = t.fix ? `<div class="scc-why pv-fix-tip"><p>${esc(t.fix)}</p></div>` : "";
    return `<div class="pv-card">\n            <div class="pv-head">\n                <div class="pv-score-line">\n                    <b class="pv-score-num">${esc(String(t.score100))}</b><span class="pv-score-max">/100</span>\n                </div>\n                ${i}\n            </div>\n            <div class="pv-grades">${n}</div>\n        </div>`;
  }
  function bindRail(e) {
    if (!e) return;
    const t = Array.from(e.querySelectorAll(".pv-grade"));
    const n = e.querySelector(".pv-head");
    const clearTips = () => {
      t.forEach(e => e.classList.remove("is-tip"));
      n?.classList.remove("is-tip");
    };
    t.forEach(e => {
      const t = e.querySelector(".scc-why");
      if (!t) return;
      e.addEventListener("mouseenter", () => {
        clearTips();
        e.classList.add("is-tip");
      });
      e.addEventListener("mouseleave", () => {
        e.classList.remove("is-tip");
      });
    });
    if (n && n.querySelector(".pv-fix-tip")) {
      n.addEventListener("mouseenter", () => {
        clearTips();
        n.classList.add("is-tip");
      });
      n.addEventListener("mouseleave", () => {
        n.classList.remove("is-tip");
      });
    }
  }
  function bind(e, t, n) {
    if (!e || e.dataset.sccBound === "1") return;
    e.dataset.sccBound = "1";
    const r = t.projectId || t.id;
    const s = e.querySelector(".scc-preview");
    const c = e.querySelector(".scc-video");
    const a = e.querySelector(".scc-bar > i");
    const o = e.querySelector(".scc-t0");
    const l = e.querySelector(".scc-t1");
    let d = "";
    const tick = () => {
      if (!c) return;
      const e = c.duration;
      const t = c.currentTime || 0;
      if (o) o.textContent = formatClock(t);
      if (Number.isFinite(e) && e > 0) {
        if (l) l.textContent = formatClock(e);
        if (a) a.style.width = `${Math.min(100, t / e * 100)}%`;
      }
    };
    const hasFrame = () => c && c.videoWidth > 0 && c.videoHeight > 0;
    const showFrame = () => {
      if (!hasFrame()) return;
      s?.classList.add("has-clip");
      tick();
    };
    const paintStill = () => {
      if (!c) return;
      const e = c.currentTime > .05 ? c.currentTime : .08;
      const afterSeek = () => {
        showFrame();
        if (!s?.matches(":hover")) {
          try {
            c.pause();
          } catch (e) {}
        }
      };
      try {
        c.currentTime = e;
      } catch (e) {}
      c.addEventListener("seeked", afterSeek, {
        once: true
      });
      c.play().then(() => {
        showFrame();
        if (!s?.matches(":hover")) {
          c.pause();
          showFrame();
        }
      }).catch(() => showFrame());
    };
    const playClip = () => {
      if (!c) return;
      c.muted = true;
      if (i && i !== c) {
        try {
          i.pause();
        } catch (e) {}
      }
      i = c;
      c.play().then(showFrame).catch(() => {});
    };
    const attachSrc = e => {
      c.muted = true;
      c.playsInline = true;
      c.setAttribute("playsinline", "");
      c.preload = "auto";
      c.src = e;
      try {
        c.load();
      } catch (e) {}
    };
    const bindReady = e => {
      c.addEventListener("loadeddata", e);
      c.addEventListener("canplay", e);
      c.addEventListener("loadedmetadata", e);
    };
    const ensureSrc = () => {
      if (!c || c.dataset.srcReady === "1" || c.dataset.srcFailed === "1") return;
      c.dataset.srcReady = "1";
      const e = previewUrl(r);
      enqueueLoad(() => new Promise(t => {
        if (!c.isConnected) {
          c.dataset.srcReady = "";
          t();
          return;
        }
        let n = false;
        let i = 0;
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
        c.addEventListener("error", () => {
          const t = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
          const tryBlob = () => {
            if (i >= 2) {
              c.dataset.srcFailed = "1";
              finish();
              return;
            }
            i += 1;
            fetch(e, {
              credentials: "include",
              headers: t
            }).then(e => e.ok ? e.blob() : Promise.reject(new Error(String(e.status)))).then(e => {
              if (d) try {
                URL.revokeObjectURL(d);
              } catch (e) {}
              d = URL.createObjectURL(e);
              bindReady(onReady);
              attachSrc(d);
            }).catch(() => {
              setTimeout(tryBlob, 1800 * i);
            });
          };
          tryBlob();
        }, {
          once: true
        });
        attachSrc(e);
        setTimeout(finish, 1e4);
      }));
    };
    c?.addEventListener("timeupdate", tick);
    c?.addEventListener("loadedmetadata", tick);
    c?.addEventListener("pause", () => {
      if (i === c) i = null;
    });
    s?.addEventListener("mouseenter", () => {
      ensureSrc();
      if (c && c.paused) playClip();
    });
    s?.addEventListener("mouseleave", () => {
      if (c) {
        c.pause();
        showFrame();
      }
    });
    e.addEventListener("click", i => {
      if (i.target.closest(".library-download-btn, .library-delete-btn, .library-share-btn, .scc-ico, .scc-viral")) return;
      i.preventDefault();
      i.stopPropagation();
      if (c && !c.paused) try {
        c.pause();
      } catch (e) {}
      const s = t.id || r;
      if (n && typeof n.openLibraryPreview === "function" && s) {
        n.openLibraryPreview(s, r, e);
      }
    });
  }
  function setDuration(e, t) {
    const n = formatClock(t);
    const i = e && e.querySelector(".scc-t1");
    if (i) i.textContent = n;
  }
  window.SolisClipCard = {
    buildHTML: buildHTML,
    bind: bind,
    bindRail: bindRail,
    formatClock: formatClock,
    viralityOf: viralityOf,
    railHTML: railHTML,
    setDuration: setDuration
  };
})();
