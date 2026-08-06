function testSaaSIntegration() {
  if (window.apiManager) {} else {
    console.error("APIManager not found!");
  }
  if (window.fetch && window.fetch.toString().includes("apiManager")) {} else {}
  if (window.wsManager) {} else {
    console.error("WebSocket Manager not found!");
  }
  if (window.ws) {} else {
    console.error("WebSocket helper not found!");
  }
  fetch("/api/auth/subscription", {
    credentials: "include"
  }).then(e => e.json()).catch(e => {
    console.error("Request failed:", e.message);
  });
  for (let e = 0; e < 5; e++) {
    fetch("/api/auth/check", {
      credentials: "include"
    }).then(() => {}).catch(n => console.error(`Request ${e + 1} error:`, n.message));
  }
  if (window.ws) {
    const e = ws.emit("test_event", {
      message: "Testing WebSocket"
    });
  }
}

window.testSaaSIntegration = testSaaSIntegration;
