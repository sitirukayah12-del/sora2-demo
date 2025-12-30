import bcrypt

# Monkey patch bcrypt to support passlib 1.7.4
if not hasattr(bcrypt, "__about__"):
    try:
        class About:
            __version__ = bcrypt.__version__
        bcrypt.__about__ = About()
    except Exception as e:
        print(f"Patch failed: {e}")

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

try:
    print("Hashing 'test'...")
    h = pwd_context.hash("test")
    print(f"Success: {h}")
    
    print("Hashing '...' ...")
    h2 = pwd_context.hash("...")
    print(f"Success: {h2}")

except Exception as e:
    print(f"Error: {e}")
