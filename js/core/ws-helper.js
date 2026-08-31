window.ws = {
  emit(e, t = {}) {
    if (window.wsManager) {
      return window.wsManager.emit(e, t);
    } else if (window.solisWSClient && window.solisWSClient.socket) {
      window.solisWSClient.socket.emit(e, t);
      return true;
    }
    console.warn(`[ws.emit] WebSocket not available for event: ${e}`);
    return false;
  },
  async request(e, t = {}) {
    if (window.wsManager) {
      return window.wsManager.request(e, t);
    } else if (window.solisWSClient && window.solisWSClient.socket) {
      return new Promise((n, o) => {
        const i = setTimeout(() => {
          o(new Error(`WebSocket request timeout: ${e}`));
        }, 3e4);
        window.solisWSClient.socket.emit(e, {
          ...t,
          _requestId: Date.now()
        });
        setTimeout(() => {
          clearTimeout(i);
          n({});
        }, 100);
      });
    }
    console.error(`[ws.request] WebSocket not available`);
    throw new Error("WebSocket not available");
  },
  getStatus() {
    if (window.wsManager) {
      return window.wsManager.getStatus();
    } else if (window.solisWSClient) {
      return {
        connected: window.solisWSClient.socket?.connected || false,
        userId: window.solisWSClient.userId
      };
    }
    return {
      connected: false
    };
  },
  events: {
    customization_changed: "customization_changed",
    element_selected: "element_selected",
    template_updated: "template_updated",
    video_generated: "video_generated",
    processing_complete: "processing_complete",
    notification_read: "notification_read",
    message_received: "message_received",
    interaction_logged: "interaction_logged",
    event_tracked: "event_tracked"
  }
};
