document.addEventListener('DOMContentLoaded', () => {
    // --- UI ELEMENTS ---
    const userInput = document.getElementById('userInput');
    const aiOutput = document.getElementById('aiOutput');
    const processBtn = document.getElementById('processBtn');
    const copyBtn = document.getElementById('copyBtn');
    const exportBtn = document.getElementById('exportBtn');
    const bookmarkBtn = document.getElementById('bookmarkBtn');
    const themeToggle = document.getElementById('themeToggle');
    const toast = document.getElementById('toast');
    const newNoteBtn = document.getElementById('newNoteBtn');

    // Sidebar
    const historyToggle = document.getElementById('historyToggle');
    const historyList = document.getElementById('historyList');
    const savedToggle = document.getElementById('savedToggle');
    const savedList = document.getElementById('savedList');

    // Settings
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const clearDataBtn = document.getElementById('clearDataBtn');

    // --- INITIALIZATION ---
    loadList('notesHistory', historyList);
    loadList('savedNotes', savedList);
    
    // Load saved API Key
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) apiKeyInput.value = savedKey;

    // --- 1. THE "BRAIN" LOGIC ---

    processBtn.addEventListener('click', async () => {
        const text = userInput.value.trim();
        if (!text) { showToast("Please enter notes first!", true); return; }

        // UI Loading
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refining...';
        aiOutput.innerHTML = '<div class="empty-state"><i class="fa-solid fa-microchip"></i><p>Analyzing...</p></div>';

        let refinedText = "";

        try {
            const apiKey = localStorage.getItem('geminiApiKey');

            if (apiKey) {
                // OPTION A: REAL AI (Client-Side)
                // We call Google directly from the browser
                refinedText = await callGeminiAPI(apiKey, text);
            } else {
                // OPTION B: SMART FORMATTER (No AI Key)
                // This organizes YOUR text (capitals, bullets) instead of random text
                await new Promise(r => setTimeout(r, 1000)); // Small delay for effect
                refinedText = smartRuleBasedFormatter(text);
                showToast("Key missing: Using basic formatting", true); // Warn user
            }

            // Render Markdown
            aiOutput.innerHTML = marked.parse(refinedText);
            aiOutput.classList.remove('empty-state');
            
            // Save to History
            saveToList('notesHistory', text, refinedText);
            
            if (apiKey) {
                showToast("Refinement Complete!");
            }

        } catch (error) {
            console.error(error);
            aiOutput.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
            showToast("Error generating notes", true);
        } finally {
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Refine with AI';
            loadList('notesHistory', historyList);
        }
    });

    // --- 2. REAL GEMINI API FUNCTION ---
    async function callGeminiAPI(key, userText) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        
        const prompt = `
            You are an expert student assistant. Refine the following notes.
            Rules:
            1. Fix grammar and capitalization.
            2. Use Markdown (headers, bold, lists).
            3. Keep it concise.
            4. If code is present, format it in a code block.
            
            Input Notes: "${userText}"
        `;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error("Invalid API Key or Network Error");
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    // --- 3. SMART FORMATTER (Fallback - No AI Key) ---
    function smartRuleBasedFormatter(text) {
        // 1. Capitalize first letter
        let formatted = text.charAt(0).toUpperCase() + text.slice(1);
        
        // 2. Detect if it looks like code
        if (text.includes("def ") || text.includes("function") || text.includes("import ") || text.includes("{")) {
            return `# 💻 Code Snippet\n\nBased on your input, here is the code structure:\n\n\`\`\`javascript\n${text}\n\`\`\``;
        }

        // 3. Convert new lines to bullet points
        const lines = formatted.split('\n').filter(line => line.trim() !== '');
        let bulletPoints = lines.map(line => `* ${line}`).join('\n');

        return `
# 📝 Refined Notes

**Overview**
The following points were extracted from your input:

${bulletPoints}

---
*Tip: To get actual AI analysis, add a Gemini API Key in Settings.*
`;
    }

    // --- 4. STANDARD UTILS (Copy, Save, Etc) ---
    
    // Bookmark
    bookmarkBtn.addEventListener('click', () => {
        if (!aiOutput.innerText || aiOutput.classList.contains('empty-state')) {
            showToast("Nothing to save!", true); return;
        }
        saveToList('savedNotes', userInput.value, aiOutput.innerHTML, true);
        showToast("Note Saved!");
        savedList.style.display = 'flex';
        loadList('savedNotes', savedList);
    });

    // New Note
    newNoteBtn.addEventListener('click', () => {
        userInput.value = '';
        aiOutput.innerHTML = `<div class="empty-state"><i class="fa-solid fa-arrow-left"></i><p>Enter notes...</p></div>`;
        aiOutput.classList.add('empty-state');
    });

    // Settings
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

    saveSettingsBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if(key) {
            localStorage.setItem('geminiApiKey', key);
            showToast("API Key Saved! AI Active.");
        }
        settingsModal.classList.add('hidden');
    });

    clearDataBtn.addEventListener('click', () => {
        if(confirm("Delete all history?")) {
            localStorage.clear();
            location.reload(); 
        }
    });

    // Utilities
    copyBtn.addEventListener('click', () => {
        if(aiOutput.innerText) navigator.clipboard.writeText(aiOutput.innerText);
        showToast("Copied!");
    });

    exportBtn.addEventListener('click', () => {
        if (!aiOutput.innerText) return;
        const blob = new Blob([aiOutput.innerText], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "SmartNotes.txt";
        a.click();
    });

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    // Lists
    function saveToList(key, original, refined, isHtml = false) {
        let list = JSON.parse(localStorage.getItem(key)) || [];
        list.unshift({ id: Date.now(), title: original.substring(0, 15) + "...", original, refined, isHtml });
        if (list.length > 20) list.pop();
        localStorage.setItem(key, JSON.stringify(list));
    }

    function loadList(key, container) {
        const list = JSON.parse(localStorage.getItem(key)) || [];
        container.innerHTML = '';
        if (list.length === 0) container.innerHTML = '<div class="list-item" style="cursor:default;opacity:0.5">Empty</div>';
        
        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<i class="fa-solid ${key === 'savedNotes' ? 'fa-bookmark' : 'fa-clock'}"></i> ${item.title}`;
            div.addEventListener('click', () => {
                userInput.value = item.original;
                aiOutput.innerHTML = item.isHtml ? item.refined : marked.parse(item.refined);
                aiOutput.classList.remove('empty-state');
            });
            container.appendChild(div);
        });
    }

    // Accordion Logic
    [historyToggle, savedToggle].forEach((btn, index) => {
        const list = index === 0 ? historyList : savedList;
        btn.addEventListener('click', () => {
            const isHidden = list.style.display === 'none';
            list.style.display = isHidden ? 'flex' : 'none';
        });
    });

    function showToast(msg, isError = false) {
        const span = toast.querySelector('span');
        const icon = toast.querySelector('i');
        span.innerText = msg;
        toast.style.background = isError ? "#ef4444" : "#1f2937";
        icon.className = isError ? "fa-solid fa-circle-exclamation" : "fa-solid fa-circle-check";
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});