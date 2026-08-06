function showLimitModal() {}

function closeLimitModal() {
  const t = document.getElementById("limitModal");
  if (t) t.remove();
}

async function attemptGeneration() {
  return true;
}

window.showLimitModal = showLimitModal;

window.closeLimitModal = closeLimitModal;

window.attemptGeneration = attemptGeneration;
