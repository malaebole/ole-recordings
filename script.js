const loader = document.getElementById("loader");
const videoPlayer = document.getElementById("player");
const playlistContainer = document.getElementById("playlist");
let currentVideoIndex = 0;
let lastSelectedIndex = 0;
let defaultCamera = "camera-7554";
let videoList = [];

// Helper Functions
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

// Main Video Functions
async function fetchAllVideos() {
  const bookingId = getQueryParam("booking_id") || null;
  const startTime = getQueryParam("s") || null;
  const endTime = getQueryParam("e") || null;

  let query = "";
  if (startTime && endTime) {
    query = `?start_time=${encodeURIComponent(
      startTime
    )}&end_time=${encodeURIComponent(endTime)}`;
  } else if (bookingId) {
    query = `?booking_id=${bookingId}`;
  }

  const urls = [
    `https://recorder.ole-app.ae/api/camera-7554/recordings${query}`,
    `https://recorder.ole-app.ae/api/camera-7555/recordings${query}`,
    `https://recorder.ole-app.ae/api/camera-7556/recordings${query}`,
    `https://recorder.ole-app.ae/api/camera-7557/recordings${query}`,
  ];

  try {
    const responses = await Promise.all(urls.map((url) => fetch(url)));
    const data = await Promise.all(responses.map((res) => res.json()));

    videoList = data.flatMap((camData, camIndex) => {
      return (camData.data || []).map((item, index) => {
        const dt = formatDateRange(item.start_time, item.end_time);
        if (camIndex === 0) {
          document.getElementById("videoDate").textContent = dt.date;
        }
        return {
          title: `Cam${camIndex + 1} - Part ${index + 1}`,
          url: item.url,
          category: `camera-${camIndex + 1}`,
          thumbnail: "thumbnail.png",
          date: dt.date,
          time: dt.time,
          live: false,
        };
      });
    });

    if (videoList.length === 0) {
      playlistContainer.innerHTML =
        "<p>No recordings found for this booking.</p>";
    }
  } catch (err) {
    console.error("Failed to fetch videos:", err);
    playlistContainer.innerHTML = "<p>Error loading playlist.</p>";
  } finally {
    loader.classList.add("hidden");
  }
}

function applyFilter(category) {
  const filtered =
    category === "all"
      ? videoList
      : videoList.filter((v) => v.category === category);

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

  const filtered =
    category === "all"
      ? videoList
      : videoList.filter((v) => v.category === category);

  if (!filtered[index]) index = 0;
  const video = filtered[index];

  videoPlayer.src = video.url;
  videoPlayer.muted = true;
  videoPlayer.load();
  videoPlayer.play().catch((err) => {
    console.warn("Autoplay prevented:", err);
    videoPlayer.controls = true;
  });

  document.querySelectorAll(".playlist-item").forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  videoPlayer.scrollIntoView({ behavior: "smooth" });
}

// Player Control Functions
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
  const activeCamera = document.querySelector(
    ".camera-option input:checked"
  ).value;
  const filtered =
    activeCamera === "all"
      ? videoList
      : videoList.filter((v) => v.category === activeCamera);
  const currentVideo = filtered[currentVideoIndex];

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

// UI Helper Functions
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

// Camera Selection Handling
function setActiveCameraFromQuery() {
  const cameraNum = getQueryParam("c") || "1";
  const targetCamera = `camera-${cameraNum}`;
  const cameraOption = document.querySelector(
    `.camera-option input[value="${targetCamera}"]`
  );

  if (cameraOption) {
    cameraOption.checked = true;
    applyFilter(targetCamera);
  }
}

function setupCameraControls() {
  document.querySelectorAll(".camera-option input").forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.value === "live") {
        showAlert("We are working on it. Coming soon...");
        return;
      }
      if (this.checked) {
        const url = new URL(window.location);
        const cameraNum = this.value.split("-")[1];

        if (this.value === "camera-7554") {
          url.searchParams.delete("c");
        } else {
          url.searchParams.set("c", cameraNum);
        }

        window.history.pushState({}, "", url);
        applyFilter(this.value);
      }
    });
  });
}

// Time Filter Handling
function setupTimeFilters() {
  const startInput = document.getElementById("startTime");
  const endInput = document.getElementById("endTime");

  // Initialize from query params or localStorage
  const startTime =
    getQueryParam("s") || localStorage.getItem("filter_start_time");
  const endTime = getQueryParam("e") || localStorage.getItem("filter_end_time");

  if (startTime) startInput.value = startTime;
  if (endTime) endInput.value = endTime;

  function isValid30MinStep(dateStr) {
    const date = new Date(dateStr);
    const minutes = date.getMinutes();
    return minutes === 0 || minutes === 30;
  }

  document
    .getElementById("timeFilterForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      const start = startInput.value;
      const end = endInput.value;

      if (!start || !end) {
        showAlert("Please select both start and end time.");
        return;
      }

      if (!isValid30MinStep(start) || !isValid30MinStep(end)) {
        showAlert("Time must be in 30-minute steps (:00 or :30 only).");
        return;
      }

      if (new Date(start) >= new Date(end)) {
        showAlert("End time must be after start time.");
        return;
      }

      localStorage.setItem("filter_start_time", start);
      localStorage.setItem("filter_end_time", end);

      const formatToSQL = (dateStr) => {
        const date = new Date(dateStr);
        const pad = (n) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
          date.getDate()
        )} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
      };

      const url = new URL(window.location);
      url.searchParams.set("s", formatToSQL(start));
      url.searchParams.set("e", formatToSQL(end));
      url.searchParams.delete("booking_id");
      window.location.href = url.toString();
    });

  document.getElementById("clearSearchTimes")?.addEventListener("click", () => {
    startInput.value = "";
    endInput.value = "";
    localStorage.removeItem("filter_start_time");
    localStorage.removeItem("filter_end_time");

    const bookingId = getQueryParam("booking_id");
    const url = new URL(window.location);
    url.searchParams.delete("s");
    url.searchParams.delete("e");
    window.location.href = url.toString();
  });
}

// Initialize Player
function initPlayer() {
  videoPlayer.muted = true;
  videoPlayer.playsInline = true;
  videoPlayer.play().catch((err) => {
    videoPlayer.controls = true;
    console.log("Autoplay prevented:", err);
  });
}

// Main Initialization
document.addEventListener("DOMContentLoaded", async () => {
  setupCameraControls();
  setupTimeFilters();
  initPlayer();

  loader.classList.remove("hidden");
  await fetchAllVideos();
  setActiveCameraFromQuery();

  // Handle video end
  videoPlayer.addEventListener("ended", () => {
    const activeCamera = document.querySelector(
      ".camera-option input:checked"
    ).value;
    const filtered =
      activeCamera === "all"
        ? videoList
        : videoList.filter((v) => v.category === activeCamera);

    const nextIndex = currentVideoIndex + 1;
    if (nextIndex < filtered.length) {
      loadVideoByFilter(nextIndex, activeCamera);
    }
  });
});
