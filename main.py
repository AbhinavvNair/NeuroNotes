import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from openai import OpenAI
from dotenv import load_dotenv

from app.dependencies import get_db
from app import models, schemas
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

load_dotenv()

API_KEY = os.getenv("GROQ_API_KEY")
model_context = {}


# -------------------------
# Lifespan (Groq Client Init)
# -------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔌 Initializing NeuroNotes Pro...")
    if not API_KEY:
        print("❌ ERROR: 'GROQ_API_KEY' not found in .env!")
    else:
        try:
            client = OpenAI(
                api_key=API_KEY,
                base_url="https://api.groq.com/openai/v1",
            )
            model_context["client"] = client
            print("🚀 Groq AI Client successfully initialized!")
        except Exception as e:
            print(f"❌ CRITICAL ERROR: {e}")
    yield
    model_context.clear()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------
# Request Schemas
# -------------------------
class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 1000
    temperature: float = 0.7


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# -------------------------
# Routes
# -------------------------
@app.get("/")
async def read_index():
    return FileResponse("index.html")


# -------------------------
# Register
# -------------------------
@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = (
        db.query(models.User)
        .filter(models.User.email == user.email)
        .first()
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        email=user.email,
        hashed_password=hash_password(user.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# -------------------------
# Login
# -------------------------
@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    db_user = (
        db.query(models.User)
        .filter(models.User.email == form_data.username)
        .first()
    )

    if not db_user or not verify_password(
        form_data.password,
        db_user.hashed_password,
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(
        data={"sub": db_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# -------------------------
# Current User
# -------------------------
@app.get("/me")
def read_current_user(
    current_user: models.User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_active": current_user.is_active,
    }


# -------------------------
# Change Password
# -------------------------
@app.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(request.new_password)

    db.commit()
    db.refresh(current_user)

    return {"message": "Password updated successfully"}


# -------------------------
# Generate (Protected)
# -------------------------
@app.post("/generate")
async def generate_text(
    request: GenerateRequest,
    current_user: models.User = Depends(get_current_user),
):
    client = model_context.get("client")
    if not client:
        raise HTTPException(status_code=503, detail="AI Client not initialized.")

    try:
        print(f"📡 Sending request to Groq: {request.prompt[:50]}...")

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are NeuroNotes Pro. Summarize educational content with clean Markdown, bold key terms, and LaTeX ($$).",
                },
                {"role": "user", "content": request.prompt},
            ],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        return {"response": completion.choices[0].message.content}

    except Exception as e:
        print(f"❌ Groq API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")

# -------------------------
# Static Files
# -------------------------
app.mount("/", StaticFiles(directory="./"), name="static")


# -------------------------
# Run Server
# -------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
