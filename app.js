/* Vani web player — static, streams from R2 */
const R2_BASE = "https://pub-7676b7019d5b48829c874ec448f03618.r2.dev/songs/";

const $ = (id) => document.getElementById(id);
const audio = new Audio();
audio.preload = "metadata";

let order = TRACKS.map((_, i) => i); // play order of TRACKS indexes
let pos = -1;                        // position inside `order`
let shuffleOn = false;
let seeking = false;
const durations = {};

const trackUrl = (t) => R2_BASE + encodeURIComponent(t.file);
const absCover = (t) => new URL(t.cover, location.href).href;
const fmt = (s) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
};

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.hidden = true), 2200);
}

/* ---------- track list ---------- */
function renderList(filter = "") {
  const q = filter.trim().toLowerCase();
  const list = $("tracklist");
  list.innerHTML = "";
  let shown = 0;
  TRACKS.forEach((t, i) => {
    if (q && !(t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))) return;
    shown++;
    const li = document.createElement("li");
    li.dataset.idx = i;
    li.innerHTML =
      `<span class="t-num">${i + 1}</span>` +
      `<img loading="lazy" src="${t.cover}" alt="">` +
      `<span class="t-meta"><p class="t-title"></p><p class="t-artist"></p></span>` +
      `<span class="t-dur">${durations[i] ? fmt(durations[i]) : ""}</span>`;
    li.querySelector(".t-title").textContent = t.title;
    li.querySelector(".t-artist").textContent = t.artist;
    if (i === curIdx()) li.classList.add("active");
    li.addEventListener("click", () => playIndex(i));
    list.appendChild(li);
  });
  $("empty").hidden = shown > 0;
}

function markActive() {
  document.querySelectorAll("#tracklist li").forEach((li) => {
    li.classList.toggle("active", Number(li.dataset.idx) === curIdx());
  });
}

const curIdx = () => (pos >= 0 ? order[pos] : -1);

/* ---------- playback ---------- */
function playIndex(i) {
  if (shuffleOn) {
    const rest = TRACKS.map((_, x) => x).filter((x) => x !== i);
    for (let k = rest.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [rest[k], rest[j]] = [rest[j], rest[k]];
    }
    order = [i, ...rest];
    pos = 0;
  } else {
    order = TRACKS.map((_, x) => x);
    pos = i;
  }
  load(true);
}

function load(autoplay) {
  const t = TRACKS[curIdx()];
  audio.src = trackUrl(t);
  setMeta(t);
  markActive();
  if (autoplay) audio.play().catch(() => {});
}

function toggle() {
  if (pos < 0) { playIndex(0); return; }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function step(dir) {
  if (pos < 0) { playIndex(0); return; }
  pos = (pos + dir + order.length) % order.length;
  load(true);
}

function toggleShuffle() {
  shuffleOn = !shuffleOn;
  $("btn-shuffle").classList.toggle("on", shuffleOn);
  const cur = curIdx();
  if (cur >= 0) {
    if (shuffleOn) {
      const rest = TRACKS.map((_, x) => x).filter((x) => x !== cur);
      for (let k = rest.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [rest[k], rest[j]] = [rest[j], rest[k]];
      }
      order = [cur, ...rest];
    } else {
      order = TRACKS.map((_, x) => x);
    }
    pos = 0;
  }
  toast(shuffleOn ? "Shuffle on" : "Shuffle off");
}

function setMeta(t) {
  const i = curIdx();
  ["pb-cover"].forEach((id) => ($(id).src = t.cover));
  $("pb-title").textContent = t.title;
  $("pb-artist").textContent = t.artist;
  $("np-cover").src = t.cover;
  $("np-title").textContent = t.title;
  $("np-artist").textContent = t.artist;
  $("np-pos").textContent = (i + 1);
  document.title = `${t.title} — ${t.artist} · Vani`;
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: "Vani",
        artwork: [{ src: absCover(t), sizes: "512x512", type: "image/jpeg" }],
      });
    } catch (e) { /* older browsers */ }
  }
}

function syncPlayUI() {
  const playing = !audio.paused && !audio.ended;
  const pairs = [
    [$("btn-play"), $("ic-play"), $("ic-pause")],
    [$("np-play"), ...$("np-play").querySelectorAll("svg")],
  ];
  pairs.forEach(([btn, icPlay, icPause]) => {
    icPlay.hidden = playing;
    icPause.hidden = !playing;
    btn.setAttribute("aria-label", playing ? "Pause" : "Play");
  });
  $("np-vinyl").classList.toggle("spinning", playing);
  if ("mediaSession" in navigator) {
    try { navigator.mediaSession.playbackState = playing ? "playing" : "paused"; } catch (e) {}
  }
}

function syncTime() {
  const d = audio.duration || 0, c = audio.currentTime || 0;
  const pct = d ? (c / d) * 1000 : 0;
  if (!seeking) {
    $("seek").value = pct;
    $("np-seek").value = pct;
  }
  $("t-cur").textContent = fmt(c);
  $("np-cur").textContent = fmt(c);
  $("t-total").textContent = fmt(d);
  $("np-total").textContent = fmt(d);
}

/* ---------- events ---------- */
audio.addEventListener("play", syncPlayUI);
audio.addEventListener("pause", syncPlayUI);
audio.addEventListener("ended", () => step(1));
audio.addEventListener("timeupdate", syncTime);
audio.addEventListener("loadedmetadata", () => {
  const i = curIdx();
  if (i >= 0) {
    durations[i] = audio.duration;
    const li = document.querySelector(`#tracklist li[data-idx="${i}"] .t-dur`);
    if (li) li.textContent = fmt(audio.duration);
  }
  syncTime();
});
audio.addEventListener("error", () => {
  if (!audio.src) return;
  toast("Couldn't load this track — skipping");
  setTimeout(() => step(1), 800);
});

[["btn-play"], ["np-play"]].forEach(([id]) => $(id).addEventListener("click", toggle));
$("btn-prev").addEventListener("click", () => step(-1));
$("btn-next").addEventListener("click", () => step(1));
$("np-prev").addEventListener("click", () => step(-1));
$("np-next").addEventListener("click", () => step(1));
$("btn-shuffle").addEventListener("click", toggleShuffle);

function bindSeek(el) {
  el.addEventListener("input", () => {
    seeking = true;
    const d = audio.duration || 0;
    const preview = (el.value / 1000) * d;
    $("t-cur").textContent = fmt(preview);
    $("np-cur").textContent = fmt(preview);
  });
  el.addEventListener("change", () => {
    const d = audio.duration || 0;
    if (d) audio.currentTime = (el.value / 1000) * d;
    seeking = false;
    syncTime();
  });
}
bindSeek($("seek"));
bindSeek($("np-seek"));

/* volume */
const savedVol = parseFloat(localStorage.getItem("vani-vol"));
if (!isNaN(savedVol)) {
  audio.volume = savedVol;
  $("vol").value = Math.round(savedVol * 100);
} else {
  audio.volume = 0.9;
}
$("vol").addEventListener("input", (e) => {
  audio.volume = e.target.value / 100;
  audio.muted = false;
  localStorage.setItem("vani-vol", audio.volume);
});
$("btn-mute").addEventListener("click", () => {
  audio.muted = !audio.muted;
  $("btn-mute").classList.toggle("on", audio.muted);
});

/* now playing overlay */
$("np-open").addEventListener("click", () => { $("nowplaying").hidden = false; });
$("np-close").addEventListener("click", () => { $("nowplaying").hidden = true; });

/* search */
$("search").addEventListener("input", (e) => renderList(e.target.value));

/* keyboard */
document.addEventListener("keydown", (e) => {
  if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.code === "Space") { e.preventDefault(); toggle(); }
  else if (e.key === "ArrowRight" && audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  else if (e.key === "ArrowLeft" && audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 5);
});

/* media session (lock screen / bluetooth controls) */
if ("mediaSession" in navigator) {
  try {
    const H = [
      ["play", () => audio.play().catch(() => {})],
      ["pause", () => audio.pause()],
      ["previoustrack", () => step(-1)],
      ["nexttrack", () => step(1)],
      ["seekbackward", (d) => { audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)); }],
      ["seekforward", (d) => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (d.seekOffset || 10)); }],
      ["seekto", (d) => { if (d.seekTime != null && d.fastSeek) audio.fastSeek(d.seekTime); else if (d.seekTime != null) audio.currentTime = d.seekTime; }],
    ];
    H.forEach(([a, fn]) => navigator.mediaSession.setActionHandler(a, fn));
  } catch (e) { /* ignore */ }
}

/* lazy duration probing for the list */
(function probeDurations() {
  const probe = new Audio();
  probe.preload = "metadata";
  let i = 0;
  probe.addEventListener("loadedmetadata", () => {
    durations[i] = probe.duration;
    const li = document.querySelector(`#tracklist li[data-idx="${i}"] .t-dur`);
    if (li) li.textContent = fmt(probe.duration);
    next();
  });
  probe.addEventListener("error", next);
  function next() {
    i++;
    if (i < TRACKS.length) { probe.src = trackUrl(TRACKS[i]); }
  }
  probe.src = trackUrl(TRACKS[0]);
})();

/* init */
renderList();
syncPlayUI();
const last = parseInt(localStorage.getItem("vani-last"), 10);
if (!isNaN(last) && last >= 0 && last < TRACKS.length) {
  order = TRACKS.map((_, x) => x);
  pos = last;
  load(false);
}
setInterval(() => {
  const i = curIdx();
  if (i >= 0) localStorage.setItem("vani-last", i);
}, 5000);
