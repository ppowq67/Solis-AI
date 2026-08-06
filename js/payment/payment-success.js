function showPaymentSuccessModal() {

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999999;
        backdrop-filter: blur(8px);
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(135deg, #FF9671 0%, #FF7A50 50%, #FF6B9D 100%);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        text-align: center;
        color: white;
        font-family: 'Poppins', sans-serif;
        box-shadow: 0 0 40px rgba(255, 107, 157, 0.4), 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: modalSlideIn 0.6s ease-out;
        border: 2px solid rgba(255, 255, 255, 0.2);
    `;

    modal.innerHTML = `
        <div style="font-size: 70px; margin-bottom: 20px; animation: bounce 0.6s ease-out;">🎉</div>
        <h2 style="font-size: 32px; margin: 0 0 10px 0; font-weight: 800; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);">Thank You!</h2>
        <p style="font-size: 16px; margin: 0 0 20px 0; opacity: 0.95; line-height: 1.6;">
            Your plan has been upgraded successfully. Enjoy unlimited access to all features!
        </p>
        <div style="font-size: 15px; opacity: 0.9; background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 10px; backdrop-filter: blur(10px);">
            📊 Your storage and video limits have been updated.
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (!document.getElementById('paymentModalStyles')) {
        const style = document.createElement('style');
        style.id = 'paymentModalStyles';
        style.textContent = `
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.85) translateY(-30px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            @keyframes bounce {
                0%, 100% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-20px);
                }
            }

            @keyframes confetti-fall {
                to {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => overlay.remove(), 500);
    }, 4000);
}

function createConfetti() {

    const confettiCount = 80;
    const orangeColors = ['#FF9671', '#FFD4C4', '#FF7A50', '#FF6B9D', '#FF8C42', '#FF6B35', '#FFB627', '#FF9671'];

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        const randomColor = orangeColors[Math.floor(Math.random() * orangeColors.length)];
        const size = Math.random() * 15 + 8;
        const duration = 2.5 + Math.random() * 1.5;
        const delay = Math.random() * 0.8;
        const rotation = Math.random() * 720;
        const swingAmount = Math.random() * 100 - 50;

        confetti.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            background: ${randomColor};
            left: ${Math.random() * 100}%;
            top: -20px;
            border-radius: ${Math.random() > 0.5 ? '50%' : '3px'};
            pointer-events: none;
            z-index: 9999999;
            animation: confetti-fall-${i} ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            animation-delay: ${delay}s;
            opacity: 1;
            box-shadow: 0 0 ${size * 0.8}px ${randomColor}, 0 0 ${size * 1.2}px ${randomColor}99;
            filter: drop-shadow(0 0 3px ${randomColor});
        `;

        document.body.appendChild(confetti);

        if (!document.getElementById(`confetti-keyframes-${i}`)) {
            const style = document.createElement('style');
            style.id = `confetti-keyframes-${i}`;
            style.textContent = `
                @keyframes confetti-fall-${i} {
                    0% {
                        transform: translateY(0) translateX(0) rotate(0deg) scale(1);
                        opacity: 1;
                    }
                    50% {
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) translateX(${swingAmount}px) rotate(${rotation}deg) scale(0);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
}
