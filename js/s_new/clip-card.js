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
  const r = {
    S: {
      label: "Must-post. Exceptional."
    },
    A: {
      label: "Excellent. Post this."
    },
    B: {
      label: "Good. Worth testing."
    },
    C: {
      label: "Average. Filler."
    },
    D: {
      label: "Skip it."
    }
  };
  function dimOf(e, t, n) {
    const i = e && e[t] || {};
    const r = Number(i.n);
    const s = Number(i.max) || n || 25;
    const a = i.available !== false && Number.isFinite(r) && r > 0;
    return {
      n: a ? r : 0,
      max: s,
      bar: a ? Math.max(0, Math.min(1, Number(i.bar) || r / s)) : 0,
      note: String(i.note || "").trim(),
      available: a
    };
  }
  function viralityOf(e) {
    const t = e && e.virality;
    if (!t || typeof t !== "object" || t.available === false) return null;
    const n = String(t.tier || "").toUpperCase();
    if (!r[n]) return null;
    const i = Array.isArray(t.clips) ? t.clips : [];
    const s = t.lone_clip === true || i.length <= 1;
    if ((n === "C" || n === "D") && !s) return null;
    const a = t.tag && typeof t.tag === "object" ? t.tag : null;
    const c = a ? Number(a.confidence) : 0;
    return {
      tier: n,
      score: Math.round(Number(t.score) || 0),
      scoreMax: Number(t.score_max) || 110,
      label: String(t.label || r[n].label),
      meaning: String(t.meaning || ""),
      why: String(t.why || "").trim(),
      fix: String(t.fix || "").trim(),
      tag: a && a.label && c >= .8 ? {
        label: String(a.label),
        confidence: c
      } : null,
      hook: dimOf(t, "hook", 25),
      takeaway: dimOf(t, "takeaway", 25),
      emotion: dimOf(t, "emotion", 25),
      flow: dimOf(t, "flow", 25),
      share: dimOf(t, "share", 10)
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
  function dimGrade(e, t) {
    const n = t > 0 ? Number(e) / t : 0;
    if (n <= 0) return "";
    if (n >= .91) return "S";
    if (n >= .73) return "A";
    if (n >= .59) return "B";
    if (n >= .45) return "C";
    return "D";
  }
  function gradeRows(e) {
    return [ [ "hook", "Hook" ], [ "takeaway", "Takeaway" ], [ "emotion", "Emotion" ], [ "flow", "Flow" ], [ "share", "Share" ] ].map(([t, n]) => {
      const i = e[t] || {};
      if (!(i.n > 0)) return "";
      const r = dimGrade(i.n, i.max);
      if (!r) return "";
      const s = i.note || "";
      const a = s ? `<div class="scc-why"><strong class="pv-g-${esc(r)}">${esc(r)} ${esc(n)}</strong><p>${esc(s)}</p></div>` : "";
      return `<div class="pv-grade" tabindex="0">\n                <b class="pv-g-${esc(r)}">${esc(r)}</b><span>${esc(n)}</span>\n                ${a}\n            </div>`;
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
    const i = esc(e.projectId || e.id || "");
    const r = formatClock(e.duration);
    const s = t ? `<div class="scc-viral scc-tier-${esc(t.tier)}" tabindex="0">\n                    <span class="scc-viral-n">${esc(t.tier)}</span>\n                    ${tip(`${t.tier} tier · ${t.label}`)}\n               </div>` : `<div class="scc-viral scc-viral-empty"></div>`;
    return `\n            <div class="scc-preview">\n                <div class="scc-skel" aria-hidden="true"></div>\n                <video class="scc-video" muted playsinline loop preload="auto" controlslist="nodownload nofullscreen noremoteplayback" disablepictureinpicture></video>\n                <div class="scc-time"><span class="scc-t0">00:00</span> <span class="scc-t1">${esc(r)}</span></div>\n                <div class="scc-bar"><i></i></div>\n            </div>\n            <div class="scc-meta">\n                <div class="scc-meta-row">\n                    ${s}\n                    <div class="scc-actions">\n                        <button type="button" class="scc-ico library-download-btn" data-project-id="${i}" aria-label="Download">\n                            ${iconDl()}${tip("Save this clip")}\n                        </button>\n                        <button type="button" class="scc-ico library-delete-btn" aria-label="Delete">\n                            ${iconTrash()}${tip("Delete this clip")}\n                        </button>\n                    </div>\n                </div>\n                <h2 class="card-title scc-title" title="${n}">${n}</h2>\n            </div>`;
  }
  function railHTML(e) {
    const t = viralityOf(e);
    if (!t) return "";
    const n = gradeRows(t);
    const i = t.why ? `<div class="pv-foot pv-why"><p>${esc(t.why)}</p></div>` : "";
    const r = t.tag ? `<div class="pv-foot pv-tag">${esc(t.tag.label)} ✓</div>` : "";
    const s = t.fix ? `<div class="pv-foot pv-fix">${esc(t.fix)}</div>` : "";
    return `<div class="pv-card pv-tier-${esc(t.tier)}">\n            <div class="pv-head"><b>${esc(t.tier)}</b></div>\n            <p class="pv-label">${esc(t.label)}</p>\n            <div class="pv-grades">${n}</div>\n            ${i}${r}${s}\n        </div>`;
  }
  function bind(e, t, n) {
    if (!e || e.dataset.sccBound === "1") return;
    e.dataset.sccBound = "1";
    const r = t.projectId || t.id;
    const s = e.querySelector(".scc-preview");
    const a = e.querySelector(".scc-video");
    const c = e.querySelector(".scc-bar > i");
    const o = e.querySelector(".scc-t0");
    const l = e.querySelector(".scc-t1");
    let d = "";
    const tick = () => {
      if (!a) return;
      const e = a.duration;
      const t = a.currentTime || 0;
      if (o) o.textContent = formatClock(t);
      if (Number.isFinite(e) && e > 0) {
        if (l) l.textContent = formatClock(e);
        if (c) c.style.width = `${Math.min(100, t / e * 100)}%`;
      }
    };
    const hasFrame = () => a && a.videoWidth > 0 && a.videoHeight > 0;
    const showFrame = () => {
      if (!hasFrame()) return;
      s?.classList.add("has-clip");
      tick();
    };
    const paintStill = () => {
      if (!a) return;
      const e = a.currentTime > .05 ? a.currentTime : .08;
      const afterSeek = () => {
        showFrame();
        if (!s?.matches(":hover")) {
          try {
            a.pause();
          } catch (e) {}
        }
      };
      try {
        a.currentTime = e;
      } catch (e) {}
      a.addEventListener("seeked", afterSeek, {
        once: true
      });
      a.play().then(() => {
        showFrame();
        if (!s?.matches(":hover")) {
          a.pause();
          showFrame();
        }
      }).catch(() => showFrame());
    };
    const playClip = () => {
      if (!a) return;
      a.muted = true;
      if (i && i !== a) {
        try {
          i.pause();
        } catch (e) {}
      }
      i = a;
      a.play().then(showFrame).catch(() => {});
    };
    const attachSrc = e => {
      a.muted = true;
      a.playsInline = true;
      a.setAttribute("playsinline", "");
      a.preload = "auto";
      a.src = e;
      try {
        a.load();
      } catch (e) {}
    };
    const bindReady = e => {
      a.addEventListener("loadeddata", e);
      a.addEventListener("canplay", e);
      a.addEventListener("loadedmetadata", e);
    };
    const ensureSrc = () => {
      if (!a || a.dataset.srcReady === "1") return;
      a.dataset.srcReady = "1";
      const e = previewUrl(r);
      enqueueLoad(() => new Promise(t => {
        if (!a.isConnected) {
          a.dataset.srcReady = "";
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
        a.addEventListener("error", () => {
          const t = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
          const tryBlob = n => {
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
              if (n < 4) setTimeout(() => tryBlob(n + 1), 1600 * (n + 1)); else finish();
            });
          };
          tryBlob(0);
        }, {
          once: true
        });
        attachSrc(e);
        setTimeout(finish, 1e4);
      }));
    };
    a?.addEventListener("timeupdate", tick);
    a?.addEventListener("loadedmetadata", tick);
    a?.addEventListener("pause", () => {
      if (i === a) i = null;
    });
    if (a && "IntersectionObserver" in window) {
      const t = new IntersectionObserver(e => {
        const t = e.some(e => e.isIntersecting);
        if (t) ensureSrc(); else if (a && !a.paused) {
          a.pause();
          if (i === a) i = null;
        }
      }, {
        rootMargin: "120px",
        threshold: .2
      });
      t.observe(e);
    } else {
      ensureSrc();
    }
    s?.addEventListener("mouseenter", () => {
      ensureSrc();
      if (a && a.paused) playClip();
    });
    s?.addEventListener("mouseleave", () => {
      if (a) {
        a.pause();
        showFrame();
      }
    });
    e.addEventListener("click", i => {
      if (i.target.closest(".library-download-btn, .library-delete-btn, .scc-ico, .scc-viral")) return;
      i.preventDefault();
      i.stopPropagation();
      if (a && !a.paused) try {
        a.pause();
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
    formatClock: formatClock,
    viralityOf: viralityOf,
    railHTML: railHTML,
    setDuration: setDuration
  };
})();
