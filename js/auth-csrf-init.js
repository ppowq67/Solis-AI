const APP_VERSION = "1.0.0";

if (window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
  console.warn("Warning: Connection is not secure. Use HTTPS in production.");
}

function isNewUser() {
  const e = sessionStorage.getItem("solis_visited");
  return !e;
}

function markUserAsVisited() {
  sessionStorage.setItem("solis_visited", "true");
}

function validateUserObject(e) {
  if (!e || typeof e !== "object") {
    throw new Error("Invalid user object");
  }
  const o = [ "id", "email", "name", "role", "picture", "plan", "auth_provider" ];
  const t = {};
  for (const n of o) {
    if (n in e) {
      const o = e[n];
      if (typeof o === "string" || typeof o === "number") {
        t[n] = o;
      }
    }
  }
  return t;
}

function checkVersionUpdate() {
  const e = sessionStorage.getItem("appVersion");
  if (e && e !== APP_VERSION) {
    sessionStorage.setItem("showVersionUpdate", "true");
  }
  sessionStorage.setItem("appVersion", APP_VERSION);
}

async function verifyAndRedirect() {
  try {
    const e = `${window.API_BASE_URL}/auth/check`;
    const o = window.apiFetch || fetch;
    const t = await o(e, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    const n = await t.json();
    if (t.ok) {
      if (!n || typeof n !== "object" || !n.user) {
        throw new Error("Invalid API response format");
      }
      const e = validateUserObject(n.user);
      sessionStorage.setItem("userId", String(e.id));
      const o = isNewUser();
      markUserAsVisited();
      checkVersionUpdate();
      window.history.replaceState({}, document.title, window.location.pathname);
      const t = o ? "/welcome.html" : "/dashboard.html";
      setTimeout(() => {
        window.location.href = t;
      }, 100);
    } else {
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 100);
    }
  } catch (e) {
    console.error("Error during verification:", e.message);
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 100);
  }
}

setTimeout(() => {
  verifyAndRedirect();
}, 500);
