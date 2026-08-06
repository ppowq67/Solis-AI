function analyzeVideoForCreate() {
  const o = window.clipsStudio || window.clipStudio;
  if (o && typeof o.processYouTubeUrl === "function") {
    o.processYouTubeUrl();
  }
}
