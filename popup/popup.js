const ONE_HOUR = 1000 * 60 * 60;

// reusable functions to avoid duplicates and cluttering the js file

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
  setInterval(() => updateCountdown(session.date_start), 1000);
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

    const cancelledNote = session.is_cancelled
      ? `<p class="cancelled">Status : Cancelled</p>`
      : "";

    card.innerHTML = `
      <p><strong>${session.session_name}</strong></p>
      <p>Date : ${dOnly}</p>
      <p>Time : ${tOnly}</p>
      ${cancelledNote}
    `;

    listContainer.appendChild(card);
  });
}

// this function simply uses previous functions to display data of the full weekend , used to avoid cluttering
function renderAll(allSessions) {
  if (allSessions.length === 0) {
    document.getElementById("next-session").innerHTML = "<p>No upcoming session scheduled</p>";
    return;
  }
  const nextSession = allSessions[0];
  renderNextSession(nextSession);
  renderWeekendList(allSessions, nextSession);
}

// this function creates countdown,calculates and updates the time remaining until session start
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


// this function fetches data from the api,sets the cache and displays the data
function fetchAndCache() {
  const now = new Date().toISOString();
  const url = `https://api.openf1.org/v1/sessions?date_start>=${now}`;

  fetch(url)
    .then((response) => response.json())
    .then((jsonContent) => {
      chrome.storage.local.set({
        cachedSessions: jsonContent,
        cachedTimestamp: Date.now(),
      });
      renderAll(jsonContent);
    })
    .catch((error) => {
      console.error("Fetch failed:", error);
      document.getElementById("next-session").innerHTML =
        "<p>Couldn't load session data. Check your connection and try again.</p>";
    });
}


// this is the start of the code ,we check chrome storage first and compare timestamp with actual
// time if it's over one hour since that's the refresh threshold,if it's stale we fetch new data 
// if it's not we don't 
chrome.storage.local.get(["cachedSessions", "cachedTimestamp"]).then((result) => {
  const now = Date.now();
  const isStale = !result.cachedTimestamp || now - result.cachedTimestamp > ONE_HOUR;

  if (!isStale) {
    renderAll(result.cachedSessions);
  } else {
    fetchAndCache();
  }
});