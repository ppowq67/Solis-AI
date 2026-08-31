/**
 * Premium page — wire plan CTAs to Paddle checkout + nav sign-in links.
 */
(function () {
  const FALLBACK_PLANS = {
    basic: { priceId: 'pri_01kbavyh2vxwy5z8pdzrwb5eqq' },
    prime: { priceId: 'pri_01kbds6nnbv1hj5vef6nxgpha4' },
    elite: { priceId: 'pri_01kbjphsvy40kypjk2nxh0qdzk' },
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

  const PLAN_RANK = { free: 0, basic: 1, prime: 2, elite: 3 };

  function normalizePlan(plan) {
    const key = String(plan || 'free').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PLAN_RANK, key) ? key : 'free';
  }

  function currentPlanLabel(planKey) {
    const name = String(planKey || 'free');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function applyCurrentPlan(plan) {
    const current = normalizePlan(plan);
    document.querySelectorAll('.plan-card[data-plan]').forEach((card) => {
      const planKey = card.getAttribute('data-plan');
      const btn = card.querySelector('.plan-btn');
      const isCurrent = planKey === current && current !== 'free';
      card.classList.toggle('is-current', isCurrent);
      if (!btn) return;
      if (!btn.dataset.defaultHtml) btn.dataset.defaultHtml = btn.innerHTML.trim();
      if (isCurrent) {
        btn.classList.add('is-current-plan');
        btn.disabled = true;
        btn.setAttribute('aria-current', 'true');
        btn.textContent = 'Current plan';
      } else {
        btn.classList.remove('is-current-plan');
        btn.disabled = false;
        btn.removeAttribute('aria-current');
        if (btn.dataset.defaultHtml) btn.innerHTML = btn.dataset.defaultHtml;
      }
    });

    const stickyBtn = document.querySelector('._cta-btn');
    const stickyPrice = document.getElementById('_ctaPrice');
    if (current !== 'free' && stickyBtn) {
      stickyBtn.textContent = current === 'elite' ? 'You are on Elite' : `You are on ${currentPlanLabel(current)}`;
      stickyBtn.classList.add('is-current-plan');
      stickyBtn.disabled = true;
    }
    if (current !== 'free' && stickyPrice) {
      stickyPrice.textContent = 'Manage billing from your dashboard';
    }
  }

  window.applyPremiumCurrentPlan = applyCurrentPlan;

  async function resolveCurrentPlan() {
    const user = window.currentAuthenticatedUser || window.currentUser;
    if (user?.plan) applyCurrentPlan(user.plan);
    try {
      const url = typeof window.apiUrl === 'function'
        ? window.apiUrl('/api/auth/subscription')
        : `${apiBase().replace(/\/$/, '')}/auth/subscription`;
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const plan = data?.subscription?.plan || data?.plan;
      if (plan) applyCurrentPlan(plan);
    } catch (_) { /* guest or network — keep default CTAs */ }
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
        if (btn.disabled || btn.classList.contains('is-current-plan')) return;
        startCheckout(info.priceId, planKey, e);
      });
    });

    const stickyBtn = document.querySelector('._cta-btn');
    const prime = plans.prime;
    if (stickyBtn && prime?.priceId) {
      stickyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (stickyBtn.disabled || stickyBtn.classList.contains('is-current-plan')) return;
        startCheckout(prime.priceId, 'prime', e);
      });
    }
  }

  function wireAuthLinks() {
    document.querySelectorAll('.nav-login, .nav-mobile-signin, .nav-cta[data-open-auth], .nav-mobile-cta[data-open-auth]').forEach((el) => {
      el.setAttribute('href', '/?login=1');
      if (!el.hasAttribute('data-open-auth')) el.setAttribute('data-open-auth', '');
    });
    document.querySelectorAll('.nav-cta, .nav-mobile-cta').forEach((el) => {
      if (!el.dataset.boundDashboard) {
        el.dataset.boundDashboard = '1';
        el.addEventListener('click', (e) => {
          const user = window.currentAuthenticatedUser || window.currentUser;
          if (user) {
            e.preventDefault();
            window.location.href = '/dashboard.html';
            return;
          }
          if (typeof window.openAuthModal === 'function') {
            e.preventDefault();
            window.openAuthModal();
          }
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    wireAuthLinks();
    const plans = await fetchPlanCatalog();
    wirePlanButtons(plans);
    await resolveCurrentPlan();
  });
})();
