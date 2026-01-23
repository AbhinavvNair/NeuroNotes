from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import sentencepiece as spm
import os

app = FastAPI()

# ENABLE CORS (Allow website to talk to Python)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LOAD MODEL
DEVICE = 'cpu'
try:
    print("⏳ Loading Model...")
    sp = spm.SentencePieceProcessor()
    sp.load(os.path.join("data", "tokenizer.model"))
    
    from model import EduLLM
    model = EduLLM(sp.get_piece_size())
    checkpoint = torch.load(os.path.join("data", "edullm_model.pt"), map_location=DEVICE)
    model.load_state_dict(checkpoint)
    model.to(DEVICE)
    model.eval()
    print("✅ Model Loaded!")
except Exception as e:
    print(f"❌ Error loading model: {e}")

class RequestData(BaseModel):
    prompt: str

@app.post("/generate")
async def generate(data: RequestData):
    # INFERENCE LOGIC
    input_ids = sp.encode_as_ids(data.prompt)
    input_tensor = torch.tensor([input_ids], dtype=torch.long).to(DEVICE)
    
    with torch.no_grad():
        output = model.generate(input_tensor, max_new_tokens=100)
    
    decoded = sp.decode_ids(output[0].tolist())
    
    # Remove the prompt from the response
    if decoded.startswith(data.prompt):
        decoded = decoded[len(data.prompt):]
        
    return {"generated_text": decoded}