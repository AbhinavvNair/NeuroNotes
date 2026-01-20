import os
import re
import wikipediaapi
from tqdm import tqdm

# --- CONFIGURATION ---
# The folder where we want to save our data
DATA_DIR = "data"
OUTPUT_FILE = os.path.join(DATA_DIR, "dataset.txt")

# Topics to fetch. 
# We are building an "Edu" model, so we want academic text.
TOPICS = [
    "Physics", "Chemistry", "Biology", "Mathematics", "Computer Science",
    "Artificial Intelligence", "Machine Learning", "Deep Learning", 
    "Neural Network", "Natural Language Processing", "History", "Geography",
    "Economics", "Psychology", "Philosophy", "Literature", "Astronomy",
    "Environmental Science", "Political Science", "Sociology", "Anthropology",
    "Newton's laws of motion", "Thermodynamics", "Photosynthesis", 
    "Calculus", "Algebra", "World War I", "World War II", "The Solar System",
    "Climate Change", "Democracy", "Supply and demand", "Cognitive science",
    "Renaissance", "Industrial Revolution", "Genetics", "Evolution",
    "Quantum mechanics", "Relativity", "Microbiology"
]

def clean_text(text):
    """
    Cleans raw text by removing references [1], extra spaces, etc.
    """
    # Remove references like [1], [citation needed]
    text = re.sub(r'\[.*?\]', '', text)
    # Remove extra whitespace and newlines
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def fetch_and_save_data():
    # Ensure the data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Initialize Wikipedia API
    # user_agent is required by Wikipedia to identify your bot
    wiki_wiki = wikipediaapi.Wikipedia(
        user_agent='EduSummarizer/1.0 (Student Project)',
        language='en'
    )

    print(f"🚀 Starting data collection for {len(TOPICS)} topics...")
    
    # Open file in 'append' mode so we can add to it continuously
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        
        # tqdm creates the progress bar
        for topic in tqdm(TOPICS):
            page = wiki_wiki.page(topic)
            
            if not page.exists():
                print(f"⚠️  Page '{topic}' not found. Skipping.")
                continue
            
            # Get raw text
            raw_text = page.text
            
            # Basic cleaning: split into paragraphs and clean each
            paragraphs = raw_text.split('\n')
            for p in paragraphs:
                cleaned = clean_text(p)
                # Filter out very short lines (headers, captions)
                if len(cleaned) > 50:
                    f.write(cleaned + "\n")
            
            # Add a delimiter (optional, but good for debugging)
            f.write("\n") 

    # Check final size
    if os.path.exists(OUTPUT_FILE):
        size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
        print(f"\n✅ SUCCESS! Data saved to: {OUTPUT_FILE}")
        print(f"📊 Dataset Size: {size_mb:.2f} MB")
    else:
        print("\n❌ Error: File was not created.")

if __name__ == "__main__":
    fetch_and_save_data()