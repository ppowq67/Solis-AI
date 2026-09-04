(function() {
  const e = [ {
    title: "Made for<br>short-form",
    sub: "Long videos in. Tight clips out, with captions and polish already on."
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
        e.classList.add("is-blinking");
        this._genCompanionBlinkRestoreTimer = setTimeout(() => {
          e.classList.remove("is-blinking");
          if (this._genCompanionState === "scanning") {
            this._scheduleGenCompanionBlink();
          }
        }, 340);
      }, 1600 + Math.random() * 1800);
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
      const n = document.getElementById("solisGenActivitySummary");
      const i = document.getElementById("solisGenActivity");
      if (n && i && !n.__solisBound) {
        n.__solisBound = true;
        n.addEventListener("click", () => {
          const e = i.classList.contains("is-open");
          const t = !e;
          i.classList.toggle("is-open", t);
          n.classList.toggle("is-expanded", t);
          n.setAttribute("aria-expanded", t ? "true" : "false");
          if (t) {
            const e = document.getElementById("solisGenSteps");
            e?.querySelectorAll(".solis-gen-step").forEach((e, t) => {
              e.classList.remove("is-shown");
              requestAnimationFrame(() => {
                setTimeout(() => e.classList.add("is-shown"), 40 + t * 55);
              });
            });
          }
        });
      }
    };
    n._stepCheckSvg = function _stepCheckSvg() {
      return '<svg class="solis-gen-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    };
    n._stepSpinSvg = function _stepSpinSvg() {
      return '<svg class="solis-gen-step-spin" viewBox="0 0 24 24" aria-hidden="true">' + '<circle class="solis-gen-step-spin-track" cx="12" cy="12" r="9"></circle>' + '<circle class="solis-gen-step-spin-arc" cx="12" cy="12" r="9" transform="rotate(-90 12 12)"></circle>' + "</svg>";
    };
    n._stepIcoHtml = function _stepIcoHtml() {
      return `<span class="solis-gen-step-ico">${this._stepSpinSvg()}${this._stepCheckSvg()}</span>`;
    };
    n._setActivitySummary = function _setActivitySummary(e, t) {
      const n = document.getElementById("solisGenActivityText");
      const i = document.getElementById("solisGenActivityCount");
      if (i) {
        if (t) {
          i.hidden = false;
          i.textContent = t;
        } else {
          i.hidden = true;
          i.textContent = "";
        }
      }
      if (!n) return;
      const s = String(e || "").trim() || "Getting started";
      if (n.textContent === s) return;
      if (!n.textContent || n.textContent === "Getting started") {
        n.textContent = s;
        return;
      }
      n.classList.add("is-swap");
      const apply = () => {
        n.textContent = s;
        requestAnimationFrame(() => n.classList.remove("is-swap"));
      };
      const onEnd = e => {
        if (e.target !== n || e.propertyName !== "opacity") return;
        n.removeEventListener("transitionend", onEnd);
        clearTimeout(o);
        apply();
      };
      n.addEventListener("transitionend", onEnd);
      const o = setTimeout(() => {
        n.removeEventListener("transitionend", onEnd);
        apply();
      }, 320);
    };
    n._paintStepState = function _paintStepState(e, {done: t, active: n}) {
      if (!e) return;
      e.classList.toggle("is-done", !!t);
      e.classList.toggle("is-active", !!n);
      e.classList.toggle("is-pending", !t && !n);
      e.classList.remove("is-just-done");
    };
    n._thinkWordEl = function _thinkWordEl() {
      let e = document.getElementById("solisGenThinkWord");
      const t = document.getElementById("solisGenHeading");
      if (!e && t) {
        t.innerHTML = '<span class="solis-gen-think-word" id="solisGenThinkWord"></span>';
        e = document.getElementById("solisGenThinkWord");
      }
      return e;
    };
    n._setThinkWord = function _setThinkWord(e) {
      const t = this._thinkWordEl();
      if (!t) return;
      const n = String(e || "");
      t.textContent = n;
      t.classList.toggle("is-thinking", n === "Thinking");
    };
    n._thinkBeatsFor = function _thinkBeatsFor(e, t, n) {
      const i = String(e || "");
      const s = String(t || "").toLowerCase();
      const o = Number.isFinite(Number(n)) ? Number(n) : 0;
      const r = /think|analy|scout|gemini|telescope|understand|reason|model|prompt|llm|brain|consider/.test(s);
      const a = /watch|fetch|download|pull|ingest|source|stream|yt-?dl|proxy|buffer|install/.test(s);
      const l = /find|moment|clip|rank|score|viral|highlight|best|select|pick|segment/.test(s);
      const c = /caption|overlay|title|subtitle|hook|text|write|script/.test(s);
      const d = /frame|panel|secondary|b-?roll|layout|split/.test(s);
      const u = /compose|compile|render|build|assemble|stitch|encode/.test(s);
      const g = /export|upload|finish|final|package|download clip|ready/.test(s);
      const m = /queue|wait|pending|start/.test(s);
      if (g && (i === "export" || i === "download" || o >= 88)) return [ "Finishing" ];
      if (c && (i === "overlay" || /caption|overlay|hook/.test(s))) return [ "Writing" ];
      if (d && (i === "secondary" || /panel|secondary|split/.test(s))) return [ "Framing" ];
      if (u && (i === "compose" || i === "compile" || /render|compose|encode/.test(s))) {
        return r ? [ "Thinking", "Building" ] : [ "Building" ];
      }
      if (i === "wait" || m && o < 4 && !a && !r) return [ "Waiting" ];
      if (i === "install" || a && !l && o < 28) {
        if (r) return [ "Watching", "Thinking" ];
        return [ "Watching" ];
      }
      if (i === "clip" || i === "moment" || l) {
        if (r && !l) return [ "Thinking" ];
        if (o < 22 || r && o < 40) return [ "Thinking", "Finding" ];
        if (r) return [ "Finding", "Thinking" ];
        return [ "Finding" ];
      }
      if (i === "overlay") return r ? [ "Thinking", "Writing" ] : [ "Writing" ];
      if (i === "secondary") return r ? [ "Thinking", "Framing" ] : [ "Framing" ];
      if (i === "compose" || i === "compile") return r ? [ "Thinking", "Building" ] : [ "Building" ];
      if (i === "export" || i === "download") return [ "Finishing" ];
      if (i === "apply") return [ "Applying" ];
      if (o < 18) return [ "Watching" ];
      if (o < 55) return l ? [ "Thinking", "Finding" ] : [ "Thinking" ];
      if (o < 85) return [ "Building" ];
      return [ "Finishing" ];
    };
    n._thinkHoldMs = function _thinkHoldMs(e, t) {
      if (!t || t.length < 2) return 0;
      if (e === "Thinking") return 1600;
      if (e === "Watching") return 1400;
      if (e === "Finding") return 1500;
      return 1300;
    };
    n._clearThinkWordTimers = function _clearThinkWordTimers() {
      if (this._thinkWordHold) clearTimeout(this._thinkWordHold);
      if (this._thinkWordFallback) clearTimeout(this._thinkWordFallback);
      this._thinkWordHold = this._thinkWordFallback = null;
      if (this._thinkWordOnEnd && this._thinkWordElNode) {
        this._thinkWordElNode.removeEventListener("transitionend", this._thinkWordOnEnd);
      }
      this._thinkWordOnEnd = null;
      this._thinkWordElNode = null;
    };
    n._transitionToThinkWord = function _transitionToThinkWord(e, t) {
      const n = this._thinkWordEl();
      const i = String(e || "");
      if (!n) {
        if (typeof t === "function") t();
        return;
      }
      if (n.textContent === i && !n.classList.contains("is-out")) {
        if (typeof t === "function") t();
        return;
      }
      if (this._thinkWordHold) clearTimeout(this._thinkWordHold);
      this._thinkWordHold = null;
      if (this._thinkWordOnEnd && this._thinkWordElNode) {
        this._thinkWordElNode.removeEventListener("transitionend", this._thinkWordOnEnd);
      }
      if (this._thinkWordFallback) clearTimeout(this._thinkWordFallback);
      this._thinkWordFallback = null;
      this._thinkWordElNode = n;
      n.classList.add("is-out");
      let s = false;
      const finish = () => {
        if (s) return;
        s = true;
        if (this._thinkWordOnEnd) {
          n.removeEventListener("transitionend", this._thinkWordOnEnd);
          this._thinkWordOnEnd = null;
        }
        clearTimeout(this._thinkWordFallback);
        this._thinkWordFallback = null;
        this._setThinkWord(i);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            n.classList.remove("is-out");
            if (typeof t === "function") t();
          });
        });
      };
      const onEnd = e => {
        if (e.target !== n) return;
        if (e.propertyName !== "opacity" && e.propertyName !== "filter") return;
        finish();
      };
      this._thinkWordOnEnd = onEnd;
      n.addEventListener("transitionend", onEnd);
      this._thinkWordFallback = setTimeout(finish, 340);
    };
    n._stopThinkWordCycle = function _stopThinkWordCycle(e) {
      this._clearThinkWordTimers();
      this._thinkWordRunning = false;
      this._thinkWordSig = null;
      const t = this._thinkWordEl();
      if (!t) return;
      if (e) {
        this._transitionToThinkWord(e);
      } else {
        t.classList.remove("is-out");
      }
    };
    n._scheduleThinkAdvance = function _scheduleThinkAdvance(e) {
      const t = this._thinkWordBeats || [];
      const n = this._thinkHoldMs(e, t);
      if (n <= 0 || !this._thinkWordRunning) return;
      if (this._thinkWordHold) clearTimeout(this._thinkWordHold);
      this._thinkWordHold = setTimeout(() => this._advanceThinkWord(), n);
    };
    n._advanceThinkWord = function _advanceThinkWord() {
      const e = this._thinkWordBeats || [];
      if (!this._thinkWordRunning || e.length < 2) return;
      this._thinkWordIndex = ((this._thinkWordIndex || 0) + 1) % e.length;
      const t = e[this._thinkWordIndex];
      this._transitionToThinkWord(t, () => {
        if (!this._thinkWordRunning) return;
        this._scheduleThinkAdvance(t);
      });
    };
    n._ensureThinkWordCycle = function _ensureThinkWordCycle(e, t, n) {
      if (this._genStageOutcomeKind) return;
      const i = this._thinkBeatsFor(e, t, n);
      const s = i.join("|");
      const o = this._thinkWordEl();
      if (!o || !i.length) return;
      const startHold = e => {
        this._scheduleThinkAdvance(e);
      };
      if (this._thinkWordRunning && this._thinkWordSig !== s) {
        this._thinkWordBeats = i;
        this._thinkWordSig = s;
        this._thinkWordIndex = 0;
        this._transitionToThinkWord(i[0], () => {
          if (!this._thinkWordRunning || this._thinkWordSig !== s) return;
          startHold(i[0]);
        });
        return;
      }
      if (this._thinkWordRunning && this._thinkWordSig === s) return;
      this._thinkWordBeats = i;
      this._thinkWordSig = s;
      this._thinkWordRunning = true;
      this._thinkWordIndex = 0;
      if (!o.textContent) {
        o.classList.remove("is-out");
        this._setThinkWord(i[0]);
        startHold(i[0]);
      } else {
        this._transitionToThinkWord(i[0], () => {
          if (!this._thinkWordRunning) return;
          startHold(i[0]);
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
      this._thinkWordRunning = false;
      this._thinkWordIndex = 0;
      this._ensureThinkWordCycle("install", "", 0);
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
        this._stopThinkWordCycle?.();
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
      const r = (typeof s?.resolveSourceVideoCardMeta === "function" ? s.resolveSourceVideoCardMeta() : null) || {};
      let a = String(i.videoTitle || i.title || r.title || o?.name || "").trim();
      if (!a || /^https?:\/\//i.test(a) || /^Clip\s*·\s*https?/i.test(a)) {
        a = r.title || "Your video";
      }
      a = a.replace(/^Clip\s*·\s*/i, "").replace(/^Ranking\s*·\s*/i, "");
      const l = this.activeTemplateId || "ranked_compilation";
      const c = s?.templates?.[l]?.name || (l === "splitscreen" ? "Clip" : l === "ranked_compilation" ? "Ranking" : "Clip");
      if (e) {
        e.textContent = a || "Your video";
        e.title = a || "Your video";
      }
      if (t) t.textContent = c;
      const d = String(i.thumbnailUrl || r.thumbnailUrl || "").trim();
      const u = i.videoId || r.videoId || null;
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
      const m = !a || a === "Your video" || a === "YouTube video";
      if (m && u && !this._genStageMetaFetchId) {
        this._genStageMetaFetchId = u;
        const e = window.API_BASE_URL || "/api";
        fetch(`${e}/youtube/get-metadata/${encodeURIComponent(u)}`, {
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
      const i = document.getElementById("solisGenSteps");
      const s = document.getElementById("solisGenHeading");
      const o = document.getElementById("solisGenProgressLabel");
      const r = document.getElementById("solisGenLiveLog");
      const a = document.getElementById("solisGenOutcome");
      const l = document.getElementById("solisGenStage");
      if (!i || typeof this._getActiveTasks !== "function") return;
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
      const m = n && n.reveal;
      const h = c.map(e => e.id).join("|");
      const p = m || this._genStepListSig !== h || i.children.length !== c.length;
      if (p) {
        this._genStepListSig = h;
        i.innerHTML = c.map((e, t) => {
          const n = t < g || d >= 100;
          const i = !n && t === g;
          const s = n ? "is-done" : i ? "is-active" : "is-pending";
          return `<li class="solis-gen-step ${s}" data-step-i="${t}">${this._stepIcoHtml()}<span class="solis-gen-step-label"></span></li>`;
        }).join("");
        const e = document.getElementById("solisGenActivity");
        const t = e?.classList.contains("is-open");
        if (m || t) {
          i.querySelectorAll(".solis-gen-step").forEach((e, t) => {
            e.classList.remove("is-shown");
            setTimeout(() => e.classList.add("is-shown"), 60 + t * 70);
          });
        } else {
          i.querySelectorAll(".solis-gen-step").forEach(e => e.classList.add("is-shown"));
        }
      }
      i.querySelectorAll(".solis-gen-step").forEach((e, t) => {
        const n = c[t];
        if (!n) return;
        const i = t < g || d >= 100;
        const s = !i && t === g;
        const o = e.querySelector(".solis-gen-step-label");
        if (o) {
          if (s && d < 100 && d > 0) {
            o.innerHTML = `${escapeHtml(n.label)}<span class="solis-gen-step-pct">…${Math.floor(d)}%</span>`;
          } else if (s) {
            o.textContent = `${n.label}…`;
          } else {
            o.textContent = n.label;
          }
        }
        this._paintStepState(e, {
          done: i,
          active: s
        });
      });
      this._genStepActiveIdx = g;
      const f = c[Math.min(g, c.length - 1)];
      if (s && !this._genStageOutcomeKind) {
        s.classList.remove("solis-gen-thinking");
        if (d >= 100) {
          this._stopThinkWordCycle("Ready");
        } else {
          this._ensureThinkWordCycle(f?.id || "install", u, d);
        }
      }
      const _ = d >= 100 ? c.length : g;
      const k = d >= 100 ? "All set" : f?.label || "Getting started";
      const y = c.length > 1 ? `${Math.min(_ + (d >= 100 ? 0 : 1), c.length)}/${c.length}` : "";
      this._setActivitySummary(k, y);
      if (o) {
        o.textContent = d >= 100 ? "Complete" : d > 0 ? `${Math.floor(d)}%` : "Starting...";
      }
      if (r) {
        r.classList.remove("is-complete", "is-error", "is-warn");
        r.hidden = true;
        r.textContent = "";
      }
      if (a && d < 100 && !this._genStageOutcomeKind) {
        a.hidden = true;
        a.textContent = "";
        a.classList.remove("is-complete", "is-error");
      }
      if (l && !this._genStageOutcomeKind) {
        l.classList.remove("is-complete", "is-error");
      }
      if (!this._genStageOutcomeKind) {
        this._syncGenStageCompanion?.(f?.id, {
          pct: d
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
      const r = String(t || "").trim();
      if (n) {
        n.classList.remove("is-complete", "is-error");
        if (e === "error") n.classList.add("is-error");
      }
      if (o) {
        o.classList.remove("solis-gen-thinking");
        this._stopThinkWordCycle(e === "error" ? "Stuck" : "Ready");
      }
      if (i) {
        if (e === "error") {
          this._showGenStageAlert("error", r || "Something went wrong. Try again.");
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
          s.textContent = r || "Complete. Your clip is ready.";
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
    const t = '<svg class="solis-gen-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const n = '<svg class="solis-gen-step-spin" viewBox="0 0 24 24" aria-hidden="true"><circle class="solis-gen-step-spin-track" cx="12" cy="12" r="9"></circle><circle class="solis-gen-step-spin-arc" cx="12" cy="12" r="9" transform="rotate(-90 12 12)"></circle></svg>';
    const i = `<span class="solis-gen-step-ico">${n}${t}</span>`;
    e.innerHTML = [ [ "Watching the source", "done" ], [ "Finding the best moment", "active" ], [ "Setting up the second panel", "pending" ], [ "Building the split", "pending" ], [ "Finishing up", "pending" ] ].map(([e, t], n) => {
      const s = t === "done";
      const o = t === "active";
      const r = s ? "is-done" : o ? "is-active" : "is-pending";
      const a = o ? `${e}<span class="solis-gen-step-pct">…37%</span>` : e;
      return `<li class="solis-gen-step is-shown ${r}" data-step-i="${n}">${i}<span class="solis-gen-step-label">${a}</span></li>`;
    }).join("");
    const s = document.getElementById("solisGenHeading");
    const o = document.getElementById("solisGenProgressLabel");
    const r = document.getElementById("solisGenVideoTitle");
    const a = document.getElementById("solisGenActivityText");
    const l = document.getElementById("solisGenActivityCount");
    if (s) {
      s.classList.remove("solis-gen-thinking");
      s.innerHTML = '<span class="solis-gen-think-word" id="solisGenThinkWord">Finding</span>';
    }
    if (a) a.textContent = "Finding the best moment";
    if (l) {
      l.hidden = false;
      l.textContent = "2/5";
    }
    if (o) o.textContent = "37%";
    if (r) r.textContent = "I Ate Nothing But YouTuber Products for 7 Days";
    const c = document.getElementById("solisGenThumb");
    if (c) {
      c.innerHTML = '<img src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" alt="" loading="lazy">';
    }
    const d = document.getElementById("solisGenActivity");
    const u = document.getElementById("solisGenActivitySummary");
    if (d && u) {
      d.classList.add("is-open");
      u.setAttribute("aria-expanded", "true");
      u.classList.add("is-expanded");
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
        t.displayProgress?.(37, "Finding the best moment...");
        t._ensureThinkWordCycle?.("moment", "Finding the best moment...", 37);
        const e = document.getElementById("solisGenActivity");
        const n = document.getElementById("solisGenActivitySummary");
        if (e && n) {
          e.classList.add("is-open");
          n.setAttribute("aria-expanded", "true");
          n.classList.add("is-expanded");
        }
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
        e.displayProgress?.(37, "Finding the best moment...");
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
