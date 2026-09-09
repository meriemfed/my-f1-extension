const now = new Date().toISOString();
const url = `https://api.openf1.org/v1/sessions?date_start>=${now}`;

const currentYear = new Date().getFullYear().toString().slice(-2);
document.getElementById("season-label").textContent = `season ${currentYear}`;

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

fetch(url)
  .then((response) => response.json())
  .then((jsonContent) => {
    if (jsonContent.length > 0) {
      const nextSession = jsonContent[0];

      document.getElementById("circuit-name").textContent = nextSession.circuit_short_name;
      document.getElementById("session-location").textContent =
     `${nextSession.location}, ${nextSession.country_name}`;
      document.getElementById("session-type").textContent = nextSession.session_name;

      const dateOnly = new Date(nextSession.date_start).toLocaleDateString("fr-FR");
      const timeOnly = new Date(nextSession.date_start).toLocaleTimeString("fr-FR", { timeStyle: "short" });
      document.getElementById("session-date").textContent = dateOnly;
      document.getElementById("session-time").textContent = timeOnly;

      updateCountdown(nextSession.date_start);
      setInterval(() => updateCountdown(nextSession.date_start), 1000);

      if (nextSession.is_cancelled) {
        document.getElementById("session-status").textContent = "Cancelled";
      }

      const sameWeekend = jsonContent.filter(
        (session) =>
          session.meeting_key === nextSession.meeting_key &&
          session.session_key !== nextSession.session_key
      );

      const listContainer = document.getElementById("weekend-sessions");
      listContainer.innerHTML = "";

      if (sameWeekend.length === 0) {
        listContainer.innerHTML = "<p>No other sessions left this weekend</p>";
      } else {
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
            <p><strong>Date :</strong> ${dOnly}</p>
            <p><strong>Time :</strong>${tOnly}</p>
            ${cancelledNote}
          `;

          listContainer.appendChild(card);
        });
      }
    } else {
      document.getElementById("next-session").innerHTML = "<p>No upcoming session scheduled</p>";
    }
  })
  .catch((error) => {
    console.error("Fetch failed:", error);
    document.getElementById("next-session").innerHTML =
      "<p>Couldn't load session data. Check your connection and try again.</p>";
  });