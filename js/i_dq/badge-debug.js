
setTimeout(() => {
    
    if (window.notificationSystem) {
        const methods = [
            'add', 'showVideoGenerated', 'clearUnread', 'closeDropdowns',
            'getState', 'getStorageSize', 'isWebSocketConnected', 'testNotification',
            'fetchUserBadges', 'fetchCurrentUserBadges', 'sendFirstLoginNotification', 'displayUserBadge',
            'loadUserBadges'
        ];
        
        methods.forEach(method => {
            const type = typeof window.notificationSystem[method];
            const status = type === 'undefined' ? '❌' : '✅';
        });
    }
}, 100);
