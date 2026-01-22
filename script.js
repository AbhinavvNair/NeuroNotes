document.addEventListener('DOMContentLoaded', () => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });

    // DOM ELEMENTS
    const userInput = document.getElementById('userInput');
    const aiOutput = document.getElementById('aiOutput');
    const processBtn = document.getElementById('processBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const studyBtn = document.getElementById('studyBtn'); // Study Button
    const inputStats = document.getElementById('inputStats');
    const toast = document.getElementById('toast');

    // --- 1. REFINE TEXT ---
    processBtn.addEventListener('click', async () => {
        const text = userInput.value.trim();
        if(!text) { showToast("Enter text first"); return; }
        
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refining...';
        await new Promise(r => setTimeout(r, 600)); 
        
        const refined = smartFormat(text);
        aiOutput.innerHTML = marked.parse(refined);
        aiOutput.classList.remove('empty-state');
        
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Refine';
        showToast("Notes Refined");
    });

    // --- 2. VISUALIZE ---
    visualizeBtn.addEventListener('click', async () => {
        const text = userInput.value.trim();
        if(!text) { showToast("Enter diagram code"); return; }

        aiOutput.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Rendering...</p></div>';
        await new Promise(r => setTimeout(r, 500));

        try {
            let graph = text;
            if(!text.includes('graph') && !text.includes('->')) {
                graph = `graph TD\nA[Start] --> B[${text.substring(0,10)}...]\nB --> C{Process}\nC -->|Yes| D[Done]`;
            } else if (!text.includes('graph')) {
                graph = `graph TD\n${text}`;
            }

            const uid = `mermaid-${Date.now()}`;
            aiOutput.innerHTML = `<div class="mermaid" id="${uid}">${graph}</div>`;
            aiOutput.classList.remove('empty-state');
            await mermaid.run({ nodes: [document.getElementById(uid)] });
            showToast("Diagram Generated");
        } catch (e) {
            aiOutput.innerHTML = `<p style="color:#ef4444; padding:20px;">Syntax Error.</p>`;
        }
    });

    // --- STUDY MODE ---
    let cards = []; let cardIndex = 0;
    studyBtn.addEventListener('click', () => {
        const text = userInput.value.trim();
        if(!text) { showToast("Enter notes (Term : Definition)"); return; }

        cards = parseCards(text);
        if(cards.length === 0) { showToast("No terms found. Use 'Term : Definition'"); return; }

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
        aiOutput.innerHTML = `<div class="flashcard-container"><div class="flashcard" onclick="this.classList.toggle('flipped')"><div class="card-face card-front"><p>${c.front}</p><span style="font-size:0.75rem; color:grey; margin-top:auto;">(Click to Flip)</span></div><div class="card-face card-back"><p>${c.back}</p></div></div><div class="card-controls"><button class="control-btn" onclick="prevCard()">Prev</button><span>${cardIndex + 1}/${cards.length}</span><button class="control-btn" onclick="nextCard()">Next</button></div></div>`;
        aiOutput.classList.remove('empty-state');
    }

    // Window functions for HTML onclick
    window.nextCard = () => { if(cardIndex < cards.length - 1) { cardIndex++; renderCard(); } };
    window.prevCard = () => { if(cardIndex > 0) { cardIndex--; renderCard(); } };

    // --- UTILS ---
    userInput.addEventListener('input', () => {
        inputStats.innerText = `${userInput.value.trim().split(/\s+/).length} words`;
    });

    function smartFormat(text) {
        if(text.includes("def ") || text.includes("{")) return `# 💻 Code\n\`\`\`javascript\n${text}\n\`\`\``;
        let lines = text.split('\n').filter(l => l.trim());
        let bullets = lines.map(l => `* ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n');
        return `# 📝 Refined Notes\n\n${bullets}`;
    }

    function showToast(msg) {
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
    
    // Toggles
    const toggle = (id, listId) => {
        document.getElementById(id).addEventListener('click', () => {
            const el = document.getElementById(listId);
            el.style.display = el.style.display === 'none' ? 'flex' : 'none';
        });
    }
    toggle('historyToggle', 'historyList');
    toggle('savedToggle', 'savedList');
    
    document.getElementById('settingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.remove('hidden'));
    document.getElementById('closeSettings').addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));
});