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
        "&scope=" + encodeURIComponent("read:user user:email gist") +
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
        token: provider === "github" ? (profile.token || "") : "",
        sub: profile.sub || "",
        session: profile.session || "",
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
      var avatarEl = document.querySelector(".acct-avatar");
      if (avatarEl && s.avatar) { avatarEl.src = s.avatar; avatarEl.style.display = "inline-block"; }
      var greetEl = document.querySelector("[data-greet]");
      if (greetEl && s.name) greetEl.textContent = ", " + s.name.split(" ")[0];
      if (s.provider === "github" && s.token) void loadSyncedData(s.token);
    }
    document.querySelectorAll("[data-signout]").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); signOut(); });
    });
  }

  // Read the user's own private "termcoder:sync" gist (decks + progress) and
  // fill the real Study numbers. Best-effort: any failure leaves the sample.
  async function loadSyncedData(token) {
    try {
      var headers = { authorization: "Bearer " + token, accept: "application/vnd.github+json" };
      var gists = await (await fetch("https://api.github.com/gists?per_page=100", { headers })).json();
      if (!Array.isArray(gists)) return;
      var sync = gists.find(function (g) { return (g.description || "").indexOf("termcoder:sync") === 0; });
      if (!sync) return;
      var full = await (await fetch("https://api.github.com/gists/" + sync.id, { headers })).json();
      var files = full.files || {};
      var decks = parseEnvelope(files["decks.json"]);
      var progress = parseEnvelope(files["progress.json"]);
      var deckNames = decks && typeof decks === "object" ? Object.keys(decks) : [];
      var due = 0, now = Date.now();
      var rows = [];
      deckNames.forEach(function (n) {
        var cards = (decks[n] && decks[n].cards) || [];
        var deckDue = cards.filter(function (c) { return !c.due || c.due <= now; }).length;
        due += deckDue;
        rows.push(
          '<div class="dash-row"><span class="dash-c1">' + escapeHtml(n) +
          '</span><span class="dash-c2">' + cards.length + (cards.length === 1 ? " card" : " cards") +
          '</span><span class="badge-2">' + deckDue + " due</span></div>"
        );
      });
      var streak = (progress && (progress.streak || progress.currentStreak)) || 0;
      var streakText = streak + (streak === 1 ? " day" : " days");
      setStat("streak", streakText);
      setStat("study-streak", streakText);
      setStat("study-due", due + " cards");
      setStat("study-decks", String(deckNames.length));
      setDeckList(rows.length ? rows.join("") : '<div class="dash-empty">No synced decks yet. Create some in the app.</div>');
    } catch (e) { /* leave the sample data in place */ }
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function setDeckList(html) {
    document.querySelectorAll("[data-deck-list]").forEach(function (el) { el.innerHTML = html; });
  }
  function parseEnvelope(file) {
    if (!file || !file.content) return null;
    try {
      var env = JSON.parse(file.content);
      return env && typeof env === "object" && "data" in env ? env.data : env;
    } catch (e) {
      return null;
    }
  }
  function setStat(id, value) {
    document.querySelectorAll('[data-stat="' + id + '"]').forEach(function (el) { el.textContent = value; });
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
