/**
 * Solis library card — Opus layout, white Solis theme.
 */
(function () {
    const LOAD_MAX = 3;
    const _queue = [];
    let _active = 0;
    let _playing = null;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatClock(raw) {
        if (raw == null || raw === '' || raw === '—') return '00:00';
        const s = String(raw).trim();
        const hm = s.match(/^(\d+):(\d{2})$/);
        if (hm) return `${String(hm[1]).padStart(2, '0')}:${hm[2]}`;
        const sec = s.match(/^(\d+(?:\.\d+)?)\s*s$/i);
        if (sec) {
            const n = Math.max(0, Math.round(Number(sec[1])));
            return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
        }
        const n = Number(s);
        if (Number.isFinite(n) && n >= 0) {
            const t = Math.round(n);
            return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        }
        return s;
    }

    function fmtHundred(score10) {
        const x = Number(score10);
        if (!Number.isFinite(x) || x <= 0) return 0;
        if (x > 10) return Math.max(0, Math.min(100, Math.round(x)));
        return Math.max(0, Math.min(100, Math.round(x * 10)));
    }

    const BAND_META = {
        high: { label: 'High potential.' },
        solid: { label: 'Worth posting.' },
        average: { label: 'Average.' },
        low: { label: 'Skip it.' },
    };
    const LETTER_TO_100 = { 'S+': 100, S: 92, A: 82, B: 68, C: 52, D: 30 };

    function bandOf(n) {
        const x = Number(n);
        if (!Number.isFinite(x) || x <= 0) return '';
        if (x >= 80) return 'high';
        if (x >= 60) return 'solid';
        if (x >= 40) return 'average';
        return 'low';
    }

    function scoreToHundred(v, fallbackLetter) {
        if (!v || typeof v !== 'object') return 0;
        if (v.n100 != null && Number.isFinite(Number(v.n100))) return fmtHundred(v.n100);
        if (v.score_100 != null && Number.isFinite(Number(v.score_100))) return fmtHundred(v.score_100);
        if (Number(v.score_max) === 100 && v.score != null) return fmtHundred(v.score);
        const ten = v.score_10 != null ? v.score_10 : v.n != null ? v.n : v.score;
        if (ten != null && Number.isFinite(Number(ten))) return fmtHundred(ten);
        const letter = String(fallbackLetter || v.tier || v.grade || '').toUpperCase().replace(/\s+/g, '');
        return LETTER_TO_100[letter === 'S+' ? 'S+' : letter] || 0;
    }

    function dimOf(v, key) {
        const m = (v && v[key]) || {};
        const n = Number(m.n != null ? m.n : m.score);
        const has = m.available !== false && Number.isFinite(n) && n > 0;
        const n100 = has ? scoreToHundred(m, m.band || m.grade) : 0;
        const band = m.band || bandOf(n100);
        return {
            n: has ? n : 0,
            n100,
            display: n100 ? String(n100) : '',
            band,
            note: String(m.note || m.why || '').trim(),
            available: has || n100 > 0,
        };
    }

    function viralityOf(item) {
        const v = item && item.virality;
        if (!v || typeof v !== 'object') return null;
        if (v.available === false) return null;
        const score100 = scoreToHundred(v, v.tier || v.band);
        let band = String(v.band || '').toLowerCase();
        if (!BAND_META[band]) {
            const t = String(v.tier || '').toLowerCase();
            band = BAND_META[t] ? t : bandOf(score100);
        }
        if (!BAND_META[band] || score100 <= 0) return null;
        const clips = Array.isArray(v.clips) ? v.clips : [];
        const lone = v.lone_clip === true || clips.length <= 1;
        if (score100 < 60 && !lone) return null;
        const tag = v.tag && typeof v.tag === 'object' ? v.tag : null;
        const tagConf = tag ? Number(tag.confidence) : 0;
        const meta = BAND_META[band] || BAND_META.solid;
        return {
            band,
            score100,
            scoreDisplay: String(score100),
            label: String(v.label || meta.label),
            why: String(v.why || '').trim(),
            fix: String(v.fix || '').trim(),
            rank: v.rank != null && v.rank !== '' ? v.rank : null,
            tag: tag && tag.label && tagConf >= 0.8
                ? { label: String(tag.label), confidence: tagConf }
                : null,
            hook: dimOf(v, 'hook'),
            subtitles: dimOf(v, 'subtitles'),
            clip: dimOf(v, 'clip'),
            video: dimOf(v, 'video'),
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

    function tip(text) {
        return `<span class="scc-tip">${esc(text)}</span>`;
    }

    function dimBandClass(band) {
        const t = String(band || '');
        return t ? 'pv-band-' + t : '';
    }

    function gradeRows(v) {
        return [
            ['hook', 'Hook'],
            ['clip', 'Clip'],
            ['video', 'Video'],
        ].map(([k, label]) => {
            const m = v[k] || {};
            const n100 = m.n100 || 0;
            if (!n100) return '';
            const band = m.band || bandOf(n100);
            const note = m.note || '';
            const tipBody = note ? `<div class="scc-why"><p>${esc(note)}</p></div>` : '';
            return `<div class="pv-grade" data-dim="${esc(k)}">
                <b class="pv-dim-tier ${dimBandClass(band)}">${esc(String(n100))}</b>
                <span class="pv-dim-label">${esc(label)}</span>
                ${tipBody}
            </div>`;
        }).join('');
    }

    function previewUrl(pid) {
        if (window.clipsStudio && typeof clipsStudio.getLibraryPreviewVideoUrl === 'function') {
            return clipsStudio.getLibraryPreviewVideoUrl(pid, { bust: false });
        }
        const base = (window.API_BASE_URL || '/api').replace(/\/$/, '');
        return `${base}/clips/preview/${encodeURIComponent(pid)}/1`;
    }

    function posterUrl(item) {
        const external = item && (item.thumbnailUrl || item.thumbnail_url);
        if (external && String(external).startsWith('http')) return String(external);
        const pid = item && (item.projectId || item.id);
        if (!pid) return '';
        const base = (window.API_BASE_URL || '/api').replace(/\/$/, '');
        return `${base}/clips/poster/${encodeURIComponent(pid)}`;
    }

    function pumpQueue() {
        while (_active < LOAD_MAX && _queue.length) {
            const fn = _queue.shift();
            _active += 1;
            Promise.resolve().then(fn).catch(() => {}).finally(() => {
                _active -= 1;
                pumpQueue();
            });
        }
    }
    function enqueueLoad(fn) {
        _queue.push(fn);
        pumpQueue();
    }

    function bandClass(band) {
        return 'scc-band-' + String(band || 'solid');
    }

    function buildHTML(item) {
        const name = esc(item.name || item.video_title || 'Clip');
        const pid = esc(item.projectId || item.id || '');
        const itemId = esc(item.id || item.projectId || '');
        const dur = formatClock(item.duration);
        const _plan = (window.currentUser && window.currentUser.plan) || 'free';
        const _curRes = item.resolution || (_plan === 'free' ? '720p' : '1080p');
        const _canHD = _plan !== 'free';
        const _proBadge = _canHD ? '' : '<span class="pro-badge scc-res-pro-inline">PRO</span>';
        const viral = `<div class="scc-res-wrap" data-project-id="${pid}" data-res="${esc(_curRes)}">
            <button type="button" class="scc-res-pill${_curRes === '720p' ? ' active' : ''}" data-res="720p">720p</button>
            <button type="button" class="scc-res-pill${_curRes === '1080p' ? ' active' : ''}${!_canHD ? ' locked' : ''}" data-res="1080p">1080p${_proBadge}</button>
        </div>`;

        return `
            <span class="scc-select-check" aria-hidden="true"></span>
            <div class="scc-preview">
                <div class="scc-skel" aria-hidden="true"></div>
                <img class="scc-poster" alt="" loading="lazy" decoding="async" draggable="false">
                <video class="scc-video" muted playsinline loop preload="none" controlslist="nodownload nofullscreen noremoteplayback" disablepictureinpicture></video>
                <span class="scc-play" aria-hidden="true"></span>
                <div class="scc-time"><span class="scc-t0">00:00</span> <span class="scc-t1">${esc(dur)}</span></div>
                <div class="scc-bar"><i></i></div>
            </div>
            <div class="scc-meta">
                <div class="scc-meta-row">
                    ${viral}
                    <div class="scc-actions">
                        <button type="button" class="scc-ico library-share-btn" data-project-id="${pid}" aria-label="Share preview">
                            ${iconShare()}${tip('Copy public preview link')}
                        </button>
                        <button type="button" class="scc-ico library-download-btn" data-project-id="${pid}" aria-label="Download">
                            ${iconDl()}${tip('Save this clip')}
                        </button>
                        <button type="button" class="scc-ico library-delete-btn" data-item-id="${itemId}" data-project-id="${pid}" aria-label="Delete">
                            ${iconTrash()}${tip('Delete')}
                        </button>
                    </div>
                </div>
                <h2 class="card-title scc-title" title="${name}">${name}</h2>
            </div>`;
    }

    function railHTML(item) {
        const v = viralityOf(item);
        if (!v) return '';
        const grades = gradeRows(v);
        const fixTip = v.fix
            ? `<div class="scc-why pv-fix-tip"><p>${esc(v.fix)}</p></div>`
            : '';
        return `<div class="pv-card">
            <div class="pv-head">
                <div class="pv-score-line">
                    <b class="pv-score-num">${esc(String(v.score100))}</b><span class="pv-score-max">/100</span> <span class="pv-res-badge">${esc(item.resolution || item.video_quality || '')}</span>
                </div>
                ${fixTip}
            </div>
            <div class="pv-grades">${grades}</div>
        </div>`;
    }

    function bindRail(rail) {
        if (!rail) return;
        const grades = Array.from(rail.querySelectorAll('.pv-grade'));
        const head = rail.querySelector('.pv-head');
        const clearTips = () => {
            grades.forEach((g) => g.classList.remove('is-tip'));
            head?.classList.remove('is-tip');
        };
        grades.forEach((row) => {
            const tip = row.querySelector('.scc-why');
            if (!tip) return;
            row.addEventListener('mouseenter', () => {
                clearTips();
                row.classList.add('is-tip');
            });
            row.addEventListener('mouseleave', () => {
                row.classList.remove('is-tip');
            });
        });
        if (head && head.querySelector('.pv-fix-tip')) {
            head.addEventListener('mouseenter', () => {
                clearTips();
                head.classList.add('is-tip');
            });
            head.addEventListener('mouseleave', () => {
                head.classList.remove('is-tip');
            });
        }
    }

    function bind(card, item, studio) {
        if (!card || card.dataset.sccBound === '1') return;
        card.dataset.sccBound = '1';
        const pid = item.projectId || item.id;
        const preview = card.querySelector('.scc-preview');
        const poster = card.querySelector('.scc-poster');
        const video = card.querySelector('.scc-video');
        const bar = card.querySelector('.scc-bar > i');
        const t0 = card.querySelector('.scc-t0');
        const t1 = card.querySelector('.scc-t1');
        let blobUrl = '';

        const showPoster = () => {
            preview?.classList.add('has-poster');
            preview?.classList.remove('has-video-playing');
        };

        if (poster) {
            const purl = posterUrl(item);
            if (purl) {
                poster.src = purl;
                poster.addEventListener('load', showPoster, { once: true });
                poster.addEventListener('error', () => {
                    poster.removeAttribute('src');
                }, { once: true });
            }
        }

        const tick = () => {
            if (!video) return;
            const d = video.duration;
            const c = video.currentTime || 0;
            if (t0) t0.textContent = formatClock(c);
            if (Number.isFinite(d) && d > 0) {
                if (t1) t1.textContent = formatClock(d);
                if (bar) bar.style.width = `${Math.min(100, (c / d) * 100)}%`;
            }
        };

        const hasFrame = () => video && video.videoWidth > 0 && video.videoHeight > 0;

        const showFrame = () => {
            if (!hasFrame()) return;
            preview?.classList.add('has-clip', 'has-video-playing');
            tick();
        };

        const paintStill = () => {
            if (!video) return;
            const t = video.currentTime > 0.05 ? video.currentTime : 0.08;
            const afterSeek = () => {
                showFrame();
                if (!preview?.matches(':hover')) {
                    try { video.pause(); } catch (_) {}
                }
            };
            try {
                video.currentTime = t;
            } catch (_) { /* ignore */ }
            video.addEventListener('seeked', afterSeek, { once: true });
            video.play().then(() => {
                showFrame();
                if (!preview?.matches(':hover')) {
                    video.pause();
                    showFrame();
                }
            }).catch(() => showFrame());
        };

        const playClip = () => {
            if (!video) return;
            video.muted = true;
            if (_playing && _playing !== video) {
                try { _playing.pause(); } catch (_) {}
            }
            _playing = video;
            video.play().then(showFrame).catch(() => {});
        };

        const attachSrc = (url) => {
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.preload = 'auto';
            video.src = url;
            try { video.load(); } catch (_) {}
        };

        const bindReady = (onReady) => {
            video.addEventListener('loadeddata', onReady);
            video.addEventListener('canplay', onReady);
            video.addEventListener('loadedmetadata', onReady);
        };

        const ensureSrc = () => {
            if (!video || video.dataset.srcReady === '1' || video.dataset.srcFailed === '1') return;
            video.dataset.srcReady = '1';
            const url = previewUrl(pid);
            enqueueLoad(() => new Promise((resolve) => {
                if (!video.isConnected) {
                    video.dataset.srcReady = '';
                    resolve();
                    return;
                }
                let done = false;
                const finish = () => { if (!done) { done = true; resolve(); } };
                const onReady = () => {
                    if (!hasFrame()) return;
                    paintStill();
                    finish();
                };
                bindReady(onReady);
                video.addEventListener('error', () => {
                    video.dataset.srcFailed = '1';
                    finish();
                }, { once: true });
                attachSrc(url);
                setTimeout(finish, 8000);
            }));
        };

        video?.addEventListener('timeupdate', tick);
        video?.addEventListener('loadedmetadata', tick);
        video?.addEventListener('pause', () => {
            if (_playing === video) _playing = null;
        });

        // Do NOT auto-fetch /clips/preview when the card scrolls into view —
        // only load on hover (or when the full preview modal opens).
        preview?.addEventListener('mouseenter', () => {
            ensureSrc();
            if (video && video.paused) playClip();
        });
        preview?.addEventListener('mouseleave', () => {
            if (video) {
                video.pause();
                preview?.classList.remove('has-video-playing');
                showPoster();
            }
        });

        card.addEventListener('click', (e) => {
            const resPill = e.target.closest('.scc-res-pill');
            if (resPill) {
                e.preventDefault(); e.stopPropagation();
                if (resPill.classList.contains('locked')) {
                    if (typeof window.openPlanSelector === 'function') window.openPlanSelector();
                    else if (typeof window.showUpgradeModal === 'function') window.showUpgradeModal();
                    return;
                }
                const wrap = resPill.closest('.scc-res-wrap');
                const newRes = resPill.dataset.res;
                wrap.dataset.res = newRes;
                wrap.querySelectorAll('.scc-res-pill').forEach(o => o.classList.toggle('active', o.dataset.res === newRes));
                item.resolution = newRes;
                const projId = wrap.dataset.projectId;
                if (projId) {
                    fetch('/api/clips/' + encodeURIComponent(projId) + '/resolution', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ resolution: newRes })
                    }).catch(() => {});
                }
                return;
            }
            if (e.target.closest('.scc-res-wrap')) return;
            if (e.target.closest('.library-download-btn, .library-delete-btn, .library-share-btn, .scc-ico, .scc-delete-confirm')) return;
            if (studio && studio.librarySelectMode) {
                // Select mode is handled by libraryGrid capture listener — don't open preview
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            if (video && !video.paused) try { video.pause(); } catch (_) {}
            const cid = item.id || pid;
            if (studio && typeof studio.openLibraryPreview === 'function' && cid) {
                studio.openLibraryPreview(cid, pid, card);
            }
        });
    }

    function setDuration(card, formatted) {
        const clock = formatClock(formatted);
        const el = card && card.querySelector('.scc-t1');
        if (el) el.textContent = clock;
    }

    window.SolisClipCard = {
        buildHTML,
        bind,
        bindRail,
        formatClock,
        viralityOf,
        railHTML,
        setDuration,
    };
})();
