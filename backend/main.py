from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
import time
import os
from dotenv import load_dotenv
from passlib.context import CryptContext
from jose import JWTError, jwt

# 尝试导入数据库模块 (兼容不同的运行方式)
try:
    from backend.database import SessionLocal, engine, Base, User, Transaction
except ImportError:
    from database import SessionLocal, engine, Base, User, Transaction

# 加载环境变量
load_dotenv()

# 初始化数据库表
Base.metadata.create_all(bind=engine)

# 全局配置存储 (模拟数据库)
APP_CONFIG = {
    "admin_password": "admin",
    "mock_mode": True,
    "sora_api_key": "",
    "sora_api_url": "",
    "veo_api_key": "",
    "suno_api_key": "",
    "heygem_api_key": ""
}

# 定价表 (Credits)
PRICING = {
    "video": 50.0,
    "image": 10.0,
    "music": 20.0,
    "avatar": 30.0
}

# JWT 配置
SECRET_KEY = "your-secret-key-keep-it-secret" # 生产环境应从 env 读取
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300

# 密码哈希工具
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

app = FastAPI()

# 尝试从环境变量初始化配置
if os.getenv("SORA_API_KEY"):
    APP_CONFIG["sora_api_key"] = os.getenv("SORA_API_KEY")
if os.getenv("MOCK_MODE"):
    APP_CONFIG["mock_mode"] = os.getenv("MOCK_MODE").lower() == "true"

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 依赖项 ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# --- Pydantic Models ---

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserOut(BaseModel):
    username: str
    email: Optional[str] = None
    balance: float

class Token(BaseModel):
    access_token: str
    token_type: str

class RechargeRequest(BaseModel):
    amount: float # 美元金额

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

class PricingUpdateRequest(BaseModel):
    password: str
    video: float
    image: float
    music: float
    avatar: float

class UserAdminView(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    balance: float
    is_active: bool = True
    
    class Config:
        from_attributes = True

class UserBalanceUpdate(BaseModel):
    password: str
    amount: float

# --- Auth Routes ---

@app.post("/api/auth/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    try:
        # 校验密码长度 (bcrypt 限制为 72 字节)
        if len(user.password.encode('utf-8')) > 70:
            raise HTTPException(status_code=400, detail="密码太长了，请控制在 50 个字符以内")

        db_user = db.query(User).filter(User.username == user.username).first()
        if db_user:
            raise HTTPException(status_code=400, detail="该用户名已被注册")
        
        hashed_password = get_password_hash(user.password)
        new_user = User(username=user.username, hashed_password=hashed_password, email=user.email, balance=10.0) # 注册送10积分
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception as e:
        print(f"Registration Error: {str(e)}")
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        # 捕获其他未知错误，但给用户更友好的提示
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")

@app.post("/api/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/user/me", response_model=UserOut)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# --- Payment Routes ---

@app.post("/api/payment/recharge")
async def recharge(request: RechargeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 简单的汇率逻辑：1 USD = 100 Credits
    credits_amount = request.amount * 100
    
    # 记录交易
    transaction = Transaction(
        user_id=current_user.id,
        amount=request.amount,
        credits=credits_amount,
        type="recharge",
        description=f"Recharge ${request.amount}",
        timestamp=time.time()
    )
    
    # 更新余额
    current_user.balance += credits_amount
    
    db.add(transaction)
    db.commit()
    db.refresh(current_user)
    
    return {"status": "success", "new_balance": current_user.balance, "message": f"Successfully recharged {credits_amount} credits"}

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

@app.get("/api/admin/pricing")
async def get_pricing(password: str):
    if password != APP_CONFIG["admin_password"]:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return PRICING

@app.post("/api/admin/pricing")
async def update_pricing(request: PricingUpdateRequest):
    if request.password != APP_CONFIG["admin_password"]:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    PRICING["video"] = request.video
    PRICING["image"] = request.image
    PRICING["music"] = request.music
    PRICING["avatar"] = request.avatar
    
    return {"status": "success", "message": "Pricing updated", "pricing": PRICING}

@app.get("/api/admin/users", response_model=List[UserAdminView])
async def get_users(password: str, db: Session = Depends(get_db)):
    if password != APP_CONFIG["admin_password"]:
        raise HTTPException(status_code=401, detail="Unauthorized")
    users = db.query(User).all()
    return users

@app.post("/api/admin/users/{user_id}/balance")
async def update_user_balance(user_id: int, request: UserBalanceUpdate, db: Session = Depends(get_db)):
    if request.password != APP_CONFIG["admin_password"]:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.balance = request.amount
    db.commit()
    db.refresh(user)
    return {"status": "success", "message": f"User {user.username} balance updated to {request.amount}", "new_balance": request.amount}

# --- Generation API Helper ---

def deduct_credits(user: User, cost: float, db: Session):
    if user.balance < cost:
        raise HTTPException(status_code=402, detail=f"Insufficient balance. Required: {cost}, Available: {user.balance}")
    user.balance -= cost
    # 记录消费
    tx = Transaction(user_id=user.id, amount=0, credits=-cost, type="usage", description="API Usage", timestamp=time.time())
    db.add(tx)
    db.commit()

# --- Generation Endpoints ---

@app.post("/api/generate-video")
async def generate_video(request: VideoRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deduct_credits(current_user, PRICING["video"], db)
    
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    # Mock Call
    if APP_CONFIG["mock_mode"]:
        time.sleep(3)
        return {
            "status": "success",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "message": "模拟生成视频成功 (-50 Credits)"
        }
    return {"status": "error", "message": "Real API not configured"}

@app.post("/api/generate-image")
async def generate_image(request: ImageRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deduct_credits(current_user, PRICING["image"], db)
    
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    if APP_CONFIG["mock_mode"]:
        time.sleep(2)
        return {
            "status": "success",
            "image_url": "https://picsum.photos/1024/1024",
            "message": "模拟生成图片成功 (-10 Credits)"
        }
    return {"status": "error", "message": "Real API not configured"}

@app.post("/api/generate-music")
async def generate_music(request: MusicRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deduct_credits(current_user, PRICING["music"], db)
    
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    if APP_CONFIG["mock_mode"]:
        time.sleep(2)
        return {
            "status": "success",
            "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "message": "模拟生成音乐成功 (-20 Credits)"
        }
    return {"status": "error", "message": "Real API not configured"}

@app.post("/api/generate-avatar")
async def generate_avatar(request: AvatarRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deduct_credits(current_user, PRICING["avatar"], db)
    
    if not request.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if APP_CONFIG["mock_mode"]:
        time.sleep(2)
        return {
            "status": "success",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            "message": "模拟生成数字人成功 (-30 Credits)"
        }
    return {"status": "error", "message": "Real API not configured"}

# --- Static Files ---

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
frontend_dir = os.path.join(project_root, "frontend")

if not os.path.exists(frontend_dir):
    frontend_dir = os.path.join(current_dir, "frontend")

if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/admin")
async def read_admin():
    admin_path = os.path.join(frontend_dir, 'admin.html')
    if os.path.exists(admin_path):
        return FileResponse(admin_path)
    return {"message": "Admin page not found"}

@app.get("/")
async def read_index():
    index_path = os.path.join(frontend_dir, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "API Running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
