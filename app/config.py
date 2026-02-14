import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY")
    DATABASE_URL: str = os.getenv("DATABASE_URL")

settings = Settings()
