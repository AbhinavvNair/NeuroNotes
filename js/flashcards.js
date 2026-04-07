import { apiFetch, API_BASE, showToast } from './api.js';

export function initFlashcards() {
    const el = id => document.getElementById(id);

    let fcConfig = { count: 10, topic: '', difficulty: 'Intermediate', cardType: 'Mixed' };
    let fcCards = [], fcActiveCards = [], fcCardIdx = 0, fcRevealed = false, fcRatings = {};

    function fcShowStep(step) {
        ['fcStepConfig', 'fcStepLoading', 'fcStepError'].forEach(s => el(s).classList.add('hidden'));
        el(step).classList.remove('hidden');
    }

    el('flashcardChip')?.addEventListener('click', () => {
        fcResetConfig();
        el('fcOverlay').classList.remove('hidden');
        fcShowStep('fcStepConfig');
    });

    function fcResetConfig() {
        fcConfig = { count: 10, topic: '', difficulty: 'Intermediate', cardType: 'Mixed' };
        if (el('fcTopic')) el('fcTopic').value = '';
        el('fcTopicError')?.classList.add('hidden');
        el('fcTopic')?.classList.remove('fc-input-error');
        document.querySelectorAll('#fcStepConfig .fc-preset-btn').forEach(b => b.classList.toggle('fc-selected', b.dataset.val === '10'));
        document.querySelectorAll('#fcDiffRow .fc-pill-btn').forEach(b => b.classList.toggle('fc-pill-selected', b.dataset.val === 'Intermediate'));
        document.querySelectorAll('#fcTypeRow .fc-pill-btn').forEach(b => b.classList.toggle('fc-pill-selected', b.dataset.val === 'Mixed'));
    }

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

    el('fcCancelBtn')?.addEventListener('click', () => el('fcOverlay').classList.add('hidden'));
    el('fcGenerateBtn')?.addEventListener('click', fcGenerate);
    el('fcTopic')?.addEventListener('keydown', e => { if (e.key === 'Enter') fcGenerate(); });
    el('fcRetryBtn')?.addEventListener('click', fcGenerate);
    el('fcBackBtn')?.addEventListener('click', () => fcShowStep('fcStepConfig'));

    async function fcGenerate() {
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
                    prompt,
                    max_tokens: fcConfig.count <= 10 ? 2000 : fcConfig.count <= 20 ? 4000 : 6000
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
        const row = list.querySelectorAll('.fc-card-row')[idx];
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
                if (e.key === 'Escape') { e.stopPropagation(); fcRenderCardList(); }
            });
        });
    }

    el('fcRegenBtn')?.addEventListener('click', () => {
        el('fcReviewScreen').classList.add('hidden');
        el('fcOverlay').classList.remove('hidden');
        fcShowStep('fcStepLoading');
        fcGenerate();
    });

    el('fcStartBtn')?.addEventListener('click', () => fcStartMode(fcCards));

    el('fcSaveBtn')?.addEventListener('click', async () => {
        try {
            const res = await apiFetch(`${API_BASE}/flashcards`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: fcConfig.topic, difficulty: fcConfig.difficulty, cards: fcCards })
            });
            if (!res.ok) throw new Error();
            showToast('Deck saved!');
        } catch { showToast('Failed to save deck'); }
    });

    el('fcViewSavedBtn')?.addEventListener('click', () => {
        el('fcOverlay').classList.add('hidden');
        fcRenderSavedDecks();
        el('fcSavedScreen').classList.remove('hidden');
    });

    el('fcSavedCloseBtn')?.addEventListener('click', () => {
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
                    } catch { showToast('Failed to delete deck'); }
                });
                list.appendChild(row);
            });
        } catch { list.innerHTML = '<div class="fc-empty-saved">Failed to load decks.</div>'; }
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

    el('fcShowBtn')?.addEventListener('click', () => {
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

    el('fcMobileShowBtn')?.addEventListener('click', () => {
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

    el('fcPrevBtn')?.addEventListener('click', () => { if (fcCardIdx > 0) { fcCardIdx--; fcRenderCard(); } });
    el('fcNextBtn')?.addEventListener('click', fcNext);
    el('fcMobilePrev')?.addEventListener('click', () => { if (fcCardIdx > 0) { fcCardIdx--; fcRenderCard(); } });
    el('fcMobileNext')?.addEventListener('click', fcNext);

    function fcNext() {
        if (fcCardIdx < fcActiveCards.length - 1) { fcCardIdx++; fcRenderCard(); }
        else fcShowSummary();
    }

    el('fcExitBtn')?.addEventListener('click', () => fcAskExit());

    function fcAskExit() { el('fcExitOverlay').classList.remove('hidden'); }

    // Expose for global keyboard/UI access
    window._fcAskExit = fcAskExit;
    window._fcShowStep = fcShowStep;
    window._loadDeckFromSidebar = (cards, topic, difficulty) => {
        fcCards = cards;
        fcConfig.topic = topic;
        fcConfig.difficulty = difficulty;
        fcConfig.count = cards.length;
        el('fcReviewScreen').classList.remove('hidden');
        fcRenderCardList();
        el('fcReviewMeta').textContent = `${cards.length} cards · ${topic} · ${difficulty}`;
    };

    el('fcExitCancelBtn')?.addEventListener('click', () => el('fcExitOverlay').classList.add('hidden'));
    el('fcExitConfirmBtn')?.addEventListener('click', () => {
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
            if (inSession) { e.stopImmediatePropagation(); fcAskExit(); }
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

    el('fcReviewMissedBtn')?.addEventListener('click', () => {
        const missed = fcCards.filter((_, i) => fcRatings[i] === 'missed');
        el('fcSummaryScreen').classList.add('hidden');
        fcStartMode(missed);
    });

    el('fcRestartBtn')?.addEventListener('click', () => {
        el('fcSummaryScreen').classList.add('hidden');
        fcStartMode(fcCards);
    });

    el('fcSummaryExitBtn')?.addEventListener('click', () => el('fcSummaryScreen').classList.add('hidden'));
}
