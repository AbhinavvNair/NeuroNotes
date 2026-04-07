import { apiFetch, API_BASE, showToast } from './api.js';

async function processFile(file) {
    const userInput = document.getElementById('userInput');
    const supported = /\.(pdf|pptx)$/i.test(file.name);
    const unsupportedMsg = /\.(ppt)$/i.test(file.name)
        ? "Old .ppt is not supported. Convert to .pptx first."
        : /\.(png|jpe?g)$/i.test(file.name)
            ? "Image OCR is not supported. Paste the text manually."
            : `Unsupported file: ${file.name}`;

    if (!supported) return showToast(unsupportedMsg);

    showToast(`Reading ${file.name}...`);

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await apiFetch(`${API_BASE}/upload`, {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json();
            return showToast(err.detail || "Upload failed.");
        }

        const data = await res.json();
        userInput.value = data.text;
        // Trigger word-count update
        userInput.dispatchEvent(new Event('input'));

        showFileChip(file.name);
        showToast(`${file.name} loaded!`);
    } catch (e) {
        showToast("Upload failed. Try again.");
    }
}

function showFileChip(filename) {
    const chips = document.getElementById('fileChips');
    const existing = [...chips.querySelectorAll('.file-chip-name')].find(el => el.textContent === filename);
    if (existing) return; // avoid duplicates

    const chip = document.createElement('div');
    chip.style.cssText = "display:inline-flex; align-items:center; gap:6px; background:var(--bg-panel); border:1px solid var(--border); border-radius:20px; padding:3px 10px; font-size:0.8rem; color:var(--text-muted); margin:2px;";
    chip.innerHTML = `<i class="fa-solid fa-file" style="color:var(--primary)"></i><span class="file-chip-name">${filename}</span><span style="cursor:pointer; opacity:0.6" title="Remove">✕</span>`;
    chip.querySelector('span:last-child').onclick = () => chip.remove();
    chips.appendChild(chip);
}

export function initUpload() {
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    const dropzone = document.getElementById('dropzone');
    const dropOverlay = document.getElementById('dropOverlay');
    const dropText = document.getElementById('dropText');

    // Attach button opens the file picker
    attachBtn?.addEventListener('click', () => fileInput?.click());

    // File picker selection
    fileInput?.addEventListener('change', () => {
        [...(fileInput.files || [])].forEach(processFile);
        fileInput.value = ""; // reset so the same file can be re-selected
    });

    // Drag-and-drop
    dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropOverlay.classList.add('active');
        if (dropText) dropText.textContent = "Drop to analyze";
    });

    dropzone?.addEventListener('dragleave', (e) => {
        if (!dropzone.contains(e.relatedTarget)) {
            dropOverlay.classList.remove('active');
        }
    });

    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropOverlay.classList.remove('active');
        const files = [...(e.dataTransfer?.files || [])];
        if (files.length) files.forEach(processFile);
    });
}
