import { state } from './state.js';
import { apiFetch, API_BASE, showToast, streamText } from './api.js';
import { initPresets, getSystemPrompt } from './presets.js';
import { initAuth, validateSession } from './auth.js';
import { loadNotes, handleBookmark } from './notes.js';
import { enableLiveCode } from './code.js';
import { renderMermaidDiagrams } from './diagrams.js';
import { initTTS } from './tts.js';
import { initUI } from './ui.js';
import { initChat } from './chat.js';
import { initFlashcards } from './flashcards.js';
import { initQuiz } from './quiz.js';
import { initResearch } from './research.js';
import { initUpload } from './upload.js';

// ── Core AI: Process Button ───────────────────────────────────────────────────
document.getElementById('processBtn')?.addEventListener('click', async () => {
    const userInput = document.getElementById('userInput');
    const aiOutput = document.getElementById('aiOutput');
    const text = userInput.value.trim();
    if (!text) return showToast("Enter notes first");

    const btn = document.getElementById('processBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Thinking...';

    try {
        const res = await apiFetch(`${API_BASE}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_prompt: getSystemPrompt().trim(),
                prompt: text.trim(),
            })
        });
        if (!res.ok) throw new Error("Backend Error");
        const data = await res.json();

        state.currentRawResponse = data.response;
        state.lastGeneratedNoteId = data.note_id;

        await streamText(aiOutput, data.response, () => {
            if (window.renderMathInElement) renderMathInElement(aiOutput, {
                delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }]
            });
            enableLiveCode();
            renderMermaidDiagrams();
        });

        await loadNotes();
        showToast("Complete");
    } catch (e) { showToast(e.message); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Refine'; }
});

// ── New Note ──────────────────────────────────────────────────────────────────
document.getElementById('newNoteBtn')?.addEventListener('click', () => {
    document.getElementById('userInput').value = '';
    const aiOutput = document.getElementById('aiOutput');
    aiOutput.innerHTML = '<i class="fa-solid fa-layer-group"></i><p>Ready</p>';
    aiOutput.classList.add('empty-state');
    state.currentRawResponse = "";
    state.lastGeneratedNoteId = null;
});

// ── Word count ────────────────────────────────────────────────────────────────
document.getElementById('userInput')?.addEventListener('input', e => {
    const val = e.target.value.trim();
    document.getElementById('inputStats').innerText =
        (val === '' ? 0 : val.split(/\s+/).filter(x => x).length) + ' words';
});

// ── Visualize (Mermaid Diagram) ───────────────────────────────────────────────
document.getElementById('visualizeBtn')?.addEventListener('click', async () => {
    if (!state.currentRawResponse || state.currentRawResponse.includes('Ready for refinement')) {
        return showToast("Generate a summary first!");
    }
    const btn = document.getElementById('visualizeBtn');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    showToast("Drawing diagram...");

    try {
        const systemPrompt = "Convert the following text into a visual Mermaid.js flowchart. Use 'flowchart TD'. Use clean, simple syntax without parenthesis inside node text. Return ONLY the raw code block starting with ```mermaid. No explanation.";
        const res = await apiFetch(`${API_BASE}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_prompt: systemPrompt,
                prompt: state.currentRawResponse.substring(0, 3000),
                temperature: 0.1
            })
        });
        if (!res.ok) throw new Error("Backend Error");
        const data = await res.json();

        state.currentRawResponse += "\n\n### Visual Diagram 🗺️\n" + data.response;
        const aiOutput = document.getElementById('aiOutput');
        await streamText(aiOutput, state.currentRawResponse, () => {
            if (window.renderMathInElement) renderMathInElement(aiOutput, {
                delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }]
            });
            enableLiveCode();
            renderMermaidDiagrams();
        });
    } catch (err) {
        showToast("Failed to draw diagram.");
        console.error(err);
    } finally {
        btn.innerHTML = origHTML;
        btn.disabled = false;
    }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
initPresets();
initAuth();
initTTS();
initUI();
initChat();
initFlashcards();
initQuiz();
initResearch();
initUpload();
validateSession();
