window.addEventListener('load', function() {
            const overlay = document.getElementById('loadingOverlay');
            if (!overlay) return;
            setTimeout(function() {
                overlay.classList.add('hidden');
            }, 500);
        });

        let paddleRetryCount = 0;
        const MAX_PADDLE_RETRIES = 3;

        async function initPaddle() {
            if (window.paddleInitialized) return;

            const initialized = await window.paddleManager.init();
            if (!initialized) {
                paddleRetryCount++;
                if (paddleRetryCount >= MAX_PADDLE_RETRIES) {
                    console.error('Failed to initialize Paddle after ' + MAX_PADDLE_RETRIES + ' retries');
                    console.error('Please check if backend is running and /api/payment/paddle-config endpoint exists');
                    return;
                }
                setTimeout(initPaddle, 2000);
                return;
            }

            window.addEventListener('paddle:checkoutComplete', async (event) => {
                window.paymentSucceeded = true;
                history.replaceState({}, document.title, window.location.pathname);
                await handleCheckoutSuccess(event.detail);
            });

            window.addEventListener('paddle:checkoutError', () => {
                alert('Checkout could not be completed. Please try again or use a different card.');
            });

            window.paddleInitialized = true;
        }

        window.handleCheckoutSuccess = async function(checkoutData) {
            const planName = window.pendingPlanUpgrade;
            if (!planName) {
                console.error('[PAYMENT] No pending plan upgrade found');
                return;
            }

            const authUrl = typeof window.apiUrl === 'function'
                ? window.apiUrl('/api/auth/check')
                : '/api/auth/check';
            const authResponse = await fetch(authUrl, {
                method: 'GET',
                credentials: 'include',
            });

            if (!authResponse.ok) {
                alert('Please sign in to complete your upgrade.');
                window.location.href = '/login.html';
                return;
            }

            const result = await window.PaymentFlow.completeCheckout(checkoutData);
            if (!result.ok) {
                alert(result.error || 'Payment activation failed. Check your dashboard shortly.');
                return;
            }

            if (typeof window.showPaymentSuccessModal === 'function') {
                window.showPaymentSuccessModal(result.plan || planName);
            }

            setTimeout(() => {
                window.location.href = '/dashboard.html?payment=success&plan=' + encodeURIComponent(result.plan || planName);
            }, 1800);
        };

        let checkoutRetryCount = 0;
        const MAX_CHECKOUT_RETRIES = 24;

        window.openPaddleCheckout = async function(priceId, planName, event) {
            const user = currentAuthenticatedUser || window.currentAuthenticatedUser;
            if (!user) {
                alert('Please sign in to upgrade your plan.');
                window.location.href = '/login.html';
                return;
            }

            if (!window.paddleInitialized) {
                checkoutRetryCount++;
                if (checkoutRetryCount > MAX_CHECKOUT_RETRIES) {
                    alert('Payment system failed to load. Please refresh the page and try again.');
                    checkoutRetryCount = 0;
                    return;
                }
                if (checkoutRetryCount === 1 || checkoutRetryCount % 4 === 0) {
                    initPaddle();
                }
                setTimeout(() => window.openPaddleCheckout(priceId, planName, event), 500);
                return;
            }
            checkoutRetryCount = 0;

            const btn = event?.currentTarget || event?.target;
            const originalText = btn?.textContent;
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Opening checkout…';
            }

            try {
                await window.PaymentFlow.openCheckout(priceId, planName, event);
            } catch (error) {
                console.error('Checkout error:', error);
                alert(error.message || 'Could not open checkout. Please try again.');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    if (originalText) btn.textContent = originalText;
                }
            }
        };

        window.showPaymentSuccessModal = function(planName) {
            const existingModal = document.getElementById('payment-success-modal');
            if (existingModal) existingModal.remove();

            createConfetti();

            const modal = document.createElement('div');
            modal.className = 'payment-success-modal';
            modal.id = 'payment-success-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                backdrop-filter: blur(6px);
            `;

            const capitalizedPlan = planName.charAt(0).toUpperCase() + planName.slice(1);

            modal.innerHTML = `
                <div style="
                    background: white;
                    border-radius: 32px;
                    padding: 56px 48px;
                    text-align: center;
                    max-width: 480px;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.2);
                    position: relative;
                    border: 1px solid rgba(255,255,255,0.4);
                    animation: modalSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                ">
                    <button style="
                        position: absolute;
                        top: 24px;
                        right: 24px;
                        background: transparent;
                        border: none;
                        font-size: 1.5rem;
                        color: #94a3b8;
                        cursor: pointer;
                        transition: color 0.2s ease;
                        padding: 0;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-family: 'Plus Jakarta Sans', sans-serif;
                    "
                    onmouseover="this.style.color='#f97316';"
                    onmouseout="this.style.color='#94a3b8';"
                    onclick="document.getElementById('payment-success-modal').remove();">✕</button>

                    <div style="
                        width: 88px;
                        height: 88px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #f97316, #ea580c);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 32px;
                        font-size: 3rem;
                        color: white;
                        box-shadow: 0 12px 32px rgba(249, 115, 22, 0.35);
                        animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                    ">🎉</div>

                    <h2 style="
                        font-size: 1.875rem;
                        font-weight: 800;
                        color: #0f172a;
                        margin-bottom: 12px;
                        font-family: 'Plus Jakarta Sans', sans-serif;
                        letter-spacing: -0.02em;
                    ">Welcome aboard!</h2>

                    <p style="
                        font-size: 1.1rem;
                        color: #ea580c;
                        margin-bottom: 28px;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                    ">${capitalizedPlan} Plan Unlocked ✨</p>

                    <div style="
                        padding: 20px;
                        background: linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(234, 88, 12, 0.05));
                        border-radius: 20px;
                        margin-bottom: 28px;
                        border: 1px solid rgba(249, 115, 22, 0.15);
                    ">
                        <p style="
                            font-size: 0.9rem;
                            color: #64748b;
                            margin: 0;
                            line-height: 1.6;
                            font-weight: 500;
                        ">Thank you for supporting Solis! You now have access to premium features and enhanced capabilities.</p>
                    </div>

                    <p style="
                        font-size: 0.85rem;
                        color: #94a3b8;
                        margin: 0;
                        font-weight: 500;
                    ">Redirecting to dashboard...</p>
                </div>
                </div>
            `;

            document.body.appendChild(modal);
        }

        function createConfetti() {
            const colors = ['#FF9671', '#FFD4C4', '#FF7A50', '#FF6B9D', '#C44569', '#6DDCCF', '#4ECDC4', '#B8A9E5', '#EA580C', '#F97316'];
            const confettiCount = 80;
            const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

            for (let i = 0; i < confettiCount; i++) {
                const confetti = document.createElement('div');
                const angle = (i / confettiCount) * Math.PI * 2;
                const velocity = Math.random() * 8 + 6;
                const size = Math.random() * 8 + 4;
                const distance = 150;
                const endX = Math.cos(angle) * distance * velocity;
                const endY = Math.sin(angle) * distance * velocity + 100;

                confetti.style.cssText = `
                    position: fixed;
                    width: ${size}px;
                    height: ${size}px;
                    background-color: ${colors[Math.floor(Math.random() * colors.length)]};
                    left: ${center.x}px;
                    top: ${center.y}px;
                    pointer-events: none;
                    z-index: 99999;
                    border-radius: 50%;
                    animation: confetti-burst 2.5s ease-out forwards;
                    --endX: ${endX}px;
                    --endY: ${endY}px;
                    animation-delay: ${Math.random() * 0.1}s;
                `;
                document.body.appendChild(confetti);

                setTimeout(() => confetti.remove(), 2700);
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            checkAuthenticationAndInit();
            setTimeout(initPaddle, 1000);
        });

        let currentAuthenticatedUser = null;
        let authCheckCache = null;
        let authCheckCacheTime = 0;
        const AUTH_CHECK_CACHE_DURATION = 60000; // 1 minute cache

        async function checkAuthenticationAndInit() {
            try {
                const now = Date.now();
                if (authCheckCache !== null && (now - authCheckCacheTime) < AUTH_CHECK_CACHE_DURATION) {
                    if (authCheckCache.authenticated && authCheckCache.user) {
                        currentAuthenticatedUser = authCheckCache.user;
                        window.currentAuthenticatedUser = authCheckCache.user;
                        loadUserProfile(authCheckCache.user);
                    } else {
                        console.warn('Cache says user NOT authenticated');
                        showAuthError();
                    }
                    return;
                }

                const authUrl = typeof window.apiUrl === 'function'
                    ? window.apiUrl('/api/auth/check')
                    : '/api/auth/check';
                const response = await fetch(authUrl, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();

                    authCheckCache = data;
                    authCheckCacheTime = Date.now();

                    if (data.authenticated && data.user) {
                        currentAuthenticatedUser = data.user;
                        window.currentAuthenticatedUser = data.user;
                        loadUserProfile(data.user);
                        return;
                    } else {
                        console.warn('Response OK but not authenticated');
                    }
                } else {
                    console.error('Auth check failed with status:', response.status);
                    const errorText = await response.text();
                    console.error('Response body:', errorText);
                }

                showAuthError();
            } catch (error) {
                console.error('Auth check exception:', error);
                console.error('Error details:', error.message, error.stack);
                showAuthError();
            }
        }

        function showAuthError() {
            console.warn('User not authenticated on pricing page');
            document.querySelector('.nav-login')?.style && (document.querySelector('.nav-login').style.display = 'block');
        }

        const DEFAULT_AVATAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

        function setProfileAvatar(el, url, alt) {
            if (!el) return;
            el.innerHTML = '';
            if (url) {
                const img = document.createElement('img');
                img.src = url;
                img.alt = alt || 'Profile';
                img.onerror = () => { el.innerHTML = DEFAULT_AVATAR_SVG; };
                el.appendChild(img);
            } else {
                el.innerHTML = DEFAULT_AVATAR_SVG;
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            const profileAvatarBtn = document.getElementById('profileAvatarBtn');
            const profileDropdown = document.getElementById('profileDropdown');
            const profileDropdownWr = document.getElementById('profileDropdownWr');

            if (profileAvatarBtn) {
                profileAvatarBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    profileDropdown?.classList.toggle('open');
                });
            }

            document.addEventListener('click', function(e) {
                if (profileDropdownWr && profileDropdownWr.contains(e.target)) return;
                profileDropdown?.classList.remove('open');
            });
        });

        function loadUserProfile(user) {
          try {
            const profileWr = document.getElementById('profileDropdownWr');
            const navLogin = document.querySelector('.nav-login');
            const navCta = document.querySelector('.nav-cta');

            if (user && user.email) {
                if (profileWr) profileWr.style.display = 'flex';
                if (navLogin) navLogin.style.display = 'none';
                if (navCta) navCta.style.display = 'none';

                const userName = user.username || user.name || user.email.split('@')[0] || 'User';
                const planRaw = (user.plan || 'free').toString();
                const planLabel = planRaw.charAt(0).toUpperCase() + planRaw.slice(1).toLowerCase() + ' Plan';
                const pictureUrl = typeof resolveAvatarUrl === 'function'
                    ? resolveAvatarUrl(user)
                    : (user.picture || user.avatar || null);
                const avatarUrl = pictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=ea580c&color=fff&bold=true`;

                setProfileAvatar(document.getElementById('profileAvatarBtn'), avatarUrl, userName);
                setProfileAvatar(document.getElementById('dropdownUserAvatar'), avatarUrl, userName);

                const dropdownName = document.getElementById('dropdownUserName');
                if (dropdownName) {
                    const nameSpan = dropdownName.querySelector('.username-text');
                    if (nameSpan) nameSpan.textContent = userName;
                }

                const dropdownPlan = document.getElementById('dropdownUserPlan');
                if (dropdownPlan) dropdownPlan.textContent = planLabel;
            } else {
                if (profileWr) profileWr.style.display = 'none';
                if (navLogin) navLogin.style.display = '';
                if (navCta) navCta.style.display = '';
                console.error('User data not found');
            }
          } catch (error) {
            console.error('Error loading user profile:', error);
          }
        }

        function handleLogout() {
            if (window._logoutInProgress) return;
            window._logoutInProgress = true;

            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            sessionStorage.clear();

            const apiUrl = window.API_BASE_URL || '/api';
            const logoutUrl = typeof window.apiUrl === 'function'
                ? window.apiUrl('/api/auth/logout')
                : (apiUrl.endsWith('/api') ? apiUrl + '/auth/logout' : apiUrl + '/api/auth/logout');

            sessionStorage.setItem('solis_just_logged_out', '1');
            sessionStorage.setItem('solis_skip_auth_redirect', '1');

            fetch(logoutUrl, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            })
                .catch(() => {})
                .finally(() => {
                    window.location.replace('/login.html?logout=1');
                });
        }

        document.addEventListener('DOMContentLoaded', function() {
            const logoutLink = document.getElementById('dropdownLogout');
            if (logoutLink) {
                logoutLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const profileDropdown = document.getElementById('profileDropdown');
                    if (profileDropdown) profileDropdown.classList.remove('open');
                    handleLogout();
                });
            } else {
                console.error('Logout link not found in DOM');
            }
        });
