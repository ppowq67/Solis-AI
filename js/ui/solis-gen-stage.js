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
      n.setAttribute("aria-hidden", "false");
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
      const r = s.videoTitle || s.title || o?.name || document.getElementById("youtubeUrlInput")?.value?.trim() || "Your video";
      const a = this.activeTemplateId || "ranked_compilation";
      const l = i?.templates?.[a]?.name || (a === "splitscreen" ? "Clip" : a === "ranked_compilation" ? "Ranking" : "Clip");
      if (e) {
        let t = String(r);
        if (/^https?:\/\//i.test(t)) {
          try {
            const e = new URL(t);
            t = e.hostname.replace(/^www\./, "") + e.pathname.slice(0, 28);
          } catch (e) {
            t = "YouTube video";
          }
        }
        t = t.replace(/^Clip\s*·\s*/i, "").replace(/^Ranking\s*·\s*/i, "");
        e.textContent = t;
        e.title = String(r);
      }
      if (t) t.textContent = l;
      if (n && s.thumbnailUrl) {
        n.innerHTML = `<img src="${String(s.thumbnailUrl).replace(/"/g, "")}" alt="">`;
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
      if (!s || typeof this._getActiveTasks !== "function") return;
      const r = this._getActiveTasks();
      if (!r.length) return;
      let a = Number(e);
      if (!Number.isFinite(a)) {
        const e = this.activeGenerations?.values?.().next?.().value;
        a = Number(e?.progress);
      }
      if (!Number.isFinite(a)) a = 0;
      a = Math.max(0, Math.min(100, a));
      const l = String(t || firstMessage(this) || "");
      let c = 0;
      if (typeof this._resolveTaskIndex === "function") {
        c = this._resolveTaskIndex(a, l);
      } else {
        for (let e = 0; e < r.length; e++) {
          const t = e === 0 ? 0 : Number(r[e - 1]?.maxProgress) || 0;
          if (a >= t) c = e;
        }
      }
      const d = n && n.reveal;
      const p = `${r.map(e => e.id).join("|")}|${c}|${a >= 100 ? 1 : 0}`;
      const u = d || this._genStepSignature !== p || s.children.length !== r.length;
      if (u) {
        this._genStepSignature = p;
        s.innerHTML = r.map((e, t) => {
          const n = t < c || a >= 100;
          const s = !n && t === c;
          const i = n ? `<span class="solis-gen-step-ico"><svg class="solis-gen-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>` : s ? `<span class="solis-gen-step-ico"><span class="solis-gen-step-spin" aria-hidden="true"></span></span>` : `<span class="solis-gen-step-ico"></span>`;
          return `<li class="solis-gen-step${n ? " is-done" : ""}${s ? " is-active" : ""}" data-step-i="${t}">${i}<span class="solis-gen-step-label"></span></li>`;
        }).join("");
        if (d) {
          s.querySelectorAll(".solis-gen-step").forEach((e, t) => {
            e.classList.remove("is-shown");
            setTimeout(() => e.classList.add("is-shown"), 80 + t * 100);
          });
        } else {
          s.querySelectorAll(".solis-gen-step").forEach(e => e.classList.add("is-shown"));
        }
      }
      s.querySelectorAll(".solis-gen-step").forEach((e, t) => {
        const n = r[t];
        if (!n) return;
        const s = t < c || a >= 100;
        const i = !s && t === c;
        const o = e.querySelector(".solis-gen-step-label");
        if (!o) return;
        if (i && a < 100 && a > 0) {
          o.innerHTML = `${escapeHtml(n.label)}<span class="solis-gen-step-pct">...${Math.floor(a)}%</span>`;
        } else if (i) {
          o.textContent = `${n.label}...`;
        } else {
          o.textContent = n.label;
        }
        e.classList.toggle("is-done", s);
        e.classList.toggle("is-active", i);
      });
      const g = r[Math.min(c, r.length - 1)];
      const f = a >= 100 ? "Your clips are ready" : g?.id === "moment" || g?.id === "clip" ? "Analyzing content and finding clips" : g?.label || "Analyzing content and finding clips";
      if (i && f !== this._lastGenHeadline) {
        i.textContent = f;
        this._lastGenHeadline = f;
      }
      if (o) {
        o.textContent = a >= 100 ? "Complete" : a > 0 ? `${Math.floor(a)}%` : "Starting...";
      }
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
          title: "I Ate Nothing But YouTuber Products for 7 Days"
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
          title: "I Ate Nothing But YouTuber Products for 7 Days"
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
