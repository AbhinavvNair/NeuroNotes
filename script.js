document.addEventListener('DOMContentLoaded', () => {
    window.speechSynthesis.cancel();
    if (typeof mermaid !== 'undefined') mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

    // --- HELPER & DOM ---
    const $ = id => document.getElementById(id);
    const toast = $('toast'), userInput = $('userInput'), aiOutput = $('aiOutput');
    const showToast = msg => { toast.innerText = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); };
    const API_BASE = "http://127.0.0.1:8000";

    let currentRawResponse = "", historyNotes = [], historyDisplayCount = 10, savedNotesData = [], lastGeneratedNoteId = null;
    let isReg = false, isResizing = false;

    // ======================================================
    // PRESET SYSTEM + AI MODE BADGE
    // ======================================================

    const promptPresets = {
        custom: "",
        child: "Explain this as if I am 10 years old. Use simple words, friendly tone, short sentences, and include small examples.",
        composition: "Break this topic into its complete structure and composition. List all components, subparts, relationships, and how they work together.",
        geo_stats: "Answer from a geographic and statistical perspective. Include data, metrics, region-wise comparisons, and relevant real-world stats.",
        news: "Answer like an unbiased news analyst. Provide recent developments, timelines, causes, impacts, and multiple viewpoints.",
        exam: "Give a crisp, exam-oriented answer. Use definitions, bullet points, formulas, and important facts without fluff.",
        professor: "Explain rigorously with academic depth. Include theory, formal definitions, detailed examples, and logical reasoning.",
        code: "Explain the code step-by-step. Fix errors, provide corrected versions, discuss logic, and mention time complexity.",
        math: "Solve with a detailed step-by-step explanation. Show formulas, derivations, intermediate steps, and simplified final answers.",
        summary: "Summarize the content into clear, concise bullet points with maximum clarity and minimal words.",
        compare: "Compare the items side-by-side using bullet points or tables. Highlight similarities, differences, pros/cons, and key takeaways.",
        creative: "Rewrite the content creatively. Use metaphors, analogies, and mental models to make it intuitive while preserving meaning."
    };

    const presetLabels = {
        custom: "Custom ✏",
        child: "Explain Like I'm a Child 🧒",
        composition: "Full Composition Breakdown 🧩",
        geo_stats: "Geographic & Statistical 🌍",
        news: "News & Current Affairs 📰",
        exam: "Exam Mode 📝",
        professor: "Professor Mode 🎓",
        code: "Code Explainer 💻",
        math: "Math Solver ∑",
        summary: "Summary 📘",
        compare: "Compare & Contrast ⚖️",
        creative: "Creative Rewrite 🎨"
    };

    const aiBadge = document.getElementById("aiModeBadge");

    function updateAIModeBadge(preset) {
        if (!aiBadge) return;
        aiBadge.classList.add("hide");
        setTimeout(() => {
            aiBadge.textContent = presetLabels[preset] || "Custom ✏";
            aiBadge.classList.remove("hide");
            aiBadge.classList.add("show");
        }, 150);
    }

    const presetSelect = document.getElementById("promptPresetSelect");
    const promptTextarea = document.getElementById("settingPrompt");

    const savedPreset = localStorage.getItem("ai_preset") || "summary";
    if (presetSelect) presetSelect.value = savedPreset;

    if (promptTextarea) {
        if (savedPreset === "custom") {
            promptTextarea.value = localStorage.getItem("ai_custom_prompt") || "";
        } else {
            promptTextarea.value = promptPresets[savedPreset];
        }
    }

    updateAIModeBadge(savedPreset);

    presetSelect?.addEventListener("change", () => {
        const preset = presetSelect.value;
        localStorage.setItem("ai_preset", preset);

        if (preset === "custom") {
            const lastCustom = localStorage.getItem("ai_custom_prompt") || "";
            promptTextarea.value = lastCustom;
        } else {
            promptTextarea.value = promptPresets[preset];
        }

        updateAIModeBadge(preset);
    });

    promptTextarea?.addEventListener("input", () => {
        if (presetSelect.value === "custom") {
            localStorage.setItem("ai_custom_prompt", promptTextarea.value.trim());
        }
    });


    // === LOGOUT CONFIRMATION MODAL ===
    const logoutOverlay = $('logoutConfirmOverlay');
    const cancelLogoutBtn = $('cancelLogoutBtn');
    const confirmLogoutBtn = $('confirmLogoutBtn');
    const logoutBtn = $('logoutBtn');

    // prevent dropdown from closing
    logoutBtn?.addEventListener('click', e => e.stopPropagation());

    // open modal
    logoutBtn?.addEventListener('click', () => {
        logoutOverlay.classList.add('show');
        document.activeElement.blur(); 
    });

    // close modal (cancel)
    cancelLogoutBtn?.addEventListener('click', () => {
        logoutOverlay.classList.remove('show');
    });

    // close when clicking outside
    logoutOverlay?.addEventListener('click', (e) => {
        if (e.target === logoutOverlay) logoutOverlay.classList.remove('show');
    });

    // close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") logoutOverlay?.classList.remove('show');
    });

    // confirm logout
    confirmLogoutBtn?.addEventListener('click', () => {
        localStorage.removeItem("access_token");
        sessionStorage.removeItem("access_token");
        location.reload();
    });


    // --- API & AUTH ---
    const forceLogout = (msg = "Session expired. Please login again.") => {
        localStorage.removeItem("access_token"); sessionStorage.removeItem("access_token");
        $('appContainer').classList.add('hidden'); $('loginScreen').style.display = 'flex';
        userInput.value = ""; aiOutput.innerHTML = '<i class="fa-solid fa-sparkles"></i><p>Ready for refinement</p>'; aiOutput.classList.add('empty-state');
        lastGeneratedNoteId = null; currentRawResponse = ""; showToast(msg);
    };

    const apiFetch = async (url, opts = {}) => {
        const t = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        if (t) opts.headers = { ...opts.headers, "Authorization": "Bearer " + t };
        const res = await fetch(url, opts);
        if (res.status === 401) { forceLogout(); throw new Error("Unauthorized"); }
        return res;
    };

    const loadNotes = async () => {
        try {
            const res = await apiFetch(`${API_BASE}/notes`);
            if (!res.ok) throw new Error("Fetch failed");
            const notes = await res.json();
            historyNotes = notes.filter(n => !n.is_bookmarked); savedNotesData = notes.filter(n => n.is_bookmarked);
            renderList($('historyList'), historyNotes.slice(0, historyDisplayCount), false);
            renderList($('savedList'), savedNotesData, true);
            if (historyNotes.length > historyDisplayCount) {
                const btn = document.createElement('div'); btn.className = "list-item"; btn.style = "text-align:center; font-weight:600; color:var(--primary);";
                btn.textContent = "Show More"; btn.onclick = () => { historyDisplayCount += 10; loadNotes(); };
                $('historyList').appendChild(btn);
            }
        } catch (e) {
            console.error(e);
            showToast("Could not load notes. Check your connection.");
        }
    };

    function updateUserUI(email) {
        const nameEl = document.querySelector(".user-info .name");
        const avEl = document.querySelector(".user-avatar");
        if (!nameEl || !avEl) return;
        nameEl.textContent = email.split("@")[0];
        avEl.textContent = email.substring(0, 2).toUpperCase();
    }

    const renderList = (container, notes, isSaved) => {
        container.innerHTML = "";
        notes.forEach(note => {
            const wrap = document.createElement('div'); wrap.className = "list-item"; wrap.style.display = "flex"; wrap.style.justifyContent = "space-between";
            const title = document.createElement('span'); title.style.cursor = "pointer"; title.textContent = note.title || note.content.substring(0, 25);
            title.onclick = () => {
                userInput.value = note.title || "";
                aiOutput.innerHTML = marked.parse(note.content);
                aiOutput.classList.remove("empty-state");
                currentRawResponse = note.content;
                lastGeneratedNoteId = note.id;
                enableLiveCode();
                renderMermaidDiagrams();
            };
            const btn = document.createElement('button'); btn.className = isSaved ? "hover-action" : "delete-btn hover-action"; btn.style = `background:transparent; border:none; cursor:pointer; color: ${isSaved ? '#818cf8' : '#ef4444'}`;
            btn.innerHTML = isSaved ? `<i class="fa-solid fa-bookmark"></i>` : `<i class="fa-solid fa-xmark"></i>`;
            btn.onclick = async (e) => { e.stopPropagation(); isSaved ? handleBookmark(note.id, true) : showDeleteModal(note.id); };
            wrap.append(title, btn); container.appendChild(wrap);
        });
    };

    async function renderSavedDecksSidebar() {
        const list = $('savedDecksList');
        list.innerHTML = '<div class="list-item">Loading...</div>';

        try {
            const res = await apiFetch(`${API_BASE}/flashcards`);
            if (!res.ok) throw new Error();
            const decks = await res.json();
            list.innerHTML = '';

            if (decks.length === 0) {
                list.innerHTML = '<div class="list-item">No saved decks</div>';
                return;
            }

            decks.forEach(deck => {
                const row = document.createElement('div');
                row.className = "list-item"; row.style.display = "flex"; row.style.justifyContent = "space-between";
                const label = document.createElement('span');
                label.style.cursor = "pointer"; label.textContent = `${deck.count} · ${deck.topic}`;
                label.onclick = () => {
                    const fcCardsLoaded = deck.cards.map((c, i) => ({ ...c, id: i }));
                    document.getElementById('fcSavedScreen')?.classList.add('hidden');
                    window.scrollTo(0, 0);
                    window._loadDeckFromSidebar?.(fcCardsLoaded, deck.topic, deck.difficulty);
                    $('savedDecksList').style.display = 'none';
                };
                const del = document.createElement('button');
                del.className = "hover-action"; del.style.background = "transparent"; del.style.border = "none"; del.style.cursor = "pointer"; del.style.color = "#ef4444";
                del.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
                del.onclick = async (e) => {
                    e.stopPropagation();
                    const r = await apiFetch(`${API_BASE}/flashcards/${deck.id}`, { method: "DELETE" });
                    if (!r.ok) return showToast("Delete failed");
                    showToast("Deck deleted");
                    renderSavedDecksSidebar();
                };
                row.append(label, del); list.appendChild(row);
            });
        } catch (e) { list.innerHTML = '<div class="list-item">Failed to load decks</div>'; }
    }

    (async function validateSession() {
        if (!(localStorage.getItem("access_token") || sessionStorage.getItem("access_token"))) return forceLogout("Please login to continue");
        try {
            const res = await apiFetch(`${API_BASE}/me`); if (!res.ok) throw new Error();
            const email = (await res.json()).email;
            updateUserUI(email);
            $('loginScreen').style.display = 'none'; $('appContainer').classList.remove('hidden'); await loadNotes();
        } catch { forceLogout(); }
    })();

    // --- LOGIN & SETTINGS ---
    $('toggleAuthMode')?.addEventListener('click', () => {
        isReg = !isReg; $('confirmPasswordGroup').classList.toggle('hidden', !isReg); $('loginError').classList.add('hidden');
        $('loginSubmitBtn').innerHTML = isReg ? 'Create Account <i class="fa-solid fa-user-plus"></i>' : 'Enter Workspace <i class="fa-solid fa-arrow-right"></i>';
        $('toggleAuthMode').innerText = isReg ? "Already have an account? Login" : "Don't have an account? Register";
    });

    const userSection = $('userSection');
    $('userToggleBtn')?.addEventListener('click', (e) => { e.stopPropagation(); userSection?.classList.toggle('open'); });
    document.addEventListener('click', () => userSection?.classList.remove('open'));

    $('loginSubmitBtn')?.addEventListener('click', async () => {
        const email = $('loginUser').value.trim(), pass = $('loginPass').value.trim(), conf = $('confirmPass')?.value.trim();
        if (!email || !pass) return showLoginError("Enter email and password");
        if (isReg && pass !== conf) return showLoginError("Passwords do not match");
        try {
            if (isReg) {
                const r = await fetch(`${API_BASE}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pass }) });
                if (!r.ok) throw new Error((await r.json()).detail || "Registration failed");
                showToast("Account created. Please login."); $('toggleAuthMode').click(); return;
            }
            const fd = new URLSearchParams(); fd.append("username", email); fd.append("password", pass);
            const r = await fetch(`${API_BASE}/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: fd });
            if (!r.ok) throw new Error((await r.json()).detail || "Invalid credentials");
            const loginData = await r.json();
            sessionStorage.setItem("access_token", loginData.access_token);
            updateUserUI(email);
            $('loginScreen').style.display = 'none'; $('appContainer').classList.remove('hidden'); await loadNotes();
        } catch (e) { showLoginError(e.message); }
    });
    const showLoginError = msg => { $('loginError').textContent = msg; $('loginError').classList.remove('hidden'); };

    $('settingsBtn')?.addEventListener('click', () => { $('settingsModal').classList.remove('hidden'); setTimeout(() => $('settingsModal').classList.add('show'), 10); });
    $('closeSettingsBtn')?.addEventListener('click', () => { $('settingsModal').classList.remove('show'); setTimeout(() => $('settingsModal').classList.add('hidden'), 200); });
    $('saveSettingsBtn')?.addEventListener('click', () => {
        if (presetSelect.value === "custom") localStorage.setItem("ai_custom_prompt", promptTextarea.value.trim());
        showToast("Preferences Saved!"); $('closeSettingsBtn').click();
    });

    $('changePasswordBtn')?.addEventListener('click', async () => {
        const old_p = $('currentPassword').value.trim(), new_p = $('newPassword').value.trim(), conf_p = $('confirmNewPassword').value.trim();
        if (!old_p || !new_p) return showToast("Fill all fields"); if (new_p !== conf_p) return showToast("Passwords don't match");
        try {
            const r = await apiFetch(`${API_BASE}/change-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ old_password: old_p, new_password: new_p }) });
            if (!r.ok) throw new Error("Incorrect current password");
            showToast("Password updated"); $('currentPassword').value = $('newPassword').value = $('confirmNewPassword').value = "";
        } catch (e) { showToast(e.message); }
    });

    // --- SIDEBAR & THEMES ---
    const themes = ['nebula', 'light', 'midnight', 'terminal', 'sunset'];
    const applyTheme = idx => { document.documentElement.removeAttribute('data-theme'); if (idx > 0) document.documentElement.setAttribute('data-theme', themes[idx]); localStorage.setItem('themeIndex', idx); };
    applyTheme(parseInt(localStorage.getItem('themeIndex')) || 0);
    document.querySelectorAll('.theme-option').forEach(opt => opt.addEventListener('click', () => { applyTheme(opt.dataset.idx); showToast("Theme updated"); }));

    const toggleList = (listId, btnId) => {
        const list = $(listId), isHidden = list.style.display === 'none';
        list.style.display = isHidden ? 'flex' : 'none'; $(btnId).classList.toggle('active', isHidden);
    };
    $('historyToggle')?.addEventListener('click', () => toggleList('historyList', 'historyToggle'));
    $('savedToggle')?.addEventListener('click', () => toggleList('savedList', 'savedToggle'));
    $('savedDecksToggle')?.addEventListener('click', async () => { await renderSavedDecksSidebar(); toggleList('savedDecksList', 'savedDecksToggle'); });

    $('clearHistoryBtn')?.addEventListener("click", async () => {
        if (!confirm("Clear all history?")) return;
        try {
            await Promise.all(historyNotes.map(n => apiFetch(`${API_BASE}/notes/${n.id}`, { method: "DELETE" })));
            await loadNotes(); showToast("History cleared");
        } catch { showToast("Error clearing history"); }
    });

    const handleBookmark = async (id, isRemoving = false) => {
        if (!id) return showToast("No note selected");
        try { const r = await apiFetch(`${API_BASE}/notes/${id}/bookmark`, { method: "PATCH" }); if (!r.ok) throw new Error(); await loadNotes(); showToast(isRemoving ? "Removed bookmark" : "Saved note"); } catch { showToast("Bookmark failed"); }
    };
    $('saveNoteBtn')?.addEventListener('click', () => handleBookmark(lastGeneratedNoteId));
    $('copyBtn')?.addEventListener('click', () => {
        if (!currentRawResponse) return showToast("Nothing to copy");
        navigator.clipboard.writeText(currentRawResponse);
        showToast("Copied!");
    });

    const showDeleteModal = async (id) => { if (confirm("Delete this note?")) { try { await apiFetch(`${API_BASE}/notes/${id}`, { method: "DELETE" }); await loadNotes(); showToast("Note deleted"); } catch { showToast("Delete failed"); } } };

    // ==========================================
    // AUTO-MIND MAPPER (MERMAID.JS)
    // ==========================================
    async function renderMermaidDiagrams() {
        // Look for all code blocks in the output
        const blocks = aiOutput.querySelectorAll('pre code');
        let foundDiagram = false;

        blocks.forEach(block => {
            const text = block.textContent.trim();

            // Aggressively catch mermaid code even if the AI forgot the specific markdown tag
            if (block.className.includes('language-mermaid') ||
                text.startsWith('graph ') ||
                text.startsWith('flowchart ') ||
                text.startsWith('mindmap')) {

                foundDiagram = true;
                const pre = block.parentElement;

                const wrapper = document.createElement('div');
                wrapper.className = 'diagram-wrapper';
                wrapper.style.padding = '20px';
                wrapper.style.background = 'rgba(0,0,0,0.2)';
                wrapper.style.borderRadius = '12px';
                wrapper.style.marginTop = '20px';
                wrapper.style.border = '1px solid var(--border)';
                wrapper.style.overflowX = 'auto';
                wrapper.style.textAlign = 'center';

                const mermaidDiv = document.createElement('div');
                mermaidDiv.className = 'mermaid';

                // Clean up any weird markdown formatting the AI might have hallucinated
                mermaidDiv.textContent = text.replace(/```mermaid/g, '').replace(/```/g, '').trim();

                wrapper.appendChild(mermaidDiv);
                pre.replaceWith(wrapper);
            }
        });

        if (foundDiagram) {
            try {
                if (typeof mermaid === 'undefined') {
                    return showToast("Diagram engine loading...");
                }
                // Force a fresh initialization and render using the dark theme
                mermaid.initialize({ startOnLoad: false, theme: 'dark' });
                await mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
            } catch (e) {
                console.error("Mermaid Render Error:", e);
                showToast("Syntax error in diagram.");
            }
        }
    }

    $('visualizeBtn')?.addEventListener('click', async () => {
        if (!currentRawResponse || currentRawResponse.includes('Ready for refinement')) {
            return showToast("Generate a summary first!");
        }

        const btn = $('visualizeBtn');
        const origHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;
        showToast("Drawing diagram...");

        try {
            // A much stricter prompt to force standard flowchart logic
            const systemPrompt = "Convert the following text into a visual Mermaid.js flowchart. Use 'flowchart TD'. Use clean, simple syntax without parenthesis inside node text. Return ONLY the raw code block starting with ```mermaid. No explanation.";

            const res = await apiFetch(`${API_BASE}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_prompt: systemPrompt,
                    prompt: currentRawResponse.substring(0, 3000),
                    temperature: 0.1 // Strict temperature to prevent AI hallucinations
                })
            });

            if (!res.ok) throw new Error("Backend Error");
            const data = await res.json();

            // Append diagram safely
            currentRawResponse += "\n\n### Visual Diagram 🗺️\n" + data.response;

            await streamText(aiOutput, currentRawResponse, () => {
                if (window.renderMathInElement) renderMathInElement(aiOutput, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }] });
                enableLiveCode();
                renderMermaidDiagrams(); // Call our upgraded render function!
            });

        } catch (err) {
            showToast("Failed to draw diagram.");
            console.error(err);
        } finally {
            btn.innerHTML = origHTML;
            btn.disabled = false;
        }
    });

    // ==========================================
    // TYPEWRITER STREAMING ENGINE
    // ==========================================
    const streamText = async (container, rawText, onFinish) => {
        container.classList.remove('empty-state');
        container.classList.add('typing-cursor');
        let i = 0, buffer = '';
        return new Promise(resolve => {
            const timer = setInterval(() => {
                buffer += rawText.substring(i, i + 8);
                i += 8;
                container.innerHTML = marked.parse(buffer);
                container.scrollTop = container.scrollHeight;

                if (i >= rawText.length) {
                    clearInterval(timer);
                    container.innerHTML = marked.parse(rawText);
                    container.classList.remove('typing-cursor');
                    if (onFinish) onFinish();
                    resolve();
                }
            }, 16);
        });
    };

    // --- CORE AI ENGINE ---
    $('processBtn')?.addEventListener('click', async () => {
        const text = userInput.value.trim(); if (!text) return showToast("Enter notes first");
        const btn = $('processBtn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Thinking...';

        try {
            const activePreset = localStorage.getItem("ai_preset") || "summary";
            let systemPromptText = "";
            if (activePreset === "custom") {
                systemPromptText = localStorage.getItem("ai_custom_prompt") || "";
            } else {
                systemPromptText = promptPresets[activePreset] || "";
            }

            const res = await apiFetch(`${API_BASE}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_prompt: systemPromptText.trim(),
                    prompt: text.trim()
                })
            });
            if (!res.ok) throw new Error("Backend Error");
            const data = await res.json();

            currentRawResponse = data.response; lastGeneratedNoteId = data.note_id;

            await streamText(aiOutput, data.response, () => {
                if (window.renderMathInElement) renderMathInElement(aiOutput, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }] });
                enableLiveCode();
                renderMermaidDiagrams(); // Auto-render if AI generated mermaid code
            });

            await loadNotes(); showToast("Complete");
        } catch (e) { showToast(e.message); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Refine'; }
    });

    $('newNoteBtn')?.addEventListener('click', () => { userInput.value = ''; aiOutput.innerHTML = '<i class="fa-solid fa-layer-group"></i><p>Ready</p>'; aiOutput.classList.add('empty-state'); currentRawResponse = ""; lastGeneratedNoteId = null; });

    userInput.addEventListener('input', e => {
        const val = e.target.value.trim();
        $('inputStats').innerText = (val === '' ? 0 : val.split(/\s+/).filter(x => x).length) + ' words';
    });

    // --- INSTA-CODE & SNAPSHOT ---
    function enableLiveCode() {
        aiOutput.querySelectorAll('pre code').forEach(block => {
            const pre = block.parentElement; if (pre.classList.contains('processed')) return; pre.classList.add('processed'); pre.style.position = 'relative';
            const head = document.createElement('div'); head.className = 'code-header'; head.innerHTML = `<div class="window-dots"><span></span><span></span><span></span></div>`;
            const actions = document.createElement('div'); actions.className = 'code-actions';
            const copyBtn = document.createElement('button'); copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; copyBtn.onclick = () => { navigator.clipboard.writeText(block.innerText); showToast("Copied!"); };
            const snapBtn = document.createElement('button'); snapBtn.innerHTML = '<i class="fa-solid fa-camera"></i>'; snapBtn.onclick = () => {
                showToast("Snapping..."); const c = pre.cloneNode(true); c.style = "width:800px; padding:40px; background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:20px; position:fixed; top:-999px;";
                c.querySelector('.code-actions')?.remove(); document.body.appendChild(c);
                html2canvas(c, { backgroundColor: null, scale: 2 }).then(canvas => { const a = document.createElement('a'); a.download = 'code.png'; a.href = canvas.toDataURL(); a.click(); c.remove(); showToast("Saved! 📸"); });
            };
            actions.append(copyBtn, snapBtn);
            if (block.className.includes('js')) { const runBtn = document.createElement('button'); runBtn.className = 'run-btn-small'; runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run'; runBtn.onclick = () => executeCode(block, pre); actions.append(runBtn); }
            head.appendChild(actions); pre.insertBefore(head, block);
        });
    }

    const executeCode = (block, pre) => {
        pre.nextElementSibling?.classList.contains('code-output') && pre.nextElementSibling.remove();
        const out = document.createElement('div'); out.className = 'code-output show';
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        try {
            const logs = [];
            iframe.contentWindow.console = {
                log: (...a) => logs.push(a.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ')),
                error: (...a) => logs.push('Error: ' + a.join(' ')),
                warn: (...a) => logs.push('Warn: ' + a.join(' ')),
            };
            iframe.contentWindow.eval(block.innerText);
            out.innerText = logs.length ? logs.join('\n') : "> Executed";
            out.style.color = "#10b981";
        } catch (e) {
            out.innerText = "Error: " + e.message;
            out.style.color = "#ef4444";
        } finally {
            document.body.removeChild(iframe);
        }
        pre.after(out);
    };

    // --- AUDIO, NOISE & GOD MODE ---
    let speechParams = { speeds: [1, 1.5, 2], index: 0, utterance: null };
    const populateVoices = () => {
        const v = window.speechSynthesis.getVoices(); if (!v.length) return setTimeout(populateVoices, 200); if (!$('voiceSelect')) return; $('voiceSelect').innerHTML = '';
        v.slice(0, 10).forEach(voice => { const opt = document.createElement('option'); opt.value = voice.name; opt.textContent = voice.name.substring(0, 25); $('voiceSelect').appendChild(opt); });
    };
    populateVoices(); window.speechSynthesis.onvoiceschanged = populateVoices;

    $('playAudioBtn')?.addEventListener('click', () => {
        if (speechSynthesis.paused) { speechSynthesis.resume(); $('playAudioBtn').innerHTML = '<i class="fa-solid fa-pause"></i>'; return; }
        if (speechSynthesis.speaking) { speechSynthesis.pause(); $('playAudioBtn').innerHTML = '<i class="fa-solid fa-play"></i>'; return; }
        const t = window.getSelection().toString() || aiOutput.innerText || userInput.value; if (!t || t.includes("Ready")) return;
        speechSynthesis.cancel(); speechParams.utterance = new SpeechSynthesisUtterance(t);
        const selVoice = window.speechSynthesis.getVoices().find(v => v.name === $('voiceSelect').value); if (selVoice) speechParams.utterance.voice = selVoice;
        speechParams.utterance.rate = speechParams.speeds[speechParams.index];
        speechParams.utterance.onend = () => $('playAudioBtn').innerHTML = '<i class="fa-solid fa-play"></i>';
        speechSynthesis.speak(speechParams.utterance); $('playAudioBtn').innerHTML = '<i class="fa-solid fa-pause"></i>';
    });
    $('stopAudioBtn')?.addEventListener('click', () => { speechSynthesis.cancel(); $('playAudioBtn').innerHTML = '<i class="fa-solid fa-play"></i>'; });
    $('speedBtn')?.addEventListener('click', () => { speechParams.index = (speechParams.index + 1) % speechParams.speeds.length; $('speedBtn').innerText = speechParams.speeds[speechParams.index] + 'x'; });

    $('focusBtn')?.addEventListener('click', () => { $('inputPanel').classList.add('hidden'); $('resizeHandler').classList.add('hidden'); $('outputPanel').classList.add('focus-mode'); $('workspace').classList.add('focus-active'); $('exitFocusBtn').classList.remove('hidden'); $('exitFocusBtn').classList.add('show'); });
    const exitFocus = () => { $('inputPanel').classList.remove('hidden'); $('resizeHandler').classList.remove('hidden'); $('outputPanel').classList.remove('focus-mode'); $('workspace').classList.remove('focus-active'); $('exitFocusBtn').classList.remove('show'); $('exitFocusBtn').classList.add('hidden'); };
    $('exitFocusBtn')?.addEventListener('click', exitFocus);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        exitFocus();
        if (!$('settingsModal').classList.contains('hidden')) $('closeSettingsBtn').click();
        if (!$('cmdPalette')?.classList.contains('hidden')) { $('cmdPalette').classList.remove('show'); setTimeout(() => $('cmdPalette').classList.add('hidden'), 200); }
        if (chatSidebar.classList.contains('open')) toggleChat();
        if ($('confirmOverlay')?.classList.contains('show')) { $('confirmOverlay').classList.remove('show'); }

        if (!$('fcExitOverlay').classList.contains('hidden')) { $('fcExitOverlay').classList.add('hidden'); return; }
        if (!$('fcModeScreen').classList.contains('hidden') || !$('fcReviewScreen').classList.contains('hidden')) { window._fcAskExit?.(); return; }
        if (!$('fcOverlay').classList.contains('hidden')) { $('fcOverlay').classList.add('hidden'); return; }
        if (!$('fcSummaryScreen').classList.contains('hidden')) { $('fcSummaryScreen').classList.add('hidden'); return; }
        if (!$('fcSavedScreen')?.classList.contains('hidden')) { $('fcSavedScreen').classList.add('hidden'); $('fcOverlay').classList.remove('hidden'); window._fcShowStep('fcStepConfig'); return; }
    });

    let audioCtx, noiseSrc;
    $('focusSoundBtn')?.addEventListener('click', () => {
        if (noiseSrc) { noiseSrc.stop(); noiseSrc = null; $('focusSoundBtn').classList.remove('active'); showToast("Focus: OFF"); return; }
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate), data = buf.getChannelData(0); let last = 0;
        for (let i = 0; i < buf.length; i++) { const w = Math.random() * 2 - 1; last = (last + (0.02 * w)) / 1.02; data[i] = last * 3.5; }
        noiseSrc = audioCtx.createBufferSource(); noiseSrc.buffer = buf; noiseSrc.loop = true;
        const gain = audioCtx.createGain(); gain.gain.value = 0.05; noiseSrc.connect(gain); gain.connect(audioCtx.destination);
        noiseSrc.start(); $('focusSoundBtn').classList.add('active'); showToast("Focus: ON");
    });

    $('pdfBtn')?.addEventListener('click', () => { if (!aiOutput.innerText) return; showToast("Generating PDF..."); html2pdf().from(aiOutput).save('note.pdf'); });

    // IDE Splitter
    $('resizeHandler')?.addEventListener('mousedown', () => { isResizing = true; document.body.classList.add('resizing'); $('resizeHandler').classList.add('active'); });
    document.addEventListener('mousemove', e => { if (!isResizing) return; const r = $('workspace').getBoundingClientRect(); let w = ((e.clientX - r.left) / r.width) * 100; $('inputPanel').style.flex = `0 0 calc(${Math.max(20, Math.min(w, 80))}% - 8px)`; });
    document.addEventListener('mouseup', () => { isResizing = false; document.body.classList.remove('resizing'); $('resizeHandler')?.classList.remove('active'); });

    // --- FLOATING HIGHLIGHT MENU ---
    const floatingMenu = $('floatingMenu');
    let selectedTextForMenu = "";

    userInput.addEventListener('mouseup', (e) => {
        selectedTextForMenu = userInput.value.substring(userInput.selectionStart, userInput.selectionEnd).trim();
        if (selectedTextForMenu.length > 0) {
            floatingMenu.style.left = `${e.pageX - 80}px`; floatingMenu.style.top = `${e.pageY - 50}px`;
            floatingMenu.classList.remove('hidden'); setTimeout(() => floatingMenu.classList.add('show'), 10);
        } else hideFloatingMenu();
    });

    const hideFloatingMenu = () => { floatingMenu.classList.remove('show'); setTimeout(() => floatingMenu.classList.add('hidden'), 200); };
    document.addEventListener('mousedown', (e) => { if (!floatingMenu.contains(e.target) && e.target !== userInput) hideFloatingMenu(); });
    userInput.addEventListener('keydown', hideFloatingMenu);

    document.querySelectorAll('.float-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault(); const action = btn.dataset.action; hideFloatingMenu();

            if (action === 'read') {
                speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(selectedTextForMenu);
                const selVoice = window.speechSynthesis.getVoices().find(v => v.name === $('voiceSelect').value); if (selVoice) utterance.voice = selVoice;
                speechSynthesis.speak(utterance); return;
            }

            const processBtnOrig = $('processBtn').innerHTML;
            $('processBtn').disabled = true; $('processBtn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Working...';

            let systemPromptAddon = "";
            if (action === 'rewrite') systemPromptAddon = "Rewrite the following text to be more clear, professional, and engaging. Return ONLY the rewritten text.";
            if (action === 'summarize') systemPromptAddon = "Summarize the following text concisely in bullet points.";
            if (action === 'explain') systemPromptAddon = "Explain the following code or concept step-by-step so a beginner can understand.";

            try {
                const preset = localStorage.getItem("ai_preset") || "summary";
                let systemPrompt = "";
                if (preset === "custom") systemPrompt = localStorage.getItem("ai_custom_prompt") || "";
                else systemPrompt = promptPresets[preset] || "";

                const res = await apiFetch(`${API_BASE}/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        system_prompt: systemPrompt.trim() + "\n" + systemPromptAddon,
                        prompt: selectedTextForMenu
                    })
                });
                if (!res.ok) throw new Error("Backend Error");
                const data = await res.json();

                currentRawResponse = data.response; lastGeneratedNoteId = data.note_id;

                await streamText(aiOutput, data.response, () => {
                    if (window.renderMathInElement) renderMathInElement(aiOutput, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }] });
                    enableLiveCode();
                    renderMermaidDiagrams(); // Auto-render if AI generates code via rewrite/explain
                });

                await loadNotes(); showToast(action.charAt(0).toUpperCase() + action.slice(1) + " Complete!");
            } catch (err) { showToast(err.message); }
            finally { $('processBtn').disabled = false; $('processBtn').innerHTML = processBtnOrig; }
        });
    });

    // ==========================================
    // CONTEXTUAL AI CHAT SIDEBAR
    // ==========================================
    const chatSidebar = $('chatSidebar'), chatInput = $('chatInput'), chatMessages = $('chatMessages');

    let currentChatContextId = null; // Keeps track of what note we are currently discussing

    // Smart Greeting Generator
    const updateChatGreeting = () => {
        chatMessages.innerHTML = ''; // Clear previous chat history for the new topic
        const greetingDiv = document.createElement('div');
        greetingDiv.className = 'chat-msg ai';

        const contextText = aiOutput.innerText.includes('Ready for refinement') ? userInput.value : aiOutput.innerText;

        if (!contextText.trim() || contextText.includes('Ready for refinement')) {
            greetingDiv.innerText = "Hi! Paste some notes first so we have something to talk about.";
        } else {
            // Grab the first real line of the note to use as the Topic Name
            let firstLine = contextText.split('\n').find(line => line.trim().length > 0 && !line.startsWith('```')) || "";

            // Strip out markdown formatting (like #, *, -) to get the pure text
            let topic = firstLine.replace(/^[#*\-\s:]+|[#*\-\s:]+$/g, '').substring(0, 40).trim();

            // If the first line is just a long sentence instead of a title, fallback to a smart generic greeting
            if (topic.split(' ').length > 7 || topic.length < 3) {
                greetingDiv.innerText = "I've analyzed your document. What specific part would you like to dive into?";
            } else {
                greetingDiv.innerText = `So, what would you like to ask about ${topic}?`;
            }
        }
        chatMessages.appendChild(greetingDiv);
    };

    const toggleChat = () => {
        // Automatically reset the chat and update the greeting ONLY if the user switched to a new note
        const newContextId = lastGeneratedNoteId || userInput.value.substring(0, 20);
        if (currentChatContextId !== newContextId) {
            updateChatGreeting();
            currentChatContextId = newContextId;
        }

        chatSidebar.classList.toggle('open');
        $('workspace').classList.toggle('chat-open');
        if (chatSidebar.classList.contains('open')) chatInput.focus();
    };

    $('chatToggleBtn')?.addEventListener('click', toggleChat);
    $('closeChatBtn')?.addEventListener('click', toggleChat);

    const appendMsg = (text, sender) => {
        const div = document.createElement('div'); div.className = `chat-msg ${sender}`;
        div.innerHTML = sender === 'ai' ? marked.parse(text) : text;
        chatMessages.appendChild(div); chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    };

    const handleChatSend = async () => {
        const msg = chatInput.value.trim(); if (!msg) return;
        appendMsg(msg, 'user'); chatInput.value = '';

        const contextText = aiOutput.innerText.includes('Ready for refinement') ? userInput.value : aiOutput.innerText;

        if (!contextText.trim() || contextText.includes('Ready for refinement')) {
            setTimeout(() => appendMsg("Please paste some text or generate a note first so I know what we are talking about!", 'ai'), 400);
            return;
        }

        const aiDiv = appendMsg("", 'ai');
        aiDiv.classList.add('typing-cursor');
        aiDiv.innerHTML = "Thinking...";

        try {
            const chatPrompt = `You are a helpful study assistant. Use the provided Context to answer the User's Question. Keep your answer concise, conversational, and format it nicely in markdown.\n\nContext:\n${contextText.substring(0, 3000)}\n\nUser Question:\n${msg}`;

            const activePreset = localStorage.getItem("ai_preset") || "summary";
            let systemPromptText = "";
            if (activePreset === "custom") systemPromptText = localStorage.getItem("ai_custom_prompt") || "";
            else systemPromptText = promptPresets[activePreset] || "";

            const res = await apiFetch(`${API_BASE}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_prompt: systemPromptText.trim(),
                    prompt: chatPrompt.trim(),
                    temperature: 0.3
                })
            });

            if (!res.ok) throw new Error("API Error");
            const data = await res.json();

            aiDiv.innerHTML = "";
            await streamText(aiDiv, data.response);

        } catch (err) {
            aiDiv.innerHTML = "Error: " + err.message;
            aiDiv.classList.remove('typing-cursor');
        }
    };

    $('sendChatBtn')?.addEventListener('click', handleChatSend);
    chatInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleChatSend(); });

    // ==========================================
    // FLASHCARD FEATURE
    // ==========================================
    (function () {
        let fcConfig = { count: 10, topic: '', difficulty: 'Intermediate', cardType: 'Mixed' };
        let fcCards = [], fcActiveCards = [], fcCardIdx = 0, fcRevealed = false, fcRatings = {};

        const el = id => document.getElementById(id);

        function fcShowStep(step) {
            ['fcStepConfig', 'fcStepLoading', 'fcStepError'].forEach(s => el(s).classList.add('hidden'));
            el(step).classList.remove('hidden');
        }

        el('flashcardChip').addEventListener('click', () => {
            fcResetConfig();
            el('fcOverlay').classList.remove('hidden');
            fcShowStep('fcStepConfig');
        });

        function fcResetConfig() {
            fcConfig = { count: 10, topic: '', difficulty: 'Intermediate', cardType: 'Mixed' };
            el('fcTopic').value = '';
            el('fcTopicError').classList.add('hidden');
            el('fcTopic').classList.remove('fc-input-error');
            // FIX: Added #fcStepConfig so it doesn't mess with the Quiz Arena buttons!
            document.querySelectorAll('#fcStepConfig .fc-preset-btn').forEach(b => b.classList.toggle('fc-selected', b.dataset.val === '10'));
            document.querySelectorAll('#fcDiffRow .fc-pill-btn').forEach(b => b.classList.toggle('fc-pill-selected', b.dataset.val === 'Intermediate'));
            document.querySelectorAll('#fcTypeRow .fc-pill-btn').forEach(b => b.classList.toggle('fc-pill-selected', b.dataset.val === 'Mixed'));
        }

        // FIX: Scoped click listener to Flashcard setup only
        document.querySelectorAll('#fcStepConfig .fc-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#fcStepConfig .fc-preset-btn').forEach(b => b.classList.remove('fc-selected'));
                btn.classList.add('fc-selected');
                fcConfig.count = parseInt(btn.dataset.val);
            });
        });

        document.querySelectorAll('#fcDiffRow .fc-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#fcDiffRow .fc-pill-btn').forEach(b => b.classList.remove('fc-pill-selected'));
                btn.classList.add('fc-pill-selected');
                fcConfig.difficulty = btn.dataset.val;
            });
        });

        document.querySelectorAll('#fcTypeRow .fc-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#fcTypeRow .fc-pill-btn').forEach(b => b.classList.remove('fc-pill-selected'));
                btn.classList.add('fc-pill-selected');
                fcConfig.cardType = btn.dataset.val;
            });
        });

        el('fcCancelBtn').addEventListener('click', () => el('fcOverlay').classList.add('hidden'));

        el('fcGenerateBtn').addEventListener('click', fcGenerate);
        el('fcTopic').addEventListener('keydown', e => { if (e.key === 'Enter') fcGenerate(); });
        el('fcRetryBtn').addEventListener('click', fcGenerate);
        el('fcBackBtn').addEventListener('click', () => fcShowStep('fcStepConfig'));

        async function fcGenerate() {
            // FIX: Ensure it only reads the Flashcard preset button, not the Quiz Arena one
            const selectedPreset = document.querySelector('#fcStepConfig .fc-preset-btn.fc-selected');
            if (selectedPreset) fcConfig.count = parseInt(selectedPreset.dataset.val);

            fcConfig.topic = el('fcTopic').value.trim();
            if (!fcConfig.topic) {
                el('fcTopicError').classList.remove('hidden');
                el('fcTopic').classList.add('fc-input-error');
                return;
            }
            el('fcTopicError').classList.add('hidden');
            el('fcTopic').classList.remove('fc-input-error');

            el('fcLoadCount').textContent = fcConfig.count;
            el('fcLoadTopic').textContent = `"${fcConfig.topic}"`;
            fcShowStep('fcStepLoading');

            const prompt = `Generate exactly ${fcConfig.count} flashcards about "${fcConfig.topic}". Difficulty: ${fcConfig.difficulty}. Type: ${fcConfig.cardType}. Respond with ONLY a valid JSON array. Each item must have: "question", "answer", "explanation", "hint". Keep questions concise. Answers 1-3 sentences. No markdown, no extra text.`;

            try {
                const res = await apiFetch(`${API_BASE}/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt, max_tokens: fcConfig.count <= 10 ? 2000 : fcConfig.count <= 20 ? 4000 : 6000
                    })
                });
                if (!res.ok) throw new Error("Backend error");
                const data = await res.json();
                const raw = data.response.replace(/```json|```/g, '').trim();
                fcCards = JSON.parse(raw).map((c, i) => ({ ...c, id: i }));
                el('fcOverlay').classList.add('hidden');
                fcShowReview();
            } catch (e) {
                el('fcErrorMsg').textContent = "Generation failed. Please try again.";
                fcShowStep('fcStepError');
            }
        }

        function fcShowReview() {
            el('fcReviewMeta').textContent = `${fcCards.length} cards · ${fcConfig.topic} · ${fcConfig.difficulty}`;
            fcRenderCardList();
            el('fcReviewScreen').classList.remove('hidden');
        }

        function fcRenderCardList() {
            const list = el('fcCardList');
            list.innerHTML = '';
            fcCards.forEach((card, idx) => {
                const row = document.createElement('div');
                row.className = 'fc-card-row';
                row.innerHTML = `
                <span class="fc-card-num">#${idx + 1}</span>
                <div class="fc-card-content">
                    <div class="fc-card-question">${card.question}</div>
                    <div class="fc-card-answer-preview">${card.answer}</div>
                </div>
                <button class="fc-edit-btn" data-idx="${idx}" title="Edit">✎</button>`;
                list.appendChild(row);
            });

            list.querySelectorAll('.fc-edit-btn').forEach(btn => {
                btn.addEventListener('click', () => fcOpenEdit(parseInt(btn.dataset.idx)));
            });
        }

        function fcOpenEdit(idx) {
            const list = el('fcCardList');
            const rows = list.querySelectorAll('.fc-card-row');
            const row = rows[idx];
            row.classList.add('fc-editing');
            row.innerHTML = `
            <span class="fc-card-num">#${idx + 1}</span>
            <div class="fc-card-content">
                <div class="fc-edit-form">
                    <textarea id="fcEditQ" rows="2">${fcCards[idx].question}</textarea>
                    <textarea id="fcEditA" rows="2">${fcCards[idx].answer}</textarea>
                    <div class="fc-edit-actions">
                        <button class="fc-btn fc-btn-primary fc-btn-sm" id="fcSaveEdit">Save</button>
                        <button class="fc-btn fc-btn-ghost fc-btn-sm" id="fcCancelEdit">Cancel</button>
                    </div>
                </div>
            </div>`;
            el('fcSaveEdit').addEventListener('click', () => {
                fcCards[idx].question = el('fcEditQ').value.trim();
                fcCards[idx].answer = el('fcEditA').value.trim();
                fcRenderCardList();
            });
            el('fcCancelEdit').addEventListener('click', () => fcRenderCardList());

            [el('fcEditQ'), el('fcEditA')].forEach(textarea => {
                textarea.addEventListener('keydown', e => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        fcRenderCardList();
                    }
                });
            });
        }

        el('fcRegenBtn').addEventListener('click', () => {
            el('fcReviewScreen').classList.add('hidden');
            el('fcOverlay').classList.remove('hidden');
            fcShowStep('fcStepLoading');
            fcGenerate();
        });

        el('fcStartBtn').addEventListener('click', () => fcStartMode(fcCards));

        el('fcSaveBtn').addEventListener('click', async () => {
            try {
                const res = await apiFetch(`${API_BASE}/flashcards`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        topic: fcConfig.topic,
                        difficulty: fcConfig.difficulty,
                        cards: fcCards
                    })
                });
                if (!res.ok) throw new Error();
                showToast('Deck saved!');
            } catch {
                showToast('Failed to save deck');
            }
        });

        el('fcViewSavedBtn').addEventListener('click', () => {
            el('fcOverlay').classList.add('hidden');
            fcRenderSavedDecks();
            el('fcSavedScreen').classList.remove('hidden');
        });

        el('fcSavedCloseBtn').addEventListener('click', () => {
            el('fcSavedScreen').classList.add('hidden');
            el('fcOverlay').classList.remove('hidden');
            fcShowStep('fcStepConfig');
        });

        async function fcRenderSavedDecks() {
            const list = el('fcSavedList');
            list.innerHTML = '<div class="fc-empty-saved">Loading...</div>';

            try {
                const res = await apiFetch(`${API_BASE}/flashcards`);
                if (!res.ok) throw new Error();
                const decks = await res.json();

                list.innerHTML = '';
                if (decks.length === 0) {
                    list.innerHTML = '<div class="fc-empty-saved">No saved decks yet.</div>';
                    return;
                }

                decks.forEach(deck => {
                    const row = document.createElement('div');
                    row.className = 'fc-saved-row';
                    row.innerHTML = `
                        <div class="fc-saved-info" data-id="${deck.id}">
                            <span class="fc-saved-label">${deck.count} cards · ${deck.topic} · ${deck.difficulty}</span>
                            <span class="fc-saved-date">${new Date(deck.saved_at).toLocaleDateString()}</span>
                        </div>
                        <button class="fc-delete-deck" data-id="${deck.id}" title="Delete">✕</button>`;

                    row.querySelector('.fc-saved-info').addEventListener('click', () => {
                        fcCards = deck.cards.map((c, i) => ({ ...c, id: i }));
                        fcConfig.topic = deck.topic;
                        fcConfig.difficulty = deck.difficulty;
                        fcConfig.count = deck.count;
                        el('fcSavedScreen').classList.add('hidden');
                        fcShowReview();
                    });

                    row.querySelector('.fc-delete-deck').addEventListener('click', async () => {
                        try {
                            const r = await apiFetch(`${API_BASE}/flashcards/${deck.id}`, { method: "DELETE" });
                            if (!r.ok) throw new Error();
                            showToast('Deck deleted');
                            fcRenderSavedDecks();
                        } catch {
                            showToast('Failed to delete deck');
                        }
                    });

                    list.appendChild(row);
                });
            } catch {
                list.innerHTML = '<div class="fc-empty-saved">Failed to load decks.</div>';
            }
        }

        function fcStartMode(deck) {
            fcActiveCards = deck;
            fcCardIdx = 0;
            fcRevealed = false;
            fcRatings = {};
            el('fcReviewScreen').classList.add('hidden');
            el('fcSummaryScreen').classList.add('hidden');
            el('fcModeScreen').classList.remove('hidden');
            fcRenderCard();
        }

        function fcRenderCard() {
            const card = fcActiveCards[fcCardIdx];
            const total = fcActiveCards.length;

            el('fcTopicLabel').textContent = fcConfig.topic;
            el('fcProgressText').textContent = `Card ${fcCardIdx + 1} of ${total}`;
            el('fcProgressFill').style.width = `${((fcCardIdx + 1) / total) * 100}%`;

            el('fcCardQ').textContent = card.question;
            el('fcPrevBtn').disabled = fcCardIdx === 0;
            el('fcNextBtn').textContent = fcCardIdx === total - 1 ? 'Finish' : 'Next →';
            el('fcShowBtn').classList.remove('hidden');
            el('fcAnswerBlock').classList.add('hidden');
            el('fcRightEmpty').classList.remove('hidden');

            document.querySelectorAll('#fcPanes .fc-rating-btn').forEach(b => b.classList.remove('fc-rated'));
            if (fcRatings[fcCardIdx]) {
                document.querySelectorAll('#fcPanes .fc-rating-btn').forEach(b => {
                    if (b.dataset.rating === fcRatings[fcCardIdx]) b.classList.add('fc-rated');
                });
            }

            el('fcMobileCard').textContent = card.question;
            el('fcMobileShowBtn').classList.remove('hidden');
            el('fcMobileAnswer').classList.add('hidden');
            el('fcMobileRating').style.display = 'none';
            el('fcMobilePrev').disabled = fcCardIdx === 0;
            el('fcMobileNext').textContent = fcCardIdx === total - 1 ? 'Finish' : 'Next →';
        }

        el('fcShowBtn').addEventListener('click', () => {
            fcRevealed = true;
            const card = fcActiveCards[fcCardIdx];
            el('fcShowBtn').classList.add('hidden');
            el('fcRightEmpty').classList.add('hidden');
            el('fcAnswerBlock').classList.remove('hidden');
            el('fcAnswerText').textContent = card.answer;
            el('fcExplText').textContent = card.explanation || '';
            el('fcExplSection').style.display = card.explanation ? 'block' : 'none';
            el('fcHintText').textContent = card.hint ? '💡 ' + card.hint : '';
            el('fcHintSection').style.display = card.hint ? 'block' : 'none';
        });

        el('fcMobileShowBtn').addEventListener('click', () => {
            const card = fcActiveCards[fcCardIdx];
            el('fcMobileShowBtn').classList.add('hidden');
            el('fcMobileAnswer').textContent = card.answer;
            el('fcMobileAnswer').classList.remove('hidden');
            el('fcMobileRating').style.display = 'flex';
        });

        document.querySelectorAll('#fcPanes .fc-rating-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                fcRatings[fcCardIdx] = btn.dataset.rating;
                document.querySelectorAll('#fcPanes .fc-rating-btn').forEach(b => b.classList.remove('fc-rated'));
                btn.classList.add('fc-rated');
            });
        });

        document.querySelectorAll('#fcMobileRating .fc-rating-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                fcRatings[fcCardIdx] = btn.dataset.rating;
                document.querySelectorAll('#fcMobileRating .fc-rating-btn').forEach(b => b.classList.remove('fc-rated'));
                btn.classList.add('fc-rated');
            });
        });

        el('fcPrevBtn').addEventListener('click', () => { if (fcCardIdx > 0) { fcCardIdx--; fcRenderCard(); } });
        el('fcNextBtn').addEventListener('click', fcNext);

        el('fcMobilePrev').addEventListener('click', () => { if (fcCardIdx > 0) { fcCardIdx--; fcRenderCard(); } });
        el('fcMobileNext').addEventListener('click', fcNext);

        function fcNext() {
            if (fcCardIdx < fcActiveCards.length - 1) {
                fcCardIdx++;
                fcRenderCard();
            } else {
                fcShowSummary();
            }
        }

        el('fcExitBtn').addEventListener('click', () => fcAskExit());

        function fcAskExit() { el('fcExitOverlay').classList.remove('hidden'); }
        window._fcAskExit = fcAskExit;
        window._fcShowStep = fcShowStep;
        window._loadDeckFromSidebar = (cards, topic, difficulty) => {
            fcCards = cards;
            fcConfig.topic = topic;
            fcConfig.difficulty = difficulty;
            fcConfig.count = cards.length;
            document.getElementById('fcReviewScreen').classList.remove('hidden');
            fcRenderCardList();
            document.getElementById('fcReviewMeta').textContent = `${cards.length} cards · ${topic} · ${difficulty}`;
        };
        el('fcExitCancelBtn').addEventListener('click', () => el('fcExitOverlay').classList.add('hidden'));
        el('fcExitConfirmBtn').addEventListener('click', () => {
            el('fcExitOverlay').classList.add('hidden');
            el('fcModeScreen').classList.add('hidden');
            el('fcReviewScreen').classList.add('hidden');
        });

        document.querySelectorAll('.chip').forEach(chip => {
            if (chip.id === 'flashcardChip') return;
            chip.addEventListener('click', () => {
                if (!el('fcModeScreen').classList.contains('hidden') || !el('fcReviewScreen').classList.contains('hidden')) {
                    fcAskExit();
                }
            });
        });

        const fcGuardedIds = [
            'newNoteBtn', 'historyToggle', 'savedToggle', 'clearHistoryBtn',
            'settingsBtn', 'chatToggleBtn', 'focusBtn',
            'focusSoundBtn', 'pdfBtn', 'processBtn', 'userToggleBtn'
        ];
        fcGuardedIds.forEach(id => {
            const btn = el(id);
            if (!btn) return;
            btn.addEventListener('click', (e) => {
                const inSession = !el('fcModeScreen').classList.contains('hidden') ||
                    !el('fcReviewScreen').classList.contains('hidden');
                if (inSession) {
                    e.stopImmediatePropagation();
                    fcAskExit();
                }
            }, true);
        });

        function fcShowSummary() {
            el('fcModeScreen').classList.add('hidden');
            const got = Object.values(fcRatings).filter(r => r === 'got').length;
            const almost = Object.values(fcRatings).filter(r => r === 'almost').length;
            const missed = Object.values(fcRatings).filter(r => r === 'missed').length;
            el('fcGotNum').textContent = got;
            el('fcAlmostNum').textContent = almost;
            el('fcMissedNum').textContent = missed;
            el('fcSummarySub').textContent = `${fcConfig.topic} · ${fcActiveCards.length} cards reviewed`;
            const reviewMissedBtn = el('fcReviewMissedBtn');
            if (missed > 0) {
                reviewMissedBtn.classList.remove('hidden');
                reviewMissedBtn.textContent = `Review ${missed} Missed Card${missed !== 1 ? 's' : ''}`;
            } else {
                reviewMissedBtn.classList.add('hidden');
            }
            el('fcSummaryScreen').classList.remove('hidden');
        }

        el('fcReviewMissedBtn').addEventListener('click', () => {
            const missed = fcCards.filter((_, i) => fcRatings[i] === 'missed');
            el('fcSummaryScreen').classList.add('hidden');
            fcStartMode(missed);
        });

        el('fcRestartBtn').addEventListener('click', () => {
            el('fcSummaryScreen').classList.add('hidden');
            fcStartMode(fcCards);
        });

        el('fcSummaryExitBtn').addEventListener('click', () => {
            el('fcSummaryScreen').classList.add('hidden');
        });

    })();

    // ==========================================
    // QUIZ ARENA (EXAM SIMULATOR)
    // ==========================================
    (function () {
        const el = id => document.getElementById(id);
        let currentQuizData = [];
        let userAnswers = [];
        let quizTimerInterval = null;
        let timeRemaining = 0; // in seconds
        let totalTime = 0;

        let quizConfig = { count: 5, difficulty: 'Intermediate', timeLimit: 0 };

        // Handle Configuration Selections
        const setupRowSelection = (rowId, configKey, isInt = false) => {
            document.querySelectorAll(`#${rowId} .fc-preset-btn`).forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll(`#${rowId} .fc-preset-btn`).forEach(b => b.classList.remove('fc-selected'));
                    btn.classList.add('fc-selected');
                    quizConfig[configKey] = isInt ? parseInt(btn.dataset.val) : btn.dataset.val;
                });
            });
        };
        setupRowSelection('quizCountRow', 'count', true);
        setupRowSelection('quizDiffRow', 'difficulty', false);
        setupRowSelection('quizTimeRow', 'timeLimit', true);

        // UI Routing
        function showQuizPhase(phaseId) {
            ['quizSetupWrap', 'quizExamWrap'].forEach(id => el(id).style.display = 'none');
            ['quizActive', 'quizResults'].forEach(id => el(id).classList.add('hidden'));

            if (phaseId === 'quizSetup') {
                el('quizSetupWrap').style.display = 'flex';
            } else if (phaseId === 'quizActive') {
                el('quizExamWrap').style.display = 'block';
                el('quizActive').classList.remove('hidden');
            } else if (phaseId === 'quizResults') {
                el('quizExamWrap').style.display = 'block';
                el('quizResults').classList.remove('hidden');
            }
        }

        // Open Arena
        el('quizArenaToggle')?.addEventListener('click', () => {
            el('quizTopic').value = ""; // Default empty encourages "My Note"
            showQuizPhase('quizSetup');
            el('quizScreen').classList.remove('hidden');
        });

        // Close Arena
        el('closeQuizBtn')?.addEventListener('click', () => {
            clearInterval(quizTimerInterval);
            el('quizScreen').classList.add('hidden');
        });
        el('playAgainQuizBtn')?.addEventListener('click', () => {
            showQuizPhase('quizSetup');
        });

        // Timer Engine
        function formatTime(seconds) {
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        }

        function startTimer() {
            clearInterval(quizTimerInterval);
            const timerEl = el('quizTimerDisplay');
            const timeText = el('quizTimeText');

            if (quizConfig.timeLimit === 0) {
                timeText.textContent = "∞ Untimed";
                timerEl.className = 'quiz-timer safe';
                return;
            }

            totalTime = quizConfig.timeLimit * 60;
            timeRemaining = totalTime;
            timeText.textContent = formatTime(timeRemaining);
            timerEl.className = 'quiz-timer safe';

            quizTimerInterval = setInterval(() => {
                timeRemaining--;
                timeText.textContent = formatTime(timeRemaining);

                if (timeRemaining <= 60 && timeRemaining > 15) timerEl.className = 'quiz-timer warn';
                else if (timeRemaining <= 15) timerEl.className = 'quiz-timer danger';

                if (timeRemaining <= 0) {
                    clearInterval(quizTimerInterval);
                    showToast("⏳ Time's up! Auto-submitting...");
                    gradeQuiz();
                }
            }, 1000);
        }

        // Generate Exam
        el('generateQuizBtn')?.addEventListener('click', async () => {
            const topicInput = el('quizTopic').value.trim();
            const topic = topicInput || (userInput.value ? "the exact content provided in the context" : "General Knowledge");

            const btn = el('generateQuizBtn');
            const origText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Forging Exam...';
            btn.disabled = true;

            const prompt = `Generate a ${quizConfig.count}-question multiple-choice exam about "${topic}". Difficulty should be ${quizConfig.difficulty}. Return ONLY a valid JSON array. Each object must have: "question" (string), "options" (array of exactly 4 strings), "correctIndex" (integer 0-3), and "explanation" (short string). No markdown, no conversational text.`;

            const contextText = (!topicInput || topicInput.toLowerCase() === "my notes") && userInput.value
                ? `\n\nContext Note to Base Exam On:\n${userInput.value.substring(0, 3000)}`
                : "";

            try {
                const res = await apiFetch(`${API_BASE}/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: prompt + contextText,
                        temperature: 0.2
                    })
                });

                if (!res.ok) throw new Error("Backend error");
                const data = await res.json();

                const raw = data.response.replace(/```json|```/g, '').trim();
                currentQuizData = JSON.parse(raw);
                userAnswers = new Array(currentQuizData.length).fill(null);

                el('quizActiveTopic').textContent = topicInput || "Workspace Notes";
                renderQuiz();
                showQuizPhase('quizActive');
                startTimer();

            } catch (err) {
                showToast("Generation failed. Please try again.");
                console.error("Quiz Gen Error:", err);
            } finally {
                btn.innerHTML = origText;
                btn.disabled = false;
            }
        });

        // Render Questions
        function renderQuiz() {
            const container = el('quizQuestionsContainer');
            container.innerHTML = '';

            currentQuizData.forEach((q, qIndex) => {
                const card = document.createElement('div');
                card.className = 'quiz-question-card';

                const qText = document.createElement('div');
                qText.className = 'quiz-q-text';
                qText.textContent = `${qIndex + 1}. ${q.question}`;

                const grid = document.createElement('div');
                grid.className = 'quiz-mcq-grid';

                q.options.forEach((optText, optIndex) => {
                    const optBtn = document.createElement('div');
                    optBtn.className = 'quiz-option';

                    // Add letters A, B, C, D
                    const letter = String.fromCharCode(65 + optIndex);
                    optBtn.innerHTML = `<strong style="color:var(--text-muted); width: 20px;">${letter}.</strong> ${optText}`;

                    optBtn.addEventListener('click', () => {
                        Array.from(grid.children).forEach(c => c.classList.remove('selected'));
                        optBtn.classList.add('selected');
                        userAnswers[qIndex] = optIndex;
                    });

                    grid.appendChild(optBtn);
                });

                card.appendChild(qText);
                card.appendChild(grid);
                container.appendChild(card);
            });
        }

        // Grade Logic
        function gradeQuiz() {
            clearInterval(quizTimerInterval); // Stop the clock

            let score = 0;
            const feedbackContainer = el('quizFeedbackContainer');
            feedbackContainer.innerHTML = '';

            currentQuizData.forEach((q, i) => {
                const isCorrect = userAnswers[i] === q.correctIndex;
                if (isCorrect) score++;

                const feedbackCard = document.createElement('div');
                feedbackCard.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;

                const userAnswerText = userAnswers[i] !== null ? q.options[userAnswers[i]] : "<span style='color:#ef4444'>Skipped (Out of Time)</span>";

                feedbackCard.innerHTML = `
                    <strong>${i + 1}. ${q.question}</strong><br>
                    <span style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-top: 5px;">Your answer: ${userAnswerText}</span>
                    <div style="margin-top: 10px;">
                        ${isCorrect ? '<span style="color:#22c55e"><i class="fa-solid fa-check"></i> Correct!</span>' : `<span style="color:#ef4444"><i class="fa-solid fa-xmark"></i> Incorrect.</span> The right answer was: <strong>${q.options[q.correctIndex]}</strong>`}
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9rem; opacity: 0.9; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px;">
                        <em>💡 ${q.explanation}</em>
                    </div>
                `;
                feedbackContainer.appendChild(feedbackCard);
            });

            const percentage = Math.round((score / currentQuizData.length) * 100);
            el('quizScoreDisplay').textContent = `${percentage}%`;

            if (percentage >= 80) el('quizScoreDisplay').style.color = '#22c55e';
            else if (percentage >= 50) el('quizScoreDisplay').style.color = '#f59e0b';
            else el('quizScoreDisplay').style.color = '#ef4444';

            if (quizConfig.timeLimit > 0) {
                const timeTaken = totalTime - timeRemaining;
                el('quizTimeTakenDisplay').textContent = `Time taken: ${formatTime(timeTaken)}`;
            } else {
                el('quizTimeTakenDisplay').textContent = `Untimed session`;
            }

            showQuizPhase('quizResults');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        el('submitQuizBtn')?.addEventListener('click', () => {
            if (userAnswers.includes(null) && !confirm("You have unanswered questions. Are you sure you want to submit?")) return;
            gradeQuiz();
        });
    })();
});