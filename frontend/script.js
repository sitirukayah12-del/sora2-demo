document.addEventListener('DOMContentLoaded', () => {
    // === 全局变量 ===
    let currentUser = null;
    const loadingOverlay = document.getElementById('global-loading');

    // === 1. Tab 切换逻辑 ===
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function switchTab(tabId) {
        navItems.forEach(item => {
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        tabContents.forEach(content => {
            if (content.id === `${tabId}-section`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.dataset.tab);
        });
    });

    window.switchTab = switchTab;

    // === 2. 认证与 UI 管理 ===
    
    // 检查登录状态
    async function checkAuth() {
        const token = localStorage.getItem('token');
        if (!token) {
            updateUI(null);
            return;
        }

        try {
            const res = await fetchWithAuth('/api/user/me');
            if (res) {
                currentUser = res;
                updateUI(currentUser);
            } else {
                // Token 无效
                logout();
            }
        } catch (e) {
            logout();
        }
    }

    function updateUI(user) {
        const guestActions = document.getElementById('guest-actions');
        const userActions = document.getElementById('user-actions');
        const displayUsername = document.getElementById('display-username');
        const displayBalance = document.getElementById('display-balance');

        if (user) {
            guestActions.style.display = 'none';
            userActions.style.display = 'flex';
            displayUsername.textContent = user.username;
            displayBalance.textContent = user.balance.toFixed(1);
        } else {
            guestActions.style.display = 'flex';
            userActions.style.display = 'none';
            displayUsername.textContent = 'User';
            displayBalance.textContent = '0';
        }
    }

    function logout() {
        localStorage.removeItem('token');
        currentUser = null;
        updateUI(null);
        alert('已退出登录');
    }

    document.getElementById('btn-logout').addEventListener('click', logout);

    // === 3. 模态框管理 ===
    window.showModal = function(modalId, mode = null) {
        document.getElementById(modalId).classList.remove('hidden');
        
        if (modalId === 'auth-modal') {
            const title = document.getElementById('auth-title');
            const submitBtn = document.getElementById('btn-auth-submit');
            const switchText = document.getElementById('auth-switch-text');
            const switchLink = document.getElementById('auth-switch-link');
            const emailGroup = document.getElementById('email-group');

            if (mode === 'register') {
                title.textContent = '注册';
                submitBtn.textContent = '立即注册';
                switchText.textContent = '已有账号？';
                switchLink.textContent = '去登录';
                emailGroup.classList.remove('hidden');
                document.getElementById('auth-form').dataset.mode = 'register';
            } else {
                title.textContent = '登录';
                submitBtn.textContent = '登录';
                switchText.textContent = '还没有账号？';
                switchLink.textContent = '去注册';
                emailGroup.classList.add('hidden');
                document.getElementById('auth-form').dataset.mode = 'login';
            }
        }
    };

    window.closeModal = function(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    };

    // 切换登录/注册
    document.getElementById('auth-switch-link').addEventListener('click', (e) => {
        e.preventDefault();
        const form = document.getElementById('auth-form');
        const isRegister = form.dataset.mode === 'register';
        showModal('auth-modal', isRegister ? 'login' : 'register');
    });

    // 处理登录/注册提交
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const mode = e.target.dataset.mode;
        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;
        const email = document.getElementById('auth-email').value;

        try {
            let res;
            if (mode === 'register') {
                res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ username, password, email })
                });
                if (!res.ok) throw await res.json();
                
                alert('注册成功，请登录');
                showModal('auth-modal', 'login');
            } else {
                // Login
                const formData = new URLSearchParams();
                formData.append('username', username);
                formData.append('password', password);

                res = await fetch('/api/auth/token', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: formData
                });
                
                if (!res.ok) throw await res.json();
                
                const data = await res.json();
                localStorage.setItem('token', data.access_token);
                closeModal('auth-modal');
                checkAuth();
                alert('登录成功！');
            }
        } catch (err) {
            alert(err.detail || '操作失败');
        }
    });

    // === 4. 充值逻辑 ===
    window.recharge = async function(amount) {
        if (!currentUser) {
            alert('请先登录！');
            closeModal('recharge-modal');
            showModal('auth-modal', 'login');
            return;
        }

        try {
            const res = await fetchWithAuth('/api/payment/recharge', {
                method: 'POST',
                body: JSON.stringify({ amount })
            });
            
            if (res) {
                alert(res.message);
                closeModal('recharge-modal');
                checkAuth(); // 刷新余额
            }
        } catch (e) {
            alert('充值失败');
        }
    };

    // === 5. 通用 API 调用逻辑 (带 Auth) ===
    async function fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem('token');
        const headers = options.headers || {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            logout();
            return null;
        }

        if (!response.ok) {
            const error = await response.json();
            throw error;
        }

        return await response.json();
    }

    async function callApi(endpoint, payload, resultContainerId, renderCallback) {
        if (!currentUser) {
            alert('请先登录后使用此功能！');
            showModal('auth-modal', 'login');
            return;
        }

        try {
            loadingOverlay.classList.remove('hidden');
            const resultContainer = document.getElementById(resultContainerId);
            resultContainer.innerHTML = '';

            const data = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (data) {
                renderCallback(resultContainer, data);
                // 刷新余额
                checkAuth();
            }

        } catch (error) {
            console.error('API Error:', error);
            if (error.status_code === 402) {
                alert('余额不足，请充值！');
                showModal('recharge-modal');
            } else {
                alert(`生成失败: ${error.detail || error.message}`);
            }
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    // === 6. 各模块功能绑定 ===

    // --- 文生图 (NanoPro) ---
    document.getElementById('generateImageBtn').addEventListener('click', () => {
        const prompt = document.getElementById('image-prompt').value.trim();
        if (!prompt) return alert('请输入提示词');

        callApi('/api/generate-image', { prompt }, 'image-result', (container, data) => {
            container.innerHTML = `
                <img src="${data.image_url}" class="generated-image" alt="生成的图片">
                <p>${data.message}</p>
            `;
        });
    });

    // --- Sora2 视频 ---
    document.getElementById('generateVideoBtn').addEventListener('click', () => {
        const prompt = document.getElementById('video-prompt').value.trim();
        const size = document.getElementById('video-size').value;
        const duration = parseInt(document.getElementById('video-duration').value);
        if (!prompt) return alert('请输入提示词');

        callApi('/api/generate-video', { prompt, size, duration }, 'video-result', (container, data) => {
            container.innerHTML = `
                <video controls width="100%" autoplay loop>
                    <source src="${data.video_url}" type="video/mp4">
                </video>
                <p>${data.message}</p>
            `;
        });
    });

    // --- Veo 视频 ---
    document.getElementById('generateVeoBtn').addEventListener('click', () => {
        const prompt = document.getElementById('veo-prompt').value.trim();
        if (!prompt) return alert('请输入提示词');
        
        // 复用 video 接口
        callApi('/api/generate-video', { prompt }, 'veo-result', (container, data) => {
             container.innerHTML = `
                <video controls width="100%" autoplay loop>
                    <source src="${data.video_url}" type="video/mp4">
                </video>
                <p>${data.message} (Veo Mode)</p>
            `;
        });
    });

    // --- Suno 音乐 ---
    document.getElementById('generateMusicBtn').addEventListener('click', () => {
        const prompt = document.getElementById('music-prompt').value.trim();
        if (!prompt) return alert('请输入提示词');

        callApi('/api/generate-music', { prompt }, 'music-result', (container, data) => {
            container.innerHTML = `
                <audio controls autoplay>
                    <source src="${data.audio_url}" type="audio/mpeg">
                </audio>
                <p>${data.message}</p>
            `;
        });
    });

    // --- Heygem 数字人 ---
    document.getElementById('generateAvatarBtn').addEventListener('click', () => {
        const prompt = document.getElementById('avatar-prompt').value.trim();
        const text = document.getElementById('avatar-text').value.trim();
        if (!text) return alert('请输入台词');

        callApi('/api/generate-avatar', { prompt, text }, 'avatar-result', (container, data) => {
             container.innerHTML = `
                <video controls width="100%" autoplay loop>
                    <source src="${data.video_url}" type="video/mp4">
                </video>
                <p>${data.message}</p>
            `;
        });
    });

    // 初始化检查
    checkAuth();
});
