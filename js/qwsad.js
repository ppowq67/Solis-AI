(async () => {
  const i = window.API_BASE_URL || "https://api.solisai.video/api";
  try {
    const o = await fetch(`${i}/auth/check`, {
      method: "GET",
      credentials: "include"
    });
    if (!o.ok) {
      window.location.href = "/welcome.html";
    }
  } catch (i) {
    window.location.href = "/login.html";
  }
})();
