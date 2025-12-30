from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

try:
    print("Hashing 'test'...")
    h = pwd_context.hash("test")
    print(f"Success: {h}")
    
    print("Hashing '...' ...")
    h2 = pwd_context.hash("...")
    print(f"Success: {h2}")

    long_pwd = "a" * 73
    print(f"Hashing 73 chars...")
    h3 = pwd_context.hash(long_pwd)
    print(f"Success: {h3}")

except Exception as e:
    print(f"Error: {e}")
