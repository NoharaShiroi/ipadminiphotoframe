const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
const CLIENT_ID = "你的_CLIENT_ID";
const REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = null;
let albumId = null;
let photos = [];
let currentPhotoIndex = 0;
let slideshowInterval = null;
let nextPageToken = null;
let isFullscreen = false;
let isRandomOrder = false;
let slideshowStartTime = "08:00";
let slideshowEndTime = "22:00";

// **🔹 初始化 Google OAuth & 事件監聽**
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").addEventListener("click", authorizeUser);
    document.getElementById("fullscreen-btn").addEventListener("click", enterFullscreenSlideshow);
    document.getElementById("random-btn").addEventListener("click", toggleSlideshowOrder);
    document.getElementById("album-id-input").addEventListener("change", updateAlbumId);
    getAccessToken();
});

// **🔹 授權用戶**
function authorizeUser() {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=${SCOPES}`;
    window.location.href = authUrl;
}

// **🔹 取得 access_token**
function getAccessToken() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    accessToken = hashParams.get("access_token");

    if (accessToken) {
        localStorage.setItem("access_token", accessToken);
        document.getElementById("authorize-btn").style.display = "none";
        fetchPhotos();
    } else {
        console.warn("未找到 access_token，請先授權 Google Photos");
    }
}

// **🔹 取得 Google Photos 相片**
async function fetchPhotos(pageToken = '') {
    let token = localStorage.getItem("access_token");
    if (!token) return console.error("未找到 access_token");

    let url = "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50";
    if (albumId) url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    if (pageToken) url += `&pageToken=${pageToken}`;

    try {
        const requestBody = albumId ? JSON.stringify({ albumId: albumId, pageSize: 50, pageToken: pageToken }) : null;
        const response = await fetch(url, {
            method: albumId ? "POST" : "GET",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: requestBody
        });
        const data = await response.json();

        if (data.mediaItems) {
            photos = [...photos, ...data.mediaItems.filter(item => item.mimeType.startsWith("image"))];
            displayPhotos();
            if (!slideshowInterval) startSlideshow();
        }
        nextPageToken = data.nextPageToken || null;
    } catch (error) {
        console.error("Error fetching photos:", error);
    }
}

// **🔹 監聽滾動事件，滾動時載入更多相片**
window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && nextPageToken) {
        fetchPhotos(nextPageToken);
    }
});

// **🔹 更新相簿 ID**
function updateAlbumId() {
    albumId = document.getElementById("album-id-input").value;
    photos = [];
    fetchPhotos();
}

// **🔹 顯示相片縮略圖**
function displayPhotos() {
    const gallery = document.getElementById("photo-gallery");
    gallery.innerHTML = "";

    photos.forEach((photo, index) => {
        const img = document.createElement("img");
        img.src = `${photo.baseUrl}=w200-h200`;
        img.classList.add("photo-item");
        img.onclick = () => openLightbox(index);
        gallery.appendChild(img);
    });
}

// **🔹 開始輪播**
function startSlideshow() {
    if (slideshowInterval) clearInterval(slideshowInterval);
    if (photos.length === 0) return console.warn("沒有可顯示的相片");

    if (isRandomOrder) shufflePhotos();
    changePhoto(0);
    slideshowInterval = setInterval(() => {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        changePhoto(currentPhotoIndex);
    }, 5000);
}

// **🔹 切換隨機/順序播放**
function toggleSlideshowOrder() {
    isRandomOrder = !isRandomOrder;
    startSlideshow();
}

// **🔹 設定全螢幕輪播時間**
function isWithinSlideshowTime() {
    let now = new Date();
    let currentTime = `${now.getHours()}:${now.getMinutes()}`;
    return currentTime >= slideshowStartTime && currentTime <= slideshowEndTime;
}

// **🔹 進入全螢幕輪播模式**
function enterFullscreenSlideshow() {
    if (!isWithinSlideshowTime()) return;
    isFullscreen = true;
    document.documentElement.requestFullscreen();
    startSlideshow();
}

// **🔹 退出全螢幕模式**
document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
        isFullscreen = false;
        clearInterval(slideshowInterval);
    }
});
