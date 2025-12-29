from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = FastAPI()

# 配置 CORS，允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置为具体的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 定义请求体模型
class VideoRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"
    duration: int = 5

# 模拟的 Sora2 API 调用函数
def call_sora2_api(prompt: str, size: str, duration: int):
    api_key = os.getenv("SORA_API_KEY")
    api_url = os.getenv("SORA_API_URL")

    # 如果没有配置 API Key，或者显式开启了模拟模式，则返回模拟数据
    if not api_key or os.getenv("MOCK_MODE", "true").lower() == "true":
        print(f"Mocking Sora2 API call with prompt: {prompt}")
        time.sleep(3)  # 模拟网络延迟
        return {
            "status": "success",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", # 一个公共测试视频
            "message": "这是模拟生成的视频。请在后端配置真实的 API Key 以启用真实调用。"
        }

    # 真实 API 调用逻辑 (根据假设的 Sora2 API 结构)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "sora-2.0",
        "prompt": prompt,
        "size": size,
        "duration": duration
    }
    
    try:
        # 这里假设了一个调用方式，实际请根据官方文档修改
        response = requests.post(api_url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-video")
async def generate_video(request: VideoRequest):
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    try:
        result = call_sora2_api(request.prompt, request.size, request.duration)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Sora2 Video Generator API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
