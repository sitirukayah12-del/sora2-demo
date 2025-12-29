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

# 全局配置存储 (模拟数据库)
APP_CONFIG = {
    "admin_password": "admin",  # 默认密码
    "mock_mode": True,
    "sora_api_key": "",
    "sora_api_url": "",
    "veo_api_key": "",
    "suno_api_key": "",
    "heygem_api_key": ""
}

# 尝试从环境变量初始化配置
if os.getenv("SORA_API_KEY"):
    APP_CONFIG["sora_api_key"] = os.getenv("SORA_API_KEY")
if os.getenv("MOCK_MODE"):
    APP_CONFIG["mock_mode"] = os.getenv("MOCK_MODE").lower() == "true"

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
class ConfigUpdateRequest(BaseModel):
    password: str
    mock_mode: bool
    sora_api_key: str
    veo_api_key: str
    suno_api_key: str
    heygem_api_key: str

class LoginRequest(BaseModel):
    password: str

class VideoRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"
    duration: int = 5

class ImageRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"

class MusicRequest(BaseModel):
    prompt: str
    duration: int = 30

class AvatarRequest(BaseModel):
    prompt: str
    text: str

# --- Admin API ---
@app.post("/api/admin/login")
async def admin_login(request: LoginRequest):
    if request.password == APP_CONFIG["admin_password"]:
        return {"status": "success", "message": "Login successful"}
    raise HTTPException(status_code=401, detail="Invalid password")

@app.get("/api/admin/config")
async def get_config(password: str):
    if password != APP_CONFIG["admin_password"]:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return APP_CONFIG

@app.post("/api/admin/config")
async def update_config(request: ConfigUpdateRequest):
    if request.password != APP_CONFIG["admin_password"]:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    APP_CONFIG["mock_mode"] = request.mock_mode
    APP_CONFIG["sora_api_key"] = request.sora_api_key
    APP_CONFIG["veo_api_key"] = request.veo_api_key
    APP_CONFIG["suno_api_key"] = request.suno_api_key
    APP_CONFIG["heygem_api_key"] = request.heygem_api_key
    
    return {"status": "success", "message": "Configuration updated", "config": APP_CONFIG}

# 模拟的 Sora2 API 调用函数
def call_sora2_api(prompt: str, size: str, duration: int):
    # 使用全局配置
    api_key = APP_CONFIG["sora_api_key"]
    
    # 如果没有配置 API Key，或者显式开启了模拟模式，则返回模拟数据
    if not api_key or APP_CONFIG["mock_mode"]:
        print(f"Mocking Sora2 API call with prompt: {prompt}")
        time.sleep(3)  # 模拟网络延迟
        return {
            "status": "success",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", # 一个公共测试视频
            "message": "这是模拟生成的视频。请在后台配置真实的 API Key 以启用真实调用。"
        }
    
    # 真实 API 调用逻辑 (这里仅为示例，实际需要对接真实接口)
    # response = requests.post(...)
    return {"status": "error", "message": "Real API call not implemented in this demo"}

@app.post("/api/generate-video")
async def generate_video(request: VideoRequest):
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    try:
        result = call_sora2_api(request.prompt, request.size, request.duration)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-image")
async def generate_image(request: ImageRequest):
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    # Mock Image Generation
    time.sleep(2)
    return {
        "status": "success",
        "image_url": "https://picsum.photos/1024/1024", # 随机图片
        "message": "这是模拟生成的图片 (NanoPro)"
    }

@app.post("/api/generate-music")
async def generate_music(request: MusicRequest):
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    # Mock Music Generation
    time.sleep(2)
    return {
        "status": "success",
        "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", # 随机音频
        "message": "这是模拟生成的音乐 (Suno)"
    }

@app.post("/api/generate-avatar")
async def generate_avatar(request: AvatarRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    # Mock Avatar Generation
    time.sleep(2)
    return {
        "status": "success",
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", # 另一个测试视频
        "message": "这是模拟生成的数字人视频 (Heygem)"
    }

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
