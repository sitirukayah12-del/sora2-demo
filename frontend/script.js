document.addEventListener('DOMContentLoaded', () => {
    // === 1. Tab 切换逻辑 ===
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function switchTab(tabId) {
        // 更新导航栏状态
        navItems.forEach(item => {
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 更新内容显示
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

    // 暴露给全局以便 HTML onclick 调用
    window.switchTab = switchTab;

    // === 2. 通用 API 调用逻辑 ===
    const loadingOverlay = document.getElementById('global-loading');

    async function callApi(endpoint, payload, resultContainerId, renderCallback) {
        try {
            loadingOverlay.classList.remove('hidden');
            const resultContainer = document.getElementById(resultContainerId);
            resultContainer.innerHTML = ''; // 清空之前的结果

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '请求失败');
            }

            const data = await response.json();
            renderCallback(resultContainer, data);

        } catch (error) {
            console.error('API Error:', error);
            alert(`生成失败: ${error.message}`);
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    // === 3. 各模块功能绑定 ===

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

    // --- Veo 视频 (复用 Video 接口) ---
    document.getElementById('generateVeoBtn').addEventListener('click', () => {
        const prompt = document.getElementById('veo-prompt').value.trim();
        if (!prompt) return alert('请输入提示词');

        callApi('/api/generate-video', { prompt, size: "1920x1080", duration: 10 }, 'veo-result', (container, data) => {
            container.innerHTML = `
                <video controls width="100%" autoplay loop>
                    <source src="${data.video_url}" type="video/mp4">
                </video>
                <p>Veo 模型生成结果: ${data.message}</p>
            `;
        });
    });

    // --- Suno 音乐 ---
    document.getElementById('generateMusicBtn').addEventListener('click', () => {
        const prompt = document.getElementById('music-prompt').value.trim();
        if (!prompt) return alert('请输入提示词');

        callApi('/api/generate-music', { prompt }, 'music-result', (container, data) => {
            container.innerHTML = `
                <div style="background: #f1f5f9; padding: 20px; border-radius: 10px;">
                    <h3>🎵 音乐已生成</h3>
                    <audio controls style="width: 100%; margin-top: 10px;">
                        <source src="${data.audio_url}" type="audio/mpeg">
                    </audio>
                    <p>${data.message}</p>
                </div>
            `;
        });
    });

    // --- Heygem 数字人 ---
    document.getElementById('generateAvatarBtn').addEventListener('click', () => {
        const text = document.getElementById('avatar-text').value.trim();
        if (!text) return alert('请输入说话内容');

        callApi('/api/generate-avatar', { prompt: "avatar", text }, 'avatar-result', (container, data) => {
            container.innerHTML = `
                <video controls width="100%" autoplay>
                    <source src="${data.video_url}" type="video/mp4">
                </video>
                <p>${data.message}</p>
            `;
        });
    });
});