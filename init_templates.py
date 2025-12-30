from backend.database import SessionLocal, PromptTemplate, engine, Base

# Ensure tables exist
Base.metadata.create_all(bind=engine)

db = SessionLocal()

templates = [
    {
        "name": "连环表情包",
        "content": "A set of 9 emojis of a cute [SUBJECT], various expressions (happy, sad, angry, surprised, love, laughing, crying, sleeping, thinking), sticker style, thick white outline, vector art, colorful, high quality",
        "category": "style"
    },
    {
        "name": "虚拟角色拆解",
        "content": "Character reference sheet of [SUBJECT], full body, front view, side view, back view, three distinct poses, detailed character design, concept art, game asset style, 4k resolution, neutral background",
        "category": "character"
    },
    {
        "name": "3D 盲盒公仔",
        "content": "3D render of a cute [SUBJECT] as a blind box toy, chibi style, glossy plastic material, soft studio lighting, pastel colors, 8k resolution, C4D render, octane render",
        "category": "style"
    },
    {
        "name": "极简线条 Logo",
        "content": "Minimalist line art logo of [SUBJECT], continuous line, vector style, black and white, simple, modern, elegant",
        "category": "logo"
    }
]

for t in templates:
    exists = db.query(PromptTemplate).filter(PromptTemplate.name == t["name"]).first()
    if not exists:
        new_t = PromptTemplate(**t)
        db.add(new_t)
        print(f"Added template: {t['name']}")
    else:
        print(f"Template already exists: {t['name']}")

db.commit()
db.close()
