from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import time
import os
import requests
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

app = FastAPI()

# 挂载前端静态文件 (注意：这行代码最好放在 API 路由之后，或者使用特定路径)
# 我们将前端文件放在 'frontend' 目录，并挂载到 '/static' 路径下
# 为了方便直接访问根目录 '/' 显示网页，我们稍微调整一下逻辑


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

# 挂载静态文件目录
# 在 Vercel 环境中，文件结构可能略有不同，我们需要确保路径正确
# Vercel 会将所有文件部署到根目录
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir) # 获取 backend 的上一级，即项目根目录
frontend_dir = os.path.join(project_root, "frontend")

if not os.path.exists(frontend_dir):
    # 如果找不到，尝试直接在当前目录找 frontend (兼容 Vercel 的某些情况)
    frontend_dir = os.path.join(current_dir, "frontend")

# 只有当目录存在时才挂载，防止报错
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/")
async def read_index():
    # 优先尝试返回 index.html
    index_path = os.path.join(frontend_dir, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Sora2 Video Generator API is running. Frontend not found."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
