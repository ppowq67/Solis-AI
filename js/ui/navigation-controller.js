/**
 * Navigation Controller
 * Handles sidebar navigation with animated indicator
 * Pure JavaScript - no build system required
 */

class NavigationController {
  constructor() {
    this.config = {
      itemHeight: 76,
      itemGap: 2,
      animationDuration: 420
    };

    this.state = {
      direction: null,
      isMoving: false
    };

    this.navContainer = document.getElementById('navContainer');
    this.indicator = document.getElementById('indicator');
    
    this.init();
  }

  /**
   * Initialize navigation controller
   */
  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initIndicatorPosition());
    } else {
      this.initIndicatorPosition();
    }
  }

  /**
   * Initialize indicator position based on active nav item
   */
  initIndicatorPosition() {
    if (!this.indicator) return;
    
    const navItems = document.querySelectorAll('.nav-item');
    let activeIndex = 0;
    
    navItems.forEach((el, index) => {
      if (el.classList.contains('active')) {
        activeIndex = index;
      }
    });
    
    const targetY = activeIndex * (this.config.itemHeight + this.config.itemGap);
    this.indicator.style.transition = 'none';
    this.indicator.style.transform = `translateY(${targetY}px)`;
    
    // Enable transitions after initial position
    setTimeout(() => {
      if (this.indicator) {
        this.indicator.style.transition = `transform ${this.config.animationDuration}ms cubic-bezier(0.2, 1, 0.2, 1)`;
      }
    }, 50);
  }

  /**
   * Navigate to a specific nav item
   * @param {HTMLElement} el - The nav item element
   * @param {number} index - The index of the nav item
   */
  navigate(el, index) {
    // Remove active from all items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active to clicked item
    el.classList.add('active');

    if (!this.navContainer || !this.indicator) return;

    // Calculate positions
    const currentY = this.getCurrentIndicatorY();
    const targetY = index * (this.config.itemHeight + this.config.itemGap);

    // Update state
    this.state.direction = targetY > currentY ? 'down' : 'up';
    this.state.isMoving = true;
    
    this.navContainer.dataset.direction = this.state.direction;
    this.navContainer.dataset.moving = 'true';

    // Animate indicator
    this.indicator.style.transform = `translateY(${targetY}px)`;

    // Reset moving state
    setTimeout(() => {
      this.state.isMoving = false;
      if (this.navContainer) {
        this.navContainer.dataset.moving = 'false';
      }
    }, this.config.animationDuration);
  }

  /**
   * Get current Y position of indicator from transform
   * @returns {number} Current Y translation
   */
  getCurrentIndicatorY() {
    if (!this.indicator) return 0;
    
    const transform = this.indicator.style.transform;
    const match = transform.match(/translateY\(([^)]+)px\)/);
    
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
    
    return 0;
  }

  /**
   * Update configuration
   * @param {Object} config - New config options
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current state
   * @returns {Object} Current navigation state
   */
  getState() {
    return { ...this.state };
  }
}

// Initialize global instance when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.navigationController = new NavigationController();
  });
} else {
  window.navigationController = new NavigationController();
}
