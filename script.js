const loader = document.getElementById("loader");
const videoPlayer = document.getElementById("player");
const playlistContainer = document.getElementById("playlist");
const dualPlayerContainer = document.querySelector(".dual-player-container");
const videoPlayer2 = document.getElementById("player2");
const noVideo = document.querySelector(".no-video");
const dualCameraIds = ["7554", "7555"];

let currentVideoIndex = 0;
let lastSelectedIndex = 0;
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

function showAlert(message, duration = 3000) {
  const alert = document.createElement("div");
  alert.className = "video-alert";
  alert.textContent = message;
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), duration);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
}

// Video Loading Functions
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
  ];
  const cameraIDMap = { 1: 7554, 2: 7555, 3: 7556 };

  try {
    const responses = await Promise.all(urls.map((url) => fetch(url)));
    const data = await Promise.all(responses.map((res) => res.json()));

    videoList = data.flatMap((camData, camIndex) => {
      return (camData.data || []).map((item, index) => {
        const dt = formatDateRange(item.start_time, item.end_time);
        if (camIndex === 0) {
          document.getElementById("videoDate").textContent = dt.date;
        }
        const targetCamera = cameraIDMap[camIndex + 1];
        return {
          title: `Cam${camIndex + 1} - Part ${index + 1}`,
          url: item.url,
          category: `camera-${targetCamera}`,
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
  const cameraId = category.split("-")[1];

  // Toggle player visibility based on camera selection
  if (dualCameraIds.includes(cameraId)) {
    document.getElementById("playerOne").classList.remove("hidden");
    document.getElementById("playerTwo").classList.remove("hidden");
  } else {
    document.getElementById("playerOne").classList.remove("hidden");
    document.getElementById("playerTwo").classList.add("hidden");
  }

  const filtered =
    category === "all"
      ? videoList
      : videoList.filter((v) => v.category === category);

  playlistContainer.innerHTML = "";

  if (filtered.length === 0) {
    playlistContainer.innerHTML = "";
    if (noVideo && noVideo.classList.contains("hidden")) {
      noVideo.classList.remove("hidden");
    }
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
  const cameraId = category.split("-")[1];

  if (dualCameraIds.includes(cameraId)) {
    // Dual camera mode - find matching video from the other camera
    const otherCameraId = cameraId === "7554" ? "7555" : "7554";
    const matchingVideo =
      videoList.find(
        (v) => v.category === `camera-${otherCameraId}` && v.time === video.time
      ) || video; // Fallback to same video if no match found

    // Load both players
    videoPlayer.src = video.url;
    videoPlayer2.src = matchingVideo.url.replace(cameraId, otherCameraId);

    // Play both videos
    const playPromises = [
      videoPlayer.play().catch((e) => console.log("Main player error:", e)),
      videoPlayer2
        .play()
        .catch((e) => console.log("Secondary player error:", e)),
    ];

    Promise.all(playPromises).then(() => {
      videoPlayer.controls = true;
      videoPlayer2.controls = true;
    });
  } else {
    // Single camera mode
    videoPlayer.src = video.url;
    videoPlayer.play().catch((e) => {
      console.log("Player error:", e);
      videoPlayer.controls = true;
    });
  }

  // Update active states
  document.querySelectorAll(".playlist-item").forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  videoPlayer.scrollIntoView({ behavior: "smooth" });
  noVideo.classList.add("hidden");
}

function downloadVideo() {
  try {
    // Check if we're in dual camera mode (videoPlayer2 has a source)
    const activeCamera = document.querySelector(
      ".camera-option input:checked"
    ).value;
    const isDualMode =
      activeCamera === "camera-7554" || activeCamera === "camera-7555";

    if (isDualMode) {
      // Dual camera download logic
      const mainVideoUrl = videoPlayer.src;
      const secondaryVideoUrl = videoPlayer2.src;

      // Find the video objects in videoList that match the current player sources
      const mainVideo = videoList.find((v) => v.url === mainVideoUrl);
      const secondaryVideo = videoList.find((v) => v.url === secondaryVideoUrl);

      if (!mainVideo || !secondaryVideo) {
        showAlert("Could not find video information for download");
        return;
      }

      // Check for live streams
      if (
        mainVideo.live ||
        mainVideo.url.startsWith("rtsp://") ||
        secondaryVideo.live ||
        secondaryVideo.url.startsWith("rtsp://")
      ) {
        showAlert("Live streams cannot be downloaded");
        return;
      }

      // Download both videos with a small delay between them
      const downloadWithDelay = (video, delay) => {
        setTimeout(() => {
          const link = document.createElement("a");
          link.href = video.url;
          link.download = `${sanitizeFilename(video.title)}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, delay);
      };

      downloadWithDelay(mainVideo, 0);
      downloadWithDelay(secondaryVideo, 1000); // 0.5 second delay

      showAlert("Download started for both camera angles");
    } else {
      // Single camera download logic
      const filtered =
        activeCamera === "all"
          ? videoList
          : videoList.filter((v) => v.category === activeCamera);

      const currentVideo = filtered[currentVideoIndex];

      if (!currentVideo) {
        showAlert("No video found for download");
        return;
      }

      if (currentVideo.live || currentVideo.url.startsWith("rtsp://")) {
        showAlert("Live streams cannot be downloaded");
        return;
      }

      const link = document.createElement("a");
      link.href = currentVideo.url;
      link.download = `${sanitizeFilename(currentVideo.title)}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAlert("Download started");
    }
  } catch (err) {
    console.error("Download error:", err);
    showAlert(`Download failed: ${err.message}`);
  }
}

// Player Control Functions
function toggleMute() {
  try {
    const isDualView = dualCameraIds.includes(
      document
        .querySelector(".camera-option input:checked")
        ?.value?.split("-")[1]
    );

    const players = isDualView ? [videoPlayer, videoPlayer2] : [videoPlayer];
    const newMutedState = !videoPlayer.muted;

    players.forEach((player) => {
      player.muted = newMutedState;
    });

    muteIcon.textContent = newMutedState ? "🔇" : "🔊";
    showAlert(newMutedState ? "Muted" : "Unmuted", 1000);
  } catch (err) {
    console.error("Mute toggle failed:", err);
  }
}

async function enterPiP() {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      const targetPlayer = dualPlayerContainer.classList.contains("hidden")
        ? videoPlayer
        : videoPlayer2;
      await targetPlayer.requestPictureInPicture();
    } else {
      showAlert("PiP not supported in your browser");
    }
  } catch (err) {
    console.error("PiP failed:", err);
    showAlert("PiP unavailable: " + err.message);
  }
}

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      const targetElement = dualPlayerContainer.classList.contains("hidden")
        ? videoPlayer
        : dualPlayerContainer;
      targetElement.requestFullscreen().catch((err) => {
        showAlert("Fullscreen failed: " + err.message);
      });
    } else {
      document.exitFullscreen();
    }
  } catch (err) {
    console.error("Fullscreen error:", err);
  }
}

// Camera Selection Handling
function setActiveCameraFromQuery() {
  const cameraNum = getQueryParam("c") || "7554";
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
  [videoPlayer, videoPlayer2].forEach((player) => {
    player.muted = true;
    player.playsInline = true;
    player.play().catch((err) => {
      player.controls = true;
      console.log("Autoplay prevented:", err);
    });
  });

  // Sync playback between players in dual view
  videoPlayer.addEventListener("play", () => {
    if (
      !dualPlayerContainer.classList.contains("hidden") &&
      videoPlayer2.paused
    ) {
      videoPlayer2.play().catch((e) => console.log("Sync play error:", e));
    }
  });

  videoPlayer2.addEventListener("play", () => {
    if (videoPlayer.paused) {
      videoPlayer.play().catch((e) => console.log("Sync play error:", e));
    }
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
