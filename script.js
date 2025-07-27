const videoPlayer = document.getElementById("player");
const videoDetailsContainer = document.getElementById("video-details");
const playlistContainer = document.getElementById("playlist");
let currentVideoIndex = 0;
let videoList = [];

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function renderPlaylist() {
  playlistContainer.innerHTML = "";

  const bookingId = getQueryParam("booking");

  if (!bookingId) {
    playlistContainer.innerHTML = "<p>No booking ID provided in URL.</p>";
    return;
  }

  fetch(`http://15.207.205.103:5000/api/recordings?booking_id=${bookingId}`)
    .then((response) => response.json())
    .then(({ data }) => {
      if (!Array.isArray(data) || data.length === 0) {
        playlistContainer.innerHTML =
          "<p>No recordings found for this booking.</p>";
        return;
      }

      videoList = data.map((item, index) => ({
        title: `Part ${index + 1} (${item.start_time} - ${item.end_time})`,
        url: item.url,
        thumbnail: "ole-player.png",
      }));

      playlistContainer.innerHTML = "";

      videoList.forEach((video, index) => {
        const item = document.createElement("div");
        item.className = "playlist-item";
        item.onclick = () => loadVideo(index);

        item.innerHTML = `
          <img src="${video.thumbnail}" alt="${video.title}" />
          <p>${video.title}</p>
        `;

        playlistContainer.appendChild(item);
      });

      loadVideo(0);
    })
    .catch((err) => {
      console.error("Failed to fetch videos:", err);
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

// Run once on page load
renderPlaylist();
loadVideo(0);
