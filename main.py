from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
import torch
import sentencepiece as spm
import os

# Import your custom model structure
# Ensure model.py is in the same folder as main.py
from model import EduLLM 

# --- CONFIGURATION ---
N_EMBD = 384
N_HEAD = 6
N_LAYER = 6
MODEL_PATH = "data/edullm_model.pt"
TOKENIZER_PATH = "data/tokenizer.model"

# Detect Mac M-Series chips (MPS) for speed, otherwise CPU
DEVICE = 'mps' if torch.backends.mps.is_available() else 'cpu'
print(f"🖥️  Running on device: {DEVICE}")

# Global variables to hold the model and tokenizer
model_context = {}

# --- LIFESPAN MANAGER (Loads model on startup) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔌 Loading NeuroNotes Brain...")
    try:
        # 1. Load Tokenizer
        if not os.path.exists(TOKENIZER_PATH):
            raise FileNotFoundError(f"Tokenizer not found at {TOKENIZER_PATH}")
        
        sp = spm.SentencePieceProcessor()
        sp.load(TOKENIZER_PATH)
        vocab_size = sp.get_piece_size()
        
        # 2. Load Model
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model not found at {MODEL_PATH}")

        model = EduLLM(vocab_size, N_EMBD, N_HEAD, N_LAYER)
        
        # Load weights
        checkpoint = torch.load(MODEL_PATH, map_location=torch.device(DEVICE))
        model.load_state_dict(checkpoint)
        model.to(DEVICE)
        model.eval() # Set to evaluation mode
        
        # Store in global context
        model_context['model'] = model
        model_context['sp'] = sp
        
        print("✅ Brain Loaded Successfully!")
        print(f"🚀 NeuroNotes is Ready on {DEVICE}!")
        
    except Exception as e:
        print(f"❌ CRITICAL ERROR LOADING MODEL: {e}")
        # We don't raise here so the server can still serve the frontend, 
        # but the AI endpoint will fail gracefully.
        
    yield # The application runs here
    
    # Clean up (optional)
    model_context.clear()
    print("💤 Brain shutting down...")

# --- APP INITIALIZATION ---
app = FastAPI(lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SERVE FRONTEND (The Clean Way) ---
# This mounts the 'frontend' folder to serve css, js, and images automatically
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

# Serve the main HTML page
@app.get("/")
async def read_index():
    return FileResponse('../frontend/index.html')

# --- DATA MODELS ---
class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 100
    temperature: float = 0.7

# --- AI ENDPOINT ---
@app.post("/generate")
async def generate_text(request: GenerateRequest):
    model = model_context.get('model')
    sp = model_context.get('sp')

    if not model or not sp:
        raise HTTPException(status_code=503, detail="AI Model is not loaded. Check server logs.")

    try:
        # Encode input
        idx = torch.tensor([sp.encode_as_ids(request.prompt)], dtype=torch.long).to(DEVICE)
        
        # Generate
        with torch.no_grad():
            output = model.generate(
                idx, 
                max_new_tokens=request.max_tokens, 
                temperature=request.temperature
            )
            
        # Decode output
        generated_text = sp.decode(output[0].tolist())
        return {"response": generated_text}

    except Exception as e:
        print(f"Generation Error: {e}")
        raise HTTPException(status_code=500, detail="Error generating text")

if __name__ == "__main__":
    import uvicorn
    # Reload=True is great for development
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)