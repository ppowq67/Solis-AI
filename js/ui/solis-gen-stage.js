/**
 * Solis generating stage — fullscreen wait UI.
 * Extends GenerationProgressSpinner without breaking the launcher.
 */
(function () {
    const AffTips = [
        {
            title: 'Meet Solis AI,<br>your clip co-pilot',
            sub: 'We turn long videos into short-form clips with captions, modes, and polish built in.',
        },
        {
            title: 'Named after<br>the sun',
            sub: 'Solis means sun. Bright ideas, warm orange energy, and clips that feel alive.',
        },
        {
            title: 'Beast captions<br>that actually pop',
            sub: 'Komika Axis, thick stroke, soft glow. Made for that “wait, what font is that?” energy.',
        },
        {
            title: 'AI Reframe,<br>Blur, and Focus',
            sub: 'Modes keep faces framed, letterbox wide shots, or go full-focus when the moment needs it.',
        },
        {
            title: 'Built tiny,<br>shipping fast',
            sub: 'We are early and moving quick. Your generations help Solis get sharper every week.',
        },
        {
            title: 'Fun fact',
            sub: 'Solis was built by a 16-year-old from Georgia — still shipping, still iterating.',
        },
        {
            title: 'Library is<br>home base',
            sub: 'Finished clips land in Library ready to tweak, download, and post wherever you create.',
        },
    ];

    function safeCall(fn, ctx, args) {
        try {
            if (typeof fn === 'function') return fn.apply(ctx, args || []);
        } catch (_) { /* never break the launcher */ }
        return undefined;
    }

    function patch() {
        const instance = (typeof getGenerationProgressSpinner === 'function'
            && getGenerationProgressSpinner())
            || window.generationProgressSpinner
            || null;
        const Proto = (instance && instance.constructor && instance.constructor.prototype)
            || (typeof GenerationProgressSpinner !== 'undefined' && GenerationProgressSpinner.prototype)
            || null;
        if (!Proto) return false;
        if (Proto.__solisGenStagePatched) {
            instance?._bindGenStageChrome?.();
            return true;
        }
        Proto.__solisGenStagePatched = true;

        // No-op defaults so displayProgress never throws before full patch methods run
        if (typeof Proto._syncGenStageSteps !== 'function') {
            Proto._syncGenStageSteps = function () {};
        }
        if (typeof Proto._fillGenStageVideoMeta !== 'function') {
            Proto._fillGenStageVideoMeta = function () {};
        }
        if (typeof Proto._syncGenStageOutcome !== 'function') {
            Proto._syncGenStageOutcome = function () {};
        }
        if (typeof Proto._showGenStageAlert !== 'function') {
            Proto._showGenStageAlert = function () {};
        }

        Proto._bindGenStageChrome = function _bindGenStageChrome() {
            if (this._genStageBound) return;
            const stage = document.getElementById('solisGenStage');
            if (!stage) return;
            this._genStageBound = true;
            const dismiss = () => this.closeGenStage();
            document.getElementById('solisGenContinueBg')?.addEventListener('click', dismiss);
            document.getElementById('solisGenExitBtn')?.addEventListener('click', dismiss);
            const moreBtn = document.getElementById('generationTodoMoreBtn');
            if (moreBtn && !moreBtn.__solisBound) {
                moreBtn.__solisBound = true;
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closePanel?.();
                    this.openGenStage({ reveal: true });
                });
            }
        };

        Proto.openGenStage = function openGenStage(opts) {
            const stage = document.getElementById('solisGenStage');
            if (!stage) return;
            if (this._genTipIndex == null) this._genTipIndex = 0;
            this._bindGenStageChrome();
            this._parkProfileClusterInGenStage();
            this._fillGenStageVideoMeta();
            this._renderAffHeroTip();
            const reveal = !opts || opts.reveal !== false;
            this._syncGenStageSteps(undefined, undefined, { reveal });
            stage.classList.remove('is-leaving');
            stage.classList.add('is-open');
            stage.classList.remove('is-complete', 'is-error');
            stage.setAttribute('aria-hidden', 'false');
            const outcome = document.getElementById('solisGenOutcome');
            const liveLog = document.getElementById('solisGenLiveLog');
            if (outcome) {
                outcome.hidden = true;
                outcome.textContent = '';
                outcome.classList.remove('is-complete', 'is-error');
            }
            if (liveLog) {
                liveLog.hidden = true;
                liveLog.textContent = '';
                liveLog.classList.remove('is-complete', 'is-error', 'is-warn');
            }
            this.genStageOpen = true;
            document.body.classList.add('solis-gen-stage-active');
            // Don't leave the compact spinner menu open over Advanced
            try { this.closePanel?.(); } catch (_) { /* ignore */ }
            if (!this._affTipTimer) {
                this._affTipTimer = setInterval(() => {
                    this._genTipIndex = ((this._genTipIndex || 0) + 1) % AffTips.length;
                    this._renderAffHeroTip({ animate: true });
                }, 7000);
            }
        };

        Proto.closeGenStage = function closeGenStage() {
            const stage = document.getElementById('solisGenStage');
            if (!stage || (!stage.classList.contains('is-open') && !this.genStageOpen)) {
                this.genStageOpen = false;
                document.body.classList.remove('solis-gen-stage-active');
                return;
            }
            if (stage.classList.contains('is-leaving')) return;
            if (this._affTipTimer) {
                clearInterval(this._affTipTimer);
                this._affTipTimer = null;
            }
            stage.classList.add('is-leaving');
            const finish = () => {
                stage.classList.remove('is-open', 'is-leaving');
                stage.setAttribute('aria-hidden', 'true');
                this._restoreProfileClusterFromGenStage();
                this.genStageOpen = false;
                document.body.classList.remove('solis-gen-stage-active');
            };
            const onEnd = (e) => {
                if (e.target !== stage || e.propertyName !== 'opacity') return;
                stage.removeEventListener('transitionend', onEnd);
                clearTimeout(fallback);
                finish();
            };
            stage.addEventListener('transitionend', onEnd);
            const fallback = setTimeout(() => {
                stage.removeEventListener('transitionend', onEnd);
                finish();
            }, 420);
        };

        Proto._parkProfileClusterInGenStage = function _parkProfileClusterInGenStage() {
            const cluster = document.getElementById('profileActionCluster');
            const host = document.getElementById('solisGenAccountHost');
            if (!cluster || !host) return;
            if (!this._clusterHome) {
                this._clusterHome = {
                    parent: cluster.parentElement,
                    next: cluster.nextSibling,
                };
            }
            if (cluster.parentElement !== host) {
                host.appendChild(cluster);
                document.getElementById('notificationsDropdown')?.classList.remove('open');
                document.getElementById('profileDropdown')?.classList.remove('open');
            }
        };

        Proto._restoreProfileClusterFromGenStage = function _restoreProfileClusterFromGenStage() {
            const cluster = document.getElementById('profileActionCluster');
            const home = this._clusterHome;
            if (!cluster || !home?.parent) {
                this._clusterHome = null;
                return;
            }
            if (home.next && home.next.parentElement === home.parent) {
                home.parent.insertBefore(cluster, home.next);
            } else {
                home.parent.appendChild(cluster);
            }
            this._clusterHome = null;
            document.getElementById('notificationsDropdown')?.classList.remove('open');
            document.getElementById('profileDropdown')?.classList.remove('open');
        };

        Proto._fillGenStageVideoMeta = function _fillGenStageVideoMeta() {
            const titleEl = document.getElementById('solisGenVideoTitle');
            const badgeEl = document.getElementById('solisGenTemplateBadge');
            const thumbEl = document.getElementById('solisGenThumb');
            const opts = this.activeTemplateOptions || {};
            const studio = window.clipsStudio;
            const processing = studio?.processingItems?.[0];
            const source = (typeof studio?.resolveSourceVideoCardMeta === 'function'
                ? studio.resolveSourceVideoCardMeta()
                : null) || {};

            let title = String(
                opts.videoTitle
                || opts.title
                || source.title
                || processing?.name
                || ''
            ).trim();
            // Never show raw URL / "Clip · https…" in the card
            if (!title || /^https?:\/\//i.test(title) || /^Clip\s*·\s*https?/i.test(title)) {
                title = source.title || 'Your video';
            }
            title = title.replace(/^Clip\s*·\s*/i, '').replace(/^Ranking\s*·\s*/i, '');

            const templateId = this.activeTemplateId || 'ranked_compilation';
            const templateName = studio?.templates?.[templateId]?.name
                || (templateId === 'splitscreen' ? 'Clip'
                    : templateId === 'ranked_compilation' ? 'Ranking' : 'Clip');
            if (titleEl) {
                titleEl.textContent = title || 'Your video';
                titleEl.title = title || 'Your video';
            }
            if (badgeEl) badgeEl.textContent = templateName;

            const thumbUrl = String(
                opts.thumbnailUrl
                || source.thumbnailUrl
                || ''
            ).trim();
            const videoId = opts.videoId || source.videoId || null;
            const resolvedThumb = thumbUrl
                || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
            if (thumbEl) {
                if (resolvedThumb && /^https?:\/\//i.test(resolvedThumb)) {
                    const safe = resolvedThumb.replace(/"/g, '');
                    const existing = thumbEl.querySelector('img');
                    if (!existing || existing.getAttribute('src') !== safe) {
                        thumbEl.innerHTML = `<img src="${safe}" alt="" loading="lazy">`;
                    }
                } else if (!thumbEl.querySelector('img')) {
                    thumbEl.innerHTML = '<span class="solis-gen-thumb-fallback">CLIP</span>';
                }
            }

            // If we only have a video id (no title yet), fetch once and refresh the card
            const needsTitle = !title || title === 'Your video' || title === 'YouTube video';
            if (needsTitle && videoId && !this._genStageMetaFetchId) {
                this._genStageMetaFetchId = videoId;
                const apiBase = window.API_BASE_URL || '/api';
                fetch(`${apiBase}/youtube/get-metadata/${encodeURIComponent(videoId)}`, {
                    credentials: 'include',
                    signal: AbortSignal.timeout(5000),
                })
                    .then((r) => (r.ok ? r.json() : null))
                    .then((data) => {
                        if (!data?.title) return;
                        if (studio) studio._lastVideoTitle = data.title;
                        if (data.thumbnail && studio) studio._lastVideoThumbnail = data.thumbnail;
                        this.activeTemplateOptions = {
                            ...(this.activeTemplateOptions || {}),
                            videoTitle: data.title,
                            title: data.title,
                            thumbnailUrl: data.thumbnail
                                || this.activeTemplateOptions?.thumbnailUrl
                                || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
                            videoId,
                        };
                        this._fillGenStageVideoMeta();
                    })
                    .catch(() => { /* ignore */ })
                    .finally(() => {
                        if (this._genStageMetaFetchId === videoId) this._genStageMetaFetchId = null;
                    });
            }
        };

        Proto._renderAffHeroTip = function _renderAffHeroTip(opts) {
            const tip = AffTips[this._genTipIndex] || AffTips[0];
            const title = document.getElementById('solisGenAffTitle');
            const sub = document.getElementById('solisGenAffSub');
            const body = title?.closest('.solis-gen-aff-body')
                || document.querySelector('#solisGenAffHero .solis-gen-aff-body');
            const apply = () => {
                if (title) title.innerHTML = tip.title;
                if (sub) sub.textContent = tip.sub;
            };
            if (!opts?.animate || !body) {
                body?.classList.remove('is-tip-out');
                apply();
                return;
            }
            if (this._affTipAnimating) return;
            this._affTipAnimating = true;
            body.classList.add('is-tip-out');
            const finish = () => {
                apply();
                // Next frame so the browser paints blurred empty state before clearing
                requestAnimationFrame(() => {
                    body.classList.remove('is-tip-out');
                    this._affTipAnimating = false;
                });
            };
            const onEnd = (e) => {
                if (e.target !== body || e.propertyName !== 'filter') return;
                body.removeEventListener('transitionend', onEnd);
                clearTimeout(fallback);
                finish();
            };
            body.addEventListener('transitionend', onEnd);
            const fallback = setTimeout(() => {
                body.removeEventListener('transitionend', onEnd);
                finish();
            }, 500);
        };

        Proto._syncGenStageSteps = function _syncGenStageSteps(progress, message, opts) {
            const list = document.getElementById('solisGenSteps');
            const heading = document.getElementById('solisGenHeading');
            const progressLabel = document.getElementById('solisGenProgressLabel');
            const liveLog = document.getElementById('solisGenLiveLog');
            const outcome = document.getElementById('solisGenOutcome');
            const stage = document.getElementById('solisGenStage');
            if (!list || typeof this._getActiveTasks !== 'function') return;
            const tasks = this._getActiveTasks();
            if (!tasks.length) return;

            let pct = Number(progress);
            if (!Number.isFinite(pct)) {
                const first = this.activeGenerations?.values?.().next?.().value;
                pct = Number(first?.progress);
            }
            if (!Number.isFinite(pct)) pct = 0;
            pct = Math.max(0, Math.min(100, pct));
            const msg = String(message || firstMessage(this) || '');

            let activeIdx = 0;
            if (typeof this._resolveTaskIndex === 'function') {
                activeIdx = this._resolveTaskIndex(pct, msg);
            } else {
                for (let i = 0; i < tasks.length; i++) {
                    const floor = i === 0 ? 0 : (Number(tasks[i - 1]?.maxProgress) || 0);
                    if (pct >= floor) activeIdx = i;
                }
            }

            const reveal = opts && opts.reveal;
            const signature = `${tasks.map((t) => t.id).join('|')}|${activeIdx}|${pct >= 100 ? 1 : 0}`;
            const needsRebuild = reveal || this._genStepSignature !== signature || list.children.length !== tasks.length;

            if (needsRebuild) {
                this._genStepSignature = signature;
                list.innerHTML = tasks.map((task, i) => {
                    const done = i < activeIdx || pct >= 100;
                    const active = !done && i === activeIdx;
                    const ico = done
                        ? `<span class="solis-gen-step-ico"><svg class="solis-gen-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>`
                        : active
                            ? `<span class="solis-gen-step-ico"><span class="solis-gen-step-spin" aria-hidden="true"></span></span>`
                            : `<span class="solis-gen-step-ico"></span>`;
                    return `<li class="solis-gen-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}" data-step-i="${i}">${ico}<span class="solis-gen-step-label"></span></li>`;
                }).join('');

                if (reveal) {
                    list.querySelectorAll('.solis-gen-step').forEach((el, i) => {
                        el.classList.remove('is-shown');
                        setTimeout(() => el.classList.add('is-shown'), 80 + i * 100);
                    });
                } else {
                    list.querySelectorAll('.solis-gen-step').forEach((el) => el.classList.add('is-shown'));
                }
            }

            // Update labels / % without remounting the active spinner
            list.querySelectorAll('.solis-gen-step').forEach((el, i) => {
                const task = tasks[i];
                if (!task) return;
                const done = i < activeIdx || pct >= 100;
                const active = !done && i === activeIdx;
                const labelEl = el.querySelector('.solis-gen-step-label');
                if (!labelEl) return;
                if (active && pct < 100 && pct > 0) {
                    labelEl.innerHTML = `${escapeHtml(task.label)}<span class="solis-gen-step-pct">...${Math.floor(pct)}%</span>`;
                } else if (active) {
                    labelEl.textContent = `${task.label}...`;
                } else {
                    labelEl.textContent = task.label;
                }
                el.classList.toggle('is-done', done);
                el.classList.toggle('is-active', active);
            });

            const activeTask = tasks[Math.min(activeIdx, tasks.length - 1)];
            const headline = pct >= 100
                ? 'Your clips are ready'
                : (activeTask?.id === 'moment' || activeTask?.id === 'clip'
                    ? 'Analyzing content and finding clips'
                    : (activeTask?.label || 'Analyzing content and finding clips'));
            if (heading && headline !== this._lastGenHeadline) {
                heading.textContent = headline;
                this._lastGenHeadline = headline;
            }
            if (progressLabel) {
                progressLabel.textContent = pct >= 100 ? 'Complete' : (pct > 0 ? `${Math.floor(pct)}%` : 'Starting...');
            }

            const cleanedMsg = typeof this._cleanMessage === 'function'
                ? this._cleanMessage(msg)
                : String(msg || '').trim();
            if (liveLog) {
                liveLog.classList.remove('is-complete', 'is-error', 'is-warn');
                if (pct >= 100) {
                    liveLog.hidden = true;
                    liveLog.textContent = '';
                } else {
                    liveLog.hidden = true;
                    liveLog.textContent = '';
                }
            }
            if (outcome && pct < 100) {
                outcome.hidden = true;
                outcome.textContent = '';
                outcome.classList.remove('is-complete', 'is-error');
            }
            if (stage) {
                stage.classList.remove('is-complete', 'is-error');
            }
        };

        Proto._showGenStageAlert = function _showGenStageAlert(kind, message) {
            const liveLog = document.getElementById('solisGenLiveLog');
            if (!liveLog) return;
            const safe = String(message || '').trim();
            if (!safe) {
                liveLog.hidden = true;
                liveLog.textContent = '';
                liveLog.classList.remove('is-error', 'is-warn', 'is-complete');
                return;
            }
            liveLog.hidden = false;
            liveLog.classList.remove('is-complete', 'is-error', 'is-warn');
            liveLog.classList.add(kind === 'warn' ? 'is-warn' : 'is-error');
            liveLog.textContent = safe;
        };

        Proto._syncGenStageOutcome = function _syncGenStageOutcome(kind, message) {
            const stage = document.getElementById('solisGenStage');
            const liveLog = document.getElementById('solisGenLiveLog');
            const outcome = document.getElementById('solisGenOutcome');
            const heading = document.getElementById('solisGenHeading');
            const safe = String(message || '').trim();
            if (stage) {
                stage.classList.remove('is-complete', 'is-error');
                if (kind === 'error') stage.classList.add('is-error');
            }
            if (heading) {
                heading.textContent = kind === 'error'
                    ? 'Generation failed'
                    : 'Your clips are ready';
            }
            if (liveLog) {
                if (kind === 'error') {
                    this._showGenStageAlert('error', safe || 'Something went wrong — try again');
                } else {
                    liveLog.hidden = true;
                    liveLog.textContent = '';
                    liveLog.classList.remove('is-complete', 'is-error', 'is-warn');
                }
            }
            if (outcome) {
                if (kind === 'error') {
                    outcome.hidden = true;
                    outcome.textContent = '';
                    outcome.classList.remove('is-complete', 'is-error');
                } else {
                    outcome.hidden = false;
                    outcome.classList.remove('is-error');
                    outcome.classList.add('is-complete');
                    outcome.textContent = safe || 'Complete — your clip is ready';
                }
            }
            try {
                this._syncGenStageSteps(kind === 'error' ? 0 : 100, safe, { reveal: false });
            } catch (_) { /* ignore */ }
        };

        function firstMessage(self) {
            try {
                const first = self.activeGenerations?.values?.().next?.().value;
                return first?.message || '';
            } catch (_) {
                return '';
            }
        }

        function escapeHtml(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        // Harden: stage sync is already guarded inside displayProgress
        // Generation start → full stage with checklist reveal
        const prevBegin = Proto.beginOptimisticGeneration;
        if (typeof prevBegin === 'function' && !Proto.__solisGenStageBeginWrapped) {
            Proto.__solisGenStageBeginWrapped = true;
            Proto.beginOptimisticGeneration = function beginOptimisticGenerationPatched(message, templateId, options) {
                prevBegin.call(this, message, templateId, options);
                requestAnimationFrame(() => {
                    safeCall(this.openGenStage, this, [{ reveal: true }]);
                });
            };
        }

        const prevStart = Proto.startGeneration;
        if (typeof prevStart === 'function' && !Proto.__solisGenStageStartWrapped) {
            Proto.__solisGenStageStartWrapped = true;
            Proto.startGeneration = function startGenerationPatched(projectId, message, templateId, options) {
                prevStart.call(this, projectId, message, templateId, options);
                if (!this.genStageOpen) {
                    requestAnimationFrame(() => safeCall(this.openGenStage, this, [{ reveal: false }]));
                }
            };
        }

        return true;
    }

    function fillDemoSteps() {
        const list = document.getElementById('solisGenSteps');
        if (!list) return;
        const check = '<svg class="solis-gen-step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        list.innerHTML = [
            ['Fetch video', 'done'],
            ['Create project', 'done'],
            ['Finding best moment', 'active'],
            ['Preparing secondary panel', ''],
            ['Building split screen', ''],
            ['Exporting', ''],
        ].map(([label, state], i) => {
            const done = state === 'done';
            const active = state === 'active';
            const ico = done
                ? `<span class="solis-gen-step-ico">${check}</span>`
                : active
                    ? '<span class="solis-gen-step-ico"><span class="solis-gen-step-spin" aria-hidden="true"></span></span>'
                    : '<span class="solis-gen-step-ico"></span>';
            const text = active
                ? `${label}<span class="solis-gen-step-pct">...37%</span>`
                : label;
            return `<li class="solis-gen-step is-shown${done ? ' is-done' : ''}${active ? ' is-active' : ''}" data-step-i="${i}">${ico}<span class="solis-gen-step-label">${text}</span></li>`;
        }).join('');
        const heading = document.getElementById('solisGenHeading');
        const progressLabel = document.getElementById('solisGenProgressLabel');
        const title = document.getElementById('solisGenVideoTitle');
        if (heading) heading.textContent = 'Analyzing content and finding clips';
        if (progressLabel) progressLabel.textContent = '37%';
        if (title) title.textContent = 'I Ate Nothing But YouTuber Products for 7 Days';
        const thumb = document.getElementById('solisGenThumb');
        if (thumb) {
            thumb.innerHTML = '<img src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" alt="" loading="lazy">';
        }
    }

    function forceOpenDemoStage() {
        const stage = document.getElementById('solisGenStage');
        if (!stage) return false;
        fillDemoSteps();
        const s = (typeof getGenerationProgressSpinner === 'function' && getGenerationProgressSpinner())
            || window.generationProgressSpinner
            || null;
        if (s && typeof s.openGenStage === 'function') {
            try {
                s.activeTemplateId = 'splitscreen';
                s.activeTemplateOptions = {
                    videoTitle: 'I Ate Nothing But YouTuber Products for 7 Days',
                    title: 'I Ate Nothing But YouTuber Products for 7 Days',
                    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
                    videoId: 'dQw4w9WgXcQ',
                };
                s.openGenStage({ reveal: true });
                s.displayProgress?.(37, 'Finding best moment...');
                return true;
            } catch (_) { /* fall through */ }
        }
        stage.classList.remove('is-leaving');
        stage.classList.add('is-open');
        stage.setAttribute('aria-hidden', 'false');
        document.body.classList.add('solis-gen-stage-active');
        // Park profile cluster if possible
        try {
            const cluster = document.getElementById('profileActionCluster');
            const host = document.getElementById('solisGenAccountHost');
            if (cluster && host && cluster.parentElement !== host) host.appendChild(cluster);
        } catch (_) { /* ignore */ }
        document.getElementById('solisGenExitBtn')?.addEventListener('click', () => {
            stage.classList.add('is-leaving');
            setTimeout(() => {
                stage.classList.remove('is-open', 'is-leaving');
                stage.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('solis-gen-stage-active');
            }, 380);
        }, { once: true });
        document.getElementById('solisGenContinueBg')?.addEventListener('click', () => {
            document.getElementById('solisGenExitBtn')?.click();
        }, { once: true });
        return true;
    }

    function forceOpenDemoTasks() {
        const s = (typeof getGenerationProgressSpinner === 'function' && getGenerationProgressSpinner())
            || window.generationProgressSpinner
            || null;
        const wrapper = document.getElementById('generationProgressWrapper');
        if (!wrapper) return false;

        // Keep full stage closed — show spinner + Solis Tasks menu
        try { s?.closeGenStage?.(); } catch (_) { /* ignore */ }

        if (s) {
            try {
                s.activeTemplateId = 'splitscreen';
                s.activeTemplateOptions = {
                    videoTitle: 'I Ate Nothing But YouTuber Products for 7 Days',
                    title: 'I Ate Nothing But YouTuber Products for 7 Days',
                    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
                    videoId: 'dQw4w9WgXcQ',
                };
                s.optimisticPending = true;
                s.tasksIntroPlayed = false;
                s._ensureDomRefs?.();
                s._ensureTaskList?.();
                if (s.wrapper) s.wrapper.style.display = 'flex';
                s.displayProgress?.(37, 'Finding best moment...');
                s.openPanel?.();
                s._bindGenStageChrome?.();
                return true;
            } catch (_) { /* fall through */ }
        }

        wrapper.style.display = 'flex';
        const panel = document.getElementById('generationTodoPanel');
        panel?.classList.add('is-open');
        return Boolean(panel);
    }

    function maybeRunDashboardDemo() {
        const search = String(location.search || '');
        const wantTasks = /[?&]solisTasksDemo=1(?:&|$)/.test(search)
            || /[?&]solisGenDemo=1(?:&|$)/.test(search);
        const wantStage = /[?&]solisGenStageDemo=1(?:&|$)/.test(search);
        if (!wantTasks && !wantStage) return;

        let tries = 0;
        const tick = () => {
            tries += 1;
            const ok = wantStage ? forceOpenDemoStage() : forceOpenDemoTasks();
            if (ok) return;
            if (tries < 50) setTimeout(tick, 120);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(tick, 80));
        } else {
            setTimeout(tick, 80);
        }
        setTimeout(() => {
            if (wantStage) forceOpenDemoStage();
            else forceOpenDemoTasks();
        }, 1600);
    }

    function boot() {
        const ok = patch();
        try {
            const s = typeof getGenerationProgressSpinner === 'function'
                ? getGenerationProgressSpinner()
                : window.generationProgressSpinner;
            if (s) {
                if (s.genStageOpen == null) s.genStageOpen = false;
                s._bindGenStageChrome?.();
            }
        } catch (_) { /* ignore */ }
        return ok;
    }

    if (!boot()) {
        document.addEventListener('DOMContentLoaded', () => {
            boot();
            setTimeout(boot, 400);
        });
    } else {
        setTimeout(boot, 200);
    }
    maybeRunDashboardDemo();
})();
