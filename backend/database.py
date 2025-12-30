import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# 优先从环境变量获取数据库 URL (适配 Vercel Postgres 等)
# 如果在 Vercel 环境且未设置 DATABASE_URL，则使用 /tmp/sql_app.db (因为 Vercel 文件系统是只读的，除了 /tmp)
if os.getenv("VERCEL"):
    # 尝试获取 Vercel Postgres 环境变量
    database_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    
    if database_url:
        # SQLAlchemy 需要 postgresql:// 开头，而 Vercel 有时提供 postgres://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        SQLALCHEMY_DATABASE_URL = database_url
    else:
        SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/sql_app.db"
else:
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# 如果是 SQLite，需要 check_same_thread=False
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    email = Column(String, unique=True, index=True, nullable=True)
    balance = Column(Float, default=0.0) # 余额 (Credits)
    is_active = Column(Boolean, default=True)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float) # 充值金额
    credits = Column(Float) # 获得点数
    type = Column(String) # "recharge" or "usage"
    description = Column(String, nullable=True)
    timestamp = Column(Float) # Unix timestamp

class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) # e.g. "连环表情包"
    content = Column(String) # The actual prompt text
    category = Column(String, default="general") # For grouping
    is_active = Column(Boolean, default=True)

