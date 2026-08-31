/**
 * Unified Paddle checkout + post-payment activation.
 * Production: wait for webhook via verify-payment-status polling.
 * Development: optional local fallback when webhooks are unavailable.
 */
(function () {
  const POLL_INTERVAL_MS = 2000;
  const MAX_POLL_ATTEMPTS = 20;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function apiBase() {
    if (typeof window.apiUrl === 'function') {
      return (path) => window.apiUrl(path);
    }
    const base = (window.API_BASE_URL || `${window.location.origin}/api`).replace(/\/$/, '');
    return (path) => {
      let p = String(path);
      if (p.startsWith('/api/')) p = p.slice(4);
      else if (p.startsWith('/api')) p = p.slice(4);
      if (!p.startsWith('/')) p = '/' + p;
      return base + p;
    };
  }

  const paymentUrl = apiBase();

  function showProcessingOverlay(message) {
    removeProcessingOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'payment-processing-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1000000;
      background: rgba(15, 23, 42, 0.72);
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(6px);
    `;
    overlay.innerHTML = `
      <div style="
        background: white; border-radius: 20px; padding: 32px 40px;
        text-align: center; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      ">
        <div style="
          width: 44px; height: 44px; border: 3px solid #fed7aa;
          border-top-color: #f97316; border-radius: 50%;
          margin: 0 auto 20px; animation: paymentSpin 0.8s linear infinite;
        "></div>
        <p style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a;">${message}</p>
        <p style="margin: 10px 0 0; font-size: 0.9rem; color: #64748b;">This usually takes a few seconds.</p>
      </div>
    `;
    if (!document.getElementById('payment-flow-styles')) {
      const style = document.createElement('style');
      style.id = 'payment-flow-styles';
      style.textContent = '@keyframes paymentSpin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    document.body.appendChild(overlay);
  }

  function removeProcessingOverlay() {
    document.getElementById('payment-processing-overlay')?.remove();
  }

  async function verifyPrice(priceId, planName) {
    const res = await fetch(paymentUrl('/api/payment/verify-price'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, planName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid plan selection');
    }
    return true;
  }

  async function pollPaymentStatus(transactionId) {
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const res = await fetch(paymentUrl('/api/payment/verify-payment-status'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId || null }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.registered) {
          return data;
        }
      }

      if (attempt < MAX_POLL_ATTEMPTS) {
        await sleep(POLL_INTERVAL_MS);
      }
    }
    return null;
  }

  async function tryLocalFallback(planName) {
    const config = window.paddleManager?.getConfig?.();
    if (!config?.useLocalFallback) {
      return null;
    }
    const res = await fetch(paymentUrl('/api/payment/process-local-payment'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planName }),
    });
    if (!res.ok) {
      return null;
    }
    return res.json();
  }

  async function completeCheckout(checkoutData) {
    const planName = window.pendingPlanUpgrade;
    if (!planName) {
      console.error('[Payment] No pending plan');
      return { ok: false, error: 'Missing plan' };
    }

    const transactionId =
      checkoutData?.transaction_id ||
      checkoutData?.id ||
      checkoutData?.transaction?.id ||
      null;

    showProcessingOverlay('Activating your plan…');

    try {
      let result = await pollPaymentStatus(transactionId);
      if (!result) {
        result = await tryLocalFallback(planName);
      }

      removeProcessingOverlay();

      if (!result || !result.success) {
        return {
          ok: false,
          error: 'Payment received but activation is still pending. Check your dashboard in a minute.',
        };
      }

      window.pendingPlanUpgrade = null;
      return { ok: true, plan: result.plan || planName };
    } catch (err) {
      removeProcessingOverlay();
      console.error('[Payment] Activation error:', err);
      return { ok: false, error: err.message || 'Activation failed' };
    }
  }

  async function openCheckout(priceId, planName, event) {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();

    if (!window.paddleManager?.initialized) {
      throw new Error('Payment system is still loading. Please try again.');
    }

    await verifyPrice(priceId, planName);

    const sessionRes = await fetch(paymentUrl('/api/payment/prepare-checkout'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, planName }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.json().catch(() => ({}));
      throw new Error(err.error || 'Could not start checkout');
    }

    const session = await sessionRes.json();
    await window.paddleManager.openCheckout(priceId, planName, session);
    return true;
  }

  async function handleDashboardReturn() {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('payment') === 'success' || params.get('status') === 'success';
    if (!ok) return;
    if (params.get('demo') === '1' || params.get('demo') === 'true') return;

    const plan = params.get('plan');
    const onPremium = /\/premium(?:\.html)?$/i.test(window.location.pathname);
    // Premium thank-you UI owns the redirect — only confirm activation here
    if (!onPremium) {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, clean);
      showProcessingOverlay('Confirming your upgrade…');
    }

    let activated = await pollPaymentStatus(null);
    if (!activated && plan) {
      activated = await tryLocalFallback(plan);
    }
    if (!onPremium) removeProcessingOverlay();

    const activePlan = activated?.plan || plan;
    if (activePlan && typeof window.handlePaymentSuccessOnDashboard === 'function') {
      window.handlePaymentSuccessOnDashboard(activePlan);
    }
    return { ok: true, plan: activePlan || null };
  }

  window.PaymentFlow = {
    openCheckout,
    completeCheckout,
    showProcessingOverlay,
    removeProcessingOverlay,
    handleDashboardReturn,
    pollPaymentStatus,
    tryLocalFallback,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      handleDashboardReturn().catch(() => {});
    });
  } else {
    handleDashboardReturn().catch(() => {});
  }
})();
