import sentencepiece as spm
import os

# Initialize the processor
sp = spm.SentencePieceProcessor()

# Load the model we just trained
model_path = os.path.join("data", "tokenizer.model")

print(f"🔍 Loading tokenizer from: {model_path}")

if not os.path.exists(model_path):
    print("❌ Error: Model file not found. Did you run train_tokenizer.py?")
    exit()

sp.load(model_path)

# Test Sentence
test_text = "Physics is the study of matter and energy."

# 1. ENCODE: Turn text into ID numbers
# This is what goes INTO the neural network
token_ids = sp.encode_as_ids(test_text)
print(f"\n📝 Raw Text:    {test_text}")
print(f"🔢 Token IDs:   {token_ids}")

# 2. DECODE: Turn ID numbers back into text
# This is what comes OUT of the neural network
decoded_text = sp.decode_ids(token_ids)
print(f"🔄 Decoded:     {decoded_text}")

# 3. SEGMENTATION: See how it chopped the words
# This shows you the 'sub-words' it learned
pieces = sp.encode_as_pieces(test_text)
print(f"🧩 Pieces:      {pieces}")

# Validation Logic
if test_text == decoded_text:
    print("\n✅ SUCCESS: The tokenizer can encode and decode perfectly.")
else:
    print("\n❌ FAILURE: Decoded text does not match original.")