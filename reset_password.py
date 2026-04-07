"""
Admin password reset utility.
Usage: python reset_password.py <email> <new_password>
"""
import sys
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app import models
from app.auth import hash_password

def reset(email: str, new_password: str):
    if len(new_password) < 8:
        print("Error: password must be at least 8 characters.")
        sys.exit(1)

    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        print(f"No user found with email: {email}")
        db.close()
        sys.exit(1)

    user.hashed_password = hash_password(new_password)
    db.commit()
    db.close()
    print(f"Password reset for {email}.")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <email> <new_password>")
        sys.exit(1)
    reset(sys.argv[1], sys.argv[2])
