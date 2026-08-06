setTimeout(() => {
  if (window.notificationSystem) {
    const e = [ "add", "showVideoGenerated", "clearUnread", "closeDropdowns", "getState", "getStorageSize", "isWebSocketConnected", "testNotification", "fetchUserBadges", "fetchCurrentUserBadges", "sendFirstLoginNotification", "displayUserBadge", "loadUserBadges" ];
    e.forEach(e => {
      const t = typeof window.notificationSystem[e];
      const o = t === "undefined" ? "❌" : "✅";
    });
  }
}, 100);
