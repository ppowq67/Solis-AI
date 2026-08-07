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
    this.navContainer = document.getElementById("navContainer");
    this.indicator = document.getElementById("indicator");
    this.init();
  }
  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.initIndicatorPosition());
    } else {
      this.initIndicatorPosition();
    }
  }
  initIndicatorPosition() {
    if (!this.indicator) return;
    const t = document.querySelectorAll(".nav-item");
    let i = 0;
    t.forEach((t, n) => {
      if (t.classList.contains("active")) {
        i = n;
      }
    });
    const n = i * (this.config.itemHeight + this.config.itemGap);
    this.indicator.style.transition = "none";
    this.indicator.style.transform = `translateY(${n}px)`;
    setTimeout(() => {
      if (this.indicator) {
        this.indicator.style.transition = `transform ${this.config.animationDuration}ms cubic-bezier(0.2, 1, 0.2, 1)`;
      }
    }, 50);
  }
  navigate(t, i) {
    document.querySelectorAll(".nav-item").forEach(t => {
      t.classList.remove("active");
    });
    t.classList.add("active");
    if (!this.navContainer || !this.indicator) return;
    const n = this.getCurrentIndicatorY();
    const e = i * (this.config.itemHeight + this.config.itemGap);
    this.state.direction = e > n ? "down" : "up";
    this.state.isMoving = true;
    this.navContainer.dataset.direction = this.state.direction;
    this.navContainer.dataset.moving = "true";
    this.indicator.style.transform = `translateY(${e}px)`;
    setTimeout(() => {
      this.state.isMoving = false;
      if (this.navContainer) {
        this.navContainer.dataset.moving = "false";
      }
    }, this.config.animationDuration);
  }
  getCurrentIndicatorY() {
    if (!this.indicator) return 0;
    const t = this.indicator.style.transform;
    const i = t.match(/translateY\(([^)]+)px\)/);
    if (i && i[1]) {
      return parseFloat(i[1]);
    }
    return 0;
  }
  setConfig(t) {
    this.config = {
      ...this.config,
      ...t
    };
  }
  getState() {
    return {
      ...this.state
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.navigationController = new NavigationController;
  });
} else {
  window.navigationController = new NavigationController;
}
