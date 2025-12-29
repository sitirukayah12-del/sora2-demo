document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generateBtn');
    const promptInput = document.getElementById('prompt');
    const sizeSelect = document.getElementById('size');
    const durationSelect = document.getElementById('duration');
    
    const loadingDiv = document.getElementById('loading');
    const videoContainer = document.getElementById('videoContainer');
    const resultVideo = document.getElementById('resultVideo');
    const resultMessage = document.getElementById('resultMessage');
    const errorContainer = document.getElementById('errorContainer');
    const errorText = document.querySelector('.error-text');

    generateBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        
        if (!prompt) {
            alert('请输入提示词！');
            return;
        }

        // Reset UI
        generateBtn.disabled = true;
        loadingDiv.classList.remove('hidden');
        videoContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
        resultVideo.pause();
        resultVideo.src = "";

        const payload = {
            prompt: prompt,
            size: sizeSelect.value,
            duration: parseInt(durationSelect.value)
        };

        try {
            // 使用相对路径，自动适配当前域名
            const response = await fetch('/api/generate-video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '请求失败');
            }

            const data = await response.json();

            // 显示结果
            resultVideo.src = data.video_url;
            resultMessage.textContent = data.message || '';
            videoContainer.classList.remove('hidden');
            
            // 自动播放
            resultVideo.play().catch(e => console.log("自动播放被阻止", e));

        } catch (error) {
            console.error('Error:', error);
            errorText.textContent = `生成失败: ${error.message}`;
            errorContainer.classList.remove('hidden');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });
});
