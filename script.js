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
    return `${hours}:${minutes} ${ampm}`;
  };

  return {
    date: formatDate(startDate),
    time: `${formatTime(startDate)} - ${formatTime(endDate)}`,
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
              <h3>${video.time}</h3>
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

function downloadVideo() {
  const video = videoList[currentVideoIndex];

  // Skip if it's a live stream or YouTube video
  if (video.live || video.isYouTube || video.url.startsWith("rtsp://")) {
    alert("Download not available for live streams");
    return;
  }

  // Create invisible download link and trigger click
  const link = document.createElement("a");
  link.href = video.url;
  link.download = video.title ? `${video.title}.mp4` : "recording.mp4";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Handle camera/category filter toggle
document.querySelectorAll(".camera-option input").forEach((radio) => {
  radio.addEventListener("change", function () {
    if (this.value === "cam2" || this.value === "live") {
      alert("Coming soon... We are working on it.");
      return;
    }
    if (this.checked) {
      renderPlaylist(this.value);
    }
  });
});

//document.getElementById("videoDate")
document.addEventListener("DOMContentLoaded", function () {
  console.log("Video Date: ", videoList[currentVideoIndex].date);
  document.getElementById("videoDate").textContent =
    videoList[currentVideoIndex].date;
});

// Initialize on load
renderPlaylist();
