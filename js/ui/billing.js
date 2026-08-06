class BillingPanel {
    constructor() {
        this.billingPanel = document.getElementById('billingPanel');
        this.billingBackdrop = document.getElementById('billingBackdrop');
        this.closeBillingBtn = document.getElementById('closeBilling');
        this.upgradePlanBtn = document.getElementById('upgradePlanBtn');
        this.cancelSubscriptionBtn = document.getElementById('cancelSubscriptionBtn');

        this.init();
    }

    init() {

        if (this.closeBillingBtn) {
            this.closeBillingBtn.addEventListener('click', () => this.closeBilling());
        } else {
            console.warn('Close button not found');
        }

        if (this.billingBackdrop) {
            this.billingBackdrop.addEventListener('click', () => this.closeBilling());
        } else {
            console.warn('Backdrop not found');
        }

        if (this.upgradePlanBtn) {
            this.upgradePlanBtn.addEventListener('click', () => this.upgradePlan());
        } else {
            console.warn('Upgrade button not found');
        }

        if (this.cancelSubscriptionBtn) {
            this.cancelSubscriptionBtn.addEventListener('click', () => this.showCancelConfirmation());
        } else {
            console.warn('Cancel button not found');
        }

        const billingDropdownLink = document.getElementById('dropdownBilling');

        if (billingDropdownLink) {
            billingDropdownLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openBilling();
            });
        } else {
            console.error('CRITICAL: dropdownBilling element not found!');
            console.error('Check that #dropdownBilling exists in dashboard.html');
        }

    }

    async openBilling() {

        if (!this.billingPanel || !this.billingBackdrop) {
            console.error('Billing panel elements not found in DOM');
            alert('❌ Error: Billing panel not initialized. Please refresh the page.');
            return;
        }

        const profileDropdown = document.getElementById('profileDropdown');
        if (profileDropdown && profileDropdown.classList.contains('open')) {
            profileDropdown.classList.remove('open');
        }

        this.billingPanel.classList.add('open');
        this.billingBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';

        await this.fetchBillingData();
    }

    closeBilling() {

        if (this.billingPanel) {
            this.billingPanel.classList.remove('open');
        }
        if (this.billingBackdrop) {
            this.billingBackdrop.classList.remove('open');
        }
        document.body.style.overflow = '';
    }

    async fetchBillingData() {
        try {

            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            };

            const response = await (window.apiFetch || fetch)('/api/user/billing', {
                method: 'GET',
                credentials: 'include',
                headers: headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);

                if (response.status === 401) {
                    console.error('Unauthorized - Token may be invalid');
                    alert('⚠️ Session expired. Please refresh the page.');
                    return;
                } else if (response.status === 403) {
                    console.error('Forbidden - Access denied');
                }

                this.showDefaultBillingData();
                return;
            }

            const data = await response.json();

            if (!data || typeof data !== 'object') {
                console.error('Invalid response structure:', data);
                this.showDefaultBillingData();
                return;
            }

            if (!data.planName || !data.status) {
                console.error('Missing critical billing fields:', data);
                this.showDefaultBillingData();
                return;
            }

            this.populateBillingData(data);
        } catch (error) {
            console.error('Network/Fetch Error:', error.message);
            console.error('Stack:', error.stack);
            this.showDefaultBillingData();
        }
    }

    populateBillingData(data) {

        const sanitize = (value) => {
            if (typeof value !== 'string' && value !== null) return '';
            if (!value) return '';
            const div = document.createElement('div');
            div.textContent = value;
            return div.innerHTML;
        };

        const currentPlanEl = document.getElementById('billingCurrentPlan');
        if (currentPlanEl && data.planName) {
            const planName = sanitize(data.planName);
            currentPlanEl.textContent = planName;
        }

        const nextDateEl = document.getElementById('billingNextDate');
        if (nextDateEl) {
            if (data.nextBillingDate) {
                try {
                    const date = new Date(data.nextBillingDate);
                    if (isNaN(date.getTime())) {
                        console.warn('Invalid date format:', data.nextBillingDate);
                        nextDateEl.textContent = 'Date unavailable';
                    } else {
                        nextDateEl.textContent = date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                } catch (e) {
                    console.error('Date formatting error:', e);
                    nextDateEl.textContent = 'No active subscription';
                }
            } else {
                nextDateEl.textContent = 'No active subscription';
            }
        }

        const statusEl = document.getElementById('billingStatus');
        if (statusEl && data.status) {
            const validStatuses = ['active', 'inactive', 'cancelled'];
            const status = sanitize(data.status).toLowerCase();

            if (!validStatuses.includes(status)) {
                console.warn('Unknown status value:', data.status);
            }

            statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusEl.classList.remove('active', 'inactive', 'cancelled');
            statusEl.classList.add(status);
        }

        const priceEl = document.getElementById('billingPrice');
        if (priceEl && data.price) {
            try {
                const priceNum = parseFloat(data.price);
                if (!isNaN(priceNum)) {
                    priceEl.textContent = `$${priceNum.toFixed(2)}/month`;
                }
            } catch (e) {
                console.warn('Price parsing error:', e);
            }
        }

        const paymentMethodEl = document.getElementById('paymentMethod');
        if (paymentMethodEl && data.paymentMethod) {
            const method = sanitize(data.paymentMethod);
            paymentMethodEl.textContent = method;
        }

        const isFreePlan = !data.currentPlan || data.currentPlan === 'free';
        const isActive = data.status === 'active';

        if (this.upgradePlanBtn) {
            this.upgradePlanBtn.style.display = isFreePlan ? 'flex' : 'none';
        }

        if (this.cancelSubscriptionBtn) {
            this.cancelSubscriptionBtn.style.display = isActive && !isFreePlan ? 'flex' : 'none';
        }

    }

    showDefaultBillingData() {
        const currentPlanEl = document.getElementById('billingCurrentPlan');
        const nextDateEl = document.getElementById('billingNextDate');
        const statusEl = document.getElementById('billingStatus');

        if (currentPlanEl) currentPlanEl.textContent = 'Free';
        if (nextDateEl) nextDateEl.textContent = 'No active subscription';
        if (statusEl) {
            statusEl.textContent = 'Inactive';
            statusEl.classList.add('inactive');
        }

        if (this.upgradePlanBtn) this.upgradePlanBtn.style.display = 'flex';
        if (this.cancelSubscriptionBtn) this.cancelSubscriptionBtn.style.display = 'none';
    }

    upgradePlan() {
        window.location.href = '/premium.html';
    }

    showCancelConfirmation() {
        const warned = confirm(
            '⚠️ Cancel subscription — immediate action\n\n'
            + 'This takes effect right away for billing:\n'
            + '• Future renewals stop immediately\n'
            + '• You keep your current plan until the end of this billing period\n'
            + '• After that date you drop to Free (no refund for unused days)\n\n'
            + 'Continue?'
        );
        if (!warned) return;

        const typed = prompt('Type CANCEL to confirm you want to stop renewals now:');
        if (!typed || String(typed).trim().toUpperCase() !== 'CANCEL') {
            alert('Confirmation did not match. Subscription was not cancelled.');
            return;
        }

        this.cancelSubscription();
    }

    async cancelSubscription() {
        try {

            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            };

            const response = await (window.apiFetch || fetch)('/api/billing/cancel', {
                method: 'POST',
                credentials: 'include',
                headers: headers,
                body: JSON.stringify({ effective_from: 'next_billing_period' })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Cancel failed:', response.status, errorText);

                if (response.status === 401) {
                    alert('⚠️ Session expired. Please refresh and try again.');
                } else if (response.status === 400) {
                    alert('⚠️ No active subscription to cancel.');
                } else {
                    alert('❌ Failed to cancel subscription. Please try again.');
                }
                return;
            }

            const data = await response.json();

            if (!data.success) {
                console.error('Server indicated failure:', data);
                alert('❌ Cancellation failed: ' + (data.message || 'Unknown error'));
                return;
            }

            alert(
                '✅ Subscription cancel scheduled.\n\n'
                + 'Renewals stopped immediately. You keep access to premium features until the end of your current billing period.'
            );

            await this.fetchBillingData();
        } catch (error) {
            console.error('Error cancelling subscription:', error.message);
            console.error('Stack:', error.stack);
            alert('❌ Error cancelling subscription. Please try again.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {

    const billingPanel = document.getElementById('billingPanel');
    const billingBackdrop = document.getElementById('billingBackdrop');
    const dropdownBilling = document.getElementById('dropdownBilling');

    if (!billingPanel || !billingBackdrop) {
        console.error('CRITICAL: Billing panel HTML elements not found!');
        console.error('- Make sure billing panel HTML is in dashboard.html');
        console.error('- Check browser DevTools (F12) > Elements tab');
        return;
    }

    if (!dropdownBilling) {
        console.error('WARNING: dropdownBilling element not found!');
        console.error('- Billing menu link may not be clickable');
    }

    try {
        window.billingPanel = new BillingPanel();

        if (billingPanel) {
            billingPanel.classList.remove('open');
        }
        if (billingBackdrop) {
            billingBackdrop.classList.remove('open');
        }
        document.body.style.overflow = '';
    } catch (error) {
        console.error('Error initializing BillingPanel:', error);
        console.error('Stack:', error.stack);
    }
});
