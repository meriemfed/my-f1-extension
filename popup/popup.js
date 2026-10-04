const ONE_HOUR = 1000 * 60 * 60;
const LIVE_WINDOW_BUFFER = 30 * 60 * 1000;

let countdownTimer = null;

const currentYear = new Date().getFullYear().toString().slice(-2);
document.getElementById("season-label").textContent = `Season ${currentYear}`;

// reusable functions to avoid duplicates and cluttering the js file

// returns true only if the data is a non-empty array of session objects
function isValidSessions(data) {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof data[0] === "object" &&
    data[0] !== null &&
    "date_start" in data[0]
  );
}

// this function displays the next session data on the main card
function renderNextSession(session) {
  document.getElementById("circuit-name").textContent = session.circuit_short_name;
  document.getElementById("session-type").textContent = session.session_name;
  document.getElementById("session-location").textContent =
    `${session.location}, ${session.country_name}`;

  const dateOnly = new Date(session.date_start).toLocaleDateString("fr-FR");
  const timeOnly = new Date(session.date_start).toLocaleTimeString("fr-FR", { timeStyle: "short" });
  document.getElementById("session-date").textContent = dateOnly;
  document.getElementById("session-time").textContent = timeOnly;

  if (session.is_cancelled) {
    document.getElementById("session-status").textContent = "Status : Cancelled";
  }

  updateCountdown(session.date_start);
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => updateCountdown(session.date_start), 1000);
}

// this function displays the rest of the sessions of the weekend in a list below the next session card
function renderWeekendList(allSessions, nextSession) {
  const sameWeekend = allSessions.filter(
    (session) =>
      session.meeting_key === nextSession.meeting_key &&
      session.session_key !== nextSession.session_key
  );

  const listContainer = document.getElementById("weekend-sessions");
  listContainer.innerHTML = "";

  if (sameWeekend.length === 0) {
    listContainer.innerHTML = "<p>No other sessions left this weekend</p>";
    return;
  }

  sameWeekend.forEach((session) => {
    const card = document.createElement("div");
    card.className = "session-card";

    const dOnly = new Date(session.date_start).toLocaleDateString("fr-FR");
    const tOnly = new Date(session.date_start).toLocaleTimeString("fr-FR", { timeStyle: "short" });

    card.innerHTML = `
      <p class="session-name"></p>
      <p class="session-date"><span class="label">Date : </span><span class="value"></span></p>
      <p class="session-time"><span class="label">Time : </span><span class="value"></span></p>
      <p class="session-cancelled"></p>
    `;

    card.querySelector(".session-name").textContent = session.session_name;
    card.querySelector(".session-date .value").textContent = dOnly;
    card.querySelector(".session-time .value").textContent = tOnly;

    if (session.is_cancelled) {
      card.querySelector(".session-cancelled").textContent = "Status : Cancelled";
    }

    listContainer.appendChild(card);
  });
}

// this function simply uses previous functions to display data of the full weekend, used to avoid cluttering
function renderAll(allSessions) {
  if (!Array.isArray(allSessions) || allSessions.length === 0) {
    document.getElementById("next-session").innerHTML = "<p>No upcoming session scheduled</p>";
    return;
  }
  const nextSession = allSessions[0];
  renderNextSession(nextSession);
  renderWeekendList(allSessions, nextSession);
}

// this function creates countdown, calculates and updates the time remaining until session start
function updateCountdown(targetDateString) {
  const target = new Date(targetDateString).getTime();
  const now = new Date().getTime();
  const diff = target - now;

  if (diff <= 0) {
    document.getElementById("countdown").textContent = "Session started";
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  document.getElementById("countdown").textContent =
    `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// this function fetches data from the api, validates it, sets the cache and displays the data.
// invalid responses (like the live-session lock object) are NEVER cached.
function fetchAndCache() {
  const now = new Date().toISOString();
  const url = `https://api.openf1.org/v1/sessions?date_start>=${now}`;

  fetch(url)
    .then((response) => response.json())
    .then((jsonContent) => {
      // API returns an object like { detail: "..." } instead of an array when restricted
      if (!Array.isArray(jsonContent)) {
        const err = new Error(jsonContent && jsonContent.detail ? jsonContent.detail : "Unexpected response");
        err.restricted = true;
        throw err;
      }

      chrome.storage.local.set({
        cachedSessions: jsonContent,
        cachedTimestamp: Date.now(),
      });
      renderAll(jsonContent);
    })
    .catch((error) => {
      console.error("Fetch failed:", error);
      document.getElementById("next-session").innerHTML = error.restricted
        ? "<p>Data access is restricted while a live session is running. Try again after it ends.</p>"
        : "<p>Couldn't load session data. Check your connection and try again.</p>";
    });
}

// returns the session's current phase relative to time now: "starting-soon",
// "in-progress", "wrapping-up" (within 30 min after end according to the openf1 API live window), or null if not live at all
function getLiveStatus(session) {
  const now = Date.now();
  const start = new Date(session.date_start).getTime();
  const end = new Date(session.date_end).getTime();

  if (now >= start - LIVE_WINDOW_BUFFER && now < start) return "starting-soon";
  if (now >= start && now <= end) return "in-progress";
  if (now > end && now <= end + LIVE_WINDOW_BUFFER) return "wrapping-up";
  return null;
}

// entry point: check cache first. if the cached next session is currently live
// (in any phase), show a status message instead of fetching. otherwise, fetch
// only if the cache is missing/invalid, older than 1 hour, or the cached session is over
chrome.storage.local.get(["cachedSessions", "cachedTimestamp"]).then((result) => {
  const now = Date.now();

  // only trust the cache if it is a valid array of sessions
  const cached = isValidSessions(result.cachedSessions) ? result.cachedSessions : null;

  // clean up any previously poisoned cache
  if (result.cachedSessions && !cached) {
    chrome.storage.local.remove(["cachedSessions", "cachedTimestamp"]);
  }

  const liveStatus = cached ? getLiveStatus(cached[0]) : null;

  if (liveStatus) {
    const session = cached[0];
    let message;

    if (liveStatus === "starting-soon") {
      message = `<strong class="live-session-name"></strong> is starting soon.`;
    } else if (liveStatus === "in-progress") {
      message = `<strong class="live-session-name"></strong> is currently in progress.`;
    } else {
      message = `<strong class="live-session-name"></strong> has finished.`;
    }

    document.getElementById("next-session").innerHTML = `
      <p>${message}</p>
      <p>Live timing isn't available in this extension.</p>
    `;
    document.querySelector(".live-session-name").textContent = session.session_name;
    renderWeekendList(cached, session);
    return;
  }

  // the cached "next session" is over (past its live window) means data is outdated
  const isOver = cached && now > new Date(cached[0].date_end).getTime() + LIVE_WINDOW_BUFFER;

  const isStale =
    !cached ||
    !result.cachedTimestamp ||
    now - result.cachedTimestamp > ONE_HOUR ||
    isOver;

  if (!isStale) {
    renderAll(cached);
  } else {
    fetchAndCache();
  }
});