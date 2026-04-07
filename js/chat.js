import { apiFetch, API_BASE, showToast, streamText } from './api.js';
import { state } from './state.js';

let currentChatContextId = null;

function appendMsg(text, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-msg ${sender}`;
    div.innerHTML = sender === 'ai' ? marked.parse(text) : text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

function updateChatGreeting() {
    const chatMessages = document.getElementById('chatMessages');
    const aiOutput = document.getElementById('aiOutput');
    const userInput = document.getElementById('userInput');

    chatMessages.innerHTML = '';
    const greetingDiv = document.createElement('div');
    greetingDiv.className = 'chat-msg ai';

    const contextText = aiOutput.innerText.includes('Ready for refinement')
        ? userInput.value
        : aiOutput.innerText;

    if (!contextText.trim() || contextText.includes('Ready for refinement')) {
        greetingDiv.innerText = "Hi! Paste some notes first so we have something to talk about.";
    } else {
        let firstLine = contextText.split('\n').find(line => line.trim().length > 0 && !line.startsWith('```')) || "";
        let topic = firstLine.replace(/^[#*\-\s:]+|[#*\-\s:]+$/g, '').substring(0, 40).trim();
        if (topic.split(' ').length > 7 || topic.length < 3) {
            greetingDiv.innerText = "I've analyzed your document. What specific part would you like to dive into?";
        } else {
            greetingDiv.innerText = `So, what would you like to ask about ${topic}?`;
        }
    }
    chatMessages.appendChild(greetingDiv);
}

function toggleChat() {
    const chatSidebar = document.getElementById('chatSidebar');
    const workspace = document.getElementById('workspace');
    const chatInput = document.getElementById('chatInput');

    const newContextId = state.lastGeneratedNoteId || document.getElementById('userInput').value.substring(0, 20);
    if (currentChatContextId !== newContextId) {
        updateChatGreeting();
        currentChatContextId = newContextId;
    }

    chatSidebar.classList.toggle('open');
    workspace.classList.toggle('chat-open');
    if (chatSidebar.classList.contains('open')) chatInput.focus();
}

async function handleChatSend() {
    const chatInput = document.getElementById('chatInput');
    const aiOutput = document.getElementById('aiOutput');
    const userInput = document.getElementById('userInput');
    const msg = chatInput.value.trim();
    if (!msg) return;

    appendMsg(msg, 'user');
    chatInput.value = '';

    const contextText = aiOutput.innerText.includes('Ready for refinement')
        ? userInput.value
        : aiOutput.innerText;

    if (!contextText.trim() || contextText.includes('Ready for refinement')) {
        setTimeout(() => appendMsg("Please paste some text or generate a note first so I know what we are talking about!", 'ai'), 400);
        return;
    }

    const aiDiv = appendMsg("", 'ai');
    aiDiv.classList.add('typing-cursor');
    aiDiv.innerHTML = "Thinking...";

    try {
        const res = await apiFetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: msg,
                context: contextText.substring(0, 3000),
                temperature: 0.3,
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
}

export function initChat() {
    document.getElementById('chatToggleBtn')?.addEventListener('click', toggleChat);
    document.getElementById('closeChatBtn')?.addEventListener('click', toggleChat);
    document.getElementById('sendChatBtn')?.addEventListener('click', handleChatSend);
    document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleChatSend();
    });

    // Expose toggleChat so ui.js can call it for Escape handling
    window._toggleChat = toggleChat;
}
