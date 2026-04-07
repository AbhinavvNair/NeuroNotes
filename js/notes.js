import { apiFetch, API_BASE, showToast } from './api.js';
import { state } from './state.js';
import { enableLiveCode } from './code.js';
import { renderMermaidDiagrams } from './diagrams.js';

export async function loadNotes(search = "") {
    try {
        const url = search
            ? `${API_BASE}/notes?search=${encodeURIComponent(search)}`
            : `${API_BASE}/notes`;
        const res = await apiFetch(url);
        if (!res.ok) throw new Error("Fetch failed");
        const notes = await res.json();

        state.historyNotes = notes.filter(n => !n.is_bookmarked);
        state.savedNotesData = notes.filter(n => n.is_bookmarked);

        renderList(document.getElementById('historyList'), state.historyNotes.slice(0, state.historyDisplayCount), false);
        renderList(document.getElementById('savedList'), state.savedNotesData, true);

        if (state.historyNotes.length > state.historyDisplayCount) {
            const btn = document.createElement('div');
            btn.className = "list-item";
            btn.style = "text-align:center; font-weight:600; color:var(--primary);";
            btn.textContent = "Show More";
            btn.onclick = () => { state.historyDisplayCount += 10; loadNotes(search); };
            document.getElementById('historyList').appendChild(btn);
        }
    } catch (e) {
        console.error(e);
        showToast("Could not load notes. Check your connection.");
    }
}

export function renderList(container, notes, isSaved) {
    const userInput = document.getElementById('userInput');
    const aiOutput = document.getElementById('aiOutput');

    container.innerHTML = "";
    notes.forEach(note => {
        const wrap = document.createElement('div');
        wrap.className = "list-item";
        wrap.style.display = "flex";
        wrap.style.justifyContent = "space-between";
        wrap.style.alignItems = "center";
        wrap.style.gap = "4px";

        const title = document.createElement('span');
        title.style.cursor = "pointer";
        title.style.flex = "1";
        title.style.overflow = "hidden";
        title.style.textOverflow = "ellipsis";
        title.style.whiteSpace = "nowrap";
        title.textContent = note.title || note.content.substring(0, 25);
        title.onclick = () => {
            userInput.value = note.title || "";
            aiOutput.innerHTML = marked.parse(note.content);
            aiOutput.classList.remove("empty-state");
            state.currentRawResponse = note.content;
            state.lastGeneratedNoteId = note.id;
            enableLiveCode();
            renderMermaidDiagrams();
        };

        const actions = document.createElement('div');
        actions.style.display = "flex";
        actions.style.gap = "2px";
        actions.style.flexShrink = "0";

        if (!isSaved) {
            const renameBtn = document.createElement('button');
            renameBtn.className = "hover-action";
            renameBtn.style = "background:transparent; border:none; cursor:pointer; color:#a5b4fc;";
            renameBtn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
            renameBtn.title = "Rename";
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.value = title.textContent;
                input.style = "flex:1; background:var(--bg-input, var(--bg-panel)); border:1px solid var(--border); border-radius:6px; color:var(--text-main); padding:2px 6px; font-size:0.85rem; width:100%; min-width:0;";
                wrap.replaceChild(input, title);
                renameBtn.style.display = 'none';
                input.focus(); input.select();
                const commit = async () => {
                    const newTitle = input.value.trim();
                    if (newTitle && newTitle !== note.title) {
                        try {
                            const r = await apiFetch(`${API_BASE}/notes/${note.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ title: newTitle })
                            });
                            if (!r.ok) throw new Error();
                            note.title = newTitle;
                            showToast("Note renamed");
                        } catch { showToast("Rename failed"); }
                    }
                    title.textContent = note.title || note.content.substring(0, 25);
                    wrap.replaceChild(title, input);
                    renameBtn.style.display = '';
                };
                input.addEventListener('blur', commit);
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') input.blur();
                    if (e.key === 'Escape') { input.value = note.title || ""; input.blur(); }
                });
            };
            actions.appendChild(renameBtn);
        }

        const btn = document.createElement('button');
        btn.className = isSaved ? "hover-action" : "delete-btn hover-action";
        btn.style = `background:transparent; border:none; cursor:pointer; color: ${isSaved ? '#818cf8' : '#ef4444'}`;
        btn.innerHTML = isSaved ? `<i class="fa-solid fa-bookmark"></i>` : `<i class="fa-solid fa-xmark"></i>`;
        btn.onclick = async (e) => {
            e.stopPropagation();
            isSaved ? handleBookmark(note.id, true) : showDeleteModal(note.id);
        };

        actions.appendChild(btn);
        wrap.append(title, actions);
        container.appendChild(wrap);
    });
}

export async function handleBookmark(id, isRemoving = false) {
    if (!id) return showToast("No note selected");
    try {
        const r = await apiFetch(`${API_BASE}/notes/${id}/bookmark`, { method: "PATCH" });
        if (!r.ok) throw new Error();
        await loadNotes();
        showToast(isRemoving ? "Removed bookmark" : "Saved note");
    } catch { showToast("Bookmark failed"); }
}

export function showDeleteModal(id) {
    document.dispatchEvent(new CustomEvent('ui:showDeleteConfirm', {
        detail: {
            title: "Delete Note?",
            msg: "This note will be permanently deleted.",
            onConfirm: async () => {
                try {
                    await apiFetch(`${API_BASE}/notes/${id}`, { method: "DELETE" });
                    await loadNotes();
                    showToast("Note deleted");
                } catch { showToast("Delete failed"); }
            }
        }
    }));
}

export async function renderSavedDecksSidebar() {
    const list = document.getElementById('savedDecksList');
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
            row.className = "list-item";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";

            const label = document.createElement('span');
            label.style.cursor = "pointer";
            label.textContent = `${deck.count} · ${deck.topic}`;
            label.onclick = () => {
                const fcCardsLoaded = deck.cards.map((c, i) => ({ ...c, id: i }));
                document.getElementById('fcSavedScreen')?.classList.add('hidden');
                window.scrollTo(0, 0);
                window._loadDeckFromSidebar?.(fcCardsLoaded, deck.topic, deck.difficulty);
                list.style.display = 'none';
            };

            const del = document.createElement('button');
            del.className = "hover-action";
            del.style.background = "transparent";
            del.style.border = "none";
            del.style.cursor = "pointer";
            del.style.color = "#ef4444";
            del.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
            del.onclick = async (e) => {
                e.stopPropagation();
                const r = await apiFetch(`${API_BASE}/flashcards/${deck.id}`, { method: "DELETE" });
                if (!r.ok) return showToast("Delete failed");
                showToast("Deck deleted");
                renderSavedDecksSidebar();
            };

            row.append(label, del);
            list.appendChild(row);
        });
    } catch (e) { list.innerHTML = '<div class="list-item">Failed to load decks</div>'; }
}
