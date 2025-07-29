const loader = document.getElementById("loader");
const videoPlayer = document.getElementById("player");
const playlistContainer = document.getElementById("playlist");
let currentVideoIndex = 0;
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
  const formatted = `${pad(now.getDate())}/${pad(
    now.getMonth() + 1
  )}/${now.getFullYear()} ${pad(hours)}:${minutes} ${ampm}`;

  return formatted;
}

function formatDateRange(startStr, endStr) {
  const startDate = parseCustomDate(startStr);
  const endDate = parseCustomDate(endStr);
  if (!startDate || !endDate) {
    return {
      date: "Invalid date",
      time: "Invalid time",
    };
  }

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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
  year = parseInt(year, 10);
  month = parseInt(month, 10) - 1;
  day = parseInt(day, 10);
  hour = parseInt(hour, 10);
  minute = parseInt(minute, 10);
  second = parseInt(second, 10);
  if (period.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (period.toUpperCase() === "AM" && hour === 12) hour = 0;

  return new Date(year, month, day, hour, minute, second);
}

function renderPlaylist(category = "all") {
  playlistContainer.innerHTML = "";
  const bookingId = getQueryParam("booking");
  if (!bookingId) {
    playlistContainer.innerHTML = "<p>No booking ID provided in URL.</p>";
    return;
  }

  loader.classList.remove("hidden");

  fetch(`https://recorder.ole-app.ae/api/recordings?booking_id=${bookingId}`)
    .then((response) => response.json())
    .then(({ data }) => {
      loader.classList.add("hidden");

      if (!Array.isArray(data) || data.length === 0) {
        playlistContainer.innerHTML =
          "<p>No recordings found for this booking.</p>";
        return;
      }

      videoList = data.map((item, index) => {
        const dateTime = formatDateRange(item.start_time, item.end_time);
        document.getElementById("videoDate").textContent = dateTime.date;
        return {
          title: `Part ${index + 1}`,
          url: item.url,
          category: item?.category || "match",
          thumbnail: "thumbnail.png",
          live: false,
          date: dateTime.date,
          time: dateTime.time,
        };
      });

      // filter videos according to selection console.log(videoDate);
      const filteredVideos =
        category === "all"
          ? videoList
          : videoList.filter((video) => video.category === category);

      playlistContainer.innerHTML = "";

      filteredVideos.forEach((video, index) => {
        const item = document.createElement("div");
        item.className = `playlist-item ${
          index === currentVideoIndex ? "active" : ""
        }`;
        item.onclick = () => loadVideo(index);

        item.innerHTML = `
          <img src="${video.thumbnail}" alt="${video.title}" />
          <div class="playlist-info">
              <h5>${video.time}</h5>
          </div>`;

        playlistContainer.appendChild(item);
      });

      loadVideo(0);
    })
    .catch((err) => {
      console.error("Failed to fetch videos:", err);
      loader.classList.add("hidden");
      playlistContainer.innerHTML = "<p>Error loading playlist.</p>";
    });
}

function loadVideo(index) {
  currentVideoIndex = index;
  videoPlayer.src = videoList[index].url;
  videoPlayer.muted = true;
  videoPlayer.load();
  videoPlayer.play().catch((err) => {
    console.warn("Autoplay prevented:", err);
  });

  // Update active playlist item
  const items = document.querySelectorAll(".playlist-item");
  items.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });
}

videoPlayer.addEventListener("ended", () => {
  const nextIndex = currentVideoIndex + 1;
  if (nextIndex < videoList.length) {
    loadVideo(nextIndex);
  }
});

// Mute/Unmute Toggle
function toggleMute() {
  try {
    videoPlayer.muted = !videoPlayer.muted;
    muteIcon.textContent = videoPlayer.muted ? "🔇" : "🔊";

    // Visual feedback
    const feedback = document.createElement("div");
    feedback.textContent = videoPlayer.muted ? "Muted" : "Unmuted";
    feedback.className = `control-feedback ${videoPlayer.muted ? "muted" : ""}`;
    document.body.appendChild(feedback);

    setTimeout(() => feedback.remove(), 1000);
  } catch (error) {
    console.error("Mute toggle failed:", error);
  }
}

// Picture-in-Picture Mode
async function enterPiP() {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await videoPlayer.requestPictureInPicture();
    } else {
      showAlert("PiP not supported in your browser");
    }
  } catch (error) {
    console.error("PiP failed:", error);
    showAlert("PiP unavailable: " + error.message);
  }
}

// Download Current Video
function downloadVideo() {
  const currentVideo = videoList[currentVideoIndex];

  // Block unsupported downloads
  if (currentVideo.live || currentVideo.url.startsWith("rtsp://")) {
    showAlert("Live streams cannot be downloaded");
    return;
  }

  try {
    const link = document.createElement("a");
    link.href = currentVideo.url;
    link.download = currentVideo.title
      ? `${sanitizeFilename(currentVideo.title)}.mp4`
      : "recording.mp4";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAlert("Download started");
  } catch (error) {
    console.error("Download failed:", error);
    showAlert("Download failed");
  }
}

// 4. Fullscreen Toggle
function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      videoPlayer.requestFullscreen().catch((err) => {
        showAlert("Fullscreen failed: " + err.message);
      });
    } else {
      document.exitFullscreen();
    }
  } catch (error) {
    console.error("Fullscreen error:", error);
  }
}

// Helper Functions
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

// Handle camera/category filter toggle
document.querySelectorAll(".camera-option input").forEach((radio) => {
  radio.addEventListener("change", function () {
    if (this.value === "cam2" || this.value === "live") {
      showAlert("We are working on it. Coming soon...");
      return;
    }
    if (this.checked) {
      renderPlaylist(this.value);
    }
  });
});

// Initialize on load
renderPlaylist();
