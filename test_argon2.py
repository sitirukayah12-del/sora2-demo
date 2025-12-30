from passlib.context import CryptContext

# Use argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

try:
    print("Hashing 'test' with argon2...")
    h = pwd_context.hash("test")
    print(f"Success: {h}")
    
    print("Hashing '...' with argon2...")
    h2 = pwd_context.hash("...")
    print(f"Success: {h2}")

    long_pwd = "a" * 100
    print(f"Hashing 100 chars with argon2...")
    h3 = pwd_context.hash(long_pwd)
    print(f"Success: {h3}")

except Exception as e:
    print(f"Error: {e}")
