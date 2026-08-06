function testSaaSIntegration() {

    if (window.apiManager) {
    } else {
        console.error('APIManager not found!');
    }

    if (window.fetch && window.fetch.toString().includes('apiManager')) {
    } else {
    }

    if (window.wsManager) {
    } else {
        console.error('WebSocket Manager not found!');
    }

    if (window.ws) {
    } else {
        console.error('WebSocket helper not found!');
    }

    fetch('/api/auth/subscription', { credentials: 'include' })
        .then(response => {
            return response.json();
        })
        .catch(error => {
            console.error('Request failed:', error.message);
        });

    for (let i = 0; i < 5; i++) {
        fetch('/api/auth/check', { credentials: 'include' })
            .then(() => {})
            .catch(err => console.error(`Request ${i + 1} error:`, err.message));
    }

    if (window.ws) {
        const result = ws.emit('test_event', { message: 'Testing WebSocket' });
    }

}

window.testSaaSIntegration = testSaaSIntegration;
