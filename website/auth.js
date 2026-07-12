// TermCoder site auth — redirect-based OAuth (GitHub + Google), no remote deps.
// The client SECRET never touches the browser; the code-for-token exchange
// happens in the Cloudflare Worker (website/auth/worker.js). Until config.js is
// filled in, the Sign-in buttons fall through to the dashboard preview.
(function () {
  var CFG = window.TC_AUTH || {};
  var SESSION_KEY = "tc-session";
  var STATE_KEY = "tc-oauth-state";

  function configured(provider) {
    if (!CFG.workerUrl) return false;
    var p = CFG[provider];
    return Boolean(p && p.clientId);
  }
  function callbackUrl() {
    return new URL("callback.html", location.href).href.split("#")[0];
  }
  function randomState() {
    var a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function authorizeUrl(provider) {
    var state = randomState();
    sessionStorage.setItem(STATE_KEY, provider + ":" + state);
    var redirect = callbackUrl();
    if (provider === "github") {
      return "https://github.com/login/oauth/authorize?client_id=" + encodeURIComponent(CFG.github.clientId) +
        "&redirect_uri=" + encodeURIComponent(redirect) +
        "&scope=" + encodeURIComponent("read:user user:email") +
        "&state=" + encodeURIComponent(state);
    }
    if (provider === "google") {
      return "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + encodeURIComponent(CFG.google.clientId) +
        "&redirect_uri=" + encodeURIComponent(redirect) +
        "&response_type=code&scope=" + encodeURIComponent("openid email profile") +
        "&state=" + encodeURIComponent(state);
    }
    return null;
  }
  function beginLogin(provider) {
    var url = authorizeUrl(provider);
    if (url) location.href = url;
  }
  function currentSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    location.href = "login.html";
  }
  async function handleCallback() {
    var params = new URLSearchParams(location.search);
    var code = params.get("code");
    var state = params.get("state");
    var stored = sessionStorage.getItem(STATE_KEY) || "";
    var provider = stored.split(":")[0];
    var expected = stored.split(":")[1];
    var statusEl = document.getElementById("cb-status");
    function fail(msg) { if (statusEl) statusEl.textContent = msg; }
    if (params.get("error")) return fail("Sign-in was cancelled. You can head back and try again.");
    if (!code || !state || state !== expected || !provider) return fail("That sign-in response didn't check out. Please try again.");
    if (!CFG.workerUrl) return fail("Auth isn't configured yet — see website/auth/README.md.");
    try {
      var res = await fetch(CFG.workerUrl.replace(/\/$/, "") + "/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: provider, code: code, redirect_uri: callbackUrl() }),
      });
      if (!res.ok) return fail("Sign-in failed (" + res.status + "). Please try again.");
      var profile = await res.json();
      if (profile.error) return fail("Sign-in failed: " + profile.error);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        provider: provider,
        name: profile.name || profile.login || "",
        email: profile.email || "",
        avatar: profile.avatar || "",
      }));
      sessionStorage.removeItem(STATE_KEY);
      location.href = "dashboard.html";
    } catch (e) {
      fail("Could not reach the auth service. Check the Worker URL in config.js.");
    }
  }

  function wireLoginButtons() {
    document.querySelectorAll(".auth-btn[data-provider]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        var p = b.getAttribute("data-provider");
        if (configured(p)) { e.preventDefault(); beginLogin(p); }
        // else: allow the default href (dashboard.html) — preview mode
      });
    });
  }
  function hydrateDashboard() {
    var s = currentSession();
    if (s) {
      var nameEl = document.querySelector(".acct-name");
      if (nameEl && (s.email || s.name)) nameEl.textContent = s.email || s.name;
    }
    document.querySelectorAll("[data-signout]").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); signOut(); });
    });
  }

  window.TCAuth = {
    beginLogin: beginLogin,
    handleCallback: handleCallback,
    currentSession: currentSession,
    signOut: signOut,
  };
  document.addEventListener("DOMContentLoaded", function () {
    wireLoginButtons();
    hydrateDashboard();
  });
})();
