// script.js

// —————————————————————————————————————
// 1) GLOBAL CONFIG & MOBILE DETECTION
// —————————————————————————————————————
const API_KEY         = "pk_0b8abc6f834b444f949f727e88a728e0";
const STATION_ID      = "cutters-choice-radio";
const BASE_URL        = "https://api.radiocult.fm/api";
const FALLBACK_ART    = "https://i.imgur.com/qWOfxOS.png";
const MIXCLOUD_PASSWORD = "cutters44";
const isMobile        = /Mobi|Android/i.test(navigator.userAgent);
// —————————————————————————————————————
// 2) HELPERS
// 
// CHAT IFRAME: lazy on mobile, auto on desktop
—————————————————————————————————————
function loadChat() {
  // THIS LINE needs updating:
  var chatContainer = document.querySelector('.chat');
  
  if (!chatContainer || chatContainer.dataset.loaded) return;
  var iframe = document.createElement('iframe');
  iframe.src    = chatContainer.getAttribute('data-src');
  iframe.width  = '100%';
  iframe.height = '650';
  iframe.className = 'chat-iframe';
  chatContainer.appendChild(iframe);
  chatContainer.dataset.loaded = 'true';

function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt => new Date(dt)
    .toISOString()
    .replace(/[-:]|\.\d{3}/g, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE`
    + `&text=${encodeURIComponent(title)}`
    + `&dates=${fmt(startUtc)}/${fmt(endUtc)}`
    + `&details=Tune in live at https://cutterschoiceradio.com`
    + `&location=https://cutterschoiceradio.com`;
}

async function rcFetch(path) {
  const res = await fetch(BASE_URL + path, {
    headers: { "x-api-key": API_KEY }
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

function shuffleIframesDaily() {
  const container = document.getElementById("mixcloud-list");
  if (!container) return;
  const iframes = Array.from(container.querySelectorAll("iframe"));
  const today = new Date().toISOString().split("T")[0];
  if (localStorage.getItem("lastShuffleDate") === today) return;
  for (let i = iframes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [iframes[i], iframes[j]] = [iframes[j], iframes[i]];
  }
  container.innerHTML = "";
  iframes.forEach(ifr => container.appendChild(ifr));
  localStorage.setItem("lastShuffleDate", today);
}

// —————————————————————————————————————
// 3) DATA FETCHERS
// —————————————————————————————————————
async function fetchLiveNow() {
  try {
    const { result } = await rcFetch(`/station/${STATION_ID}/schedule/live`);
    const md = result.metadata || {}, ct = result.content || {};
    document.getElementById("now-dj").textContent =
      md.artist
        ? `${md.artist} – ${md.title}`
        : (ct.title || "No live show");
    document.getElementById("now-art").src =
      md.artwork_url || FALLBACK_ART;
  } catch (e) {
    console.error("Live-now fetch error:", e);
    document.getElementById("now-dj").textContent = "Error fetching live info";
    document.getElementById("now-art").src = FALLBACK_ART;
  }
}

async function fetchWeeklySchedule() {
  const container = document.getElementById("schedule-container");
  if (!container) return;
  container.innerHTML = "<p>Loading this week's schedule…</p>";
  try {
    const now  = new Date();
    const then = new Date(now.getTime() + 7*24*60*60*1000);
    const { schedules } = await rcFetch(
      `/station/${STATION_ID}/schedule`
      + `?startDate=${now.toISOString()}`
      + `&endDate=${then.toISOString()}`
    );

    if (!schedules.length) {
      container.innerHTML = "<p>No shows scheduled this week.</p>";
      return;
    }

    // group by day
    const byDay = schedules.reduce((acc, ev) => {
      const day = new Date(ev.startDateUtc)
        .toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "short"
        });
      (acc[day] = acc[day]||[]).push(ev);
      return acc;
    }, {});

    container.innerHTML = "";
    const fmtTime = iso => new Date(iso)
      .toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"});

    Object.entries(byDay).forEach(([day, events]) => {
      const h3 = document.createElement("h3");
      h3.textContent = day;
      container.appendChild(h3);

      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.padding = "0";

      events.forEach(ev => {
        const li = document.createElement("li");
        li.style.marginBottom = "1rem";

        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.alignItems = "center";
        wrap.style.gap = "8px";

        const t = document.createElement("strong");
        t.textContent = `${fmtTime(ev.startDateUtc)}–${fmtTime(ev.endDateUtc)}`;
        wrap.appendChild(t);

        let art = null;
        if (ev.metadata && ev.metadata.artwork) {
          art = ev.metadata.artwork.default || ev.metadata.artwork.original;
        }
        if (art) {
          const img = document.createElement("img");
          img.src = art;
          img.alt = `${ev.title} artwork`;
          img.style.cssText = "width:30px;height:30px;"
            + "object-fit:cover;border-radius:3px;";
          wrap.appendChild(img);
        }

        const title = document.createElement("span");
        title.textContent = ev.title;
        wrap.appendChild(title);

        if (!/archive/i.test(ev.title)) {
          const calBtn = document.createElement("a");
          calBtn.href   = createGoogleCalLink(ev.title, ev.startDateUtc, ev.endDateUtc);
          calBtn.target = "_blank";
          calBtn.innerHTML = "📅";
          calBtn.style.cssText = "font-size:1.4rem;text-decoration:none;"
            + "margin-left:6px;";
          wrap.appendChild(calBtn);
        }

        li.appendChild(wrap);
        ul.appendChild(li);
      });

      container.appendChild(ul);
    });

  } catch (e) {
    console.error("Schedule error:", e);
    container.innerHTML = "<p>Error loading schedule.</p>";
  }
}

async function fetchNowPlayingArchive() {
  try {
    const data = await fetch(
      `https://api.radiocult.fm/api/station/${STATION_ID}/schedule/live`,
      { headers: { 'x-api-key': API_KEY }}
    ).then(r => r.json());

    const md = data.result && data.result.metadata;
    const ct = data.result && data.result.content;
    const el = document.getElementById('now-archive');

    if (md && md.artist && md.title) {
      el.textContent = `Now Playing: ${md.artist} – ${md.title}`;
    } else if (ct && ct.title) {
      el.textContent = `Now Playing: ${ct.title}`;
    } else {
      el.textContent = 'Now Playing: Unknown Show';
    }
  } catch (err) {
    console.error('Error fetching archive show:', err);
    document.getElementById('now-archive').textContent =
      'Unable to load archive show';
  }
}

// —————————————————————————————————————
// 4) ADMIN & UI ACTIONS
// —————————————————————————————————————
function addMixcloud() {
  const url = document.getElementById('mixcloud-url').value.trim();
  if (!url) return;
  const pass = prompt('Enter admin password to add a new show:');
  if (pass !== MIXCLOUD_PASSWORD) {
    alert('Incorrect password.');
    return;
  }
  const div = document.createElement('div');
  div.className = "mixcloud-container";
  div.innerHTML = `
    <iframe src="https://www.mixcloud.com/widget/iframe/
      ?hide_cover=1&light=1&feed=${encodeURIComponent(url)}">
    </iframe>
    <button class="delete-btn" onclick="deleteMixcloud(this)">
      Delete
    </button>`;
  document.getElementById('mixcloud-list').prepend(div);
  document.getElementById('mixcloud-url').value = '';
}

function deleteMixcloud(btn) {
  const pass = prompt('Enter admin password to delete this show:');
  if (pass !== MIXCLOUD_PASSWORD) {
    alert('Incorrect password.');
    return;
  }
  btn.parentElement.remove();
}

function loadChat() {
  var chatContainer = document.querySelector('.chat-container');
  …
}

function openChatPopup() {
  window.open(
    "https://app.radiocult.fm/embed/chat/"
      + STATION_ID
      + "?theme=midnight&primaryColor=%235A8785&corners=sharp",
    "CuttersChoiceChat",
    "width=400,height=700,resizable=yes,scrollbars=yes"
  );
}

// —————————————————————————————————————
// 5) INITIALIZE ON DOM READY
// —————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  // a) Always run your live & schedule
  fetchLiveNow();
  fetchWeeklySchedule();
  fetchNowPlayingArchive();

  // repeat live & archive at intervals
  setInterval(fetchLiveNow, 30000);
  setInterval(fetchNowPlayingArchive, 60000);

  // b) Desktop vs Mobile Mixcloud behavior
  const mixSection = document.querySelector('.mixcloud');
  if (isMobile) {
    if (mixSection) mixSection.remove();
  } else {
    document.querySelectorAll('iframe.mixcloud-iframe')
      .forEach(iframe => {
        iframe.src = iframe.getAttribute('data-src');
      });
    shuffleIframesDaily();
    // load official Mixcloud widget script once
    const mc = document.createElement('script');
    mc.src   = "https://widget.mixcloud.com/widget.js";
    mc.async = true;
    document.body.appendChild(mc);
  }

  // c) Pop-out player button
  const pop = document.getElementById('popOutBtn');
  if (pop) {
    pop.addEventListener('click', () => {
      const src = document.getElementById('inlinePlayer').src;
      const w   = window.open(
        '',
        'CCRPlayer',
        'width=400,height=200,resizable=yes'
      );
      w.document.write(`
        <!DOCTYPE html><html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport"
            content="width=device-width,initial-scale=1">
          <title>Cutters Choice Player</title>
          <style>
            body { margin:0;background:#111;
              display:flex;align-items:center;
              justify-content:center;height:100vh;}
            iframe { width:100%;height:180px;
              border:none;border-radius:4px;}
          </style>
        </head>
        <body>
          <iframe src="${src}" allow="autoplay"></iframe>
        </body>
        </html>
      `);
      w.document.close();
    });
  }
});
