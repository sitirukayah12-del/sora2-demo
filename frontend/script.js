document.addEventListener('DOMContentLoaded', () => {
    console.log('App Version: v1.0.1 - Fixed Tab Visibility'); // 版本标记

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

        // 强制隐藏画布 (防漏)
        const canvasSection = document.getElementById('canvas-section');
        if (tabId !== 'canvas' && canvasSection) {
            canvasSection.classList.remove('active');
            canvasSection.style.display = 'none'; // 双重保险
        } else if (tabId === 'canvas' && canvasSection) {
            canvasSection.style.display = ''; // 清除内联样式
        }

        tabContents.forEach(content => {
            if (content.id === `${tabId}-section`) {
                content.classList.add('active');
                // 如果是画布 Tab，延迟初始化（确保 DOM 可见）
                if (tabId === 'canvas') {
                    setTimeout(initCanvas, 100);
                }
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
            console.error("Auth Error:", err);
            let msg = '操作失败';
            if (err.detail) {
                msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
            } else if (err.message) {
                msg = err.message;
            }
            alert(msg);
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
            const resultContainer = resultContainerId ? document.getElementById(resultContainerId) : null;
            if (resultContainer) resultContainer.innerHTML = '';

            const data = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (data) {
                if (renderCallback) renderCallback(resultContainer, data);
                // 刷新余额
                checkAuth();
                return data; // Return data for caller
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

    // ===================================================
    // === Nano2 Canvas Logic (Fabric.js Implementation) ===
    // ===================================================
    let canvas = null;
    let currentTool = 'select';
    let generationFrame = null;

    window.initCanvas = function() {
        if (canvas) return; // 避免重复初始化

        // 获取父容器宽度
        const container = document.getElementById('canvas-wrapper');
        const width = container.clientWidth;
        const height = container.clientHeight || 650;

        canvas = new fabric.Canvas('main-canvas', {
            width: width,
            height: height,
            backgroundColor: 'transparent', // Transparent to show CSS grid background
            isDrawingMode: false
        });

        // 自适应窗口大小
        window.addEventListener('resize', () => {
            if(canvas) {
                canvas.setWidth(container.clientWidth);
                canvas.setHeight(container.clientHeight);
            }
        });

        console.log("Canvas Initialized");

            // --- Zoom & Pan ---
            canvas.on('mouse:wheel', function(opt) {
                var delta = opt.e.deltaY;
                var zoom = canvas.getZoom();
                zoom *= 0.999 ** delta;
                if (zoom > 5) zoom = 5;
                if (zoom < 0.1) zoom = 0.1;
                canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
                opt.e.preventDefault();
                opt.e.stopPropagation();
            });

            let isDragging = false;
            let lastPosX, lastPosY;

            canvas.on('mouse:down', function(opt) {
                var evt = opt.e;
                if (currentTool === 'hand' || evt.altKey === true) {
                    isDragging = true;
                    canvas.selection = false;
                    lastPosX = evt.clientX;
                    lastPosY = evt.clientY;
                }
            });

            canvas.on('mouse:move', function(opt) {
                if (isDragging) {
                    var e = opt.e;
                    var vpt = canvas.viewportTransform;
                    vpt[4] += e.clientX - lastPosX;
                    vpt[5] += e.clientY - lastPosY;
                    canvas.requestRenderAll();
                    lastPosX = e.clientX;
                    lastPosY = e.clientY;
                }
            });

            canvas.on('mouse:up', function(opt) {
                if(isDragging) {
                    canvas.setViewportTransform(canvas.viewportTransform);
                    isDragging = false;
                    // Restore selection if not in hand mode (optional, but keep simple)
                    if (currentTool !== 'hand') canvas.selection = true;
                }
            });
        };

        window.setCanvasTool = function(tool) {
        if (!canvas) return;

        currentTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        // Find button by onclick attr content (simple hack) or add IDs later. 
        // For now, let's rely on event bubbling logic in HTML or manual selection
        const btn = document.querySelector(`.tool-btn[onclick*="'${tool}'"]`);
        if(btn) btn.classList.add('active');

        // Logic
        canvas.isDrawingMode = false;
        canvas.selection = true;

        if (tool === 'brush') {
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush.width = 5;
            canvas.freeDrawingBrush.color = '#000000';
        } else if (tool === 'hand') {
            canvas.selection = false;
            canvas.defaultCursor = 'grab';
            canvas.hoverCursor = 'grab';
        } else if (tool === 'select') {
            // Default behavior
            canvas.selection = true;
            canvas.defaultCursor = 'default';
        } else if (tool === 'rect') {
            const rect = new fabric.Rect({
                left: 100, top: 100, fill: 'transparent', stroke: '#000', strokeWidth: 2,
                width: 100, height: 100
            });
            canvas.add(rect);
            canvas.setActiveObject(rect);
            setCanvasTool('select'); // Switch back to select after adding
        } else if (tool === 'circle') {
            const circle = new fabric.Circle({
                left: 150, top: 150, radius: 50, fill: 'transparent', stroke: '#000', strokeWidth: 2
            });
            canvas.add(circle);
            canvas.setActiveObject(circle);
            setCanvasTool('select');
        } else if (tool === 'text') {
            const text = new fabric.IText('Hello AI', {
                left: 200, top: 200, fontSize: 24
            });
            canvas.add(text);
            canvas.setActiveObject(text);
            setCanvasTool('select');
        }
    };

    window.clearCanvas = function() {
        if(confirm('确定清空画布吗？')) {
            canvas.clear();
            canvas.setBackgroundColor('transparent', canvas.renderAll.bind(canvas));
        }
    };

    window.addGenFrame = function() {
        if (!canvas) return;
        
        // Remove existing frame if any (optional, or allow multiple)
        if (generationFrame) {
            canvas.remove(generationFrame);
        }

        generationFrame = new fabric.Rect({
            left: canvas.width / 2 - 150,
            top: canvas.height / 2 - 150,
            width: 300,
            height: 300,
            fill: 'transparent',
            stroke: '#ff4757',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            selectable: true,
            hasControls: true
        });

        canvas.add(generationFrame);
        canvas.setActiveObject(generationFrame);
        canvas.requestRenderAll();
        alert('已添加生成框。请调整大小和位置，然后在下方输入提示词生成。');
    };

    window.handleImageUpload = function(input) {
        const file = input.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            fabric.Image.fromURL(e.target.result, function(img) {
                img.scaleToWidth(300);
                canvas.add(img);
                canvas.centerObject(img);
                canvas.setActiveObject(img);
            });
        };
        reader.readAsDataURL(file);
        input.value = ''; // Reset
    };

    window.generateOnCanvas = async function() {
        if (!canvas) return;
        const prompt = document.getElementById('canvas-prompt').value.trim();
        if (!prompt) return alert('请输入生成提示词');

        // Capture area
        // If Generation Frame exists, capture that area. Else capture whole canvas.
        let dataURL;
        let targetRect = generationFrame;

        // Temporarily hide the frame border for capture if it's the target
        // But usually we want to send the CONTENT inside the frame.
        
        if (targetRect) {
            // Hide the frame itself before capturing
            targetRect.visible = false;
            canvas.renderAll();

            // Clone the canvas content cropped to the rect
            // Method: Use toDataURL with cropping
            dataURL = canvas.toDataURL({
                left: targetRect.left,
                top: targetRect.top,
                width: targetRect.getScaledWidth(),
                height: targetRect.getScaledHeight(),
                format: 'png'
            });

            // Show it back
            targetRect.visible = true;
            canvas.renderAll();
        } else {
            // Whole canvas
            dataURL = canvas.toDataURL({ format: 'png' });
        }

        // Call API
        // We'll reuse generate-image or make a new one. Let's make a new logic or reuse generate-image with init_image
        // Currently generate-image only takes prompt. We need to update backend or use a new endpoint.
        // Let's assume we update backend to accept 'init_image'
        
        const payload = {
            prompt: prompt,
            init_image: dataURL // Base64
        };

        // UI Loading state
        const btn = document.querySelector('.canvas-gen-panel .primary-btn');
        const originalText = btn.textContent;
        btn.textContent = '生成中...';
        btn.disabled = true;

        try {
            // Using a new endpoint /api/generate-canvas or reusing image
            // Let's use /api/generate-canvas for clarity
            const data = await callApi('/api/generate-canvas', payload, null, null);
            
            if (data && data.image_url) {
                // Add result to canvas
                fabric.Image.fromURL(data.image_url, function(img) {
                    if (targetRect) {
                        img.set({
                            left: targetRect.left,
                            top: targetRect.top,
                            scaleX: targetRect.getScaledWidth() / img.width,
                            scaleY: targetRect.getScaledHeight() / img.height
                        });
                        // Remove frame? or Keep it.
                    } else {
                        img.scaleToWidth(300);
                        canvas.centerObject(img);
                    }
                    canvas.add(img);
                    canvas.setActiveObject(img);
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    // === 7. Prompt Templates Logic ===
    
    window.applyTemplate = function(content) {
        if (!content) return;
        const textarea = document.getElementById('canvas-prompt');
        textarea.value = content;
        textarea.focus();
    };

    async function loadCanvasTemplates() {
        try {
            const res = await fetch('/api/templates');
            if (res.ok) {
                const templates = await res.json();
                renderCanvasTemplates(templates);
            }
        } catch (e) {
            console.error("Failed to load templates", e);
        }
    }

    function renderCanvasTemplates(templates) {
        const quickContainer = document.getElementById('quick-templates');
        const moreSelect = document.getElementById('more-templates');
        
        if (!quickContainer || !moreSelect) return;

        quickContainer.innerHTML = '';
        moreSelect.innerHTML = '<option value="">更多效果...</option>';

        // Top 4 as chips
        const topTemplates = templates.slice(0, 4);
        topTemplates.forEach(tpl => {
            const chip = document.createElement('div');
            chip.textContent = tpl.name;
            chip.style.cssText = 'background:#f1f5f9; padding:4px 10px; border-radius:20px; font-size:0.75rem; cursor:pointer; white-space:nowrap; border:1px solid transparent; flex-shrink:0;';
            chip.onclick = () => applyTemplate(tpl.content);
            
            // Hover effect
            chip.onmouseover = () => { chip.style.background = '#e2e8f0'; chip.style.borderColor = '#cbd5e1'; };
            chip.onmouseout = () => { chip.style.background = '#f1f5f9'; chip.style.borderColor = 'transparent'; };
            
            quickContainer.appendChild(chip);
        });

        // All as options
        templates.forEach(tpl => {
            const option = document.createElement('option');
            option.value = tpl.content;
            option.textContent = tpl.name;
            moreSelect.appendChild(option);
        });
    }

    // Load on init
    loadCanvasTemplates();

    // 初始化检查
    checkAuth();

    // 如果默认是画布页面，初始化画布
    if (document.querySelector('.nav-item[data-tab="canvas"]').classList.contains('active')) {
        setTimeout(initCanvas, 100);
    }
});
