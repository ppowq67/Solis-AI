// Portal Manager - Handles Portal Statistics and UI

class PortalManager {
    constructor() {
        this.initialized = false;
        this.memberCount = 0;
        this.partnerCount = 0;
        this.scheduledCount = 0;
        this.activity = null;
        this.initElements();
    }

    initElements() {
        this.membersValue = document.querySelector('[data-stat="members"] .portal-stat-value');
        this.partnersValue = document.querySelector('[data-stat="partners"] .portal-stat-value');
        this.scheduledValue = document.querySelector('[data-stat="scheduled"] .portal-stat-value');
        this.timeSavedValue = document.getElementById('timeSavedValue');
        this.viralScoreValue = document.getElementById('viralScoreValue');

        this.clipsMonthElement = document.querySelector('[data-activity="clips-month"]');
        this.avgScoreElement = document.querySelector('[data-activity="avg-score"]');
        this.totalExportsElement = document.querySelector('[data-activity="total-exports"]');
        this.hoursSavedElement = document.querySelector('[data-activity="hours-saved"]');
    }

    _apiBase() {
        return (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '/api';
    }

    async loadPortalStats() {
        this.memberCount = 0;
        this.partnerCount = 0;
        this.scheduledCount = 0;
        await this.loadActivityStats();
        this.updateUI();
    }

    async loadActivityStats() {
        try {
            const headers = (typeof getAuthHeaders === 'function') ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const response = await fetch(`${this._apiBase()}/portal/activity`, {
                method: 'GET',
                credentials: 'include',
                headers,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.success && data.activity) {
                this.activity = data.activity;
                return;
            }
        } catch (error) {
            console.warn('Portal activity API unavailable, using library fallback:', error);
        }
        this.activity = this.computeActivityFromLibrary();
    }

    /** Client-side fallback from clipsStudio.libraryItems timestamps only. */
    computeActivityFromLibrary() {
        const items = Array.isArray(window.clipsStudio?.libraryItems) ? window.clipsStudio.libraryItems : [];
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekStart = new Date(now);
        weekStart.setHours(0, 0, 0, 0);
        const mondayOffset = (weekStart.getDay() + 6) % 7; // Monday-start week
        weekStart.setDate(weekStart.getDate() - mondayOffset);
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        dayStart.setDate(dayStart.getDate() - 6);

        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        let clipsMonth = 0;
        let clipsWeek = 0;
        let gens24h = 0;
        const dayMs = 24 * 60 * 60 * 1000;

        items.forEach((item) => {
            const ts = item.timestamp ? new Date(item.timestamp) : null;
            if (!ts || Number.isNaN(ts.getTime())) return;
            if (ts >= monthStart) clipsMonth += 1;
            if (ts >= weekStart) clipsWeek += 1;
            if ((now - ts) <= dayMs) gens24h += 1;
            if (ts >= dayStart) {
                const idx = Math.floor((ts - dayStart) / dayMs);
                if (idx >= 0 && idx < 7) dayCounts[idx] += 1;
            }
        });

        return {
            clips_total: items.length,
            clips_month: clipsMonth,
            clips_week: clipsWeek,
            gens_24h: gens24h,
            avg_score: null,
            scored_clips: 0,
            output_seconds: 0,
            day_counts: dayCounts,
        };
    }

    updateUI() {
        if (this.membersValue) this.membersValue.textContent = this.memberCount;
        if (this.partnersValue) this.partnersValue.textContent = this.partnerCount;
        if (this.scheduledValue) this.scheduledValue.textContent = this.scheduledCount;

        const activity = this.activity || this.computeActivityFromLibrary();
        const clipsTotal = activity.clips_total || 0;

        if (this.timeSavedValue) {
            const mins = Math.round((activity.output_seconds || 0) / 60);
            this.timeSavedValue.textContent = mins > 0 ? `${mins}m` : `${clipsTotal}`;
        }

        if (this.viralScoreValue) {
            this.viralScoreValue.textContent = activity.avg_score != null ? activity.avg_score : '—';
        }

        this.updateActivityStats(activity);
    }

    updateActivityStats(activity) {
        activity = activity || this.activity || this.computeActivityFromLibrary();
        const dayCounts = Array.isArray(activity.day_counts) ? activity.day_counts : [0, 0, 0, 0, 0, 0, 0];
        const week = activity.clips_week || 0;
        const month = activity.clips_month || 0;
        const total = activity.clips_total || 0;
        const gens = activity.gens_24h || 0;
        const avgScore = activity.avg_score;

        if (this.clipsMonthElement) {
            const clipValue = this.clipsMonthElement.querySelector('.activity-val');
            const clipChange = this.clipsMonthElement.querySelector('[data-change], .activity-change');
            if (clipValue) clipValue.textContent = String(month);
            if (clipChange) clipChange.textContent = `+${week} this week`;
            this.updateSparkline(this.clipsMonthElement, dayCounts);
        }

        if (this.avgScoreElement) {
            const scoreValue = this.avgScoreElement.querySelector('.activity-val');
            const scoreChange = this.avgScoreElement.querySelector('[data-change], .activity-change');
            if (avgScore != null) {
                if (scoreValue) scoreValue.textContent = String(avgScore);
                if (scoreChange) {
                    if (avgScore >= 80) scoreChange.textContent = 'Strong';
                    else if (avgScore >= 60) scoreChange.textContent = 'Solid';
                    else scoreChange.textContent = 'Building';
                }
                this.updateScoreRing(this.avgScoreElement, avgScore);
            } else {
                if (scoreValue) scoreValue.textContent = '—';
                if (scoreChange) scoreChange.textContent = total ? 'No scores yet' : 'No clips yet';
                this.updateScoreRing(this.avgScoreElement, 0);
            }
        }

        if (this.totalExportsElement) {
            const exportValue = this.totalExportsElement.querySelector('.activity-val');
            const exportChange = this.totalExportsElement.querySelector('[data-change], .activity-change');
            if (exportValue) exportValue.textContent = String(total);
            if (exportChange) exportChange.textContent = 'Completed';
            this.updateBars(this.totalExportsElement, dayCounts);
        }

        if (this.hoursSavedElement) {
            const hoursValue = this.hoursSavedElement.querySelector('.activity-val');
            const hoursChange = this.hoursSavedElement.querySelector('[data-change], .activity-change');
            const outSec = Number(activity.output_seconds) || 0;
            if (outSec > 0) {
                const hours = outSec / 3600;
                const label = hours >= 1 ? `${hours.toFixed(hours >= 10 ? 0 : 1)}h` : `${Math.round(outSec / 60)}m`;
                if (hoursValue) hoursValue.textContent = label;
                if (hoursChange) hoursChange.textContent = 'Output length';
                this.updateSparkline(this.hoursSavedElement, dayCounts);
            } else {
                if (hoursValue) hoursValue.textContent = String(gens);
                if (hoursChange) hoursChange.textContent = 'Last 24h';
                this.updateSparkline(this.hoursSavedElement, dayCounts);
            }
        }
    }

    updateSparkline(card, series) {
        if (!card || !series?.length) return;
        const line = card.querySelector('.activity-chart-line');
        const area = card.querySelector('.activity-chart-area');
        if (!line || !area) return;

        const w = 160;
        const h = 48;
        const pad = 4;
        const max = Math.max(...series, 1);
        const step = w / Math.max(series.length - 1, 1);
        const coords = series.map((v, i) => {
            const x = i * step;
            const y = pad + (1 - (Number(v) || 0) / max) * (h - pad * 2);
            return [x, y];
        });

        const lineD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const areaD = `${lineD} L${w},${h} L0,${h} Z`;
        line.setAttribute('d', lineD);
        area.setAttribute('d', areaD);
    }

    updateScoreRing(card, score) {
        const pct = Math.max(0, Math.min(100, Number(score) || 0));
        const meter = card?.querySelector('.activity-meter-fill');
        if (meter) {
            meter.style.width = `${pct}%`;
            return;
        }
        const ring = card?.querySelector('.activity-ring-fill');
        if (!ring) return;
        if (ring.tagName === 'circle' || ring.getAttribute('pathLength')) {
            ring.setAttribute('stroke-dasharray', `${pct} 100`);
        } else {
            ring.style.width = `${pct}%`;
        }
    }

    updateBars(card, series) {
        const bars = card?.querySelectorAll('[data-bars] span');
        if (!bars?.length || !series?.length) return;
        const max = Math.max(...series, 1);
        bars.forEach((bar, i) => {
            const v = series[i % series.length];
            const pct = max <= 0 ? 12 : Math.max(10, Math.round(((Number(v) || 0) / max) * 100));
            bar.style.setProperty('--h', `${pct}%`);
        });
    }

    async init() {
        if (this.initialized) return;
        this.initElements();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.loadPortalStats());
        } else {
            await this.loadPortalStats();
        }

        this.initialized = true;
    }

    async refresh() {
        await this.loadActivityStats();
        this.updateUI();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.portalManager = new PortalManager();
    window.portalManager.init();
});

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    window.portalManager = new PortalManager();
    window.portalManager.init();
}
