import { showToast } from './api.js';
import { state } from './state.js';
import { loadNotes } from './notes.js';

// ── Themes ────────────────────────────────────────────────────────────────────
const themes = ['nebula', 'light', 'midnight', 'terminal', 'sunset'];

function applyTheme(idx) {
    document.documentElement.removeAttribute('data-theme');
    if (idx > 0) document.documentElement.setAttribute('data-theme', themes[idx]);
    localStorage.setItem('themeIndex', idx);
}

// ── Sidebar list toggles ──────────────────────────────────────────────────────
function toggleList(listId, btnId) {
    const list = document.getElementById(listId);
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'flex' : 'none';
    document.getElementById(btnId).classList.toggle('active', isHidden);
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
let pendingDeleteCallback = null;

function showDeleteConfirm(title, msg, onConfirm) {
    document.getElementById('deleteConfirmTitle').textContent = title;
    document.getElementById('deleteConfirmMsg').textContent = msg;
    pendingDeleteCallback = onConfirm;
    document.getElementById('deleteConfirmOverlay').classList.add('show');
}

export function initUI() {
    // Themes
    applyTheme(parseInt(localStorage.getItem('themeIndex')) || 0);
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', () => { applyTheme(opt.dataset.idx); showToast("Theme updated"); });
    });

    // Sidebar toggles
    document.getElementById('historyToggle')?.addEventListener('click', () => {
        toggleList('historyList', 'historyToggle');
        const wrapper = document.getElementById('historySearchWrapper');
        const isOpen = document.getElementById('historyList').style.display !== 'none';
        if (wrapper) wrapper.style.display = isOpen ? 'block' : 'none';
        if (!isOpen && document.getElementById('historySearchInput')) {
            document.getElementById('historySearchInput').value = '';
        }
    });

    let searchDebounce = null;
    document.getElementById('historySearchInput')?.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => loadNotes(document.getElementById('historySearchInput').value.trim()), 300);
    });

    document.getElementById('savedToggle')?.addEventListener('click', () => toggleList('savedList', 'savedToggle'));

    document.getElementById('savedDecksToggle')?.addEventListener('click', async () => {
        const { renderSavedDecksSidebar } = await import('./notes.js');
        await renderSavedDecksSidebar();
        toggleList('savedDecksList', 'savedDecksToggle');
    });

    // Clear history
    document.getElementById('clearHistoryBtn')?.addEventListener("click", () => {
        showDeleteConfirm("Clear History?", "All history notes will be permanently deleted.", async () => {
            const { apiFetch, API_BASE } = await import('./api.js');
            try {
                await Promise.all(state.historyNotes.map(n => apiFetch(`${API_BASE}/notes/${n.id}`, { method: "DELETE" })));
                await loadNotes();
                showToast("History cleared");
            } catch { showToast("Error clearing history"); }
        });
    });

    // Save / copy buttons
    document.getElementById('saveNoteBtn')?.addEventListener('click', () => {
        import('./notes.js').then(({ handleBookmark }) => handleBookmark(state.lastGeneratedNoteId));
    });
    document.getElementById('copyBtn')?.addEventListener('click', () => {
        if (!state.currentRawResponse) return showToast("Nothing to copy");
        navigator.clipboard.writeText(state.currentRawResponse);
        showToast("Copied!");
    });

    // Focus mode
    document.getElementById('focusBtn')?.addEventListener('click', () => {
        document.getElementById('inputPanel').classList.add('hidden');
        document.getElementById('resizeHandler').classList.add('hidden');
        document.getElementById('outputPanel').classList.add('focus-mode');
        document.getElementById('workspace').classList.add('focus-active');
        const exitBtn = document.getElementById('exitFocusBtn');
        exitBtn.classList.remove('hidden');
        exitBtn.classList.add('show');
    });
    document.getElementById('exitFocusBtn')?.addEventListener('click', exitFocus);

    // Focus noise
    let audioCtx, noiseSrc;
    document.getElementById('focusSoundBtn')?.addEventListener('click', () => {
        if (noiseSrc) {
            noiseSrc.stop(); noiseSrc = null;
            document.getElementById('focusSoundBtn').classList.remove('active');
            showToast("Focus: OFF");
            return;
        }
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < buf.length; i++) {
            const w = Math.random() * 2 - 1;
            last = (last + (0.02 * w)) / 1.02;
            data[i] = last * 3.5;
        }
        noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = buf;
        noiseSrc.loop = true;
        const gain = audioCtx.createGain();
        gain.gain.value = 0.05;
        noiseSrc.connect(gain);
        gain.connect(audioCtx.destination);
        noiseSrc.start();
        document.getElementById('focusSoundBtn').classList.add('active');
        showToast("Focus: ON");
    });

    // PDF export
    document.getElementById('pdfBtn')?.addEventListener('click', () => {
        const aiOutput = document.getElementById('aiOutput');
        if (!aiOutput.innerText) return;
        showToast("Generating PDF...");
        html2pdf().from(aiOutput).save('note.pdf');
    });

    // Resize splitter
    let isResizing = false;
    document.getElementById('resizeHandler')?.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.classList.add('resizing');
        document.getElementById('resizeHandler').classList.add('active');
    });
    document.addEventListener('mousemove', e => {
        if (!isResizing) return;
        const r = document.getElementById('workspace').getBoundingClientRect();
        let w = ((e.clientX - r.left) / r.width) * 100;
        document.getElementById('inputPanel').style.flex = `0 0 calc(${Math.max(20, Math.min(w, 80))}% - 8px)`;
    });
    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.classList.remove('resizing');
        document.getElementById('resizeHandler')?.classList.remove('active');
    });

    // Logout modal
    const logoutOverlay = document.getElementById('logoutConfirmOverlay');
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        logoutOverlay.classList.add('show');
        document.activeElement.blur();
    });
    document.getElementById('cancelLogoutBtn')?.addEventListener('click', () => logoutOverlay.classList.remove('show'));
    logoutOverlay?.addEventListener('click', (e) => { if (e.target === logoutOverlay) logoutOverlay.classList.remove('show'); });
    document.getElementById('confirmLogoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem("access_token");
        sessionStorage.removeItem("access_token");
        location.reload();
    });

    // Delete confirm modal (driven by 'ui:showDeleteConfirm' event)
    document.addEventListener('ui:showDeleteConfirm', (e) => {
        showDeleteConfirm(e.detail.title, e.detail.msg, e.detail.onConfirm);
    });
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
        document.getElementById('deleteConfirmOverlay').classList.remove('show');
        pendingDeleteCallback = null;
    });
    document.getElementById('deleteConfirmOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('deleteConfirmOverlay')) {
            document.getElementById('deleteConfirmOverlay').classList.remove('show');
            pendingDeleteCallback = null;
        }
    });
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
        document.getElementById('deleteConfirmOverlay').classList.remove('show');
        if (pendingDeleteCallback) await pendingDeleteCallback();
        pendingDeleteCallback = null;
    });

    // Floating highlight menu
    const floatingMenu = document.getElementById('floatingMenu');
    const userInput = document.getElementById('userInput');
    let selectedTextForMenu = "";

    userInput?.addEventListener('mouseup', (e) => {
        selectedTextForMenu = userInput.value.substring(userInput.selectionStart, userInput.selectionEnd).trim();
        if (selectedTextForMenu.length > 0) {
            floatingMenu.style.left = `${e.pageX - 80}px`;
            floatingMenu.style.top = `${e.pageY - 50}px`;
            floatingMenu.classList.remove('hidden');
            setTimeout(() => floatingMenu.classList.add('show'), 10);
        } else hideFloatingMenu();
    });

    const hideFloatingMenu = () => {
        floatingMenu.classList.remove('show');
        setTimeout(() => floatingMenu.classList.add('hidden'), 200);
    };
    document.addEventListener('mousedown', (e) => {
        if (!floatingMenu.contains(e.target) && e.target !== userInput) hideFloatingMenu();
    });
    userInput?.addEventListener('keydown', hideFloatingMenu);

    document.querySelectorAll('.float-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            hideFloatingMenu();

            if (action === 'read') {
                const { getSelectedVoice } = await import('./tts.js');
                speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(selectedTextForMenu);
                const selVoice = getSelectedVoice();
                if (selVoice) utterance.voice = selVoice;
                speechSynthesis.speak(utterance);
                return;
            }

            const processBtn = document.getElementById('processBtn');
            const processBtnOrig = processBtn.innerHTML;
            processBtn.disabled = true;
            processBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Working...';

            let systemPromptAddon = "";
            if (action === 'rewrite') systemPromptAddon = "Rewrite the following text to be more clear, professional, and engaging. Return ONLY the rewritten text.";
            if (action === 'summarize') systemPromptAddon = "Summarize the following text concisely in bullet points.";
            if (action === 'explain') systemPromptAddon = "Explain the following code or concept step-by-step so a beginner can understand.";

            const { apiFetch, API_BASE, streamText } = await import('./api.js');
            const { getSystemPrompt } = await import('./presets.js');
            const { enableLiveCode } = await import('./code.js');
            const { renderMermaidDiagrams } = await import('./diagrams.js');
            const { loadNotes } = await import('./notes.js');

            try {
                const systemPrompt = getSystemPrompt();
                const res = await apiFetch(`${API_BASE}/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        system_prompt: systemPrompt.trim() + "\n" + systemPromptAddon,
                        prompt: selectedTextForMenu,
                    })
                });
                if (!res.ok) throw new Error("Backend Error");
                const data = await res.json();

                state.currentRawResponse = data.response;
                state.lastGeneratedNoteId = data.note_id;

                const aiOutput = document.getElementById('aiOutput');
                await streamText(aiOutput, data.response, () => {
                    if (window.renderMathInElement) renderMathInElement(aiOutput, {
                        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }]
                    });
                    enableLiveCode();
                    renderMermaidDiagrams();
                });

                await loadNotes();
                showToast(action.charAt(0).toUpperCase() + action.slice(1) + " Complete!");
            } catch (err) { showToast(err.message); }
            finally { processBtn.disabled = false; processBtn.innerHTML = processBtnOrig; }
        });
    });

    // Tab routing
    const navWorkspace = document.getElementById('navWorkspaceBtn');
    const navResearch = document.getElementById('navResearchBtn');

    function switchTab(tab) {
        document.querySelectorAll('.nav-menu .nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('workspace')?.classList.add('hidden');
        document.getElementById('researchScreen')?.classList.add('hidden');
        document.body.classList.remove('research-mode');

        if (tab === 'workspace') {
            navWorkspace?.classList.add('active');
            document.getElementById('workspace')?.classList.remove('hidden');
            const h1 = document.getElementById('topHeader')?.querySelector('h1');
            if (h1) h1.innerText = "Workspace";
        } else if (tab === 'research') {
            navResearch?.classList.add('active');
            document.getElementById('researchScreen')?.classList.remove('hidden');
            const h1 = document.getElementById('topHeader')?.querySelector('h1');
            if (h1) h1.innerText = "Deep Research Engine";
            document.body.classList.add('research-mode');
            setTimeout(() => document.getElementById('drInput')?.focus(), 100);
        }
    }

    navWorkspace?.addEventListener('click', () => switchTab('workspace'));
    navResearch?.addEventListener('click', () => switchTab('research'));

    // Global Escape handler
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        exitFocus();
        if (!document.getElementById('settingsModal').classList.contains('hidden')) {
            document.getElementById('closeSettingsBtn').click();
        }
        if (!document.getElementById('cmdPalette')?.classList.contains('hidden')) {
            document.getElementById('cmdPalette').classList.remove('show');
            setTimeout(() => document.getElementById('cmdPalette').classList.add('hidden'), 200);
        }
        const chatSidebar = document.getElementById('chatSidebar');
        if (chatSidebar?.classList.contains('open')) window._toggleChat?.();

        if (document.getElementById('deleteConfirmOverlay')?.classList.contains('show')) {
            document.getElementById('deleteConfirmOverlay').classList.remove('show');
            pendingDeleteCallback = null;
        }
        if (document.getElementById('logoutConfirmOverlay')?.classList.contains('show')) {
            document.getElementById('logoutConfirmOverlay').classList.remove('show');
        }
        if (!document.getElementById('fcExitOverlay').classList.contains('hidden')) {
            document.getElementById('fcExitOverlay').classList.add('hidden');
            return;
        }
        if (!document.getElementById('fcModeScreen').classList.contains('hidden') ||
            !document.getElementById('fcReviewScreen').classList.contains('hidden')) {
            window._fcAskExit?.();
            return;
        }
        if (!document.getElementById('fcOverlay').classList.contains('hidden')) {
            document.getElementById('fcOverlay').classList.add('hidden');
            return;
        }
        if (!document.getElementById('fcSummaryScreen').classList.contains('hidden')) {
            document.getElementById('fcSummaryScreen').classList.add('hidden');
            return;
        }
        if (!document.getElementById('fcSavedScreen')?.classList.contains('hidden')) {
            document.getElementById('fcSavedScreen').classList.add('hidden');
            document.getElementById('fcOverlay').classList.remove('hidden');
            window._fcShowStep?.('fcStepConfig');
            return;
        }
    });
}

function exitFocus() {
    document.getElementById('inputPanel').classList.remove('hidden');
    document.getElementById('resizeHandler').classList.remove('hidden');
    document.getElementById('outputPanel').classList.remove('focus-mode');
    document.getElementById('workspace').classList.remove('focus-active');
    const exitBtn = document.getElementById('exitFocusBtn');
    exitBtn.classList.remove('show');
    exitBtn.classList.add('hidden');
}
