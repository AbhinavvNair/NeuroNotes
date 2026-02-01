document.addEventListener('DOMContentLoaded', () => {
    // Initialize Charts
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
    }

    // --- DOM ELEMENTS ---
    const userInput = document.getElementById('userInput');
    const aiOutput = document.getElementById('aiOutput');
    
    // Buttons
    const newNoteBtn = document.getElementById('newNoteBtn');
    const processBtn = document.getElementById('processBtn');
    const visualizeBtn = document.getElementById('visualizeBtn');
    const saveNoteBtn = document.getElementById('saveNoteBtn'); // NEW
    const pdfBtn = document.getElementById('pdfBtn');
    const focusBtn = document.getElementById('focusBtn'); 
    const exitFocusBtn = document.getElementById('exitFocusBtn'); 
    
    // Audio
    const playAudioBtn = document.getElementById('playAudioBtn');
    const stopAudioBtn = document.getElementById('stopAudioBtn');
    const speedBtn = document.getElementById('speedBtn');
    const micBtn = document.getElementById('micBtn');

    // Sidebar & Lists
    const historyToggle = document.getElementById('historyToggle');
    const historyList = document.getElementById('historyList');
    const savedToggle = document.getElementById('savedToggle');
    const savedList = document.getElementById('savedList');
    const sidebar = document.getElementById('sidebar');
    const topHeader = document.getElementById('topHeader');
    const outputPanel = document.getElementById('outputPanel');
    const workspace = document.getElementById('workspace');

    // God Mode
    const cmdPalette = document.getElementById('cmdPalette');
    const cmdInput = document.getElementById('cmdInput');
    const cmdResults = document.getElementById('cmdResults');
    const toast = document.getElementById('toast');

    // State Variables
    let currentRawResponse = ""; // Stores the raw Markdown for saving

    // --- INITIAL LOAD ---
    loadList('notesHistory', historyList);
    loadList('savedNotes', savedList);
    
    const savedTheme = localStorage.getItem('userTheme');
    if(savedTheme) {
        const theme = JSON.parse(savedTheme);
        setTheme(theme.primary, theme.hover, false);
    }

    // ==========================================
    // 1. SAVE & HISTORY LOGIC (THE FIX)
    // ==========================================
    
    // Save Button Listener
    if(saveNoteBtn) {
        saveNoteBtn.addEventListener('click', () => {
            const content = currentRawResponse || aiOutput.innerText;
            const title = userInput.value;

            if(!content || content.includes("Ready for refinement")) {
                showToast("Nothing to save");
                return;
            }

            saveToList('savedNotes', title, content);
            loadList('savedNotes', savedList);
            
            // Open the Saved list to show the user
            if(savedList.style.display === 'none') savedToggle.click();
            
            showToast("Note Saved to Sidebar");
        });
    }

    // Sidebar Toggles
    if(historyToggle && historyList) {
        historyToggle.addEventListener('click', () => {
            const isHidden = historyList.style.display === 'none';
            historyList.style.display = isHidden ? 'flex' : 'none';
            historyToggle.classList.toggle('active', isHidden);
            if(isHidden && savedList) { savedList.style.display = 'none'; savedToggle.classList.remove('active'); }
        });
    }

    if(savedToggle && savedList) {
        savedToggle.addEventListener('click', () => {
            const isHidden = savedList.style.display === 'none';
            savedList.style.display = isHidden ? 'flex' : 'none';
            savedToggle.classList.toggle('active', isHidden);
            if(isHidden && historyList) { historyList.style.display = 'none'; historyToggle.classList.remove('active'); }
        });
    }

    // ==========================================
    // 2. CORE AI ENGINE
    // ==========================================
    processBtn.addEventListener('click', async () => {
        const text = userInput.value.trim();
        if(!text) { showToast("Enter notes first"); return; }
        
        processBtn.disabled = true; 
        processBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Thinking...';
        
        try {
            const response = await fetch("http://127.0.0.1:8000/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: text }),
            });

            if (!response.ok) throw new Error("Backend Error");
            const data = await response.json();
            
            currentRawResponse = data.response; // Store for saving
            aiOutput.innerHTML = marked.parse(data.response);
            
            if(window.renderMathInElement) {
                renderMathInElement(aiOutput, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] });
            }
            aiOutput.classList.remove('empty-state');
            enableLiveCode();
            
            saveToList('notesHistory', text, data.response);
            loadList('notesHistory', historyList);
            showToast("Complete");

        } catch (error) { showToast("Error: " + error.message); } 
        finally { processBtn.disabled = false; processBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Refine'; }
    });

    // ==========================================
    // 3. VISUALIZATION
    // ==========================================
    if(visualizeBtn) {
        visualizeBtn.addEventListener('click', async () => {
            const text = userInput.value.trim() || aiOutput.innerText;
            if(!text || text.length < 5) { showToast("Enter more text"); return; }

            visualizeBtn.disabled = true;
            const originalIcon = visualizeBtn.innerHTML;
            visualizeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            showToast("Designing Diagram...");

            const prompt = `Based on the following text, generate a MERMAID.JS graph code (graph TD or mindmap). 
            STRICT RULE: Output ONLY the code block inside \`\`\`mermaid ... \`\`\`.
            Text: ${text.substring(0, 1500)}`; 

            try {
                const response = await fetch("http://127.0.0.1:8000/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: prompt, temperature: 0.2 }), 
                });

                if (!response.ok) throw new Error("Backend Error");
                const data = await response.json();
                const match = data.response.match(/```mermaid([\s\S]*?)```/);
                const mermaidCode = match ? match[1].trim() : data.response;

                aiOutput.innerHTML = `<div class="mermaid">${mermaidCode}</div>`;
                aiOutput.classList.remove('empty-state');
                await mermaid.run({ nodes: [aiOutput.querySelector('.mermaid')] });
                showToast("Diagram Created");

            } catch (error) {
                console.error(error);
                showToast("Visualization Failed");
            } finally {
                visualizeBtn.disabled = false;
                visualizeBtn.innerHTML = originalIcon;
            }
        });
    }

    // ==========================================
    // 4. PDF EXPORT
    // ==========================================
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            if (typeof html2pdf === 'undefined') { alert("PDF Library Missing"); return; }
            if (aiOutput.classList.contains('empty-state')) { showToast("Nothing to export"); return; }

            showToast("Generating PDF...");
            const originalIcon = pdfBtn.innerHTML;
            pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 

            const opt = {
                margin: 0.5, filename: 'NeuroNotes_Export.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true }, 
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(aiOutput).save()
                .then(() => showToast("PDF Downloaded"))
                .finally(() => pdfBtn.innerHTML = originalIcon);
        });
    }

    // ==========================================
    // 5. GOD MODE & UTILS
    // ==========================================
    function toggleGodMode() {
        if(!cmdPalette) return;
        const isHidden = cmdPalette.classList.contains('hidden');
        if (isHidden) {
            cmdPalette.classList.remove('hidden');
            setTimeout(() => cmdPalette.classList.add('show'), 10);
            cmdInput.value = ''; cmdInput.focus(); renderCommands(''); 
        } else {
            cmdPalette.classList.remove('show');
            setTimeout(() => cmdPalette.classList.add('hidden'), 200);
        }
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleGodMode(); }
        if (e.key === 'Escape' && cmdPalette) toggleGodMode();
    });

    if(cmdPalette) cmdPalette.addEventListener('click', (e) => { if (e.target === cmdPalette) toggleGodMode(); });

    function setTheme(primary, hover, notify = true) {
        document.documentElement.style.setProperty('--primary', primary);
        document.documentElement.style.setProperty('--primary-hover', hover);
        localStorage.setItem('userTheme', JSON.stringify({ primary, hover }));
        if(notify) showToast("Theme Updated");
    }

    const actions = [
        { title: "New Note", icon: "fa-plus", tag: "Action", action: () => newNoteBtn.click() },
        { title: "Refine Text", icon: "fa-wand-magic-sparkles", tag: "AI", action: () => processBtn.click() },
        { title: "Save Note", icon: "fa-bookmark", tag: "Action", action: () => saveNoteBtn.click() },
        { title: "Export PDF", icon: "fa-file-pdf", tag: "File", action: () => pdfBtn ? pdfBtn.click() : null }, 
        { title: "Podcast Play", icon: "fa-play", tag: "Audio", action: () => playAudioBtn.click() },
        { title: "Visualize", icon: "fa-diagram-project", tag: "Tool", action: () => visualizeBtn.click() },
        { title: "Focus Mode", icon: "fa-expand", tag: "View", action: () => focusBtn.click() },
        { title: "Theme: Hacker Green", icon: "fa-terminal", tag: "Theme", action: () => setTheme('#34d399', '#10b981') },
        { title: "Theme: Default Blue", icon: "fa-droplet", tag: "Theme", action: () => setTheme('#818CF8', '#6366F1') },
        { title: "Clear History", icon: "fa-trash", tag: "Data", action: () => { if(confirm("Clear history?")) { localStorage.removeItem('notesHistory'); localStorage.removeItem('savedNotes'); location.reload(); } } }
    ];

    if(cmdInput) {
        cmdInput.addEventListener('input', (e) => renderCommands(e.target.value));
        cmdInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') { const selected = document.querySelector('.cmd-item'); if(selected) selected.click(); }
        });
    }

    function renderCommands(query) {
        if(!cmdResults) return; cmdResults.innerHTML = '';
        const q = query.toLowerCase();
        
        let history = (JSON.parse(localStorage.getItem('notesHistory')) || []).map(h => ({
            title: h.title, icon: "fa-clock-rotate-left", tag: "History",
            action: () => { userInput.value = h.o; aiOutput.innerHTML = marked.parse(h.r); aiOutput.classList.remove('empty-state'); currentRawResponse = h.r; enableLiveCode(); }
        }));

        const allItems = [...actions, ...history].filter(item => item.title.toLowerCase().includes(q));

        if(allItems.length === 0) { cmdResults.innerHTML = '<div style="padding:15px; color:#64748b; text-align:center;">No actions found</div>'; return; }

        allItems.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = `cmd-item ${index === 0 ? 'selected' : ''}`;
            el.innerHTML = `<div class="cmd-icon"><i class="fa-solid ${item.icon}"></i></div><div class="cmd-text">${item.title}</div><div class="cmd-tag">${item.tag}</div>`;
            el.onclick = () => { item.action(); toggleGodMode(); };
            cmdResults.appendChild(el);
        });
    }

    // --- AUDIO & MIC ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && micBtn) {
        let recognition = new SpeechRecognition();
        recognition.continuous = false; recognition.lang = 'en-US';
        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('recording')) { recognition.stop(); } 
            else { try { recognition.start(); micBtn.classList.add('recording'); showToast("Listening..."); } catch (e) { showToast("Mic Error"); } }
        });
        recognition.onresult = (event) => {
            userInput.value += (userInput.value.length > 0 ? ' ' : '') + event.results[0][0].transcript;
            userInput.dispatchEvent(new Event('input'));
        };
        recognition.onend = () => micBtn.classList.remove('recording');
    }

    let speech = new SpeechSynthesisUtterance();
    let speeds = [1, 1.5, 2]; let speedIndex = 0;
    
    if(playAudioBtn) playAudioBtn.addEventListener('click', () => {
        if(window.speechSynthesis.speaking && !window.speechSynthesis.paused) { window.speechSynthesis.pause(); playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; }
        else if(window.speechSynthesis.paused) { window.speechSynthesis.resume(); playAudioBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; }
        else {
            let t = window.getSelection().toString() || aiOutput.innerText || userInput.value;
            if(!t || t.includes("Ready")) return;
            window.speechSynthesis.cancel(); speech.text = t; speech.rate = speeds[speedIndex];
            window.speechSynthesis.speak(speech); playAudioBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        }
    });
    
    if(stopAudioBtn) stopAudioBtn.addEventListener('click', () => { window.speechSynthesis.cancel(); playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; });
    if(speedBtn) speedBtn.addEventListener('click', () => { speedIndex = (speedIndex + 1) % speeds.length; speedBtn.innerText = speeds[speedIndex] + 'x'; });
    speech.onend = () => playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i>';

    // --- HELPERS ---
    function enableLiveCode() {
        aiOutput.querySelectorAll('pre code').forEach(block => {
            if(!block.className.includes('javascript')) return;
            const pre = block.parentElement; if(pre.querySelector('.run-btn')) return;
            const btn = document.createElement('button'); btn.className='run-btn'; btn.innerHTML='<i class="fa-solid fa-play"></i> Run';
            pre.appendChild(btn); const div = document.createElement('div'); div.className='code-output'; pre.after(div);
            btn.onclick = () => {
                const logs=[]; const old=console.log; console.log=(...a)=>logs.push(a.join(' '));
                try { eval(block.innerText); div.innerText=logs.join('\n')||"Done"; div.style.color="#10b981"; }
                catch(e){ div.innerText=e.message; div.style.color="#ef4444"; }
                div.classList.add('show'); console.log=old;
            };
        });
    }

    focusBtn.addEventListener('click', () => { sidebar.classList.add('hidden'); topHeader.classList.add('hidden'); outputPanel.classList.add('hidden'); workspace.classList.add('zen'); exitFocusBtn.classList.add('show'); });
    exitFocusBtn.addEventListener('click', () => { sidebar.classList.remove('hidden'); topHeader.classList.remove('hidden'); outputPanel.classList.remove('hidden'); workspace.classList.remove('zen'); exitFocusBtn.classList.remove('show'); });
    newNoteBtn.addEventListener('click', () => { userInput.value=''; aiOutput.innerHTML='<i class="fa-solid fa-layer-group"></i><p>Ready</p>'; aiOutput.classList.add('empty-state'); currentRawResponse=""; });
    userInput.addEventListener('input', (e) => document.getElementById('inputStats').innerText = `${e.target.value.trim().split(/\s+/).length} words`);

    function showToast(msg) { toast.innerText=msg; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2000); }
    
    function saveToList(k, o, r) { 
        let l = JSON.parse(localStorage.getItem(k)) || []; 
        l.unshift({id:Date.now(), title:o.substring(0,15)+"...", o, r}); 
        localStorage.setItem(k, JSON.stringify(l.slice(0, 15))); 
    }
    
    function loadList(k, c) {
        if(!c) return; let l = JSON.parse(localStorage.getItem(k)) || []; c.innerHTML = '';
        l.forEach(i => {
            let el = document.createElement('div'); el.className='list-item'; el.innerText=i.title;
            el.onclick = () => { userInput.value=i.o; aiOutput.innerHTML=marked.parse(i.r); aiOutput.classList.remove('empty-state'); currentRawResponse=i.r; enableLiveCode(); };
            c.appendChild(el);
        });
    }
});