// Premium/Payment Logic Handler
// Handles payment success and storage updates

// Cache for subscription info to reduce API calls
const subscriptionCache = {
    data: null,
    timestamp: 0,
    ttl: 30000 // 30 second cache
};

// Listen for payment success from premium.html
window.addEventListener('message', function(event) {
    // Accept messages from premium.html
    if (event.origin !== window.location.origin) return;
    
    if (event.data && event.data.type === 'PAYMENT_SUCCESS') {
        const { plan } = event.data;
        handlePaymentSuccessOnDashboard(plan);
    }
});

// Handle payment success on dashboard.html
async function handlePaymentSuccessOnDashboard(planName) {
    
    try {
        // 1. Show confetti and thank you modal
        createConfettiEffect();
        showPaymentSuccessModalOnDashboard(planName);
        
        // 2. Fetch updated user data from backend to ensure plan is synced
        // Use httpOnly cookies with credentials: 'include' instead of localStorage token
        try {
            const response = await fetch(`${window.API_BASE_URL}/auth/subscription`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Validate response structure
                if (!data || typeof data !== 'object' || !data.subscription) {
                    throw new Error('Invalid subscription response');
                }
                
                // Update cache
                subscriptionCache.data = data.subscription;
                subscriptionCache.timestamp = Date.now();
                
                // Update localStorage with new subscription info - validate plan first
                if (data.subscription && data.subscription.plan && typeof data.subscription.plan === 'string') {
                    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                    currentUser.plan = data.subscription.plan.toLowerCase();
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
                
                // 3. Update storage display on dashboard
                updateStorageDisplayOnDashboard(data.subscription);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error handling payment success:', error);
        }
    } catch (error) {
        console.error('Error in payment success handler:', error);
    }
}

// Create confetti effect on dashboard
function createConfettiEffect() {
    const colors = ['#FF9671', '#FFD4C4', '#FF7A50', '#FF6B9D', '#C44569', '#6DDCCF', '#4ECDC4', '#B8A9E5', '#FFD700', '#FF69B4', '#00CED1', '#FF4500'];
    const shapes = ['circle', 'square', 'triangle'];
    const confettiCount = 100;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-particle';
        
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 12 + 6;
        
        // Determine starting position: top, left bottom, or right bottom
        let startLeft, startTop, endLeft, endTop;
        const direction = Math.floor(Math.random() * 3);
        
        if (direction === 0) {
            // From top
            startLeft = Math.random() * 100;
            startTop = -10;
            endLeft = 45 + Math.random() * 10; // Towards center
            endTop = 40 + Math.random() * 20;
        } else if (direction === 1) {
            // From left bottom
            startLeft = -10;
            startTop = 60 + Math.random() * 40;
            endLeft = 45 + Math.random() * 10;
            endTop = 40 + Math.random() * 20;
        } else {
            // From right bottom
            startLeft = 110;
            startTop = 60 + Math.random() * 40;
            endLeft = 45 + Math.random() * 10;
            endTop = 40 + Math.random() * 20;
        }
        
        let shapeStyle = '';
        if (shape === 'circle') {
            shapeStyle = `border-radius: 50%;`;
        } else if (shape === 'triangle') {
            shapeStyle = `clip-path: polygon(50% 0%, 0% 100%, 100% 100%);`;
        }
        
        confetti.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            ${shapeStyle}
            left: ${startLeft}%;
            top: ${startTop}%;
            pointer-events: none;
            z-index: 9999;
            animation: confetti-explosion 2.5s ease-out forwards;
            animation-delay: ${Math.random() * 0.5}s;
            --end-left: ${endLeft}%;
            --end-top: ${endTop}%;
        `;
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 3000);
    }
}

// Show thank you modal on dashboard
function showPaymentSuccessModalOnDashboard(planName) {
    // Validate plan name before using
    if (!planName || typeof planName !== 'string' || planName.length === 0) {
        console.warn('Invalid plan name for modal');
        planName = 'your plan';
    }
    
    // Remove existing modal if any
    const existingModal = document.getElementById('dashboard-payment-success-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const capitalizedPlan = planName.charAt(0).toUpperCase() + planName.slice(1);
    
    const modal = document.createElement('div');
    modal.id = 'dashboard-payment-success-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        animation: fadeIn 0.3s ease;
        backdrop-filter: blur(8px);
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 24px;
            padding: 60px 40px;
            text-align: center;
            max-width: 550px;
            max-height: 90vh;
            overflow-y: auto;
            animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <button style="
                position: absolute;
                top: 15px;
                right: 15px;
                z-index: 1000;
                background: none;
                border: none;
                font-size: 1.5rem;
                color: #718096;
                cursor: pointer;
            " onclick="document.getElementById('dashboard-payment-success-modal').remove();">
                <i class="fas fa-times"></i>
            </button>
            
            <div style="
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background: linear-gradient(135deg, #6DDCCF, #4ECDC4);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 30px;
                font-size: 3rem;
                color: white;
            ">
                <i class="fas fa-check"></i>
            </div>
            
            <h2 style="
                font-size: 2rem;
                font-weight: 900;
                color: #1A1A2E;
                margin-bottom: 8px;
            ">Thank You!</h2>
            
            <p style="
                font-size: 1rem;
                color: #718096;
                margin-bottom: 24px;
            ">Your payment was successful</p>
            
            <div style="
                text-align: left;
                padding: 24px;
                background: #f7f7f7;
                border-radius: 16px;
                margin: 24px 0;
            ">
                <p style="font-size: 0.9rem; margin-bottom: 12px;">🎉 Congratulations!</p>
                <p style="font-size: 1.1rem; font-weight: 800; margin-bottom: 8px;">You've upgraded to the</p>
                <div style="font-size: 1.5rem; margin: 8px 0; font-weight: bold; color: #FF9671;">${capitalizedPlan} Plan</div>
                
                <div style="text-align: left; margin-top: 16px; padding-top: 16px; border-top: 2px solid rgba(255, 150, 113, 0.2);">
                    <p style="font-size: 0.9rem; font-weight: 700; margin-bottom: 12px;">✨ What's Included:</p>
                    <ul style="
                        font-size: 0.85rem;
                        line-height: 1.8;
                        margin-left: 0;
                        list-style: none;
                        color: #2D3748;
                    ">
                        <li>✓ Priority access to new features</li>
                        <li>✓ Enhanced video generation capabilities</li>
                        <li>✓ Premium templates and customization</li>
                        <li>✓ Advanced AI-powered hashtag generation</li>
                        <li>✓ Priority customer support</li>
                        <li>✓ Exclusive automation tools</li>
                        <li>✓ Extended storage capacity</li>
                    </ul>
                </div>
                
                <p style="
                    font-size: 0.9rem;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 2px solid rgba(255, 150, 113, 0.2);
                    color: #718096;
                ">
                    💡 Your ${capitalizedPlan} plan features are now active and ready to use!
                </p>
            </div>
            
            <button onclick="document.getElementById('dashboard-payment-success-modal').remove();" style="
                background: linear-gradient(135deg, #FF9671, #FF7A50);
                color: white;
                border: none;
                padding: 14px 32px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-top: 24px;
            " onmouseover="this.style.background = 'linear-gradient(135deg, #FF7A50, #FF5533)'" onmouseout="this.style.background = 'linear-gradient(135deg, #FF9671, #FF7A50)'">
                Continue to Dashboard
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Update storage display on dashboard
function updateStorageDisplayOnDashboard(subscription) {
    if (!subscription) return;
    
    // Define plan limits as fallback
    const planLimits = {
        free: { videosStorage: 2, storage: '2GB', uploadDuration: 30, videosPerDay: 1 },
        basic: { videosStorage: 10, storage: '5GB', uploadDuration: 45, videosPerDay: 3 },
        prime: { videosStorage: 20, storage: '10GB', uploadDuration: 120, videosPerDay: 5 },
        elite: { videosStorage: 100, storage: '50GB', uploadDuration: 240, videosPerDay: 10 }
    };
    
    const plan = (subscription.plan || 'free').toLowerCase();
    const unlimited = subscription.library_unlimited === true
        || ['basic', 'prime', 'elite'].includes(plan);
    
    let videosUsed = 0;
    if (window.clipsStudio && window.clipsStudio.libraryItems) {
        videosUsed = window.clipsStudio.libraryItems.length;
    }
    const videoLimit = unlimited ? null : (subscription.video_limit || 10);
    const planName = subscription.plan_name || (plan.charAt(0).toUpperCase() + plan.slice(1));
    
    if (typeof window.applyStorageBadgeUI === 'function') {
        window.applyStorageBadgeUI({ used: videosUsed, limit: videoLimit, plan, unlimited });
    } else {
        const usedBadge = document.getElementById('storageUsedBadge');
        const totalBadge = document.getElementById('storageTotalBadge');
        const planBadge = document.getElementById('storagePlanBadge');
        const limitGroup = document.getElementById('storageLimitGroup');
        if (usedBadge) usedBadge.textContent = videosUsed;
        if (totalBadge && !unlimited && videoLimit != null) totalBadge.textContent = String(videoLimit);
        if (limitGroup) {
            limitGroup.style.display = unlimited ? 'none' : '';
            limitGroup.hidden = unlimited;
        }
        if (planBadge) planBadge.textContent = planName;
    }
    
    // Also update any other storage-related displays
    updateDashboardStorageInfo(subscription);
    
    // If ClipsStudio is available, trigger storage update
    if (window.clipsStudio && typeof window.clipsStudio.loadAndDisplayStorageInfo === 'function') {
        window.clipsStudio.loadAndDisplayStorageInfo();
    }

}

// Stub function for updateDashboardStorageInfo in case it's not defined elsewhere
function updateDashboardStorageInfo(subscription) {
    // This will be overridden if s.js has a better implementation
}

// Refresh user subscription info from backend
async function refreshUserSubscriptionInfo() {
    try {
        // 🔐 SECURITY: Use httpOnly cookies only via credentials: 'include'
        // Never read authToken from localStorage - use automatic cookie-based auth
        const response = await fetch(`${window.API_BASE_URL}/auth/subscription`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // 🔐 SECURITY: Always validate response before trusting it
            if (data && data.subscription && typeof data.subscription.plan === 'string') {
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                currentUser.plan = data.subscription.plan;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
            return data.subscription;
        }
    } catch (error) {
        console.error('Error refreshing subscription:', error);
    }
    return null;
}

// Add CSS animations to document
if (!document.getElementById('premium-logic-styles')) {
    const style = document.createElement('style');
    style.id = 'premium-logic-styles';
    style.textContent = `
        @keyframes confetti-explosion {
            0% {
                transform: translate(0, 0) rotate(0deg) scale(1);
                opacity: 1;
            }
            30% {
                transform: translate(var(--end-left), var(--end-top)) rotate(180deg) scale(1.2);
                opacity: 1;
            }
            60% {
                transform: translate(var(--end-left), calc(var(--end-top) + 100px)) rotate(360deg) scale(0.8);
                opacity: 0.8;
            }
            100% {
                transform: translate(var(--end-left), calc(var(--end-top) + 300px)) rotate(720deg) scale(0.5);
                opacity: 0;
            }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .confetti-particle {
            animation: confetti-explosion 2.5s ease-out forwards !important;
        }
    `;
    document.head.appendChild(style);
}

// Export functions for global use
window.handlePaymentSuccessOnDashboard = handlePaymentSuccessOnDashboard;
window.refreshUserSubscriptionInfo = refreshUserSubscriptionInfo;

