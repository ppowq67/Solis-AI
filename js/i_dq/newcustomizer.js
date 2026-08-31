// ─── Customizer Pro - Modern Typography & Appearance Editor ─────────────────
// Complete rewrite based on newcustomizer.html
// SECURITY: XSS Prevention enabled - all user inputs validated and sanitized

class CustomizerPro {
    constructor() {
        this.currentElement = null;
        this.elementOriginalFont = null;
        this.elementOriginalShadow = null;  // Store original shadow to preserve it
        this.state = {
            font: "'Luckiest Guy', cursive",
            textColor: '#1d1d1f',
            textBg: 'transparent',
            textBgBlur: false,
            textBgBlurStrength: 6,
            weight: 400,
            size: 40,
            spacing: 0,
            radius: 20,
            padding: 4,
            // Text shadow - preset styles
            textShadow: 'none',
            textShadowSpread: 0  // 0-10px spread control for shadow thickness
        };
        this.userSetTextColor = false;
        this.scrubbers = {};
        
        // Whitelisted fonts - only these can be applied
        this.ALLOWED_FONTS = [
            // Display Fonts
            "'Luckiest Guy', cursive",
            "'Playfair Display', serif",
            "'Fraunces', serif",
            "'Syne', sans-serif",
            // Modern Sans-Serif
            "'Plus Jakarta Sans', sans-serif",
            "'Space Grotesk', sans-serif",
            "'Bricolage Grotesque', sans-serif",
            "'Outfit', sans-serif",
            "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            // Additional Display
            "'DM Serif Display', serif",
            "'Abril Fatface', serif",
            "'Bebas Neue', sans-serif",
            // Additional Modern
            "'Urbanist', sans-serif",
            "'Poppins', sans-serif",
            "'Manrope', sans-serif",
            "'Raleway', sans-serif",
            "'Montserrat', sans-serif",
            "'Quicksand', sans-serif",
            // Monospace
            "'Courier New', monospace",
            "'JetBrains Mono', monospace"
        ];
        
        // Whitelisted colors - only hex colors or transparent
        this.ALLOWED_COLORS = [
            '#1d1d1f', '#007AFF', '#FF2D55', '#AF52DE', '#FF9500', '#34C759',
            '#5856D6', '#FF3B30', '#000000', '#FFFFFF'
        ];
        
        this.init();
    }
    
    // ─── Input Validation & Sanitization ───────────────────────────────────
    
    /**
     * Normalize colors to a comparable format (converts rgb/rgba to hex)
     * Handles rgb(), rgba(), hex, and transparent formats
     */
    normalizeColor(color) {
        if (!color) return 'transparent';
        color = color.trim();
        
        // Already hex or transparent
        if (color.startsWith('#') || color === 'transparent') {
            return color.toLowerCase();
        }
        
        // Parse rgb() or rgba() format
        const rgbMatch = color.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
            const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
            const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`.toLowerCase();
        }
        
        return color.toLowerCase();
    }

    /**
     * Validate and sanitize hex color input
     * Returns color if valid, fallback otherwise
     */
    validateColor(color, fallback = '#1d1d1f') {
        if (typeof color !== 'string') return fallback;
        color = color.trim();
        
        // Check for transparent keyword
        if (color === 'transparent') return 'transparent';
        
        // Validate hex color format (#RRGGBB or #RGB)
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
            return color.toLowerCase();
        }
        
        // Validate rgb format (without alpha) - handles computed styles from getComputedStyle()
        if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)) {
            return color;  // Return rgb format as-is
        }
        
        // Validate rgba format (with alpha)
        if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/.test(color)) {
            return color;
        }
        
        console.warn(`[XSS Prevention] Invalid color rejected: ${color}`);
        return fallback;
    }
    
    /**
     * Validate numeric input (weight, size, spacing, radius, padding, blur)
     */
    validateNumber(value, min = 0, max = 999, fallback = 0) {
        const num = parseInt(value, 10);
        if (isNaN(num)) {
            console.warn(`[XSS Prevention] Invalid number rejected: ${value}`);
            return fallback;
        }
        return Math.max(min, Math.min(max, num));
    }
    
    /**
     * Validate font family - must be in whitelist
     */
    validateFont(fontFamily, fallback = "'Plus Jakarta Sans', sans-serif") {
        if (typeof fontFamily !== 'string') return fallback;
        if (this.ALLOWED_FONTS.includes(fontFamily)) {
            return fontFamily;
        }
        console.warn(`[XSS Prevention] Font not in whitelist: ${fontFamily}`);
        return fallback;
    }
    
    /**
     * Sanitize text for safe display (removes HTML)
     */
    sanitizeText(text) {
        if (typeof text !== 'string') return '';
        // Create a div to escape HTML entities
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML; // This escapes the text
    }

    init() {
        this.ensureDOM();
        this.setupPanel();
        this.repositionPanel();
        this.setupScrubbers();
        this.setupFonts();
        this.setupColors();
        this.setupPresets();
        this.setupNavigation();
        this.attachDoubleClickListeners();
    }

    attachDoubleClickListeners() {
        // Hide panel by default
        if (this.panel) {
            this.panel.classList.remove('active');
            this.navBtns.forEach(b => b.classList.remove('active'));
        }
        
        // Don't attach any double-click listeners - ranking template editor handles selection via click only
    }

    closeCustomizer() {
        // 🎯 Close the customizer panel smoothly
        try {
            if (this.panel) {
                this.panel.classList.add('customizer-animate-close');
                
                this.closeTimeout = setTimeout(() => {
                    try {
                        this.panel.classList.remove('customizer-animate-close');
                        this.panel.classList.remove('active');
                        this.navBtns.forEach(b => b.classList.remove('active'));
                        if (this.uiSystem) this.uiSystem.style.display = 'none';
                        this.isAnimating = false;
                    } catch (error) {
                        console.warn('[CustomizerPro] Error closing:', error);
                        this.isAnimating = false;
                    }
                }, 350);
            }
        } catch (error) {
            console.warn('[CustomizerPro] Close error:', error);
        }
    }

    selectElement(el) {
        if (this.currentElement) {
            this.currentElement.style.outline = '';
            this.currentElement.style.outlineOffset = '';
            this.currentElement.style.userSelect = '';  // Re-enable selection on old element
        }
        this.currentElement = el;
        this.currentElement.style.outline = '2px solid #ff6b35';
        this.currentElement.style.outlineOffset = '2px';
        this.currentElement.style.userSelect = 'none';  // Prevent text selection while editing
        
        // Store the element's original font family so it's never lost
        const cs = window.getComputedStyle(this.currentElement);
        const fontFromElement = cs.fontFamily || this.state.font;
        this.elementOriginalFont = fontFromElement;
        
        // 🎨 Store the element's original text-shadow so it's preserved
        const shadowFromElement = cs.textShadow;
        if (shadowFromElement && shadowFromElement !== 'none') {
            this.elementOriginalShadow = shadowFromElement;
        } else {
            this.elementOriginalShadow = null;
        }
        
        // Try to match the element's font to our whitelist, otherwise keep current state.font
        if (this.ALLOWED_FONTS.some(f => fontFromElement.includes(f.replace(/['"]/g, '').split(',')[0]))) {
            // Element has one of our whitelisted fonts, use it
            const fontName = fontFromElement.split(',')[0].trim().replace(/['"]/g, '');
            const matchedFont = this.ALLOWED_FONTS.find(f => f.includes(fontName));
            if (matchedFont) {
                this.state.font = matchedFont;
            }
        }
        // If font doesn't match whitelist, state.font stays as is (from UI selection)
        
        this.clearEmptyState();
        this.syncStateFromElement();
        
        // 🎯 Reposition customizer near the selected element
        this.positionNearElement();
    }

    deselectElement() {
        if (this.currentElement) {
            this.currentElement.style.outline = '';
            this.currentElement.style.outlineOffset = '';
            this.currentElement.style.userSelect = '';  // Restore selection ability
        }
        this.currentElement = null;
        if (this.panel) {
            this.panel.classList.remove('active');
            this.navBtns.forEach(b => b.classList.remove('active'));
        }
        // Force cleanup of animation states
        if (this.closeTimeout) clearTimeout(this.closeTimeout);
        if (this.expandTimeout) clearTimeout(this.expandTimeout);
        this.isAnimating = false;
    }

    syncStateFromElement() {
        if (!this.currentElement) return;
        
        try {
            const cs = window.getComputedStyle(this.currentElement);
            
            // Don't sync font - keep the current state.font (default is "Luckiest Guy")
            // Fonts from computed styles may be in different formats and cause issues
            
            // Normalize color from element to hex format for consistent state
            this.state.textColor = this.normalizeColor(cs.color || this.state.textColor);
            this.state.weight = this.validateNumber(parseInt(cs.fontWeight) || 400, 100, 900, 400);
            this.state.size = this.validateNumber(parseInt(cs.fontSize) || 16, 8, 200, 40);
            this.state.spacing = this.validateNumber(parseInt(cs.letterSpacing) || 0, -50, 50, 0);
            
            // Use the stored original shadow, don't try to sync it
            // (It's already been captured in selectElement())
            if (this.elementOriginalShadow) {
                this.state.textShadow = this.elementOriginalShadow;
            }
            
            // Update UI to reflect element styles
            this.updateFontUI();
            this.updateColorUI();
            this.updateScrubberUI();
        } catch (error) {
            console.warn('[CustomizerPro] Error syncing state:', error);
        }
    }

    updateFontUI() {
        const items = document.querySelectorAll('.customizer-font-item');
        items.forEach(item => item.classList.remove('customizer-active'));
        // Find and highlight matching font
        const fontFamily = this.state.font.replace(/['"]/g, '').split(',')[0].trim();
        items.forEach(item => {
            if (item.textContent.toLowerCase().includes(fontFamily.toLowerCase())) {
                item.classList.add('customizer-active');
            }
        });
    }

    updateColorUI() {
        const dots = document.querySelectorAll('.customizer-color-dot');
        dots.forEach(dot => dot.classList.remove('customizer-active'));
        
        // If multiple colors are selected (mixed), don't highlight any
        if (this.mixedProperties?.textColor) {
            // Multi-select mode with mixed colors - show no highlight
            return;
        }
        
        // Find and highlight matching color (normalize both formats for comparison)
        const normalizedStateColor = this.normalizeColor(this.state.textColor);
        dots.forEach(dot => {
            const dotColor = window.getComputedStyle(dot).backgroundColor;
            const normalizedDotColor = this.normalizeColor(dotColor);
            if (normalizedDotColor === normalizedStateColor) {
                dot.classList.add('customizer-active');
            }
        });
    }

    updateScrubberUI() {
        // Update scrubber positions based on current element
        if (this.scrubbers.weight) {
            const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
            const idx = WEIGHTS.indexOf(this.state.weight);
            if (idx >= 0) this.scrubbers.weight.setIndex(idx);
        }
    }

    ensureDOM() {
        // Check if customizer UI already exists
        if (document.getElementById('customizer-ui-system')) return;

        // Add Google Fonts link to head
        if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
            const fontsLink = document.createElement('link');
            fontsLink.href = 'https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Plus+Jakarta+Sans:wght@200..800&family=Space+Grotesk:wght@300..700&family=Inter:wght@100..900&family=Playfair+Display:wght@400..900&family=Fraunces:wght@100..900&family=Syne:wght@400..800&family=Bricolage+Grotesque:wght@200..800&family=Outfit:wght@100..900&family=Montserrat:wght@100..900&family=DM+Serif+Display&family=Abril+Fatface&family=Bebas+Neue&family=Urbanist:wght@400..700&family=Poppins:wght@400..700&family=Manrope:wght@400..700&family=Raleway:wght@400..700&family=Quicksand:wght@400..700&display=swap';
            fontsLink.rel = 'stylesheet';
            document.head.appendChild(fontsLink);
        }

        // Create customizer UI container
        const uiSystem = document.createElement('div');
        uiSystem.id = 'customizer-ui-system';
        uiSystem.style.display = 'none'; // Hidden by default
        uiSystem.innerHTML = `
            <div class="customizer-panel-container" id="customizer-panel">
                <header class="customizer-panel-header">
                    <h3 id="customizer-panel-title">Typography</h3>
                </header>
                <div class="customizer-panel-content">
                    <!-- Typography View -->
                    <div id="customizer-view-font" class="customizer-view active">
                        <div class="customizer-font-list" id="customizer-font-list"></div>
                        <div id="customizer-scrubber-weight"></div>
                        <div id="customizer-scrubber-size"></div>
                        <div id="customizer-scrubber-spacing"></div>
                        <div id="customizer-scrubber-shadow-spread"></div>
                    </div>
                    <!-- Appearance View -->
                    <div id="customizer-view-color" class="customizer-view">
                        <div class="customizer-palette-title">Text Color</div>
                        <div class="customizer-color-grid" id="customizer-text-colors"></div>
                        <div class="customizer-palette-title">Text Background</div>
                        <div class="customizer-color-grid" id="customizer-text-bg-colors"></div>
                        <div id="customizer-scrubber-radius"></div>
                        <div id="customizer-scrubber-padding"></div>
                        <div id="customizer-scrubber-blur-wrap" style="display:none;"></div>
                    </div>
                    <!-- Style Presets View -->
                    <div id="customizer-view-presets" class="customizer-view">
                        <div class="customizer-presets-grid" id="customizer-presets-grid"></div>
                    </div>
                </div>
            </div>

            <nav class="customizer-dock">
                <button class="customizer-nav-btn" data-view="font" data-title="Typography">
                    <svg viewBox="0 0 24 24"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
                </button>
                <button class="customizer-nav-btn" data-view="color" data-title="Appearance">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12c0-2 2-3.5 4-3.5"/></svg>
                </button>
                <button class="customizer-nav-btn" data-view="presets" data-title="Presets">
                    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
            </nav>
        `;
        document.body.appendChild(uiSystem);
    }

    setupPanel() {
        this.panel = document.getElementById('customizer-panel');
        this.titleEl = document.getElementById('customizer-panel-title');
        this.navBtns = document.querySelectorAll('.customizer-nav-btn');
        this.views = document.querySelectorAll('.customizer-view');
        this.uiSystem = document.getElementById('customizer-ui-system');

        this.closeTimeout = null;
        this.expandTimeout = null;
        this.isAnimating = false;
        
        // Reposition when window resizes or element is selected
        window.addEventListener('resize', () => this.positionNearElement());

        this.navBtns.forEach(btn => {
            btn.onclick = () => {
                // Prevent rapid successive clicks while animating
                if (this.isAnimating) return;
                this.toggleView(btn);
            };
        });
    }

    positionNearElement() {
        /**
         * 🎯 Position customizer near the selected element
         * Appears above/below/side based on available space
         */
        if (!this.currentElement || !this.panel || !this.uiSystem) return;
        
        const rect = this.currentElement.getBoundingClientRect();
        const panelWidth = 360;
        const panelHeight = 380;
        const dockHeight = 60;
        const gap = 12;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let top, left;
        
        // Try to position panel to the right of the element
        if (rect.right + gap + panelWidth < viewportWidth) {
            left = rect.right + gap;
        }
        // Otherwise position to the left
        else if (rect.left - gap - panelWidth > 0) {
            left = rect.left - gap - panelWidth;
        }
        // Center horizontally if not enough space
        else {
            left = (viewportWidth - panelWidth) / 2;
        }
        
        // Try to position panel above the element
        if (rect.top - gap - panelHeight > 0) {
            top = rect.top - gap - panelHeight;
        }
        // Otherwise position below
        else if (rect.bottom + gap + panelHeight < viewportHeight) {
            top = rect.bottom + gap;
        }
        // Center vertically if not enough space
        else {
            top = (viewportHeight - panelHeight) / 2;
        }
        
        // Clamp to viewport bounds
        left = Math.max(12, Math.min(left, viewportWidth - panelWidth - 12));
        top = Math.max(12, Math.min(top, viewportHeight - panelHeight - dockHeight - 12));
        
        // Apply positioning with !important to override CSS
        this.panel.style.cssText = `
            position: fixed !important;
            left: ${left}px !important;
            top: ${top}px !important;
            bottom: auto !important;
            right: auto !important;
            transform: none !important;
        `;
        
        // Position dock near panel (follow the panel)
        const dock = document.querySelector('.customizer-dock');
        if (dock) {
            dock.style.cssText = `
                position: fixed !important;
                left: ${left}px !important;
                top: ${top + panelHeight + gap}px !important;
                bottom: auto !important;
                right: auto !important;
                transform: none !important;
            `;
        }
    }

    repositionPanel() {
        // Alias for compatibility
        this.positionNearElement();
    }

    toggleView(btn) {
        const target = btn.dataset.view;
        const title = btn.dataset.title;

        // Clear any empty state
        this.clearEmptyState();

        // Clean up existing timeouts to prevent animation stacking
        if (this.closeTimeout) clearTimeout(this.closeTimeout);
        if (this.expandTimeout) clearTimeout(this.expandTimeout);

        if (btn.classList.contains('active')) {
            // Close panel with smooth animation
            if (this.isAnimating) return; // Prevent double-click issues
            this.isAnimating = true;
            this.panel.classList.remove('customizer-animate-expand');
            void this.panel.offsetWidth; // Trigger reflow
            this.panel.classList.add('customizer-animate-close');
            
            this.closeTimeout = setTimeout(() => {
                try {
                    this.panel.classList.remove('customizer-animate-close');
                    this.panel.classList.remove('active');
                    btn.classList.remove('active');
                    this.navBtns.forEach(b => b.classList.remove('active'));
                    this.uiSystem.style.display = 'none';
                    this.isAnimating = false;
                } catch (error) {
                    console.warn('[CustomizerPro] Error closing panel:', error);
                    this.isAnimating = false;
                }
            }, 350);
        } else {
            // Open panel
            if (this.isAnimating) return; // Prevent double-click issues
            this.isAnimating = true;
            
            try {
                this.uiSystem.style.display = 'block';
                
                // 🎯 Reposition near element before showing
                this.positionNearElement();
                
                this.navBtns.forEach(b => b.classList.remove('active'));
                this.views.forEach(v => v.classList.remove('active'));
                btn.classList.add('active');
                this.titleEl.innerText = title;
                
                const viewEl = document.getElementById(`customizer-view-${target}`);
                if (viewEl) viewEl.classList.add('active');
                
                this.panel.classList.remove('customizer-animate-expand');
                void this.panel.offsetWidth; // Trigger reflow
                this.panel.classList.add('active', 'customizer-animate-expand');
                
                this.expandTimeout = setTimeout(() => {
                    try {
                        this.panel.classList.remove('customizer-animate-expand');
                        this.isAnimating = false;
                    } catch (error) {
                        console.warn('[CustomizerPro] Error completing expand:', error);
                        this.isAnimating = false;
                    }
                }, 450);
            } catch (error) {
                console.warn('[CustomizerPro] Error opening panel:', error);
                this.isAnimating = false;
            }
        }
    }



    clearEmptyState() {
        const panel = document.getElementById('customizer-panel');
        if (!panel) return;
        
        const message = panel.querySelector('.customizer-empty-state');
        
        // Remove message if exists
        if (message) {
            message.remove();
        }
    }

    setupScrubbers() {
        const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const SIZES = [12, 16, 20, 24, 28, 32, 36, 40];  // Limited to 40px max for readability
        const SPACINGS = [-20, -15, -10, -5, 0, 5, 10, 15, 20];  // 5px increments for comfort
        const RADII = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];  // 5px increments for smooth control
        const PADDINGS = [0, 5, 10, 15, 20, 25, 30, 35, 40];  // 5px increments (removed micro-steps)
        const BLURS = [0, 5, 10, 15, 20, 25];  // 5px increments for smooth blur control

        this.scrubbers.weight = this.createScrubber({
            container: document.getElementById('customizer-scrubber-weight'),
            label: 'Weight',
            presets: WEIGHTS,
            defaultValue: 400,
            onChange: (v) => { this.state.weight = v; this.applyStyles(); }
        });

        this.scrubbers.size = this.createScrubber({
            container: document.getElementById('customizer-scrubber-size'),
            label: 'Size',
            presets: SIZES,
            defaultValue: 40,
            onChange: (v) => { this.state.size = v; this.applyStyles(); }
        });

        this.scrubbers.spacing = this.createScrubber({
            container: document.getElementById('customizer-scrubber-spacing'),
            label: 'Spacing',
            presets: SPACINGS,
            defaultValue: 0,
            onChange: (v) => { this.state.spacing = v; this.applyStyles(); }
        });

        this.scrubbers.radius = this.createScrubber({
            container: document.getElementById('customizer-scrubber-radius'),
            label: 'BG Corner Radius',
            presets: RADII,
            defaultValue: 20,
            onChange: (v) => { this.state.radius = v; this.applyStyles(); }
        });

        this.scrubbers.padding = this.createScrubber({
            container: document.getElementById('customizer-scrubber-padding'),
            label: 'BG Padding',
            presets: PADDINGS,
            defaultValue: 4,
            onChange: (v) => { this.state.padding = v; this.applyStyles(); }
        });

        // 🎨 NEW: Text Shadow Spread Control
        const SHADOW_SPREADS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        this.scrubbers.shadowSpread = this.createScrubber({
            container: document.getElementById('customizer-scrubber-shadow-spread'),
            label: 'Shadow Thickness',
            presets: SHADOW_SPREADS,
            defaultValue: 0,
            onChange: (v) => { this.state.textShadowSpread = v; this.applyStyles(); }
        });
    }

    createScrubber({ container, label, presets, defaultValue, onChange }) {
        const dotCount = presets.length;
        let activeIndex = presets.indexOf(defaultValue);
        if (activeIndex < 0) activeIndex = 0;

        let rawPct = (activeIndex / (dotCount - 1)) * 100;
        let lastRawPct = rawPct;
        let isDragging = false;
        let direction = 'right';
        let animVal = presets[activeIndex];

        const wrap = document.createElement('div');
        wrap.className = 'customizer-scrubber-block';
        wrap.style.userSelect = 'none';
        wrap.style.WebkitUserSelect = 'none';
        wrap.style.touchAction = 'none';
        
        // SECURITY: Use safe DOM creation instead of innerHTML
        const labelDiv = document.createElement('div');
        labelDiv.className = 'customizer-scrubber-label';
        labelDiv.style.userSelect = 'none';
        labelDiv.style.WebkitUserSelect = 'none';
        
        const labelSpan = document.createElement('span');
        labelSpan.className = 'customizer-lbl';
        labelSpan.textContent = label; // Safe - textContent, not innerHTML
        labelDiv.appendChild(labelSpan);
        
        const valSpan = document.createElement('span');
        valSpan.className = 'customizer-val';
        valSpan.id = `scrubber-val-${label.replace(/\s/g, '-')}`; // Sanitize ID
        labelDiv.appendChild(valSpan);
        
        const trackDiv = document.createElement('div');
        trackDiv.className = 'customizer-scrubber-track';
        
        const glowDiv = document.createElement('div');
        glowDiv.className = 'customizer-scrubber-glow';
        trackDiv.appendChild(glowDiv);
        
        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'customizer-scrubber-dots';
        trackDiv.appendChild(dotsDiv);
        
        const handleDiv = document.createElement('div');
        handleDiv.className = 'customizer-scrubber-handle';
        
        const gripDiv = document.createElement('div');
        gripDiv.className = 'customizer-s-grip';
        
        const gripBar1 = document.createElement('div');
        gripBar1.className = 'customizer-s-grip-bar';
        gripBar1.style.height = '10px';
        gripDiv.appendChild(gripBar1);
        
        const gripBar2 = document.createElement('div');
        gripBar2.className = 'customizer-s-grip-bar';
        gripBar2.style.height = '7px';
        gripDiv.appendChild(gripBar2);
        
        handleDiv.appendChild(gripDiv);
        trackDiv.appendChild(handleDiv);
        
        wrap.appendChild(labelDiv);
        wrap.appendChild(trackDiv);
        container.appendChild(wrap);

        const valEl = valSpan;
        const track = trackDiv;
        const glow = glowDiv;
        const dotsEl = dotsDiv;
        const handle = handleDiv;
        const grip = gripDiv;
        const bars = [gripBar1, gripBar2];

        presets.forEach((_, i) => {
            const d = document.createElement('div');
            d.className = 'customizer-s-dot';
            dotsEl.appendChild(d);
        });

        const updateUI = () => {
            const visualPct = isDragging ? rawPct : (activeIndex / (dotCount - 1)) * 100;
            handle.style.left = `${visualPct}%`;
            handle.style.transform = `translate(-${visualPct}%, -50%) scale(${isDragging ? 1.08 : 1})`;

            if (isDragging && visualPct > 2 && visualPct < 98) {
                handle.style.borderRadius = direction === 'right'
                    ? '10px 9999px 9999px 10px'
                    : '9999px 10px 10px 9999px';
            } else {
                handle.style.borderRadius = '9999px';
            }

            grip.style.flexDirection = direction === 'left' ? 'row-reverse' : 'row';
            bars[0].style.height = isDragging ? '20px' : '10px';
            bars[1].style.height = isDragging ? '13px' : '7px';

            glow.style.background = `radial-gradient(80% 120% at ${visualPct}%, rgba(0,0,0,0.05), transparent)`;

            presets.forEach((_, i) => {
                const dot = dotsEl.children[i];
                dot.classList.toggle('customizer-active', i <= activeIndex);
                dot.classList.toggle('customizer-current', i === activeIndex);
            });

            if (isDragging) {
                track.classList.add('customizer-active');
                handle.classList.add('customizer-dragging');
            } else {
                track.classList.remove('customizer-active');
                handle.classList.remove('customizer-dragging');
            }
        };

        const animateNum = () => {
            const target = presets[activeIndex];
            if (Math.abs(animVal - target) > 0.15) {
                animVal += (target - animVal) * 0.22;
                valEl.textContent = Math.round(animVal);
            } else {
                animVal = target;
                valEl.textContent = target;
            }
            requestAnimationFrame(animateNum);
        };

        const handleMove = (clientX) => {
            const rect = track.getBoundingClientRect();
            const pad = 20;
            let p = ((clientX - rect.left - pad) / (rect.width - pad * 2)) * 100;
            p = Math.max(0, Math.min(100, p));

            if (p > lastRawPct + 0.1) direction = 'right';
            else if (p < lastRawPct - 0.1) direction = 'left';
            lastRawPct = p;
            rawPct = p;

            const newIndex = Math.round((rawPct / 100) * (dotCount - 1));
            if (newIndex !== activeIndex) {
                activeIndex = newIndex;
                onChange(presets[activeIndex]);
            }
            updateUI();
        };

        // Prevent text selection while dragging
        track.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            handleMove(e.clientX);
        });
        window.addEventListener('mousemove', (e) => {
            if (isDragging) handleMove(e.clientX);
        });
        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                updateUI();
            }
        });

        track.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDragging = true;
            handleMove(e.touches[0].clientX);
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                handleMove(e.touches[0].clientX);
            }
        }, { passive: false });
        window.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                updateUI();
            }
        });

        updateUI();
        animateNum();

        return {
            getValue: () => presets[activeIndex],
            setIndex: (i) => {
                activeIndex = Math.max(0, Math.min(i, dotCount - 1));
                rawPct = (activeIndex / (dotCount - 1)) * 100;
                lastRawPct = rawPct;
                updateUI();
            }
        };
    }

    setupFonts() {
        // 🎨 Organized font list with categories for easy navigation
        const FONT_GROUPS = {
            'Display': [
                { name: 'Luckiest Guy', family: "'Luckiest Guy', cursive" },
                { name: 'Playfair Display', family: "'Playfair Display', serif" },
                { name: 'DM Serif Display', family: "'DM Serif Display', serif" },
                { name: 'Abril Fatface', family: "'Abril Fatface', serif" },
                { name: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
                { name: 'Fraunces', family: "'Fraunces', serif" },
                { name: 'Syne', family: "'Syne', sans-serif" }
            ],
            'Modern Sans': [
                { name: 'Plus Jakarta', family: "'Plus Jakarta Sans', sans-serif" },
                { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
                { name: 'Bricolage', family: "'Bricolage Grotesque', sans-serif" },
                { name: 'Outfit', family: "'Outfit', sans-serif" },
                { name: 'Urbanist', family: "'Urbanist', sans-serif" },
                { name: 'Poppins', family: "'Poppins', sans-serif" },
                { name: 'Manrope', family: "'Manrope', sans-serif" },
                { name: 'Raleway', family: "'Raleway', sans-serif" },
                { name: 'Quicksand', family: "'Quicksand', sans-serif" }
            ],
            'Minimal': [
                { name: 'Inter', family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
                { name: 'Montserrat', family: "'Montserrat', sans-serif" }
            ],
            'Monospace': [
                { name: 'Courier New', family: "'Courier New', monospace" },
                { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" }
            ]
        };

        const fontList = document.getElementById('customizer-font-list');
        
        // Create groups with headers
        Object.entries(FONT_GROUPS).forEach(([category, fonts]) => {
            // Category header
            const categoryHeader = document.createElement('div');
            categoryHeader.style.cssText = 'font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-top:12px;margin-bottom:6px;padding:0 8px;';
            categoryHeader.textContent = category;
            fontList.appendChild(categoryHeader);
            
            // Font items in group
            fonts.forEach(f => {
                const item = document.createElement('div');
                item.className = `customizer-font-item ${this.state.font === f.family ? 'customizer-active' : ''}`;
                item.style.userSelect = 'none';
                item.style.WebkitUserSelect = 'none';
                
                // SECURITY: Use textContent for safety, but apply font-family to show preview
                const span = document.createElement('span');
                span.textContent = f.name; // Safe - textContent, not innerHTML
                span.style.fontFamily = f.family; // Show font preview
                span.style.fontWeight = '600';
                span.style.fontSize = '16px';
                span.style.letterSpacing = '0.2px';
                item.appendChild(span);
                
                item.onclick = (e) => {
                    e.preventDefault();
                    // SECURITY: Validate font before applying
                    const validatedFont = this.validateFont(f.family);
                    this.state.font = validatedFont;
                    document.querySelectorAll('.customizer-font-item').forEach(i => i.classList.remove('customizer-active'));
                    item.classList.add('customizer-active');
                    this.applyStyles();
                    this.updateFontUI();
                };
                fontList.appendChild(item);
            });
        });
    }

    setupColors() {
        const TEXT_COLORS = [
            '#1d1d1f',   // Dark Gray
            '#FFFFFF',   // White
            '#007AFF',   // Blue
            '#FF9500'    // Orange
        ];
        
        const BG_COLORS = [
            '#FFFFFF',   // White
            '#000000',   // Black
            '#007AFF',   // Blue
            '#FF9500',   // Orange
            '#34C759',   // Green
            '#FF3B30'    // Red
        ];

        this.setupColorPalette('customizer-text-colors', 'textColor', TEXT_COLORS, false);
        this.setupColorPalette('customizer-text-bg-colors', 'textBg', BG_COLORS, true);
    }

    getColorName(hex) {
        const colorMap = {
            '#1d1d1f': 'Dark Gray',
            '#FFFFFF': 'White',
            '#000000': 'Black',
            '#007AFF': 'Blue',
            '#FF9500': 'Orange',
            '#34C759': 'Green',
            '#FF3B30': 'Red',
            '#FF2D55': 'Pink',
            '#AF52DE': 'Purple',
            '#5856D6': 'Purple',
        };
        return colorMap[hex.toUpperCase()] || 'Color';
    }

    setupColorPalette(containerId, property, palette, isBg) {
        const grid = document.getElementById(containerId);

        palette.forEach(color => {
            const dot = document.createElement('div');
            dot.className = 'customizer-color-dot';
            dot.style.background = color;
            dot.style.userSelect = 'none';
            dot.style.WebkitUserSelect = 'none';
            dot.title = this.getColorName(color);
            dot.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // SECURITY: Validate color before applying
                const validatedColor = this.validateColor(color);
                this.state[property] = validatedColor;
                if (property === 'textBg') {
                    this.state.textBgBlur = false;
                    this.hideBlurScrubber();
                }
                grid.querySelectorAll('.customizer-color-dot').forEach(d => d.classList.remove('customizer-active'));
                dot.classList.add('customizer-active');
                if (property === 'textColor') this.userSetTextColor = true;
                if (property === 'textBg') {
                    this.state.textBgBlur = false;
                    this.hideBlurScrubber();
                }
                this.applyStyles();
                this.updateColorUI();
            }, false);
            grid.appendChild(dot);
        });

        // Custom color picker for both text and background
        const custom = document.createElement('div');
        custom.className = 'customizer-color-dot';
        custom.style.cssText = 'background:linear-gradient(135deg,#ff6b3d 0%,#ff9500 50%,#ffd700 100%);display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;user-select:none;-webkit-user-select:none;border:2px solid rgba(255,255,255,0.3);';
        custom.title = 'Custom Color';
        
        // SECURITY: Use safe SVG creation
        const svgCustom = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgCustom.setAttribute('width', '16');
        svgCustom.setAttribute('height', '16');
        svgCustom.setAttribute('viewBox', '0 0 24 24');
        svgCustom.setAttribute('fill', 'none');
        svgCustom.setAttribute('stroke', 'white');
        svgCustom.setAttribute('stroke-width', '2.5');
        svgCustom.style.pointerEvents = 'none';
        
        // Plus symbol
        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', '12');
        line1.setAttribute('y1', '5');
        line1.setAttribute('x2', '12');
        line1.setAttribute('y2', '19');
        svgCustom.appendChild(line1);
        
        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', '5');
        line2.setAttribute('y1', '12');
        line2.setAttribute('x2', '19');
        line2.setAttribute('y2', '12');
        svgCustom.appendChild(line2);
        
        custom.appendChild(svgCustom);
        
        // Click handler - open color picker positioned at click location
        custom.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Create an input positioned at the click point (invisible but positioned)
            const tempInput = document.createElement('input');
            tempInput.type = 'color';
            tempInput.value = this.state[property] || '#ffffff';
            tempInput.style.position = 'fixed';
            tempInput.style.left = e.clientX + 'px';
            tempInput.style.top = e.clientY + 'px';
            tempInput.style.opacity = '0';
            tempInput.style.width = '0';
            tempInput.style.height = '0';
            tempInput.style.border = 'none';
            tempInput.style.padding = '0';
            tempInput.style.margin = '0';
            tempInput.style.pointerEvents = 'none';
            document.body.appendChild(tempInput);
            
            // Handle selection
            const handleChange = (ev) => {
                const validatedColor = this.validateColor(ev.target.value, '#ffffff');
                this.state[property] = validatedColor;
                if (property === 'textBg') {
                    this.state.textBgBlur = false;
                    this.hideBlurScrubber();
                }
                if (property === 'textColor') {
                    this.userSetTextColor = true;
                }
                grid.querySelectorAll('.customizer-color-dot').forEach(d => d.classList.remove('customizer-active'));
                custom.classList.add('customizer-active');
                this.applyStyles();
                this.updateColorUI();
                tempInput.remove();
            };
            
            const handleCancel = () => {
                tempInput.remove();
            };
            
            tempInput.addEventListener('change', handleChange.bind(this), false);
            tempInput.addEventListener('cancel', handleCancel, false);
            
            // Click the input to open the native color picker dialog
            tempInput.click();
        }, false);
        grid.appendChild(custom);

        if (isBg) {
            // No background option
            const none = document.createElement('div');
            none.className = 'customizer-color-dot';
            none.style.cssText = 'background:white;border:2px dashed #bbb;position:relative;cursor:pointer;user-select:none;-webkit-user-select:none;';
            
            // SECURITY: Use safe SVG creation
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.setAttribute('viewBox', '0 0 18 18');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', '#bbb');
            svg.setAttribute('stroke-width', '2');
            svg.style.position = 'absolute';
            svg.style.inset = '0';
            svg.style.margin = 'auto';
            svg.style.display = 'block';
            svg.style.pointerEvents = 'none';
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '9');
            circle.setAttribute('cy', '9');
            circle.setAttribute('r', '6');
            svg.appendChild(circle);
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '5');
            line.setAttribute('y1', '13');
            line.setAttribute('x2', '13');
            line.setAttribute('y2', '5');
            svg.appendChild(line);
            
            none.appendChild(svg);
            
            none.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.state.textBg = 'transparent';
                this.state.textBgBlur = false;
                grid.querySelectorAll('.customizer-color-dot').forEach(d => d.classList.remove('customizer-active'));
                none.classList.add('customizer-active');
                this.hideBlurScrubber();
                this.applyStyles();
                this.updateColorUI();
            }, false);
            grid.prepend(none);

            // Glassy blur option
            const blur = document.createElement('div');
            blur.className = 'customizer-color-dot';
            blur.style.cssText = 'background:linear-gradient(135deg,rgba(255,255,255,0.55) 60%,rgba(200,220,255,0.25) 100%);border:2px solid #b3c6e0;box-shadow:0 2px 12px rgba(120,160,220,0.18);position:relative;cursor:pointer;user-select:none;-webkit-user-select:none;';
            
            // SECURITY: Use safe SVG creation
            const svgBlur = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgBlur.setAttribute('width', '16');
            svgBlur.setAttribute('height', '16');
            svgBlur.setAttribute('viewBox', '0 0 18 18');
            svgBlur.setAttribute('fill', 'none');
            svgBlur.setAttribute('stroke', '#7fa7d9');
            svgBlur.setAttribute('stroke-width', '2');
            svgBlur.style.position = 'absolute';
            svgBlur.style.inset = '0';
            svgBlur.style.margin = 'auto';
            svgBlur.style.display = 'block';
            svgBlur.style.pointerEvents = 'none';
            
            const ellipse1 = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            ellipse1.setAttribute('cx', '9');
            ellipse1.setAttribute('cy', '9');
            ellipse1.setAttribute('rx', '6');
            ellipse1.setAttribute('ry', '6');
            svgBlur.appendChild(ellipse1);
            
            const ellipse2 = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            ellipse2.setAttribute('cx', '9');
            ellipse2.setAttribute('cy', '9');
            ellipse2.setAttribute('rx', '3');
            ellipse2.setAttribute('ry', '3');
            svgBlur.appendChild(ellipse2);
            
            blur.appendChild(svgBlur);
            
            blur.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.state.textBg = 'rgba(255,255,255,0.55)';
                this.state.textBgBlur = true;
                if (!this.userSetTextColor) this.state.textColor = '#1d1d1f';
                grid.querySelectorAll('.customizer-color-dot').forEach(d => d.classList.remove('customizer-active'));
                blur.classList.add('customizer-active');
                this.ensureBlurScrubber();
                this.applyStyles();
                this.updateColorUI();
            }, false);
            grid.appendChild(blur);
        }
    }

    getSmartTextColor(hex) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        if (c.length !== 6) return '#1d1d1f';
        const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1d1d1f' : '#fff';
    }

    syncTextColorDot() {
        const grid = document.getElementById('customizer-text-colors');
        grid.querySelectorAll('.customizer-color-dot').forEach(dot => {
            let bg = dot.style.background.trim().toLowerCase();
            if (bg.startsWith('rgb')) {
                const m = bg.match(/\d+/g);
                if (m && m.length >= 3) bg = '#' + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('');
            }
            dot.classList.toggle('customizer-active', bg === this.state.textColor.toLowerCase());
        });
    }

    ensureBlurScrubber() {
        const wrap = document.getElementById('customizer-scrubber-blur-wrap');
        wrap.style.display = '';
        if (!this.scrubbers.blur) {
            const BLURS = [2, 4, 6, 8, 10, 12, 16, 20, 24];
            this.scrubbers.blur = this.createScrubber({
                container: wrap,
                label: 'Blur Strength',
                presets: BLURS,
                defaultValue: 6,
                onChange: (v) => { this.state.textBgBlurStrength = v; this.applyStyles(); }
            });
        }
    }

    hideBlurScrubber() {
        const wrap = document.getElementById('customizer-scrubber-blur-wrap');
        wrap.style.display = 'none';
    }

    setupNavigation() {
        // Click outside to close panel - use once to prevent multiple listeners
        const closeHandler = (e) => {
            const panel = document.getElementById('customizer-panel');
            const dock = document.querySelector('.customizer-dock');
            
            if (!panel || !dock) return;
            
            // Only close if clicking completely outside both panel and dock
            if (panel.contains(e.target) || dock.contains(e.target)) {
                return;
            }
            
            // Close the panel
            if (panel.classList.contains('active')) {
                try {
                    // Get the active button and simulate click to toggle
                    const activeBtn = dock.querySelector('.customizer-nav-btn.active');
                    if (activeBtn && !this.isAnimating) {
                        this.toggleView(activeBtn);
                    }
                } catch (error) {
                    console.warn('[CustomizerPro] Error in close handler:', error);
                }
            }
        };
        
        // Use capture phase to catch clicks early, but allow panel/dock to handle their clicks
        document.addEventListener('click', closeHandler, false);
    }



    setupPresets() {
        // Define style presets with various combinations
        const STYLE_PRESETS = [
            {
                name: 'Bold Clean',
                state: { font: "'Syne', sans-serif", weight: 700, size: 40, spacing: 0, radius: 12, padding: 20, textBg: 'transparent', textColor: '#000000' }
            },
            {
                name: 'Elegant Serif',
                state: { font: "'Playfair Display', serif", weight: 400, size: 44, spacing: 2, radius: 8, padding: 16, textBg: '#ffffff', textColor: '#1d1d1f' }
            },
            {
                name: 'Modern Minimal',
                state: { font: "'Inter', sans-serif", weight: 500, size: 36, spacing: 1, radius: 6, padding: 12, textBg: 'transparent', textColor: '#007AFF' }
            },
            {
                name: 'Playful Fun',
                state: { font: "'Luckiest Guy', cursive", weight: 400, size: 48, spacing: 0, radius: 20, padding: 24, textBg: '#FF9500', textColor: '#ffffff' }
            },
            {
                name: 'Monospace Code',
                state: { font: "'Space Grotesk', monospace", weight: 600, size: 32, spacing: 3, radius: 8, padding: 14, textBg: '#1d1d1f', textColor: '#34C759' }
            },
            {
                name: 'Soft Blur',
                state: { font: "'Plus Jakarta Sans', sans-serif", weight: 400, size: 38, spacing: 0, radius: 16, padding: 18, textBg: 'rgba(255,255,255,0.55)', textBgBlur: true, textColor: '#1d1d1f' }
            }
        ];

        const grid = document.getElementById('customizer-presets-grid');
        STYLE_PRESETS.forEach((preset, idx) => {
            const card = document.createElement('div');
            card.className = 'customizer-preset-card';
            card.style.userSelect = 'none';
            card.style.WebkitUserSelect = 'none';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.gap = '6px';
            card.style.padding = '10px';
            card.style.cursor = 'pointer';
            
            const preview = document.createElement('div');
            preview.className = 'customizer-preset-preview';
            preview.style.fontFamily = preset.state.font;
            preview.style.fontWeight = preset.state.weight;
            preview.style.fontSize = '14px';
            preview.style.letterSpacing = `${preset.state.spacing}px`;
            preview.style.color = preset.state.textColor;
            preview.style.backgroundColor = preset.state.textBg === 'transparent' ? 'transparent' : preset.state.textBg;
            preview.style.borderRadius = `${preset.state.radius}px`;
            preview.style.padding = `${preset.state.padding / 3}px ${preset.state.padding / 2}px`;
            preview.style.minHeight = '40px';
            preview.style.display = 'flex';
            preview.style.alignItems = 'center';
            preview.style.justifyContent = 'center';
            preview.style.width = '100%';
            preview.style.maxWidth = '120px';
            preview.textContent = 'Sample';
            
            const label = document.createElement('div');
            label.className = 'customizer-preset-label';
            label.textContent = preset.name;
            label.style.fontSize = '11px';
            label.style.fontWeight = '600';
            label.style.color = '#666';
            label.style.textAlign = 'center';
            label.style.maxWidth = '120px';
            label.style.wordBreak = 'break-word';
            
            card.appendChild(preview);
            card.appendChild(label);
            
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Apply preset state
                this.state = { ...this.state, ...preset.state };
                this.applyStyles();
                // Update all UIs
                this.updateFontUI();
                this.updateColorUI();
                this.updateScrubberUI();
                // Visual feedback
                document.querySelectorAll('.customizer-preset-card').forEach(c => c.classList.remove('customizer-active'));
                card.classList.add('customizer-active');
            });
            
            grid.appendChild(card);
        });
    }

    applyStyles() {
        // SECURITY: Validate and sanitize all inputs before applying
        // Use element's original font as fallback to prevent loss of font during customization
        const fontFallback = this.elementOriginalFont || this.state.font;
        const font = this.validateFont(this.state.font, fontFallback);
        const weight = this.validateNumber(this.state.weight, 100, 900, 400);
        const size = this.validateNumber(this.state.size, 8, 200, 40);
        const spacing = this.validateNumber(this.state.spacing, -50, 50, 0);
        const color = this.validateColor(this.state.textColor, '#1d1d1f');
        const textBg = this.validateColor(this.state.textBg, 'transparent');
        const radius = this.validateNumber(this.state.radius, 0, 500, 20);
        const padding = this.validateNumber(this.state.padding, 0, 100, 4);
        const blurStrength = this.validateNumber(this.state.textBgBlurStrength, 0, 50, 6);
        const shadowSpread = this.validateNumber(this.state.textShadowSpread, 0, 10, 0);
        
        // 🎨 Preserve original shadow or use default
        let textShadow = this.elementOriginalShadow || this.state.textShadow || 'none';
        
        // If shadow exists and user adjusted spread, enhance it
        if (textShadow !== 'none' && shadowSpread > 0) {
            const shadowMatch = textShadow.match(/^([^,]+(?:,[^,]+)*)$/);
            if (shadowMatch) {
                textShadow = `${textShadow}, ${shadowSpread}px ${shadowSpread}px ${shadowSpread * 1.5}px rgba(0,0,0,${0.2 + shadowSpread * 0.04})`;
            }
        }

        // Apply to ranking template selected elements if available
        if (this.rankingSelectedElements && this.rankingSelectedElements.size > 0) {
            this.rankingSelectedElements.forEach(el => {
                // 🎨 IMPORTANT: Only override typography styles, preserve CSS classes/layout
                el.style.setProperty('font-family', font, 'important');
                el.style.setProperty('font-weight', weight.toString(), 'important');
                el.style.setProperty('font-size', `${size}px`, 'important');
                el.style.setProperty('letter-spacing', `${spacing}px`, 'important');
                el.style.setProperty('color', color, 'important');
                el.style.setProperty('text-shadow', textShadow, 'important');
                
                // Background styles (only if explicitly set)
                if (this.state.textBgBlur || textBg !== 'transparent') {
                    el.style.setProperty('display', 'inline-block', 'important');
                    el.style.setProperty('white-space', 'nowrap', 'important');
                    el.style.setProperty('box-sizing', 'border-box', 'important');
                    el.style.setProperty('border-radius', `${radius}px`, 'important');
                    el.style.setProperty('padding', `${padding / 2}px ${padding}px`, 'important');
                    
                    if (this.state.textBgBlur) {
                        el.style.setProperty('background-color', 'rgba(255,255,255,0.55)', 'important');
                        el.style.setProperty('backdrop-filter', `blur(${blurStrength}px)`, 'important');
                        el.style.setProperty('-webkit-backdrop-filter', `blur(${blurStrength}px)`, 'important');
                        el.style.setProperty('border', '1.5px solid #b3c6e0', 'important');
                        el.style.setProperty('box-shadow', '0 2px 24px rgba(120,160,220,0.18)', 'important');
                    } else {
                        el.style.setProperty('background-color', textBg, 'important');
                        el.style.removeProperty('backdrop-filter');
                        el.style.removeProperty('-webkit-backdrop-filter');
                        el.style.removeProperty('border');
                        el.style.removeProperty('box-shadow');
                    }
                } else {
                    // No background - preserve CSS layout
                    el.style.removeProperty('background-color');
                    el.style.removeProperty('backdrop-filter');
                    el.style.removeProperty('-webkit-backdrop-filter');
                    el.style.removeProperty('border');
                    el.style.removeProperty('box-shadow');
                    el.style.removeProperty('display');
                    el.style.removeProperty('white-space');
                    el.style.removeProperty('box-sizing');
                    el.style.removeProperty('padding');
                    el.style.removeProperty('border-radius');
                }
            });
            
            // 🎨 Clear mixed state once changes are applied (now all elements have the same values)
            this.mixedProperties = {};
            
            return;
        }

        // Apply to regular currentElement if no ranking elements selected
        if (!this.currentElement) {
            console.warn('[CustomizerPro] No element selected');
            return;
        }

        // Apply styles directly to the selected element with !important
        this.currentElement.style.setProperty('font-family', font, 'important');
        this.currentElement.style.setProperty('font-weight', weight.toString(), 'important');
        this.currentElement.style.setProperty('font-size', `${size}px`, 'important');
        this.currentElement.style.setProperty('letter-spacing', `${spacing}px`, 'important');
        this.currentElement.style.setProperty('color', color, 'important');
        this.currentElement.style.setProperty('text-shadow', textShadow, 'important');

        // Apply background to element if needed
        if (this.state.textBgBlur) {
            this.currentElement.style.setProperty('display', 'inline-block', 'important');
            this.currentElement.style.setProperty('white-space', 'nowrap', 'important');
            this.currentElement.style.setProperty('box-sizing', 'border-box', 'important');
            this.currentElement.style.setProperty('background-color', 'rgba(255,255,255,0.55)', 'important');
            this.currentElement.style.setProperty('backdrop-filter', `blur(${blurStrength}px)`, 'important');
            this.currentElement.style.setProperty('-webkit-backdrop-filter', `blur(${blurStrength}px)`, 'important');
            this.currentElement.style.setProperty('border', '1.5px solid #b3c6e0', 'important');
            this.currentElement.style.setProperty('box-shadow', '0 2px 24px rgba(120,160,220,0.18)', 'important');
            this.currentElement.style.setProperty('border-radius', `${radius}px`, 'important');
            this.currentElement.style.setProperty('padding', `${padding / 2}px ${padding}px`, 'important');
        } else if (textBg !== 'transparent') {
            this.currentElement.style.setProperty('display', 'inline-block', 'important');
            this.currentElement.style.setProperty('white-space', 'nowrap', 'important');
            this.currentElement.style.setProperty('box-sizing', 'border-box', 'important');
            this.currentElement.style.setProperty('background-color', textBg, 'important');
            this.currentElement.style.setProperty('border-radius', `${radius}px`, 'important');
            this.currentElement.style.setProperty('padding', `${padding / 2}px ${padding}px`, 'important');
        } else {
            // Clear background if transparent is selected
            this.currentElement.style.setProperty('background-color', 'transparent', 'important');
            this.currentElement.style.setProperty('backdrop-filter', '', 'important');
            this.currentElement.style.setProperty('-webkit-backdrop-filter', '', 'important');
            this.currentElement.style.removeProperty('display');
            this.currentElement.style.removeProperty('white-space');
            this.currentElement.style.removeProperty('box-sizing');
        }
    }
    
    /**
     * Safely save customizations to API
     * SECURITY: Validates all data before sending
     */
    async saveCustomizations(configName, elementId) {
        if (!configName || !elementId) {
            console.error('[CustomizerPro] Missing config or element ID');
            return false;
        }
        
        try {
            // Build customization object with validated data
            const customizations = {
                font: this.validateFont(this.state.font),
                font_weight: this.validateNumber(this.state.weight, 100, 900),
                font_size: this.validateNumber(this.state.size, 8, 200),
                letter_spacing: this.validateNumber(this.state.spacing, -50, 50),
                color: this.validateColor(this.state.textColor),
                background_color: this.validateColor(this.state.textBg),
                background_blur: this.state.textBgBlur === true,
                background_blur_strength: this.validateNumber(this.state.textBgBlurStrength, 0, 50),
                border_radius: this.validateNumber(this.state.radius, 0, 500),
                padding: this.validateNumber(this.state.padding, 0, 100)
            };
            
            // Send to API
            const response = await fetch(`/api/ranking-config/customize/${configName}/${elementId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ customizations })
            });
            
            if (!response.ok) {
                console.error('[CustomizerPro] Failed to save customizations:', response.statusText);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('[CustomizerPro] Error saving customizations:', error);
            return false;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.customizer = new CustomizerPro();
    });
} else {
    window.customizer = new CustomizerPro();
}
