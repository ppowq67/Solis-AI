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

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initIndicatorPosition());
    } else {
      this.initIndicatorPosition();
    }
  }

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

    setTimeout(() => {
      if (this.indicator) {
        this.indicator.style.transition = `transform ${this.config.animationDuration}ms cubic-bezier(0.2, 1, 0.2, 1)`;
      }
    }, 50);
  }

  navigate(el, index) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    el.classList.add('active');

    if (!this.navContainer || !this.indicator) return;

    const currentY = this.getCurrentIndicatorY();
    const targetY = index * (this.config.itemHeight + this.config.itemGap);

    this.state.direction = targetY > currentY ? 'down' : 'up';
    this.state.isMoving = true;

    this.navContainer.dataset.direction = this.state.direction;
    this.navContainer.dataset.moving = 'true';

    this.indicator.style.transform = `translateY(${targetY}px)`;

    setTimeout(() => {
      this.state.isMoving = false;
      if (this.navContainer) {
        this.navContainer.dataset.moving = 'false';
      }
    }, this.config.animationDuration);
  }

  getCurrentIndicatorY() {
    if (!this.indicator) return 0;

    const transform = this.indicator.style.transform;
    const match = transform.match(/translateY\(([^)]+)px\)/);

    if (match && match[1]) {
      return parseFloat(match[1]);
    }

    return 0;
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  getState() {
    return { ...this.state };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.navigationController = new NavigationController();
  });
} else {
  window.navigationController = new NavigationController();
}
