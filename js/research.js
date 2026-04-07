import { apiFetch, API_BASE, showToast, streamText } from './api.js';
import { renderMermaidDiagrams } from './diagrams.js';

let drTopic = "";
let drConversation = [];
let drDocumentMarkdown = "";

function buildResearchSystemPrompt(isDeep) {
    const depthInstructions = isDeep
        ? "Go deep: explain mechanisms, trade-offs, edge cases, assumptions, and implementation strategy in detail."
        : "Keep strong detail but prioritize clarity and concise structure over extreme depth.";

    return `You are a senior research analyst and expert educator.

Task:
- Produce a thorough, beginner-to-advanced explanation for the user's topic.
- ${depthInstructions}
- Use clean markdown with meaningful headings.
- If the topic involves math/science, include formulas with inline math ($...$) or block math ($$...$$) when useful.
- If comparison helps, include a compact markdown table.
- Avoid fluff, hype, and generic filler.

Required structure:
1. Executive Summary (4-6 bullets)
2. Core Concepts Explained Clearly
3. How It Works (step-by-step)
4. Real-World Applications
5. Advantages, Risks, and Limitations
6. Common Misconceptions (with corrections)
7. Practical Action Plan (what to do next)
8. 5 Challenging Self-Test Questions

Writing style:
- Explain like a great teacher.
- Define technical terms before using them heavily.
- Use examples and analogies where appropriate.
- Keep each section informative and substantial.`;
}

async function executeResearch() {
    const drInput = document.getElementById('drInput');
    const drHome = document.getElementById('drHome');
    const drResults = document.getElementById('drResults');
    const drOutput = document.getElementById('drOutput');
    const drQueryTitle = document.getElementById('drQueryTitle');
    const drBadge = document.getElementById('drBadge');
    const drCheckbox = document.getElementById('drCheckbox');
    const drFollowupPanel = document.getElementById('drFollowupPanel');
    const drFollowupInput = document.getElementById('drFollowupInput');

    const query = drInput.value.trim();
    if (!query) return;

    drTopic = query;
    drConversation = [];
    drDocumentMarkdown = "";
    drFollowupPanel?.classList.add('hidden');

    drHome.classList.add('hidden');
    drResults.classList.remove('hidden');
    drQueryTitle.innerText = query;
    drBadge.style.display = drCheckbox.checked ? 'flex' : 'none';

    drOutput.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; color:var(--primary); font-weight:600; font-size:1.1rem; margin-top:20px;">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <span>Building a deep analysis...</span>
        </div>`;

    try {
        const isDeep = drCheckbox.checked;
        const res = await apiFetch(`${API_BASE}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_prompt: buildResearchSystemPrompt(isDeep),
                prompt: query,
                max_tokens: isDeep ? 5000 : 3200,
                temperature: 0.35,
            })
        });

        if (!res.ok) throw new Error("Research request failed");
        const data = await res.json();

        drOutput.innerHTML = "";
        await streamText(drOutput, data.response, () => {
            if (window.renderMathInElement) {
                renderMathInElement(drOutput, {
                    delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }]
                });
            }
            renderMermaidDiagrams(drOutput);
        });

        drDocumentMarkdown = data.response;
        drConversation.push({ question: query, answer: data.response });
        drFollowupPanel?.classList.remove('hidden');
        if (drFollowupInput) drFollowupInput.value = '';
        showToast("Research ready");
    } catch (e) {
        drOutput.innerHTML = `<div style="color:#ef4444; font-weight:600; margin-top:16px;">Failed to generate deep research. Please try again.</div>`;
        showToast(e.message || "Research failed");
    }
}

async function executeResearchFollowup() {
    const drFollowupInput = document.getElementById('drFollowupInput');
    const drFollowupSubmit = document.getElementById('drFollowupSubmit');
    const drOutput = document.getElementById('drOutput');
    const drCheckbox = document.getElementById('drCheckbox');

    const followup = drFollowupInput?.value.trim();
    if (!followup || !drTopic) return;

    drFollowupSubmit.disabled = true;
    drFollowupSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    const contextWindow = drConversation.slice(-3)
        .map((turn, idx) => `Turn ${idx + 1}\nUser: ${turn.question}\nAssistant: ${turn.answer}`)
        .join("\n\n");

    const followupPrompt = `Original topic: ${drTopic}\n\nConversation so far:\n${contextWindow}\n\nFollow-up question: ${followup}\n\nAnswer the follow-up in depth while staying consistent with prior analysis. Use markdown headings and concrete examples.`;

    try {
        const res = await apiFetch(`${API_BASE}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_prompt: buildResearchSystemPrompt(drCheckbox.checked),
                prompt: followupPrompt,
                max_tokens: drCheckbox.checked ? 3200 : 2200,
                temperature: 0.35,
            })
        });

        if (!res.ok) throw new Error("Follow-up request failed");
        const data = await res.json();

        const followupBlock = `\n\n---\n\n### Follow-up Question\n${followup}\n\n### Follow-up Answer\n${data.response}`;
        const merged = drDocumentMarkdown + followupBlock;

        drOutput.innerHTML = marked.parse(merged);
        if (window.renderMathInElement) {
            renderMathInElement(drOutput, {
                delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }]
            });
        }

        drConversation.push({ question: followup, answer: data.response });
        drDocumentMarkdown = merged;
        drFollowupInput.value = '';
        drOutput.scrollTop = drOutput.scrollHeight;
        showToast("Follow-up answered");
    } catch (e) {
        showToast(e.message || "Follow-up failed");
    } finally {
        drFollowupSubmit.disabled = false;
        drFollowupSubmit.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    }
}

export function initResearch() {
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
    }

    document.querySelectorAll('.dr-card').forEach(card => {
        card.addEventListener('click', () => {
            document.getElementById('drInput').value = card.querySelector('p').innerText;
            executeResearch();
        });
    });

    document.getElementById('drSubmit')?.addEventListener('click', executeResearch);
    document.getElementById('drInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') executeResearch(); });
    document.getElementById('drFollowupSubmit')?.addEventListener('click', executeResearchFollowup);
    document.getElementById('drFollowupInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') executeResearchFollowup();
    });

    document.getElementById('drNewSearchBtn')?.addEventListener('click', () => {
        const drResults = document.getElementById('drResults');
        const drHome = document.getElementById('drHome');
        const drInput = document.getElementById('drInput');
        const drOutput = document.getElementById('drOutput');
        const drFollowupPanel = document.getElementById('drFollowupPanel');
        const drFollowupInput = document.getElementById('drFollowupInput');

        drResults.classList.add('hidden');
        drHome.classList.remove('hidden');
        drInput.value = '';
        drOutput.innerHTML = '';
        drTopic = "";
        drConversation = [];
        drDocumentMarkdown = "";
        if (drFollowupInput) drFollowupInput.value = '';
        drFollowupPanel?.classList.add('hidden');
        setTimeout(() => drInput.focus(), 100);
    });
}
