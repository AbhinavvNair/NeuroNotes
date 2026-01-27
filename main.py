import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- CONFIGURATION ---
# Fetches the key from your .env file
API_KEY = os.getenv("GROQ_API_KEY")

model_context = {}

# --- LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔌 Connecting to Groq Cloud...")
    if not API_KEY:
        print("❌ ERROR: GROQ_API_KEY not found in .env file!")
    try:
        client = Groq(api_key=API_KEY)
        model_context['client'] = client
        print("🚀 EduSummarizer (Groq-powered) is Ready!")
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

# --- SERVE FRONTEND ---
@app.get("/")
async def read_index():
    return FileResponse('index.html')

app.mount("/static", StaticFiles(directory="./"), name="static")

# --- DATA MODELS ---
class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 150
    temperature: float = 0.7

# --- AI ENDPOINT ---
@app.post("/generate")
async def generate_text(request: GenerateRequest):
    client = model_context.get('client')

    if not client:
        raise HTTPException(status_code=503, detail="Groq client not initialized.")

    try:
        # Groq API Call
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a helpful assistant that summarizes educational content."
                },
                {
                    "role": "user", 
                    "content": f"Summarize the following text:\n\n{request.prompt}"
                }
            ],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        summary = completion.choices[0].message.content.strip()
        return {"response": summary}

    except Exception as e:
        print(f"Groq Generation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)