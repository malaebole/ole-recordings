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
      loader.classList.add("hidden"); // Hide Loader

      if (!Array.isArray(data) || data.length === 0) {
        playlistContainer.innerHTML =
          "<p>No recordings found for this booking.</p>";
        return;
      }

      const recordedVideos = data.map((item, index) => ({
        title: `Part ${index + 1} (${item.start_time} - ${item.end_time})`,
        url: item.url,
        category: item?.category || "match",
        thumbnail: "thumbnail.png",
        live: false,
      }));
      if (recordedVideos) {
        videoList.push(...recordedVideos);
      }

      //Filtering videos by category selection
      const filteredVideos =
        category === "all"
          ? videoList
          : videoList.filter((video) => video.category === category);

      playlistContainer.innerHTML = "";
      filteredVideos.forEach((video, index) => {
        const item = document.createElement("div");
        item.className = "playlist-item";
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
  if (!videoList[index]?.url) return;

  currentVideoIndex = index;
  videoPlayer.src = videoList[index].url;
  videoDetailsContainer.innerHTML = videoList[index].title;
  videoPlayer.load();
  videoPlayer.play();
}

function toggleMute() {
  videoPlayer.muted = !videoPlayer.muted;
}

function enterPiP() {
  if (
    document.pictureInPictureEnabled &&
    !videoPlayer.disablePictureInPicture
  ) {
    videoPlayer.requestPictureInPicture().catch(console.error);
  }
}

function downloadVideo() {
  const link = document.createElement("a");
  link.href = videoList[currentVideoIndex].url;
  link.download = videoList[currentVideoIndex].title + ".mp4";
  link.click();
}

videoPlayer.addEventListener("ended", () => {
  const nextIndex = currentVideoIndex + 1;
  if (nextIndex < videoList.length) {
    loadVideo(nextIndex);
  }
});

// Handle camera/category selection changes
document.querySelectorAll(".camera-option input").forEach((radio) => {
  radio.addEventListener("change", function () {
    if (this.checked) {
      renderPlaylist(this.value);
    }
  });
});

// Run once on page load
renderPlaylist();
loadVideo(0);
