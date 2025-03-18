const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: sessionStorage.getItem("access_token") || null,
    albumId: null,
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    slideshowInterval: null,
    slideshowSpeed: 3000, // 默认速度（毫秒）
    slideshowEffect: "fade", // 默认幻灯片效果

    getAccessToken: function() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.accessToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (this.accessToken) {
            document.getElementById("auth-container").style.display = "none";
            document.getElementById("app-container").style.display = "flex";
            this.fetchAlbums();
            this.loadPhotos(); // Load photos after fetching albums
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    },

    authorizeUser: function() {
        const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}&prompt=consent`;
        window.location.href = authUrl;
    },

    fetchAlbums: function() {
        if (!this.accessToken) return;
        const url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";

        fetch(url, {
            method: "GET",
            headers: { "Authorization": "Bearer " + this.accessToken }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.albums) {
                this.renderAlbumList(data.albums);
            } else {
                console.error("No albums found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching albums:", error);
        });
    },

    renderAlbumList: function(albums) {
        const albumSelect = document.getElementById("album-select");
        albumSelect.innerHTML = '<option value="all">所有相片</option>';
        albums.forEach(album => {
            const option = document.createElement("option");
            option.value = album.id;
            option.textContent = album.title;
            albumSelect.appendChild(option);
        });
    },

    loadPhotos: function() {
        const albumSelect = document.getElementById("album-select");
        this.albumId = albumSelect.value === "all" ? null : albumSelect.value;

        // Reset the photos array and nextPageToken to avoid issues with repeated loads
        this.photos = [];
        this.nextPageToken = null;

        if (this.albumId) {
            this.fetchPhotos();
        } else {
            this.fetchAllPhotos();
        }
    },

    fetchAllPhotos: function() {
        const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
        const body = {
            pageSize: 50,
            pageToken: this.nextPageToken || ''
        };

        fetch(url, {
            method: "POST",
            headers: { "Authorization": "Bearer " + this.accessToken, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.mediaItems) {
                this.photos = [...new Map(this.photos.concat(data.mediaItems).map(item => [item.id, item])).values()];
                this.nextPageToken = data.nextPageToken;
                this.renderPhotos();
            } else {
                console.error("No mediaItems found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
        });
    },

    fetchPhotos: function() {
        const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
        const body = {
            albumId: this.albumId,
            pageSize: 50
        };

        fetch(url, {
            method: "POST",
            headers: { "Authorization": "Bearer " + this.accessToken, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.mediaItems) {
                this.photos = [...new Map(data.mediaItems.map(item => [item.id, item])).values()];
                this.renderPhotos();
            } else {
                console.error("No mediaItems found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
        });
    },

    renderPhotos: function() {
        const photoContainer = document.getElementById("photo-container");
        if (!photoContainer) {
            console.error('Photo container not found.');
            return; // 如果没有找到容器，直接返回
        }

        photoContainer.innerHTML = '';

        if (this.photos.length === 0) {
            photoContainer.innerHTML = "<p>此相簿沒有照片</p>";
        } else {
            this.photos.forEach((photo, index) => {
                const img = document.createElement("img");
                img.src = `${photo.baseUrl}=w600-h400`;
                img.alt = "Photo";
                img.classList.add("photo");
                img.onclick = () => this.openLightbox(index);
                photoContainer.appendChild(img);
            });
        }

        // 确保容器可见
        photoContainer.style.display = "grid";
        document.getElementById("app-container").style.display = "flex";
        document.getElementById("photo-container").style.display = "grid";
    },

    openLightbox: function(index) {
        this.currentPhotoIndex = index;
        const lightbox = document.getElementById("lightbox");
        const lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[index].baseUrl}=w1200-h800`;
        lightbox.style.display = "flex";
        setTimeout(() => lightbox.style.opacity = 1, 10);

        // 绑定上下左右按钮的事件
        document.getElementById("prev-photo").onclick = () => this.changePhoto(-1);
        document.getElementById("next-photo").onclick = () => this.changePhoto(1);
        
        // 幻灯片按钮
        document.getElementById("start-slideshow-lightbox").onclick = () => {
            this.slideshowEffect = document.getElementById("slideshow-effect").value;
            this.startSlideshow();
        };

        // 退出幻灯片按钮
        document.getElementById("exit-slideshow").onclick = () => {
            this.stopSlideshow();
        };

        // 停止轮播
        clearInterval(this.slideshowInterval); // 确保在打开 Lightbox 时不运行轮播
    },

    startSlideshow: function() {
        if (this.photos.length > 0) {
            // 显示退出幻灯片按钮
            document.getElementById("exit-slideshow").style.display = "inline-block";

            // 获取用户设置的轮播速度
            const speedInput = document.getElementById("slideshow-speed");
            this.slideshowSpeed = speedInput.value * 1000; // 转换为毫秒
            this.autoChangePhoto();

            // 将 Lightbox 扩展到全屏
            const lightbox = document.getElementById("lightbox");
            lightbox.style.width = "100%";
            lightbox.style.height = "100%";
        }
    },

    stopSlideshow: function() {
        clearInterval(this.slideshowInterval); // 清除幻灯片间隔

        // 隐藏退出幻灯片按钮
        document.getElementById("exit-slideshow").style.display = "none";

        // 将 Lightbox 恢复为适配屏幕大小
        const lightbox = document.getElementById("lightbox");
        lightbox.style.width = "auto";
        lightbox.style.height = "auto";

        // 重设 Lightbox 背景的 opacity
        lightbox.style.opacity = 0;
        setTimeout(() => {
            lightbox.style.display = "none"; // 撤销显示
        }, 300);

        // 重新显示当前图片
        this.showCurrentPhoto();
    },

    closeLightbox: function() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => lightbox.style.display = "none", 300);
    },

    changePhoto: function(direction) {
        this.currentPhotoIndex += direction;
        if (this.currentPhotoIndex < 0) {
            this.currentPhotoIndex = this.photos.length - 1; // 循环到最后一张
        } else if (this.currentPhotoIndex >= this.photos.length) {
            this.currentPhotoIndex = 0; // 循环到第一张
        }
        this.showCurrentPhoto(); // 更新显示的照片
    },

    showCurrentPhoto: function() {
        const lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1200-h800`;

        // 应用动画效果
        lightboxImage.classList.remove('fade', 'slide', 'zoom'); // 清除之前的动画类
        void lightboxImage.offsetWidth; // 触发重排以重新应用动画
        lightboxImage.classList.add(this.slideshowEffect); // 添加当前选择的动画效果
    },

    autoChangePhoto: function() {
        clearInterval(this.slideshowInterval); // 清除现有的轮播
        this.slideshowInterval = setInterval(() => {
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            this.showCurrentPhoto();
        }, this.slideshowSpeed);
    }
};

// 当 DOM 内容加载完成后，添加事件监听
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
    document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);
    document.getElementById("start-slideshow-btn").onclick = app.startSlideshow.bind(app);

    // 处理相册返回
    document.getElementById("back-to-album-btn").onclick = () => {
        document.getElementById("photo-container").style.display = "none";
        document.getElementById("album-selection-container").style.display = "block";
    };

    app.getAccessToken();

    // 绑定 Lightbox 点击事件关闭
    document.getElementById("lightbox").addEventListener("click", function(event) {
        if (event.target === this) {
            app.closeLightbox();
        }
    });

    // 窗口滚动加载更多照片
    window.onscroll = function() {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
            app.fetchAllPhotos();
        }
    };
});
