function showLimitModal() {
}

function closeLimitModal() {
    const overlay = document.getElementById('limitModal');
    if (overlay) overlay.remove();
}

async function attemptGeneration() {
    return true;
}

window.showLimitModal = showLimitModal;
window.closeLimitModal = closeLimitModal;
window.attemptGeneration = attemptGeneration;
