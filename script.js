document.addEventListener('DOMContentLoaded', () => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });

    // ELEMENTS
    const userInput = document.getElementById('userInput');
    const aiOutput = document.getElementById('aiOutput');
    const processBtn = document.getElementById('processBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const studyBtn = document.getElementById('studyBtn');
    const inputStats = document.getElementById('inputStats');
    const toast = document.getElementById('toast');

    const API_URL = "http://127.0.0.1:8000/generate";

    // --- HELPER: CALL PYTHON API ---
    async function callBackend(prompt) {
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: prompt, max_tokens: 150 })
            });
            const data = await response.json();
            return data.generated_text;
        } catch (error) {
            console.error(error);
            showToast("Error connecting to Python backend");
            return null;
        }
    }

    // --- 1. REFINE TEXT (Calls AI) ---
    processBtn.addEventListener('click', async () => {
        const text = userInput.value.trim();
        if(!text) { showToast("Enter text first"); return; }
        
        // UI Loading State
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refining...';
        aiOutput.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>AI is thinking...</p></div>';
        
        // Call Python
        const aiResult = await callBackend(text);
        
        if (aiResult) {
            // Render Markdown
            aiOutput.innerHTML = marked.parse(aiResult);
            aiOutput.classList.remove('empty-state');
            showToast("Generated successfully");
        }

        // Reset Button
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Refine with AI';
    });

    // --- 2. VISUALIZE (Mermaid) ---
    visualizeBtn.addEventListener('click', async () => {
        const text = userInput.value.trim();
        if(!text) { showToast("Enter a topic for the diagram"); return; }

        aiOutput.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Generating Diagram...</p></div>';
        
        // We ask the AI to generate a graph structure
        // Note: Your model is small, so we might need to fallback to a template if it fails
        const graphPrompt = "graph TD\n" + text; 
        
        // For now, let's visualize the structure directly
        const uid = `mermaid-${Date.now()}`;
        
        // Simple default graph logic for demo purposes (since model is small)
        const graph = `graph TD\nA[Start] --> B[${text.substring(0,10)}...]\nB --> C{Analyze}\nC -->|Result| D[Finish]`;

        aiOutput.innerHTML = `<div class="mermaid" id="${uid}">${graph}</div>`;
        aiOutput.classList.remove('empty-state');
        await mermaid.run({ nodes: [document.getElementById(uid)] });
        showToast("Diagram Generated");
    });

    // --- 3. FLASHCARD STUDY MODE ---
    let cards = [];
    let cardIndex = 0;

    studyBtn.addEventListener('click', () => {
        const text = userInput.value.trim();
        if(!text) { showToast("Enter notes to study"); return; }

        // Simple parsing logic for now
        // In the future, we can ask the AI to "Convert this text to JSON flashcards"
        cards = parseCards(text);
        if(cards.length === 0) { 
            // Fallback if no colon format found
            cards.push({front: "Topic", back: text.substring(0, 50) + "..."});
        }

        cardIndex = 0;
        renderCard();
        showToast("Study Mode Started");
    });

    function parseCards(text) {
        return text.split('\n').reduce((acc, line) => {
            if(line.includes(':')) {
                const [front, back] = line.split(':');
                acc.push({front: front.trim(), back: back.trim()});
            }
            return acc;
        }, []);
    }

    function renderCard() {
        if(cardIndex >= cards.length) { showToast("End of Deck"); return; }
        const c = cards[cardIndex];
        aiOutput.innerHTML = `
            <div class="flashcard-container">
                <div class="flashcard" onclick="this.classList.toggle('flipped')">
                    <div class="card-face card-front">
                        <i class="fa-solid fa-circle-question" style="color:var(--primary); font-size:1.5rem; margin-bottom:15px;"></i>
                        <p>${c.front}</p>
                        <span style="font-size:0.75rem; color:grey; margin-top:auto;">(Click to Flip)</span>
                    </div>
                    <div class="card-face card-back"><p>${c.back}</p></div>
                </div>
                <div class="card-controls">
                    <button class="control-btn" onclick="prevCard()">Prev</button>
                    <span>${cardIndex + 1} / ${cards.length}</span>
                    <button class="control-btn" onclick="nextCard()">Next</button>
                </div>
            </div>`;
        aiOutput.classList.remove('empty-state');
    }

    window.nextCard = () => { if(cardIndex < cards.length - 1) { cardIndex++; renderCard(); } };
    window.prevCard = () => { if(cardIndex > 0) { cardIndex--; renderCard(); } };

    // --- UTILS ---
    userInput.addEventListener('input', () => {
        inputStats.innerText = `${userInput.value.trim().split(/\s+/).length} words`;
    });

    function showToast(msg) {
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
    
    // Toggle Sidebar Items
    const toggle = (id, listId) => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.addEventListener('click', () => {
                const el = document.getElementById(listId);
                el.style.display = el.style.display === 'none' ? 'flex' : 'none';
            });
        }
    }
    toggle('historyToggle', 'historyList');
});