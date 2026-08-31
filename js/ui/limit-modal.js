/**
 * Legacy limit modal — disabled. Use inline notifications + plan selector pill instead.
 */
function showLimitModal() {
    /* no-op: full-screen limit overlay removed */
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
