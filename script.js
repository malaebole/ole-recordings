const loader = document.getElementById("loader");
const videoPlayer = document.getElementById("player");
const videoDetailsContainer = document.getElementById("video-details");
const playlistContainer = document.getElementById("playlist");

let currentVideoIndex = 0;

let videoList = [
  {
    title: "Live Camera Feed",
    url: "rtsp://15.207.205.103:7554/h264",
    thumbnail: "thumbnail-live.png",
    category: "live",
    live: true,
  },
];

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function formatDateRange(start, end) {
  function parseAndFormat(dateStr) {
    const [datePart, timePart, meridiem] = dateStr.split(" ");
    const [day, month, year] = datePart.split("-");
    const [h, m, s] = timePart.split(":");
    let hour = parseInt(h, 10);
    const minute = m.padStart(2, "0");
    if (meridiem.toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (meridiem.toUpperCase() === "AM" && hour === 12) hour = 0;
    const date = new Date(
      `${year}-${month}-${day}T${hour.toString().padStart(2, "0")}:${minute}`
    );

    const formattedDate = `${day}/${month}/${year}`;
    const formattedHour = (date.getHours() % 12 || 12)
      .toString()
      .padStart(2, "0");
    const formattedMinute = date.getMinutes().toString().padStart(2, "0");
    const ampm = date.getHours() >= 12 ? "PM" : "AM";
    return `${formattedDate} ${formattedHour}:${formattedMinute} ${ampm}`;
  }
  return `${parseAndFormat(start)} - ${parseAndFormat(end)}`;
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

      const recordedVideos = data.map((item, index) => ({
        title: `Part ${index + 1} (${formatDateRange(
          item.start_time,
          item.end_time
        )})`,
        url: item.url,
        category: item?.category || "match",
        thumbnail: "thumbnail.png",
        live: false,
      }));

      // Merge recordings with existing list
      videoList = [videoList[0], ...recordedVideos];

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
              <h3>${video.title}</h3>
              <p>${video.category}</p>
              <p>${video.category === "live" ? "Live Feed" : "Match Video"}</p>
          </div>
          ${video.live ? '<div class="live-tag">LIVE</div>' : ""}
        `;

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
  videoPlayer.load();
  videoPlayer.play();

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

// Handle camera/category filter toggle
document.querySelectorAll(".camera-option input").forEach((radio) => {
  radio.addEventListener("change", function () {
    if (this.checked) {
      renderPlaylist(this.value);
    }
  });
});

// Initialize on load
renderPlaylist();
