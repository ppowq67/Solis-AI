(function () {
  const FALLBACK_PLANS = {
    basic: { priceId: 'pri_01kbavpdvztyny35d5jzbxdb3j' },
    prime: { priceId: 'pri_01kbds38r5h1ranax74yv92sps' },
    elite: { priceId: 'pri_01kbjpgwz7v6pdn2jggt0zhq6k' },
  };

  function apiBase() {
    return window.API_BASE_URL || `${window.location.origin}/api`;
  }

  async function fetchPlanCatalog() {
    try {
      const url = typeof window.apiUrl === 'function'
        ? window.apiUrl('/api/payment/paddle-config')
        : `${apiBase().replace(/\/$/, '')}/payment/paddle-config`;
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`paddle-config ${res.status}`);
      const data = await res.json();
      if (data.plans && Object.keys(data.plans).length) return data.plans;
    } catch (err) {
      console.warn('[Premium] Using fallback price IDs:', err.message);
    }
    return FALLBACK_PLANS;
  }

  function startCheckout(priceId, planKey, event) {
    if (typeof window.openPaddleCheckout !== 'function') {
      console.error('[Premium] Checkout handler not loaded');
      alert('Payment system is still loading. Please try again in a moment.');
      return;
    }
    window.openPaddleCheckout(priceId, planKey, event);
  }

  function wirePlanButtons(plans) {
    document.querySelectorAll('.plan-card[data-plan]').forEach((card) => {
      const planKey = card.getAttribute('data-plan');
      const info = plans[planKey];
      const btn = card.querySelector('.plan-btn');
      if (!btn || !info?.priceId) return;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        startCheckout(info.priceId, planKey, e);
      });
    });

    const stickyBtn = document.querySelector('._cta-btn');
    const prime = plans.prime;
    if (stickyBtn && prime?.priceId) {
      stickyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        startCheckout(prime.priceId, 'prime', e);
      });
    }
  }

  function wireAuthLinks() {
    document.querySelectorAll('.nav-login, .nav-mobile-signin').forEach((el) => {
      el.setAttribute('href', '/login.html');
    });
    document.querySelectorAll('.nav-cta, .nav-mobile-cta').forEach((el) => {
      if (!el.dataset.boundDashboard) {
        el.dataset.boundDashboard = '1';
        el.addEventListener('click', (e) => {
          const user = window.currentAuthenticatedUser || window.currentUser;
          if (user) {
            e.preventDefault();
            window.location.href = '/dashboard.html';
          }
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    wireAuthLinks();
    const plans = await fetchPlanCatalog();
    wirePlanButtons(plans);
  });
})();
