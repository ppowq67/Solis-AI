(function() {
  const e = [ {
    title: "Meet Solis AI,<br>your clip co-pilot",
    sub: "We turn long videos into short-form clips with captions, modes, and polish built in."
  }, {
    title: "Named after<br>the sun",
    sub: "Solis means sun. Bright ideas, warm orange energy, and clips that feel alive."
  }, {
    title: "Beast captions<br>that actually pop",
    sub: "Komika Axis, thick stroke, soft glow. Made for that “wait, what font is that?” energy."
  }, {
    title: "AI Reframe,<br>Blur, and Focus",
    sub: "Modes keep faces framed, letterbox wide shots, or go full-focus when the moment needs it."
  }, {
    title: "Built tiny,<br>shipping fast",
    sub: "We are early and moving quick. Your generations help Solis get sharper every week."
  }, {
    title: "Fun fact",
    sub: "Solis was built by a 16-year-old from Georgia — still shipping, still iterating."
  }, {
    title: "Library is<br>home base",
    sub: "Finished clips land in Library ready to tweak, download, and post wherever you create."
  } ];
  function safeCall(e, t, n) {
    try {
      if (typeof e === "function") return e.apply(t, n || []);
    } catch (e) {}
    return undefined;
  }
  function patch() {
    const t = typeof getGenerationProgressSpinner === "function" && getGenerationProgressSpinner() || window.generationProgressSpinner || null;
    const n = t && t.constructor && t.constructor.prototype || typeof GenerationProgressSpinner !== "undefined" && GenerationProgressSpinner.prototype || null;
    if (!n) return false;
    if (n.__solisGenStagePatched) {
      t?._bindGenStageChrome?.();
      return true;
    }
    n.__solisGenStagePatched = true;
    if (typeof n._syncGenStageSteps !== "function") {
      n._syncGenStageSteps = function() {};
    }
    if (typeof n._fillGenStageVideoMeta !== "function") {
      n._fillGenStageVideoMeta = function() {};
    }
    if (typeof n._syncGenStageOutcome !== "function") {
      n._syncGenStageOutcome = function() {};
    }
    if (typeof n._showGenStageAlert !== "function") {
      n._showGenStageAlert = function() {};
    }
    n._bindGenStageChrome = function _bindGenStageChrome() {
      if (this._genStageBound) return;
      const e = document.getElementById("solisGenStage");
      if (!e) return;
      this._genStageBound = true;
      const dismiss = () => this.closeGenStage();
      document.getElementById("solisGenContinueBg")?.addEventListener("click", dismiss);
      document.getElementById("solisGenExitBtn")?.addEventListener("click", dismiss);
      const t = document.getElementById("generationTodoMoreBtn");
      if (t && !t.__solisBound) {
        t.__solisBound = true;
        t.addEventListener("click", e => {
          e.stopPropagation();
          this.closePanel?.();
          this.openGenStage({
            reveal: true
          });
        });
      }
    };
    n.openGenStage = function openGenStage(t) {
      const n = document.getElementById("solisGenStage");
      if (!n) return;
      if (this._genTipIndex == null) this._genTipIndex = 0;
      this._bindGenStageChrome();
      this._parkProfileClusterInGenStage();
      this._fillGenStageVideoMeta();
      this._renderAffHeroTip();
      const s = !t || t.reveal !== false;
      this._syncGenStageSteps(undefined, undefined, {
        reveal: s
      });
      n.classList.remove("is-leaving");
      n.classList.add("is-open");
      n.classList.remove("is-complete", "is-error");
      n.setAttribute("aria-hidden", "false");
      const i = document.getElementById("solisGenOutcome");
      const o = document.getElementById("solisGenLiveLog");
      if (i) {
        i.hidden = true;
        i.textContent = "";
        i.classList.remove("is-complete", "is-error");
      }
      if (o) {
        o.hidden = true;
        o.textContent = "";
        o.classList.remove("is-complete", "is-error", "is-warn");
      }
      this.genStageOpen = true;
      document.body.classList.add("solis-gen-stage-active");
      try {
        this.closePanel?.();
      } catch (e) {}
      if (!this._affTipTimer) {
        this._affTipTimer = setInterval(() => {
          this._genTipIndex = ((this._genTipIndex || 0) + 1) % e.length;
          this._renderAffHeroTip({
            animate: true
          });
        }, 7e3);
      }
    };
    n.closeGenStage = function closeGenStage() {
      const e = document.getElementById("solisGenStage");
      if (!e || !e.classList.contains("is-open") && !this.genStageOpen) {
        this.genStageOpen = false;
        document.body.classList.remove("solis-gen-stage-active");
        return;
      }
      if (e.classList.contains("is-leaving")) return;
      if (this._affTipTimer) {
        clearInterval(this._affTipTimer);
        this._affTipTimer = null;
      }
      e.classList.add("is-leaving");
      const finish = () => {
        e.classList.remove("is-open", "is-leaving");
        e.setAttribute("aria-hidden", "true");
        this._restoreProfileClusterFromGenStage();
        this.genStageOpen = false;
        document.body.classList.remove("solis-gen-stage-active");
      };
      const onEnd = n => {
        if (n.target !== e || n.propertyName !== "opacity") return;
        e.removeEventListener("transitionend", onEnd);
        clearTimeout(t);
        finish();
      };
      e.addEventListener("transitionend", onEnd);
      const t = setTimeout(() => {
        e.removeEventListener("transitionend", onEnd);
        finish();
      }, 420);
    };
    n._parkProfileClusterInGenStage = function _parkProfileClusterInGenStage() {
      const e = document.getElementById("profileActionCluster");
      const t = document.getElementById("solisGenAccountHost");
      if (!e || !t) return;
      if (!this._clusterHome) {
        this._clusterHome = {
          parent: e.parentElement,
          next: e.nextSibling
        };
      }
      if (e.parentElement !== t) {
        t.appendChild(e);
        document.getElementById("notificationsDropdown")?.classList.remove("open");
        document.getElementById("profileDropdown")?.classList.remove("open");
      }
    };
    n._restoreProfileClusterFromGenStage = function _restoreProfileClusterFromGenStage() {
      const e = document.getElementById("profileActionCluster");
      const t = this._clusterHome;
      if (!e || !t?.parent) {
        this._clusterHome = null;
        return;
      }
      if (t.next && t.next.parentElement === t.parent) {
        t.parent.insertBefore(e, t.next);
      } else {
        t.parent.appendChild(e);
      }
      this._clusterHome = null;
      document.getElementById("notificationsDropdown")?.classList.remove("open");
      document.getElementById("profileDropdown")?.classList.remove("open");
    };
    n._fillGenStageVideoMeta = function _fillGenStageVideoMeta() {
      const e = document.getElementById("solisGenVideoTitle");
      const t = document.getElementById("solisGenTemplateBadge");
      const n = document.getElementById("solisGenThumb");
      const s = this.activeTemplateOptions || {};
      const i = window.clipsStudio;
      const o = i?.processingItems?.[0];
      const r = (typeof i?.resolveSourceVideoCardMeta === "function" ? i.resolveSourceVideoCardMeta() : null) || {};
      let a = String(s.videoTitle || s.title || r.title || o?.name || "").trim();
      if (!a || /^https?:\/\//i.test(a) || /^Clip\s*·\s*https?/i.test(a)) {
        a = r.title || "Your video";
      }
      a = a.replace(/^Clip\s*·\s*/i, "").replace(/^Ranking\s*·\s*/i, "");
      const l = this.activeTemplateId || "ranked_compilation";
      const c = i?.templates?.[l]?.name || (l === "splitscreen" ? "Clip" : l === "ranked_compilation" ? "Ranking" : "Clip");
      if (e) {
        e.textContent = a || "Your video";
        e.title = a || "Your video";
      }
      if (t) t.textContent = c;
      const d = String(s.thumbnailUrl || r.thumbnailUrl || "").trim();
      const u = s.videoId || r.videoId || null;
      const g = d || (u ? `https://i.ytimg.com/vi/${u}/hqdefault.jpg` : "");
      if (n) {
        if (g && /^https?:\/\//i.test(g)) {
          const e = g.replace(/"/g, "");
          const t = n.querySelector("img");
          if (!t || t.getAttribute("src") !== e) {
            n.innerHTML = `<img src="${e}" alt="" loading="lazy">`;
          }
        } else if (!n.querySelector("img")) {
          n.innerHTML = '<span class="solis-gen-thumb-fallback">CLIP</span>';
        }
      }
      const p = !a || a === "Your video" || a === "YouTube video";
      if (p && u && !this._genStageMetaFetchId) {
        this._genStageMetaFetchId = u;
        const e = window.API_BASE_URL || "/api";
        fetch(`${e}/youtube/get-metadata/${encodeURIComponent(u)}`, {
          credentials: "include",
          signal: AbortSignal.timeout(5e3)
        }).then(e => e.ok ? e.json() : null).then(e => {
          if (!e?.title) return;
          if (i) i._lastVideoTitle = e.title;
          if (e.thumbnail && i) i._lastVideoThumbnail = e.thumbnail;
          this.activeTemplateOptions = {
            ...this.activeTemplateOptions || {},
            videoTitle: e.title,
            title: e.title,
            thumbnailUrl: e.thumbnail || this.activeTemplateOptions?.thumbnailUrl || (u ? `https://i.ytimg.com/vi/${u}/hqdefault.jpg` : null),
            videoId: u
          };
          this._fillGenStageVideoMeta();
        }).catch(() => {}).finally(() => {
          if (this._genStageMetaFetchId === u) this._genStageMetaFetchId = null;
        });
      }
    };
    n._renderAffHeroTip = function _renderAffHeroTip(t) {
      const n = e[this._genTipIndex] || e[0];
      const s = document.getElementById("solisGenAffTitle");
      const i = document.getElementById("solisGenAffSub");
      const o = s?.closest(".solis-gen-aff-body") || document.querySelector("#solisGenAffHero .solis-gen-aff-body");
      const apply = () => {
        if (s) s.innerHTML = n.title;
        if (i) i.textContent = n.sub;
      };
      if (!t?.animate || !o) {
        o?.classList.remove("is-tip-out");
        apply();
        return;
      }
      if (this._affTipAnimating) return;
      this._affTipAnimating = true;
      o.classList.add("is-tip-out");
      const finish = () => {
        apply();
        requestAnimationFrame(() => {
          o.classList.remove("is-tip-out");
          this._affTipAnimating = false;
        });
      };
      const onEnd = e => {
        if (e.target !== o || e.propertyName !== "filter") return;
        o.removeEventListener("transitionend", onEnd);
        clearTimeout(r);
        finish();
      };
      o.addEventListener("transitionend", onEnd);
      const r = setTimeout(() => {
        o.removeEventListener("transitionend", onEnd);
        finish();
      }, 500);
    };
    n._syncGenStageSteps = function _syncGenStageSteps(e, t, n) {
      const s = document.getElementById("solisGenSteps");
      const i = document.getElementById("solisGenHeading");
      const o = document.getElementById("solisGenProgressLabel");
      const r = document.getElementById("solisGenLiveLog");
      const a = document.getElementById("solisGenOutcome");
      const l = document.getElementById("solisGenStage");
      if (!s || typeof this._getActiveTasks !== "function") return;
      const c = this._getActiveTasks();
      if (!c.length) return;
      let d = Number(e);
      if (!Number.isFinite(d)) {
        const e = this.activeGenerations?.values?.().next?.().value;
        d = Number(e?.progress);
      }
      if (!Number.isFinite(d)) d = 0;
      d = Math.max(0, Math.min(100, d));
      const u = String(t || firstMessage(this) || "");
      let g = 0;
      if (typeof this._resolveTaskIndex === "function") {
        g = this._resolveTaskIndex(d, u);
      } else {
        for (let e = 0; e < c.length; e++) {
          const t = e === 0 ? 0 : Number(c[e - 1]?.maxProgress) || 0;
          if (d >= t) g = e;
        }
      }
      const p = n && n.reveal;
      const m = `${c.map(e => e.id).join("|")}|${g}|${d >= 100 ? 1 : 0}`;
      const f = p || this._genStepSignature !== m || s.children.length !== c.length;
      if (f) {
        this._genStepSignature = m;
        s.innerHTML = c.map((e, t) => {
          const n = t < g || d >= 100;
          const s = !n && t === g;
          const i = n ? `<span class="solis-gen-step-ico"><svg class="solis-gen-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>` : s ? `<span class="solis-gen-step-ico"><span class="solis-gen-step-spin" aria-hidden="true"></span></span>` : `<span class="solis-gen-step-ico"></span>`;
          return `<li class="solis-gen-step${n ? " is-done" : ""}${s ? " is-active" : ""}" data-step-i="${t}">${i}<span class="solis-gen-step-label"></span></li>`;
        }).join("");
        if (p) {
          s.querySelectorAll(".solis-gen-step").forEach((e, t) => {
            e.classList.remove("is-shown");
            setTimeout(() => e.classList.add("is-shown"), 80 + t * 100);
          });
        } else {
          s.querySelectorAll(".solis-gen-step").forEach(e => e.classList.add("is-shown"));
        }
      }
      s.querySelectorAll(".solis-gen-step").forEach((e, t) => {
        const n = c[t];
        if (!n) return;
        const s = t < g || d >= 100;
        const i = !s && t === g;
        const o = e.querySelector(".solis-gen-step-label");
        if (!o) return;
        if (i && d < 100 && d > 0) {
          o.innerHTML = `${escapeHtml(n.label)}<span class="solis-gen-step-pct">...${Math.floor(d)}%</span>`;
        } else if (i) {
          o.textContent = `${n.label}...`;
        } else {
          o.textContent = n.label;
        }
        e.classList.toggle("is-done", s);
        e.classList.toggle("is-active", i);
      });
      const h = c[Math.min(g, c.length - 1)];
      const y = d >= 100 ? "Your clips are ready" : h?.id === "moment" || h?.id === "clip" ? "Analyzing content and finding clips" : h?.label || "Analyzing content and finding clips";
      if (i && y !== this._lastGenHeadline) {
        i.textContent = y;
        this._lastGenHeadline = y;
      }
      if (o) {
        o.textContent = d >= 100 ? "Complete" : d > 0 ? `${Math.floor(d)}%` : "Starting...";
      }
      const S = typeof this._cleanMessage === "function" ? this._cleanMessage(u) : String(u || "").trim();
      if (r) {
        r.classList.remove("is-complete", "is-error", "is-warn");
        if (d >= 100) {
          r.hidden = true;
          r.textContent = "";
        } else {
          r.hidden = true;
          r.textContent = "";
        }
      }
      if (a && d < 100) {
        a.hidden = true;
        a.textContent = "";
        a.classList.remove("is-complete", "is-error");
      }
      if (l) {
        l.classList.remove("is-complete", "is-error");
      }
    };
    n._showGenStageAlert = function _showGenStageAlert(e, t) {
      const n = document.getElementById("solisGenLiveLog");
      if (!n) return;
      const s = String(t || "").trim();
      if (!s) {
        n.hidden = true;
        n.textContent = "";
        n.classList.remove("is-error", "is-warn", "is-complete");
        return;
      }
      n.hidden = false;
      n.classList.remove("is-complete", "is-error", "is-warn");
      n.classList.add(e === "warn" ? "is-warn" : "is-error");
      n.textContent = s;
    };
    n._syncGenStageOutcome = function _syncGenStageOutcome(e, t) {
      const n = document.getElementById("solisGenStage");
      const s = document.getElementById("solisGenLiveLog");
      const i = document.getElementById("solisGenOutcome");
      const o = document.getElementById("solisGenHeading");
      const r = String(t || "").trim();
      if (n) {
        n.classList.remove("is-complete", "is-error");
        if (e === "error") n.classList.add("is-error");
      }
      if (o) {
        o.textContent = e === "error" ? "Generation failed" : "Your clips are ready";
      }
      if (s) {
        if (e === "error") {
          this._showGenStageAlert("error", r || "Something went wrong — try again");
        } else {
          s.hidden = true;
          s.textContent = "";
          s.classList.remove("is-complete", "is-error", "is-warn");
        }
      }
      if (i) {
        if (e === "error") {
          i.hidden = true;
          i.textContent = "";
          i.classList.remove("is-complete", "is-error");
        } else {
          i.hidden = false;
          i.classList.remove("is-error");
          i.classList.add("is-complete");
          i.textContent = r || "Complete — your clip is ready";
        }
      }
      try {
        this._syncGenStageSteps(e === "error" ? 0 : 100, r, {
          reveal: false
        });
      } catch (e) {}
    };
    function firstMessage(e) {
      try {
        const t = e.activeGenerations?.values?.().next?.().value;
        return t?.message || "";
      } catch (e) {
        return "";
      }
    }
    function escapeHtml(e) {
      return String(e || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    const s = n.beginOptimisticGeneration;
    if (typeof s === "function" && !n.__solisGenStageBeginWrapped) {
      n.__solisGenStageBeginWrapped = true;
      n.beginOptimisticGeneration = function beginOptimisticGenerationPatched(e, t, n) {
        s.call(this, e, t, n);
        requestAnimationFrame(() => {
          safeCall(this.openGenStage, this, [ {
            reveal: true
          } ]);
        });
      };
    }
    const i = n.startGeneration;
    if (typeof i === "function" && !n.__solisGenStageStartWrapped) {
      n.__solisGenStageStartWrapped = true;
      n.startGeneration = function startGenerationPatched(e, t, n, s) {
        i.call(this, e, t, n, s);
        if (!this.genStageOpen) {
          requestAnimationFrame(() => safeCall(this.openGenStage, this, [ {
            reveal: false
          } ]));
        }
      };
    }
    return true;
  }
  function fillDemoSteps() {
    const e = document.getElementById("solisGenSteps");
    if (!e) return;
    const t = '<svg class="solis-gen-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    e.innerHTML = [ [ "Fetch video", "done" ], [ "Create project", "done" ], [ "Finding best moment", "active" ], [ "Preparing secondary panel", "" ], [ "Building split screen", "" ], [ "Exporting", "" ] ].map(([e, n], s) => {
      const i = n === "done";
      const o = n === "active";
      const r = i ? `<span class="solis-gen-step-ico">${t}</span>` : o ? '<span class="solis-gen-step-ico"><span class="solis-gen-step-spin" aria-hidden="true"></span></span>' : '<span class="solis-gen-step-ico"></span>';
      const a = o ? `${e}<span class="solis-gen-step-pct">...37%</span>` : e;
      return `<li class="solis-gen-step is-shown${i ? " is-done" : ""}${o ? " is-active" : ""}" data-step-i="${s}">${r}<span class="solis-gen-step-label">${a}</span></li>`;
    }).join("");
    const n = document.getElementById("solisGenHeading");
    const s = document.getElementById("solisGenProgressLabel");
    const i = document.getElementById("solisGenVideoTitle");
    if (n) n.textContent = "Analyzing content and finding clips";
    if (s) s.textContent = "37%";
    if (i) i.textContent = "I Ate Nothing But YouTuber Products for 7 Days";
    const o = document.getElementById("solisGenThumb");
    if (o) {
      o.innerHTML = '<img src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" alt="" loading="lazy">';
    }
  }
  function forceOpenDemoStage() {
    const e = document.getElementById("solisGenStage");
    if (!e) return false;
    fillDemoSteps();
    const t = typeof getGenerationProgressSpinner === "function" && getGenerationProgressSpinner() || window.generationProgressSpinner || null;
    if (t && typeof t.openGenStage === "function") {
      try {
        t.activeTemplateId = "splitscreen";
        t.activeTemplateOptions = {
          videoTitle: "I Ate Nothing But YouTuber Products for 7 Days",
          title: "I Ate Nothing But YouTuber Products for 7 Days",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          videoId: "dQw4w9WgXcQ"
        };
        t.openGenStage({
          reveal: true
        });
        t.displayProgress?.(37, "Finding best moment...");
        return true;
      } catch (e) {}
    }
    e.classList.remove("is-leaving");
    e.classList.add("is-open");
    e.setAttribute("aria-hidden", "false");
    document.body.classList.add("solis-gen-stage-active");
    try {
      const e = document.getElementById("profileActionCluster");
      const t = document.getElementById("solisGenAccountHost");
      if (e && t && e.parentElement !== t) t.appendChild(e);
    } catch (e) {}
    document.getElementById("solisGenExitBtn")?.addEventListener("click", () => {
      e.classList.add("is-leaving");
      setTimeout(() => {
        e.classList.remove("is-open", "is-leaving");
        e.setAttribute("aria-hidden", "true");
        document.body.classList.remove("solis-gen-stage-active");
      }, 380);
    }, {
      once: true
    });
    document.getElementById("solisGenContinueBg")?.addEventListener("click", () => {
      document.getElementById("solisGenExitBtn")?.click();
    }, {
      once: true
    });
    return true;
  }
  function forceOpenDemoTasks() {
    const e = typeof getGenerationProgressSpinner === "function" && getGenerationProgressSpinner() || window.generationProgressSpinner || null;
    const t = document.getElementById("generationProgressWrapper");
    if (!t) return false;
    try {
      e?.closeGenStage?.();
    } catch (e) {}
    if (e) {
      try {
        e.activeTemplateId = "splitscreen";
        e.activeTemplateOptions = {
          videoTitle: "I Ate Nothing But YouTuber Products for 7 Days",
          title: "I Ate Nothing But YouTuber Products for 7 Days",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          videoId: "dQw4w9WgXcQ"
        };
        e.optimisticPending = true;
        e.tasksIntroPlayed = false;
        e._ensureDomRefs?.();
        e._ensureTaskList?.();
        if (e.wrapper) e.wrapper.style.display = "flex";
        e.displayProgress?.(37, "Finding best moment...");
        e.openPanel?.();
        e._bindGenStageChrome?.();
        return true;
      } catch (e) {}
    }
    t.style.display = "flex";
    const n = document.getElementById("generationTodoPanel");
    n?.classList.add("is-open");
    return Boolean(n);
  }
  function maybeRunDashboardDemo() {
    const e = String(location.search || "");
    const t = /[?&]solisTasksDemo=1(?:&|$)/.test(e) || /[?&]solisGenDemo=1(?:&|$)/.test(e);
    const n = /[?&]solisGenStageDemo=1(?:&|$)/.test(e);
    if (!t && !n) return;
    let s = 0;
    const tick = () => {
      s += 1;
      const e = n ? forceOpenDemoStage() : forceOpenDemoTasks();
      if (e) return;
      if (s < 50) setTimeout(tick, 120);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(tick, 80));
    } else {
      setTimeout(tick, 80);
    }
    setTimeout(() => {
      if (n) forceOpenDemoStage(); else forceOpenDemoTasks();
    }, 1600);
  }
  function boot() {
    const e = patch();
    try {
      const e = typeof getGenerationProgressSpinner === "function" ? getGenerationProgressSpinner() : window.generationProgressSpinner;
      if (e) {
        if (e.genStageOpen == null) e.genStageOpen = false;
        e._bindGenStageChrome?.();
      }
    } catch (e) {}
    return e;
  }
  if (!boot()) {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
      setTimeout(boot, 400);
    });
  } else {
    setTimeout(boot, 200);
  }
  maybeRunDashboardDemo();
})();
