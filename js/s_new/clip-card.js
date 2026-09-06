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
  function fmtHundred(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t <= 0) return 0;
    if (t > 10) return Math.max(0, Math.min(100, Math.round(t)));
    return Math.max(0, Math.min(100, Math.round(t * 10)));
  }
  const i = {
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
    const r = String(t || e.tier || e.grade || "").toUpperCase().replace(/\s+/g, "");
    return s[r === "S+" ? "S+" : r] || 0;
  }
  function dimOf(e, t) {
    const n = e && e[t] || {};
    const r = Number(n.n != null ? n.n : n.score);
    const i = n.available !== false && Number.isFinite(r) && r > 0;
    const s = i ? scoreToHundred(n, n.band || n.grade) : 0;
    const o = n.band || bandOf(s);
    return {
      n: i ? r : 0,
      n100: s,
      display: s ? String(s) : "",
      band: o,
      note: String(n.note || n.why || "").trim(),
      available: i || s > 0
    };
  }
  function viralityOf(e) {
    const t = e && e.virality;
    if (!t || typeof t !== "object") return null;
    if (t.available === false) return null;
    const n = scoreToHundred(t, t.tier || t.band);
    let r = String(t.band || "").toLowerCase();
    if (!i[r]) {
      const e = String(t.tier || "").toLowerCase();
      r = i[e] ? e : bandOf(n);
    }
    if (!i[r] || n <= 0) return null;
    const s = Array.isArray(t.clips) ? t.clips : [];
    const o = t.lone_clip === true || s.length <= 1;
    if (n < 60 && !o) return null;
    const c = t.tag && typeof t.tag === "object" ? t.tag : null;
    const a = c ? Number(c.confidence) : 0;
    const l = i[r] || i.solid;
    return {
      band: r,
      score100: n,
      scoreDisplay: String(n),
      label: String(t.label || l.label),
      why: String(t.why || "").trim(),
      fix: String(t.fix || "").trim(),
      rank: t.rank != null && t.rank !== "" ? t.rank : null,
      tag: c && c.label && a >= .8 ? {
        label: String(c.label),
        confidence: a
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
      const r = e[t] || {};
      const i = r.n100 || 0;
      if (!i) return "";
      const s = r.band || bandOf(i);
      const o = r.note || "";
      const c = o ? `<div class="scc-why"><p>${esc(o)}</p></div>` : "";
      return `<div class="pv-grade" data-dim="${esc(t)}">\n                <b class="pv-dim-tier ${dimBandClass(s)}">${esc(String(i))}</b>\n                <span class="pv-dim-label">${esc(n)}</span>\n                ${c}\n            </div>`;
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
  function posterUrl(e) {
    const t = e && (e.thumbnailUrl || e.thumbnail_url);
    if (t && String(t).startsWith("http")) return String(t);
    const n = e && (e.projectId || e.id);
    if (!n) return "";
    const r = (window.API_BASE_URL || "/api").replace(/\/$/, "");
    return `${r}/clips/poster/${encodeURIComponent(n)}`;
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
    const t = esc(e.name || e.video_title || "Clip");
    const n = esc(e.projectId || e.id || "");
    const r = esc(e.id || e.projectId || "");
    const i = formatClock(e.duration);
    const s = window.currentUser && window.currentUser.plan || "free";
    const o = e.resolution || (s === "free" ? "720p" : "1080p");
    const c = s !== "free";
    const a = c ? "" : '<span class="pro-badge scc-res-pro-inline">PRO</span>';
    const l = `<div class="scc-res-wrap" data-project-id="${n}" data-res="${esc(o)}">\n            <button type="button" class="scc-res-pill${o === "720p" ? " active" : ""}" data-res="720p">720p</button>\n            <button type="button" class="scc-res-pill${o === "1080p" ? " active" : ""}${!c ? " locked" : ""}" data-res="1080p">1080p${a}</button>\n        </div>`;
    return `\n            <span class="scc-select-check" aria-hidden="true"></span>\n            <div class="scc-preview">\n                <div class="scc-skel" aria-hidden="true"></div>\n                <img class="scc-poster" alt="" loading="lazy" decoding="async" draggable="false">\n                <video class="scc-video" muted playsinline loop preload="none" controlslist="nodownload nofullscreen noremoteplayback" disablepictureinpicture></video>\n                <span class="scc-play" aria-hidden="true"></span>\n                <div class="scc-time"><span class="scc-t0">00:00</span> <span class="scc-t1">${esc(i)}</span></div>\n                <div class="scc-bar"><i></i></div>\n            </div>\n            <div class="scc-meta">\n                <div class="scc-meta-row">\n                    ${l}\n                    <div class="scc-actions">\n                        <button type="button" class="scc-ico library-share-btn" data-project-id="${n}" aria-label="Share preview">\n                            ${iconShare()}${tip("Copy public preview link")}\n                        </button>\n                        <button type="button" class="scc-ico library-download-btn" data-project-id="${n}" aria-label="Download">\n                            ${iconDl()}${tip("Save this clip")}\n                        </button>\n                        <button type="button" class="scc-ico library-delete-btn" data-item-id="${r}" data-project-id="${n}" aria-label="Delete">\n                            ${iconTrash()}${tip("Delete")}\n                        </button>\n                    </div>\n                </div>\n                <h2 class="card-title scc-title" title="${t}">${t}</h2>\n            </div>`;
  }
  function railHTML(e) {
    const t = viralityOf(e);
    if (!t) return "";
    const n = gradeRows(t);
    const r = t.fix ? `<div class="scc-why pv-fix-tip"><p>${esc(t.fix)}</p></div>` : "";
    return `<div class="pv-card">\n            <div class="pv-head">\n                <div class="pv-score-line">\n                    <b class="pv-score-num">${esc(String(t.score100))}</b><span class="pv-score-max">/100</span> <span class="pv-res-badge">${esc(e.resolution || e.video_quality || "")}</span>\n                </div>\n                ${r}\n            </div>\n            <div class="pv-grades">${n}</div>\n        </div>`;
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
    const i = t.projectId || t.id;
    const s = e.querySelector(".scc-preview");
    const o = e.querySelector(".scc-poster");
    const c = e.querySelector(".scc-video");
    const a = e.querySelector(".scc-bar > i");
    const l = e.querySelector(".scc-t0");
    const d = e.querySelector(".scc-t1");
    let u = "";
    const showPoster = () => {
      s?.classList.add("has-poster");
      s?.classList.remove("has-video-playing");
    };
    if (o) {
      const e = posterUrl(t);
      if (e) {
        o.src = e;
        o.addEventListener("load", showPoster, {
          once: true
        });
        o.addEventListener("error", () => {
          o.removeAttribute("src");
        }, {
          once: true
        });
      }
    }
    const tick = () => {
      if (!c) return;
      const e = c.duration;
      const t = c.currentTime || 0;
      if (l) l.textContent = formatClock(t);
      if (Number.isFinite(e) && e > 0) {
        if (d) d.textContent = formatClock(e);
        if (a) a.style.width = `${Math.min(100, t / e * 100)}%`;
      }
    };
    const hasFrame = () => c && c.videoWidth > 0 && c.videoHeight > 0;
    const showFrame = () => {
      if (!hasFrame()) return;
      s?.classList.add("has-clip", "has-video-playing");
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
      if (r && r !== c) {
        try {
          r.pause();
        } catch (e) {}
      }
      r = c;
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
      const e = previewUrl(i);
      enqueueLoad(() => new Promise(t => {
        if (!c.isConnected) {
          c.dataset.srcReady = "";
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
        c.addEventListener("error", () => {
          c.dataset.srcFailed = "1";
          finish();
        }, {
          once: true
        });
        attachSrc(e);
        setTimeout(finish, 8e3);
      }));
    };
    c?.addEventListener("timeupdate", tick);
    c?.addEventListener("loadedmetadata", tick);
    c?.addEventListener("pause", () => {
      if (r === c) r = null;
    });
    if (c) {
      c.removeAttribute("src");
      c.load?.();
      c.style.display = "none";
    }
    s?.classList.remove("has-video-playing", "has-clip");
    showPoster();
    e.addEventListener("click", r => {
      const s = r.target.closest(".scc-res-pill");
      if (s) {
        r.preventDefault();
        r.stopPropagation();
        if (s.classList.contains("locked")) {
          if (typeof window.openPlanSelector === "function") window.openPlanSelector(); else if (typeof window.showUpgradeModal === "function") window.showUpgradeModal();
          return;
        }
        const e = s.closest(".scc-res-wrap");
        const n = s.dataset.res;
        e.dataset.res = n;
        e.querySelectorAll(".scc-res-pill").forEach(e => e.classList.toggle("active", e.dataset.res === n));
        t.resolution = n;
        const i = e.dataset.projectId;
        if (i) {
          fetch("/api/clips/" + encodeURIComponent(i) + "/resolution", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              resolution: n
            })
          }).catch(() => {});
        }
        return;
      }
      if (r.target.closest(".scc-res-wrap")) return;
      if (r.target.closest(".library-download-btn, .library-delete-btn, .library-share-btn, .scc-ico, .scc-delete-confirm")) return;
      if (n && n.librarySelectMode) {
        r.preventDefault();
        r.stopPropagation();
        return;
      }
      r.preventDefault();
      r.stopPropagation();
      if (c && !c.paused) try {
        c.pause();
      } catch (e) {}
      const o = t.id || i;
      if (n && typeof n.openLibraryPreview === "function" && o) {
        n.openLibraryPreview(o, i, e);
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
    bindRail: bindRail,
    formatClock: formatClock,
    viralityOf: viralityOf,
    railHTML: railHTML,
    setDuration: setDuration
  };
})();
