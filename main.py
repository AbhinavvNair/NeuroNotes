from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import sentencepiece as spm
import os
import sys

# --- 1. SETUP ---
# Ensure we can find the model file
if not os.path.exists("model.py"):
    print("❌ Error: model.py not found. Make sure you are in the EduSummarizer folder.")
    sys.exit(1)

from model import EduLLM

# Configuration
DEVICE = 'cpu' # Force CPU since we are on a laptop
MODEL_PATH = os.path.join("data", "edullm_model.pt")
TOKENIZER_PATH = os.path.join("data", "tokenizer.model")

app = FastAPI()

# --- 2. ENABLE CORS (Allows index.html to talk to us) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all websites to connect
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. LOAD BRAIN ---
model = None
sp = None

@app.on_event("startup")
def load_resources():
    global model, sp
    print("⏳ Loading AI Brain...")
    
    # Load Tokenizer
    if not os.path.exists(TOKENIZER_PATH):
        raise RuntimeError(f"Tokenizer missing at {TOKENIZER_PATH}")
    sp = spm.SentencePieceProcessor()
    sp.load(TOKENIZER_PATH)
    
    # Load Model
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model missing at {MODEL_PATH}")
    
    model = EduLLM(sp.get_piece_size())
    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)
    model.load_state_dict(checkpoint)
    model.to(DEVICE)
    model.eval() # Set to "Test Mode"
    print("✅ Model Loaded Successfully!")

# --- 4. API ENDPOINT ---
class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 150

@app.post("/generate")
async def generate(req: GenerateRequest):
    try:
        # Encode
        input_ids = sp.encode_as_ids(req.prompt)
        input_tensor = torch.tensor([input_ids], dtype=torch.long).to(DEVICE)
        
        # Generate
        with torch.no_grad():
            output_ids = model.generate(input_tensor, max_new_tokens=req.max_tokens)
            
        # Decode
        full_text = sp.decode_ids(output_ids[0].tolist())
        
        # Clean up (Remove the prompt from the answer)
        response = full_text[len(req.prompt):] if full_text.startswith(req.prompt) else full_text
        
        return {"generated_text": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))