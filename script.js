const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: sessionStorage.getItem("access_token") || null,
    refresh_token: sessionStorage.getItem("refresh_token") || null,
    albumId: null,
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    slideshowInterval: null,
    slideshowSpeed: 3000,
    isSlideshowPlaying: false,
    sleepStartTime: null,
    sleepEndTime: null,
    sleepModeActive: false,
    cacheEnabled: true,
    cacheExpiration: 86400000, // 24hrs in ms

    getAccessToken: function() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.accessToken = hashParams.get("access_token");
            if (hashParams.has("refresh_token")) {
                this.refresh_token = hashParams.get("refresh_token");
                sessionStorage.setItem("refresh_token", this.refresh_token);
            }
            sessionStorage.setItem("access_token", this.accessToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (this.accessToken) {
            document.getElementById("auth-container").style.display = "none";
            document.getElementById("app-container").style.display = "flex";
            this.fetchAlbums();
            this.loadPhotos();
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    },

    authorizeUser: function() {
        window.location.href = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}&prompt=consent`;
    },

    fetchAlbums: function() {
        if (!this.accessToken) return;
        const url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";

        fetch(url, {
            method: "GET",
            headers: { 
                "Authorization": "Bearer " + this.accessToken 
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.albums) {
                this.albums = data.albums;
                this.renderAlbumList();
            } else {
                console.error("No albums found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching albums:", error);
            if (error.message.includes('unauthorized')) {
                console.error('權限不足，請重新授權');
                this.accessToken = null;
                this.refresh_token = null;
                sessionStorage.removeItem("access_token");
                sessionStorage.removeItem("refresh_token");
                document.getElementById("auth-container").style.display = "flex";
                document.getElementById("app-container").style.display = "none";
            }
        });
    },

    renderAlbumList: function() {
        const albumSelect = document.getElementById("album-select");
        albumSelect.innerHTML = '<option value="all">所有相片</option>';
        this.albums.forEach(album => {
            const option = document.createElement("option");
            option.value = album.id;
            option.textContent = album.title;
            albumSelect.appendChild(option);
        });
    },

    loadCachedPhotos: function() {
        if (!this.cacheEnabled) return;

        const albumId = this.albumId === null ? 'all' : this.albumId;
        const cachedData = localStorage.getItem(`photos-${albumId}`);

        if (cachedData) {
            try {
                const data = JSON.parse(cachedData);
                const currentTime = Date.now();
                // 检查缓存的有效性
                if (currentTime - data.cacheTime <= this.cacheExpiration) {
                    this.photos = data.items || [];
                    this.nextPageToken = data.nextPageToken || null;
                } else {
                    console.warn('缓存已过期，重新加载照片');
                }
            } catch (error) {
                console.error('Error loading cached photos:', error);
                this.cacheEnabled = false;
            }
        }
    },

    cachePhotos: function() {
        if (!this.cacheEnabled) return;

        const albumId = this.albumId === null ? 'all' : this.albumId;
        const cacheData = {
            items: this.photos,
            nextPageToken: this.nextPageToken,
            cacheTime: Date.now()
        };

        localStorage.setItem(`photos-${albumId}`, JSON.stringify({
    items: this.photos,
    nextPageToken: this.nextPageToken,
    cacheTime: Date.now()
}));
    },

    loadPhotos: function() {
        const albumSelect = document.getElementById("album-select");
        this.albumId = albumSelect.value === "all" ? null : albumSelect.value;
        this.loadCachedPhotos();

        // 檢查是否有照片
        if (this.photos.length === 0) {
            this.fetchPhotos();
        }
    },

    fetchPhotos: function(retriesLeft = 3) {
        const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
        const body = {
            pageSize: 50,
            pageToken: this.nextPageToken || ''
        };

        if (this.albumId !== null) {
            body.albumId = this.albumId;
        }

        const start = Date.now();
        const loadingIndicator = document.getElementById('global-loading');
        loadingIndicator.style.display = 'block';

        fetch(url, {
            method: "POST",
            headers: { 
                "Authorization": "Bearer " + this.accessToken, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify(body)
        })
        .then(response => {
            loadingIndicator.style.display = 'none';
            const elapsed = Date.now() - start;
            console.log(`fetchPhotos response time: ${elapsed}ms`);
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('fetchPhotos data:', data);
            if (data.mediaItems) {
                this.photos = this.photos.concat(data.mediaItems.map(item => ({
                    id: item.id,
                    baseUrl: item.baseUrl,
                    filename: item.filename
                })));
                this.nextPageToken = data.nextPageToken;
                this.cachePhotos();
                this.renderPhotos();
            } else {
                console.error("No mediaItems found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
            if (retriesLeft > 1) {
                const waitTime = Math.min(10000, 1000 * retriesLeft);
                console.log(`Retrying in ${waitTime}ms...`);
                setTimeout(() => this.fetchPhotos(retriesLeft - 1), waitTime);
            } else {
                console.error('Failed to fetch photos after all retries.');
            }
        });
    },

    renderPhotos: function() {
        const photoContainer = document.getElementById("photo-container");
        const thumbnailList = document.querySelector('.thumbnail-list');
        const loadingIndicator = document.getElementById('global-loading');

        photoContainer.innerHTML = '';
        thumbnailList.innerHTML = '';

        if (this.photos.length === 0) {
            photoContainer.innerHTML = "<p>此相簿目前沒有照片</p>";
            thumbnailList.innerHTML = "<p>無Thumbnail可顯示</p>";
            return;
        }

        this.photos.forEach((photo, index) => {
            const img = document.createElement("img");
            img.src = `${photo.baseUrl}=w600-h400&v=3`;
            img.alt = "Photo" + (index + 1);
            img.classList.add("photo");
            img.onclick = () => this.openLightbox(index);

            const wrapper = document.createElement("div");
            wrapper.className = "thumbnail";
            wrapper.innerHTML = `
                <img src="${photo.baseUrl}=w60-h40&v=3" alt="Thumbnail${index + 1}" class="thumbnail">
                <div class="loading" style="display: none;">載入中...</div>
            `;

            const thumbnailImg = wrapper.querySelector('.thumbnail');
            const thumbnailLoading = wrapper.querySelector('.loading');

            thumbnailImg.onload = () => {
                thumbnailLoading.style.display = 'none';
            };

            thumbnailImg.onerror = (e) => {
            console.error(`Thumbnail failed to load from URL: ${thumbnailImg.src}`, e); // 加入图片 URL
            thumbnailLoading.style.display = 'none';
            wrapper.innerHTML = '<div class="error">圖片加載失敗</div>';
            };
            
            thumbnailList.appendChild(wrapper);

            img.onload = () => {
                if (this.isSlideshowPlaying) {
                    this.resumeSlideshow();
                }
            };

            img.onerror = (e) => {
                console.error(`Photo failed to load from URL: ${img.src}`, e); // 加入图片 URL
            img.remove();
        };

            photoContainer.appendChild(img);
        });
    },

    openLightbox: function(index) {
        const lightbox = document.getElementById("lightbox");
        const lightboxImage = document.getElementById("lightbox-image");
        const loadingIndicator = document.getElementById('loading-indicator');

        lightboxImage.src = `${this.photos[index].baseUrl}=w1200-h800`;
        lightbox.style.display = "flex";
        setTimeout(() => lightbox.style.opacity = 1, 10);
        loadingIndicator.style.display = 'block';

        this.currentPhotoIndex = index;
        document.getElementById("prev-photo").onclick = () => this.changePhoto(-1);
        document.getElementById("next-photo").onclick = () => this.changePhoto(1);

        clearInterval(this.slideshowInterval);
        this.setupLightboxClick();
    },

    setupLightboxClick: function() {
        const lightboxImage = document.getElementById("lightbox-image");
        const lightbox = document.getElementById("lightbox");
        let clickTimeout;

        lightboxImage.onreadystatechange = () => {
            if (lightboxImage.readyState === 'complete') {
                lightboxImage.style.cursor = "pointer";
            }
        };

        lightboxImage.onclick = (event) => {
            event.stopPropagation();
            clearTimeout(clickTimeout);
            
            clickTimeout = setTimeout(() => {
                if (this.isSlideshowPlaying) {
                    this.pauseSlideshow();
                } else {
                    this.resumeSlideshow();
                }
            }, 250);

            lightboxImage.ondblclick = () => {
                clearTimeout(clickTimeout);
                this.closeLightbox();
                this.pauseSlideshow();
            };

            const hammer = new Hammer.GestureManager();
            const swipe = new Hammer.Swipe();
            hammer.add(swipe);
            
            hammer.on('swipeleft', () => {
                this.changePhoto(1);
                this.isSlideshowPlaying = false;
                clearInterval(this.slideshowInterval);
                this.startSlideshow();
            });
            
            hammer.on('swiperight', () => {
                this.changePhoto(-1);
                this.isSlideshowPlaying = false;
                clearInterval(this.slideshowInterval);
                this.startSlideshow();
            });
        };
    },

    closeLightbox: function() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => {
            lightbox.style.display = "none";
        }, 300);
    },

    changePhoto: function(direction) {
        this.currentPhotoIndex += direction;
        if (this.currentPhotoIndex < 0) {
            this.currentPhotoIndex = this.photos.length - 1;
        } else if (this.currentPhotoIndex >= this.photos.length) {
            this.currentPhotoIndex = 0;
        }
        this.showCurrentPhoto();
    },

    showCurrentPhoto: function() {
        const lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1200-h800`;
    },

    startSlideshow: function() {
        if (this.photos.length > 0) {
            const speedInput = document.getElementById("slideshow-speed");
            let playOrder = document.getElementById("play-order").value;
            this.slideshowSpeed = speedInput.value * 1000;
            this.autoChangePhoto(playOrder);
            this.isSlideshowPlaying = true;
            document.body.classList.add('slideshow-active');
            document.querySelectorAll('.nav-button').forEach(button => button.style.display = 'flex');
        }
    },

    pauseSlideshow: function() {
        clearInterval(this.slideshowInterval);
        this.isSlideshowPlaying = false;
        document.body.classList.remove('slideshow-active');
        document.querySelectorAll('.nav-button').forEach(button => button.style.display = 'none');
    },

    resumeSlideshow: function() {
        const playOrder = document.getElementById("play-order").value;
        this.isSlideshowPlaying = true;
        this.autoChangePhoto(playOrder);
        document.querySelectorAll('.nav-button').forEach(button => button.style.display = 'none');
    },

    autoChangePhoto: function(playOrder) {
        clearInterval(this.slideshowInterval);
        this.slideshowInterval = setInterval(() => {
            if (playOrder === "random") {
                this.currentPhotoIndex = Math.floor(Math.random() * this.photos.length);
            } else {
                this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            }
            this.showCurrentPhoto();
        }, this.slideshowSpeed);
    },

    setSleepMode: function() {
        const startTime = document.getElementById("sleep-time-start").value;
        const endTime = document.getElementById("sleep-time-end").value;

        if (startTime && endTime) {
            this.sleepStartTime = startTime;
            this.sleepEndTime = endTime;
            const result = this.isTimeWithinRange(new Date());
            if (result) {
                alert('休眠時間設定成功');
                this.checkSleepMode();
                setInterval(() => this.checkSleepMode(), 60000); // 每分鐘檢查一次
            } else {
                alert('設定的休眠時間不交叉，請檢查');
            }
        } else {
            alert('請設定完整的休眠時間');
        }
    },

    checkSleepMode: function() {
        const now = new Date();
        let result = this.isTimeWithinRange(now);

        if (result && 
            new Date(now.getFullYear(), now.getMonth(), 
                     now.getDate(), 
                     this.sleepStartTime.split(':')[0], 
                     this.sleepStartTime.split(':')[1]) <= now) {
            this.activateSleepMode();
        } else {
            this.deactivateSleepMode();
        }
    },

    isTimeWithinRange: function(date) {
        const startSplit = this.sleepStartTime.split(':');
        const endSplit = this.sleepEndTime.split(':');
        
        const startHour = parseInt(startSplit[0], 10);
        const startMinute = parseInt(startSplit[1], 10);
        const endHour = parseInt(endSplit[0], 10);
        const endMinute = parseInt(endSplit[1], 10);

        const timeStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, startMinute);
        let timeEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), endHour, endMinute);

        if (startHour > endHour || (startHour === endHour && startMinute > endMinute)) {
            timeEnd.setDate(timeEnd.getDate() + 1);
        }

        const currentTime = date.getTime();
        return currentTime >= timeStart.getTime() && currentTime < timeEnd.getTime();
    },

    activateSleepMode: function() {
        if (!this.sleepModeActive) {
            this.sleepModeActive = true;
            this.pauseSlideshow();
            document.getElementById("photo-container").style.display = "none";
            document.body.style.filter = "brightness(20%)";
            document.body.classList.add('sleep-mode');
            const { fullscreenElement } = document;
            if (!fullscreenElement) {
                document.body.requestFullscreen();
            }
            this.toggleFullscreen(true);
        }
    },

    deactivateSleepMode: function() {
        if (this.sleepModeActive) {
            this.sleepModeActive = false;
            document.body.style.filter = "brightness(100%)";
            document.getElementById("photo-container").style.display = "grid";
            document.body.classList.remove('sleep-mode');
            document.exitFullscreen();
            this.toggleFullscreen(false);
        }
    },

    toggleFullscreen: function(enabled) {
        if (enabled) {
            if (!document.fullscreenElement) {
                document.body.requestFullscreen();
            }
        } else {
            if (document.fullscreenElement === document.body) {
                document.exitFullscreen();
            }
        }
    },

    initCache: function() {
        if (this.cacheEnabled) {
            try {
                const albums = JSON.parse(localStorage.getItem('albums'));
                const photos = JSON.parse(localStorage.getItem('photos'));

                // 验证缓存数据的有效性
                if (albums && Array.isArray(albums)) {
                    this.albums = albums;
                }
                if (photos && Array.isArray(photos)) {
                    this.photos = photos; 
                }
            } catch (error) {
                console.error('Error parsing cached data:', error);
                localStorage.removeItem('albums');
                localStorage.removeItem('photos');
            }
        }
    },

    handleError: function(error, retriesLeft = 3) {
        console.error("Error:", error);
        if (error.message.includes('unauthorized') || error.message.includes('invalid_grant')) {
            console.error('授權已過期，需重新授權');
            this.accessToken = null;
            this.refresh_token = null;
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('refresh_token');
        }
        if (retriesLeft > 0) {
            setTimeout(() => {
                this.fetchPhotos(retriesLeft - 1);
            }, 1000);
        } else {
            console.error('無法重新試圖，已超過最大重試次數');
        }
    },

    refreshToken: function() {
        if (!this.refresh_token) return;
        const url = `https://www.googleapis.com/oauth2/v4/token?client_id=${this.CLIENT_ID}&client_secret=your_client_secret&refresh_token=${this.refresh_token}&grant_type=refresh_token`;
        
        fetch(url, {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }
            return response.json();
        })
        .then(data => {
            sessionStorage.setItem('access_token', data.access_token);
            this.accessToken = data.access_token;
            console.log('Token refreshed successfully');
        })
        .catch(error => {
            console.error('Token refresh failed:', error);
            this.accessToken = null;
            this.refresh_token = null;
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('refresh_token');
        });
    },

    // 自動刷新 OAuth Token
    initToken_refresh: function() {
        const token = sessionStorage.getItem('access_token');
        const refresh_token = sessionStorage.getItem('refresh_token');

        if (token && refresh_token) {
            setTimeout(() => {
                this.refreshToken();
            }, 3600000); // 到期前1小時
        }
    }
};

// 異步_initialize
window.addEventListener('load', () => {
    app.getAccessToken();
    app.initCache();
    app.initToken_refresh();

    // 縮圖列表 scroll loading 初始化
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                app.fetchPhotos();
            }
        });
    });

    const target = document.querySelector('.thumbnail-list');
    if (target) {
        observer.observe(target);
    }
});

// 事件監聽器
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
    document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);
    
    document.getElementById("back-to-album-btn").onclick = () => {
        document.getElementById("photo-container").style.display = "none";
        document.getElementById("album-selection-container").style.display = "block";
    };

    document.getElementById("set-sleep-btn").onclick = app.setSleepMode.bind(app);
    document.getElementById("activate-btn").onclick = () => {
        app.sleepModeActive = !app.sleepModeActive;
        if (app.sleepModeActive) {
            app.activateSleepMode();
        } else {
            app.deactivateSleepMode();
        }
    };

    // 全螢幕模式切換
    document.getElementById("start-slideshow-btn").addEventListener("click", function() {
        if (!app.isSlideshowPlaying) {
            app.startSlideshow();
            this.textContent = "停止幻燈片";
        } else {
            app.pauseSlideshow();
            this.textContent = "開始幻燈片";
        }
    });

    // 觸控顯示按鈕
    let lastActiveTime = 0;
    document.addEventListener('touchstart', function() {
        if (app.isSlideshowPlaying) {
            const buttons = document.querySelectorAll('.nav-button');
            buttons.forEach(button => button.style.display = 'flex');
            lastActiveTime = new Date().getTime();
        }
    }, { passive: true });

    document.addEventListener('touchend', function() {
        lastActiveTime = new Date().getTime();
    });

    document.addEventListener('mousemove', function() {
        lastActiveTime = new Date().getTime();
    });

    document.addEventListener('mouseleave', function() {
        const currentTime = new Date().getTime();
        if (currentTime - lastActiveTime > 3000 && app.isSlideshowPlaying) {
            const buttons = document.querySelectorAll('.nav-button');
            buttons.forEach(button => button.style.display = 'none');
        }
    });
});
