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
    const i = new Set([ "wait" ]);
    n._initGenStageCompanion = function _initGenStageCompanion() {
      const e = document.getElementById("solisGenCompanion");
      if (!e) return null;
      if (!this._genCompanionBound) {
        this._genCompanionBound = true;
        this._genCompanionRoot = e;
        this._genCompanionState = "sleeping";
      }
      return e;
    };
    n._clearGenCompanionTimers = function _clearGenCompanionTimers() {
      if (this._genCompanionBlinkTimer) clearTimeout(this._genCompanionBlinkTimer);
      if (this._genCompanionBlinkRestoreTimer) clearTimeout(this._genCompanionBlinkRestoreTimer);
      this._genCompanionBlinkTimer = this._genCompanionBlinkRestoreTimer = null;
    };
    n._genCompanionDelay = function _genCompanionDelay(e) {
      return new Promise(t => setTimeout(t, e));
    };
    n._setGenCompanionState = function _setGenCompanionState(e) {
      const t = this._genCompanionRoot;
      if (!t) return;
      this._genCompanionState = e;
      t.setAttribute("data-state", e);
    };
    n._scheduleGenCompanionBlink = function _scheduleGenCompanionBlink() {
      this._clearGenCompanionTimers();
      const e = this._genCompanionRoot;
      if (!e || this._genCompanionState !== "scanning" || this._genCompanionWakeLock) return;
      this._genCompanionBlinkTimer = setTimeout(() => {
        if (this._genCompanionState !== "scanning" || this._genCompanionWakeLock) return;
        e.setAttribute("data-state", "blink");
        this._genCompanionBlinkRestoreTimer = setTimeout(() => {
          if (this._genCompanionState === "scanning") {
            e.setAttribute("data-state", "scanning");
            this._scheduleGenCompanionBlink();
          }
        }, 450);
      }, 900 + Math.random() * 1800);
    };
    n._runGenCompanionWakeSequence = function _runGenCompanionWakeSequence() {
      const e = this._genCompanionRoot;
      if (!e || this._genCompanionWakeLock) return;
      this._genCompanionWakeLock = true;
      this._clearGenCompanionTimers();
      (async () => {
        e.setAttribute("data-state", "waking");
        for (let t = 0; t < 6; t++) {
          if (this._genStageOutcomeKind === "error") {
            this._genCompanionWakeLock = false;
            this._setGenCompanionState("failed");
            return;
          }
          e.setAttribute("data-state", "blink-fast");
          await this._genCompanionDelay(220);
          if (this._genStageOutcomeKind === "error") {
            this._genCompanionWakeLock = false;
            this._setGenCompanionState("failed");
            return;
          }
          if (t < 5) e.setAttribute("data-state", "waking");
          await this._genCompanionDelay(70);
        }
        e.setAttribute("data-state", "active");
        await this._genCompanionDelay(280);
        this._genCompanionWakeLock = false;
        if (this._genCompanionState === "scanning") {
          this._setGenCompanionState("scanning");
          this._scheduleGenCompanionBlink();
        }
      })();
    };
    n._resolveGenCompanionState = function _resolveGenCompanionState(e, t) {
      const n = t && t.kind;
      const s = Number(t && t.pct);
      const o = Number.isFinite(s);
      if (n === "error") return "failed";
      if (n === "complete" || o && s >= 100) return "active";
      if (i.has(e)) return "sleeping";
      return "scanning";
    };
    n._syncGenStageCompanion = function _syncGenStageCompanion(e, t) {
      const n = this._initGenStageCompanion();
      if (!n) return;
      t = t || {};
      let i;
      if (this._genStageOutcomeKind === "error") {
        i = "failed";
      } else if (this._genStageOutcomeKind === "complete") {
        i = "active";
      } else {
        i = this._resolveGenCompanionState(e, t);
      }
      const s = this._genCompanionState;
      if (i === s && !this._genCompanionWakeLock) return;
      this._clearGenCompanionTimers();
      this._genCompanionWakeLock = false;
      if (this._genStageOutcomeKind === "error") {
        this._setGenCompanionState("failed");
        return;
      }
      if (s === "sleeping" && i === "scanning") {
        this._genCompanionState = "scanning";
        this._runGenCompanionWakeSequence();
        return;
      }
      this._setGenCompanionState(i);
      if (i === "scanning") {
        this._scheduleGenCompanionBlink();
      }
    };
    n._bindGenStageChrome = function _bindGenStageChrome() {
      if (this._genStageBound) return;
      const e = document.getElementById("solisGenStage");
      if (!e) return;
      this._genStageBound = true;
      this._initGenStageCompanion();
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
      const i = !t || t.reveal !== false;
      this._syncGenStageSteps(undefined, undefined, {
        reveal: i
      });
      n.classList.remove("is-leaving");
      n.classList.add("is-open");
      n.classList.remove("is-complete", "is-error");
      n.setAttribute("aria-hidden", "false");
      const s = document.getElementById("solisGenOutcome");
      const o = document.getElementById("solisGenLiveLog");
      if (s) {
        s.hidden = true;
        s.textContent = "";
        s.classList.remove("is-complete", "is-error");
      }
      if (o) {
        o.hidden = true;
        o.textContent = "";
        o.classList.remove("is-complete", "is-error", "is-warn");
      }
      this.genStageOpen = true;
      document.body.classList.add("solis-gen-stage-active");
      this._genStageOutcomeKind = null;
      this._clearGenCompanionTimers?.();
      this._genCompanionWakeLock = false;
      this._genCompanionState = null;
      this._syncGenStageCompanion?.("install", {
        pct: 0
      });
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
        this._clearGenCompanionTimers?.();
        if (this._genCompanionRoot) {
          this._setGenCompanionState?.("sleeping");
        }
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
      const i = this.activeTemplateOptions || {};
      const s = window.clipsStudio;
      const o = s?.processingItems?.[0];
      const a = (typeof s?.resolveSourceVideoCardMeta === "function" ? s.resolveSourceVideoCardMeta() : null) || {};
      let r = String(i.videoTitle || i.title || a.title || o?.name || "").trim();
      if (!r || /^https?:\/\//i.test(r) || /^Clip\s*·\s*https?/i.test(r)) {
        r = a.title || "Your video";
      }
      r = r.replace(/^Clip\s*·\s*/i, "").replace(/^Ranking\s*·\s*/i, "");
      const l = this.activeTemplateId || "ranked_compilation";
      const c = s?.templates?.[l]?.name || (l === "splitscreen" ? "Clip" : l === "ranked_compilation" ? "Ranking" : "Clip");
      if (e) {
        e.textContent = r || "Your video";
        e.title = r || "Your video";
      }
      if (t) t.textContent = c;
      const m = String(i.thumbnailUrl || a.thumbnailUrl || "").trim();
      const g = i.videoId || a.videoId || null;
      const u = m || (g ? `https://i.ytimg.com/vi/${g}/hqdefault.jpg` : "");
      if (n) {
        if (u && /^https?:\/\//i.test(u)) {
          const e = u.replace(/"/g, "");
          const t = n.querySelector("img");
          if (!t || t.getAttribute("src") !== e) {
            n.innerHTML = `<img src="${e}" alt="" loading="lazy">`;
          }
        } else if (!n.querySelector("img")) {
          n.innerHTML = '<span class="solis-gen-thumb-fallback">CLIP</span>';
        }
      }
      const d = !r || r === "Your video" || r === "YouTube video";
      if (d && g && !this._genStageMetaFetchId) {
        this._genStageMetaFetchId = g;
        const e = window.API_BASE_URL || "/api";
        fetch(`${e}/youtube/get-metadata/${encodeURIComponent(g)}`, {
          credentials: "include",
          signal: AbortSignal.timeout(5e3)
        }).then(e => e.ok ? e.json() : null).then(e => {
          if (!e?.title) return;
          if (s) s._lastVideoTitle = e.title;
          if (e.thumbnail && s) s._lastVideoThumbnail = e.thumbnail;
          this.activeTemplateOptions = {
            ...this.activeTemplateOptions || {},
            videoTitle: e.title,
            title: e.title,
            thumbnailUrl: e.thumbnail || this.activeTemplateOptions?.thumbnailUrl || (g ? `https://i.ytimg.com/vi/${g}/hqdefault.jpg` : null),
            videoId: g
          };
          this._fillGenStageVideoMeta();
        }).catch(() => {}).finally(() => {
          if (this._genStageMetaFetchId === g) this._genStageMetaFetchId = null;
        });
      }
    };
    n._renderAffHeroTip = function _renderAffHeroTip(t) {
      const n = e[this._genTipIndex] || e[0];
      const i = document.getElementById("solisGenAffTitle");
      const s = document.getElementById("solisGenAffSub");
      const o = i?.closest(".solis-gen-aff-body") || document.querySelector("#solisGenAffHero .solis-gen-aff-body");
      const apply = () => {
        if (i) i.innerHTML = n.title;
        if (s) s.textContent = n.sub;
      };
      if (this._genStageOutcomeKind) {
        o?.classList.remove("is-tip-out");
        apply();
        return;
      }
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
        clearTimeout(a);
        finish();
      };
      o.addEventListener("transitionend", onEnd);
      const a = setTimeout(() => {
        o.removeEventListener("transitionend", onEnd);
        finish();
      }, 500);
    };
    n._syncGenStageSteps = function _syncGenStageSteps(e, t, n) {
      const i = document.getElementById("solisGenSteps");
      const s = document.getElementById("solisGenHeading");
      const o = document.getElementById("solisGenProgressLabel");
      const a = document.getElementById("solisGenLiveLog");
      const r = document.getElementById("solisGenOutcome");
      const l = document.getElementById("solisGenStage");
      if (!i || typeof this._getActiveTasks !== "function") return;
      const c = this._getActiveTasks();
      if (!c.length) return;
      let m = Number(e);
      if (!Number.isFinite(m)) {
        const e = this.activeGenerations?.values?.().next?.().value;
        m = Number(e?.progress);
      }
      if (!Number.isFinite(m)) m = 0;
      m = Math.max(0, Math.min(100, m));
      const g = String(t || firstMessage(this) || "");
      let u = 0;
      if (typeof this._resolveTaskIndex === "function") {
        u = this._resolveTaskIndex(m, g);
      } else {
        for (let e = 0; e < c.length; e++) {
          const t = e === 0 ? 0 : Number(c[e - 1]?.maxProgress) || 0;
          if (m >= t) u = e;
        }
      }
      const d = n && n.reveal;
      const p = `${c.map(e => e.id).join("|")}|${u}|${m >= 100 ? 1 : 0}`;
      const f = d || this._genStepSignature !== p || i.children.length !== c.length;
      if (f) {
        this._genStepSignature = p;
        i.innerHTML = c.map((e, t) => {
          const n = t < u || m >= 100;
          const i = !n && t === u;
          const s = n ? `<span class="solis-gen-step-ico"><svg class="solis-gen-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>` : i ? `<span class="solis-gen-step-ico"><span class="solis-gen-step-spin" aria-hidden="true"></span></span>` : `<span class="solis-gen-step-ico"></span>`;
          return `<li class="solis-gen-step${n ? " is-done" : ""}${i ? " is-active" : ""}" data-step-i="${t}">${s}<span class="solis-gen-step-label"></span></li>`;
        }).join("");
        if (d) {
          i.querySelectorAll(".solis-gen-step").forEach((e, t) => {
            e.classList.remove("is-shown");
            setTimeout(() => e.classList.add("is-shown"), 80 + t * 100);
          });
        } else {
          i.querySelectorAll(".solis-gen-step").forEach(e => e.classList.add("is-shown"));
        }
      }
      i.querySelectorAll(".solis-gen-step").forEach((e, t) => {
        const n = c[t];
        if (!n) return;
        const i = t < u || m >= 100;
        const s = !i && t === u;
        const o = e.querySelector(".solis-gen-step-label");
        if (!o) return;
        if (s && m < 100 && m > 0) {
          o.innerHTML = `${escapeHtml(n.label)}<span class="solis-gen-step-pct">...${Math.floor(m)}%</span>`;
        } else if (s) {
          o.textContent = `${n.label}...`;
        } else {
          o.textContent = n.label;
        }
        e.classList.toggle("is-done", i);
        e.classList.toggle("is-active", s);
      });
      const h = c[Math.min(u, c.length - 1)];
      if (s && !this._genStageOutcomeKind) {
        const e = m >= 100 ? "Your clips are ready" : h?.id === "moment" || h?.id === "clip" ? "Analyzing content and finding clips" : h?.label || "Analyzing content and finding clips";
        if (e !== this._lastGenHeadline) {
          s.textContent = e;
          this._lastGenHeadline = e;
        }
      }
      if (o) {
        o.textContent = m >= 100 ? "Complete" : m > 0 ? `${Math.floor(m)}%` : "Starting...";
      }
      const _ = typeof this._cleanMessage === "function" ? this._cleanMessage(g) : String(g || "").trim();
      if (a) {
        a.classList.remove("is-complete", "is-error", "is-warn");
        if (m >= 100) {
          a.hidden = true;
          a.textContent = "";
        } else {
          a.hidden = true;
          a.textContent = "";
        }
      }
      if (r && m < 100 && !this._genStageOutcomeKind) {
        r.hidden = true;
        r.textContent = "";
        r.classList.remove("is-complete", "is-error");
      }
      if (l && !this._genStageOutcomeKind) {
        l.classList.remove("is-complete", "is-error");
      }
      if (!this._genStageOutcomeKind) {
        this._syncGenStageCompanion?.(h?.id, {
          pct: m
        });
      }
    };
    n._showGenStageAlert = function _showGenStageAlert(e, t) {
      const n = document.getElementById("solisGenLiveLog");
      if (!n) return;
      const i = String(t || "").trim();
      if (!i) {
        n.hidden = true;
        n.textContent = "";
        n.classList.remove("is-error", "is-warn", "is-complete");
        return;
      }
      n.hidden = false;
      n.classList.remove("is-complete", "is-error", "is-warn");
      n.classList.add(e === "warn" ? "is-warn" : "is-error");
      n.textContent = i;
    };
    n._resetGenAffHeroBlur = function _resetGenAffHeroBlur() {
      this._affTipAnimating = false;
      const e = document.querySelector("#solisGenAffHero .solis-gen-aff-body");
      if (e) e.classList.remove("is-tip-out");
    };
    n._syncGenStageOutcome = function _syncGenStageOutcome(e, t) {
      this._genStageOutcomeKind = e === "error" ? "error" : e === "complete" ? "complete" : null;
      this._genCompanionWakeLock = false;
      this._clearGenCompanionTimers?.();
      if (e === "error" || e === "complete") {
        this._resetGenAffHeroBlur?.();
      }
      this._syncGenStageCompanion?.(null, {
        kind: e,
        pct: e === "error" ? 0 : 100
      });
      const n = document.getElementById("solisGenStage");
      const i = document.getElementById("solisGenLiveLog");
      const s = document.getElementById("solisGenOutcome");
      const o = document.getElementById("solisGenHeading");
      const a = String(t || "").trim();
      if (n) {
        n.classList.remove("is-complete", "is-error");
        if (e === "error") n.classList.add("is-error");
      }
      if (o) {
        o.textContent = e === "error" ? "Generation failed" : "Your clips are ready";
      }
      if (i) {
        if (e === "error") {
          this._showGenStageAlert("error", a || "Something went wrong — try again");
        } else {
          i.hidden = true;
          i.textContent = "";
          i.classList.remove("is-complete", "is-error", "is-warn");
        }
      }
      if (s) {
        if (e === "error") {
          s.hidden = true;
          s.textContent = "";
          s.classList.remove("is-complete", "is-error");
        } else {
          s.hidden = false;
          s.classList.remove("is-error");
          s.classList.add("is-complete");
          s.textContent = a || "Complete — your clip is ready";
        }
      }
      try {
        this._syncGenStageSteps(e === "error" ? 0 : 100, a, {
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
    const o = n.startGeneration;
    if (typeof o === "function" && !n.__solisGenStageStartWrapped) {
      n.__solisGenStageStartWrapped = true;
      n.startGeneration = function startGenerationPatched(e, t, n, i) {
        o.call(this, e, t, n, i);
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
    e.innerHTML = [ [ "Fetch video", "done" ], [ "Create project", "done" ], [ "Finding best moment", "active" ], [ "Preparing secondary panel", "" ], [ "Building split screen", "" ], [ "Exporting", "" ] ].map(([e, n], i) => {
      const s = n === "done";
      const o = n === "active";
      const a = s ? `<span class="solis-gen-step-ico">${t}</span>` : o ? '<span class="solis-gen-step-ico"><span class="solis-gen-step-spin" aria-hidden="true"></span></span>' : '<span class="solis-gen-step-ico"></span>';
      const r = o ? `${e}<span class="solis-gen-step-pct">...37%</span>` : e;
      return `<li class="solis-gen-step is-shown${s ? " is-done" : ""}${o ? " is-active" : ""}" data-step-i="${i}">${a}<span class="solis-gen-step-label">${r}</span></li>`;
    }).join("");
    const n = document.getElementById("solisGenHeading");
    const i = document.getElementById("solisGenProgressLabel");
    const s = document.getElementById("solisGenVideoTitle");
    if (n) n.textContent = "Analyzing content and finding clips";
    if (i) i.textContent = "37%";
    if (s) s.textContent = "I Ate Nothing But YouTuber Products for 7 Days";
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
    let i = 0;
    const tick = () => {
      i += 1;
      const e = n ? forceOpenDemoStage() : forceOpenDemoTasks();
      if (e) return;
      if (i < 50) setTimeout(tick, 120);
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
