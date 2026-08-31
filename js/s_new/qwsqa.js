                // ===== SECURITY: Never use localStorage for sensitive auth data =====
        // Always use httpOnly cookies with credentials: 'include'

        // ===== VALIDATION SCHEMAS & LIMITS =====
        const VALIDATION = {
            MAX_STRING_LENGTH: 500,
            MAX_EMAIL_LENGTH: 254,
            MAX_USERNAME_LENGTH: 100,
            MAX_ERROR_MSG_LENGTH: 200,
            ALLOWED_PLANS: ['free', 'basic', 'prime', 'elite'],
            MAX_VIDEOS_LIMIT: 1000,
            MAX_STORAGE_GB: 10000
        };

        // Sanitize strings to prevent injection
        window.sanitizeString = function(str) {
            if (typeof str !== 'string') return '';
            // Truncate to max length
            const truncated = str.substring(0, VALIDATION.MAX_STRING_LENGTH);
            // Remove any HTML/special chars by using textContent trick
            const div = document.createElement('div');
            div.textContent = truncated;
            return div.innerHTML;
        };

        // Validate numeric value is safe
        window.validateNumber = function(num, min = 0, max = Infinity, defaultVal = 0) {
            if (typeof num !== 'number' || isNaN(num)) return defaultVal;
            return Math.max(min, Math.min(max, num));
        };

        // Validate and sanitize error messages
        window.getSafeErrorMessage = function(error) {
            if (!error) return 'An error occurred';
            // Only use hardcoded messages or safe error codes
            if (error.code === 'RATE_LIMIT') return 'Too many requests. Please try again later.';
            if (error.code === 'AUTH_FAILED') return 'Authentication failed. Please log in again.';
            if (error.code === 'PERMISSION_DENIED') return 'You do not have permission for this action.';
            if (error.code === 'SERVER_ERROR') return 'Server error. Please try again later.';
            // Default safe message - never expose user input
            return 'Operation failed. Please try again.';
        };

        // Validate URLs before DOM injection
        window.isValidImageUrl = function(url) {
            if (!url || typeof url !== 'string') return false;
            const trimmed = url.trim();
            const lower = trimmed.toLowerCase();
            if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
                return false;
            }
            // Same-origin relative avatar / asset paths
            if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
                return true;
            }
            try {
                const urlObj = new URL(trimmed, window.location.href);
                return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
            } catch {
                return false;
            }
        };

        // Validate and sanitize user object
        window.validateUserObject = function(obj) {
            if (!obj || typeof obj !== 'object') return null;
            
            // Only allow expected fields, reject unknown keys
            const allowed = ['name', 'email', 'username', 'picture', 'avatar', 'photo', 'plan', 'id', 'tier', 'youtube_connected', 'bio'];
            const validated = {};
            
            for (const key of allowed) {
                if (obj.hasOwnProperty(key)) {
                    const value = obj[key];
                    // Type validation with length limits
                    if (key === 'email' && typeof value === 'string') {
                        if (value.length > VALIDATION.MAX_EMAIL_LENGTH) return null;
                        validated[key] = window.sanitizeString(value);
                    } else if (key === 'username' && typeof value === 'string') {
                        if (value.length > VALIDATION.MAX_USERNAME_LENGTH) return null;
                        validated[key] = window.sanitizeString(value);
                    } else if ((key === 'name' || key === 'picture' || key === 'avatar' || key === 'photo') && typeof value === 'string') {
                        if (value.length > VALIDATION.MAX_STRING_LENGTH) return null;
                        validated[key] = window.sanitizeString(value);
                    } else if (key === 'plan' && typeof value === 'string') {
                        if (!VALIDATION.ALLOWED_PLANS.includes(value.toLowerCase())) return null;
                        validated[key] = value.toLowerCase();
                    } else if ((key === 'id' || key === 'tier') && (typeof value === 'string' || typeof value === 'number')) {
                        validated[key] = value;
                    } else if (key === 'youtube_connected' && typeof value === 'boolean') {
                        validated[key] = value;
                    } else if (key === 'bio' && typeof value === 'string') {
                        if (value.length > 120) return null;
                        validated[key] = window.sanitizeString(value);
                    }
                }
            }
            
            // Must have at least an id or email
            if (!validated.id && !validated.email) return null;
            return validated;
        };



        // ===== SECURE LOGOUT HANDLER =====
        window.handleSecureLogout = function() {
            if (typeof window._comprehensiveLogout === 'function') {
                window._comprehensiveLogout();
                return;
            }
            if (window._logoutInProgress) return;
            window._logoutInProgress = true;

            sessionStorage.setItem('solis_just_logged_out', '1');
            sessionStorage.setItem('solis_skip_auth_redirect', '1');

            fetch(window.apiUrl('/api/auth/logout'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            })
                .catch(() => {})
                .finally(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('userSubscription');
                    window.currentUser = null;
                    window.location.replace('/login.html?logout=1');
                });
        };

        // ===== UPDATE PROFILE DROPDOWN - SECURE VERSION =====
        // Only display data; never trust client-side user info for actual permissions
        async function updateProfileDropdown(user) {
            if (!user) {
                console.warn('No user provided to updateProfileDropdown');
                return;
            }

            // Validate the user object structure to prevent injection
            const validatedUser = window.validateUserObject(user);
            if (!validatedUser) {
                console.warn('User object failed validation, skipping dropdown update');
                return;
            }


            const dropdownName = document.getElementById('dropdownUserName');
            const dropdownPlan = document.getElementById('dropdownUserPlan');
            const dropdownAvatar = document.getElementById('dropdownUserAvatar');

            // Update name (display only, not security-sensitive)
            if (dropdownName) {
                const displayName = validatedUser.name || validatedUser.username || validatedUser.email || 'Guest User';
                let usernameText = dropdownName.querySelector('.username-text');
                if (!usernameText) {
                    usernameText = document.createElement('span');
                    usernameText.className = 'username-text';
                    dropdownName.insertBefore(usernameText, dropdownName.firstChild);
                }
                usernameText.textContent = displayName;
            }

            // ===== FETCH REAL PLAN FROM BACKEND =====
            // Never trust localStorage or client-side data for plan info
            let planToDisplay = 'Free'; // Safe default
            try {
                // Use httpOnly cookies, NOT localStorage token
                const response = await window.apiRequestCache.dedupFetch(window.apiUrl('/api/user/profile'), {
                    method: 'POST',
                    credentials: 'include', // ✅ Uses httpOnly cookie automatically
                    headers: window.secureHeaders(),
                    body: JSON.stringify({})
                });
                
                if (response.ok) {
                    const data = await response.json();
                    // Validate response structure strictly
                    if (data && typeof data === 'object' && data.plan && typeof data.plan === 'string' && data.plan.length > 0) {
                        const planLower = data.plan.toLowerCase();
                        if (VALIDATION.ALLOWED_PLANS.includes(planLower)) {
                            planToDisplay = planLower;
                        } else {
                            console.warn('Invalid plan from backend:', data.plan);
                        }
                    } else {
                        console.warn('Invalid response structure from /api/user/profile');
                    }
                } else {
                    console.warn('Failed to fetch profile from backend:', response.status);
                }
            } catch (err) {
                console.warn('Could not fetch plan from backend, using safe default:', err);
            }

            if (dropdownPlan && typeof planToDisplay === 'string' && planToDisplay.length > 0) {
                const planCapitalized = planToDisplay.charAt(0).toUpperCase() + planToDisplay.slice(1).toLowerCase();
                const planText = `${planCapitalized} Plan`;
                dropdownPlan.textContent = planText;
            }

            // ===== SECURE AVATAR IMAGE =====
            // Validate URL before injecting into DOM
            const pictureUrl = typeof resolveAvatarUrl === 'function'
                ? resolveAvatarUrl(validatedUser)
                : (validatedUser.picture || validatedUser.avatar || validatedUser.photo || null);
            if (dropdownAvatar) {
                if (pictureUrl && window.isValidImageUrl(pictureUrl)) {
                    
                    // Clear existing content
                    dropdownAvatar.innerHTML = '';
                    
                    const img = document.createElement('img');
                    img.src = pictureUrl;
                    img.alt = validatedUser.name || 'Profile';
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
                    
                    img.onerror = () => {
                        console.warn('Failed to load profile image');
                        dropdownAvatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                    };
                    
                    dropdownAvatar.appendChild(img);
                } else {
                    // Show default avatar SVG
                    dropdownAvatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                }
            }
        }
        window.updateProfileDropdown = updateProfileDropdown;
        document.addEventListener('DOMContentLoaded', () => {
            // ===== DROPDOWN EVENT LISTENERS =====
            const profileAvatarBtn = document.getElementById('profileAvatarBtn');
            const profileDropdown = document.getElementById('profileDropdown');
            const profileDropdownWr = document.getElementById('profileDropdownWr');

            // Toggle dropdown on avatar click
            if (profileAvatarBtn) {
                profileAvatarBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Close notifications dropdown when opening profile
                    const notifDropdown = document.getElementById('notificationsDropdown');
                    if (notifDropdown) notifDropdown.classList.remove('open');
                    if (profileDropdown) {
                        profileDropdown.classList.toggle('open');
                        if (profileDropdown.classList.contains('open')) {
                            if (window.NotificationSystemV2?.loadUserBadges) {
                                window.NotificationSystemV2.loadUserBadges(true);
                            } else if (window.SolisBadges?.renderCurrentUser) {
                                window.SolisBadges.renderCurrentUser(['dropdown-badges'], 22);
                            }
                        }
                    }
                });
            } else {
                console.warn('profileAvatarBtn element not found');
            }

            // Close dropdown when clicking outside - SAFE null check
            document.addEventListener('click', (e) => {
                if (profileDropdownWr && profileDropdownWr.contains(e.target)) {
                    return; // Clicked inside dropdown, don't close
                }
                if (profileDropdown) {
                    profileDropdown.classList.remove('open');
                }
            });

            // Profile dropdown link handlers
            const dropdownBilling = document.getElementById('dropdownBilling');
            const dropdownPricing = document.getElementById('dropdownPricing');
            const dropdownLogout = document.getElementById('dropdownLogout');

            // Note: dropdownSettings is handled by stg.js
            // Note: dropdownBilling is handled by billing.js (billing panel Modal)

            if (dropdownPricing) {
                dropdownPricing.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (profileDropdown) profileDropdown.classList.remove('open');
                    // Navigate to premium/pricing
                    window.location.href = '/premium.html';
                });
            }

            // Logout click is handled by s.js (dropdownLogout → _comprehensiveLogout)

            // ===== LOAD USER DATA FOR DROPDOWN - SAFELY =====
            let currentUser = null;
            
            try {
                // Try to get from window object first (source of truth)
                if (window.currentUser) {
                    currentUser = window.validateUserObject(window.currentUser);
                }
                
                // If not in window, try localStorage as backup
                if (!currentUser) {
                    const saved = localStorage.getItem('currentUser');
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            currentUser = window.validateUserObject(parsed);
                        } catch (parseErr) {
                            console.error('Failed to parse localStorage currentUser:', parseErr);
                            // Continue without user data rather than crashing
                        }
                    }
                }
                
                // Only update dropdown if we have valid user data
                if (currentUser) {
                    updateProfileDropdown(currentUser);
                } else {
                    console.warn('No valid user data available for dropdown');
                }
            } catch (err) {
                console.error('Error loading user data for dropdown:', err);
                // Don't crash the app if user loading fails
            }
        });