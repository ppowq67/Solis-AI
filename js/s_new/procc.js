function analyzeVideoForCreate() {
    const studio = window.clipsStudio || window.clipStudio;
    if (studio && typeof studio.processYouTubeUrl === 'function') {
        studio.processYouTubeUrl();
    }
}
