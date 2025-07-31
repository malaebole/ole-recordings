const loader = document.getElementById("loader");
const videoPlayer = document.getElementById("player");
const playlistContainer = document.getElementById("playlist");
let currentVideoIndex = 0;
let lastSelectedIndex = 0;
let videoList = [];

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function currentDateTime() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  let hours = now.getHours();
  const minutes = pad(now.getMinutes());
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${pad(now.getDate())}/${pad(
    now.getMonth() + 1
  )}/${now.getFullYear()} ${pad(hours)}:${minutes} ${ampm}`;
}

function formatDateRange(startStr, endStr) {
  const startDate = parseCustomDate(startStr);
  const endDate = parseCustomDate(endStr);
  if (!startDate || !endDate) {
    return { date: "Invalid date", time: "Invalid time" };
  }

  const formatDate = (date) => {
    return `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;
  };

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes}${ampm}`;
  };

  return {
    date: formatDate(startDate),
    time: `${formatTime(startDate)}-${formatTime(endDate)}`,
  };
}

function parseCustomDate(str) {
  str = str.trim();
  const regex = /^(\d{2})-(\d{2})-(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) ?(AM|PM)$/i;
  const match = str.match(regex);
  if (!match) return null;
  let [_, day, month, year, hour, minute, second, period] = match;
  hour = parseInt(hour, 10);
  if (period.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (period.toUpperCase() === "AM" && hour === 12) hour = 0;
  return new Date(+year, +month - 1, +day, hour, +minute, +second);
}

async function renderPlaylist(category = "camera-1") {
  playlistContainer.innerHTML = "";
  const bookingId = getQueryParam("booking");
  const startTime = getQueryParam("start_time");
  const endTime = getQueryParam("end_time");
  if (!bookingId && (!startTime || !endTime)) {
    playlistContainer.innerHTML =
      "<p>No booking ID or time range provided.</p>";
    return;
  }
  loader.classList.remove("hidden");

  const queryParameters =
    startTime && endTime
      ? `start_time=${encodeURIComponent(
          startTime
        )}&end_time=${encodeURIComponent(endTime)}`
      : `booking=${bookingId}`;

  const cameraOneURL = `https://recorder.ole-app.ae/api/camera-1/recordings?${queryParameters}`;
  const cameraTwoURL = `https://recorder.ole-app.ae/api/camera-2/recordings?${queryParameters}`;

  try {
    const [cam1Res, cam2Res] = await Promise.all([
      fetch(cameraOneURL),
      fetch(cameraTwoURL),
    ]);
    const cam1Data = await cam1Res.json();
    const cam2Data = await cam2Res.json();

    const cam1Videos = (cam1Data.data || []).map((item, index) => {
      const dt = formatDateRange(item.start_time, item.end_time);
      document.getElementById("videoDate").textContent = dt.date;
      return {
        title: `Cam1 - Part ${index + 1}`,
        url: item.url,
        category: "camera-1",
        thumbnail: "thumbnail.png",
        date: dt.date,
        time: dt.time,
        live: false,
      };
    });

    const cam2Videos = (cam2Data.data || []).map((item, index) => {
      const dt = formatDateRange(item.start_time, item.end_time);
      return {
        title: `Cam2 - Part ${index + 1}`,
        url: item.url,
        category: "camera-2",
        thumbnail: "thumbnail.png",
        date: dt.date,
        time: dt.time,
        live: false,
      };
    });

    videoList = [...cam1Videos, ...cam2Videos];
    loader.classList.add("hidden");

    if (videoList.length === 0) {
      playlistContainer.innerHTML =
        "<p>No recordings found for this booking.</p>";
      return;
    }

    applyFilter(category);
  } catch (err) {
    console.error("Failed to fetch videos:", err);
    loader.classList.add("hidden");
    playlistContainer.innerHTML = "<p>Error loading playlist.</p>";
  }
}

function applyFilter(category) {
  const filtered = videoList.filter((v) => v.category === category);
  playlistContainer.innerHTML = "";

  if (filtered.length === 0) {
    playlistContainer.innerHTML = "<p>No videos for selected camera.</p>";
    return;
  }

  const startIndex =
    lastSelectedIndex < filtered.length ? lastSelectedIndex : 0;

  filtered.forEach((video, i) => {
    const item = document.createElement("div");
    item.className = `playlist-item ${i === startIndex ? "active" : ""}`;
    item.onclick = () => loadVideoByFilter(i, category);

    item.innerHTML = `
      <img src="${video.thumbnail}" alt="${video.title}" />
      <div class="playlist-info">
        <h5>${video.time}</h5>
      </div>`;
    playlistContainer.appendChild(item);
  });

  loadVideoByFilter(startIndex, category);
}

function loadVideoByFilter(index, category) {
  lastSelectedIndex = index;
  currentVideoIndex = index;

  const filtered = videoList.filter((v) => v.category === category);
  if (!filtered[index]) index = 0;
  const video = filtered[index];

  videoPlayer.src = video.url;
  videoPlayer.muted = true;
  videoPlayer.load();
  videoPlayer.play().catch((err) => {
    console.warn("Autoplay prevented:", err);
  });

  // Highlight active item
  const items = document.querySelectorAll(".playlist-item");
  items.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  // Scroll up to video player
  videoPlayer.scrollIntoView({ behavior: "smooth" });
}

videoPlayer.addEventListener("ended", () => {
  const active =
    document.querySelector(".camera-option input:checked")?.value || "camera-1";
  const filtered =
    active === "all"
      ? videoList
      : videoList.filter((v) => v.category === active);
  const nextIndex = currentVideoIndex + 1;
  if (nextIndex < filtered.length) {
    loadVideoByFilter(nextIndex, active);
  }
});

function toggleMute() {
  try {
    videoPlayer.muted = !videoPlayer.muted;
    muteIcon.textContent = videoPlayer.muted ? "🔇" : "🔊";

    const feedback = document.createElement("div");
    feedback.textContent = videoPlayer.muted ? "Muted" : "Unmuted";
    feedback.className = `control-feedback ${videoPlayer.muted ? "muted" : ""}`;
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1000);
  } catch (err) {
    console.error("Mute toggle failed:", err);
  }
}

async function enterPiP() {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await videoPlayer.requestPictureInPicture();
    } else {
      showAlert("PiP not supported in your browser");
    }
  } catch (err) {
    console.error("PiP failed:", err);
    showAlert("PiP unavailable: " + err.message);
  }
}

function downloadVideo() {
  const currentVideo = videoList[currentVideoIndex];
  if (currentVideo.live || currentVideo.url.startsWith("rtsp://")) {
    showAlert("Live streams cannot be downloaded");
    return;
  }

  try {
    const link = document.createElement("a");
    link.href = currentVideo.url;
    link.download = `${sanitizeFilename(currentVideo.title)}.mp4`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert("Download started");
  } catch (err) {
    console.error("Download failed:", err);
    showAlert("Download failed");
  }
}

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      videoPlayer.requestFullscreen().catch((err) => {
        showAlert("Fullscreen failed: " + err.message);
      });
    } else {
      document.exitFullscreen();
    }
  } catch (err) {
    console.error("Fullscreen error:", err);
  }
}

function showAlert(message) {
  const alert = document.createElement("div");
  alert.className = "video-alert";
  alert.textContent = message;
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 3000);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
}

document.querySelectorAll(".camera-option input").forEach((radio) => {
  radio.addEventListener("change", function () {
    if (this.value === "live") {
      showAlert("We are working on it. Coming soon...");
      return;
    }
    if (this.checked) {
      renderPlaylist(this.value);
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  videoPlayer.muted = true;
  videoPlayer.playsInline = true;

  const playPromise = videoPlayer.play();
  if (playPromise !== undefined) {
    playPromise.catch((error) => {
      videoPlayer.controls = true;
      console.log("Autoplay prevented:", error);
    });
  }

  document
    .getElementById("timeFilterForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      const start = document.getElementById("startTime").value;
      const end = document.getElementById("endTime").value;

      if (!start || !end) {
        alert("Please select both start and end time.");
        return;
      }

      const formatToSQL = (dateStr) => {
        const date = new Date(dateStr);
        const pad = (n) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
          date.getDate()
        )} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
      };

      const formattedStart = formatToSQL(start);
      const formattedEnd = formatToSQL(end);

      const url = new URL(window.location.href);
      url.searchParams.set("start_time", formattedStart);
      url.searchParams.set("end_time", formattedEnd);

      // remove booking_id if present
      url.searchParams.delete("booking");

      // reload page with new query
      window.location.href = url.toString();
    });

  // Default camera-1 videos
  renderPlaylist("camera-1");
});
