const speechParams = { speeds: [1, 1.5, 2], index: 0, utterance: null };

const targetAccents = [
    { id: 'en-US', label: '🇺🇸 American (US)' },
    { id: 'en-GB', label: '🇬🇧 British (UK)' },
    { id: 'en-AU', label: '🇦🇺 Australian (AU)' },
    { id: 'en-IN', label: '🇮🇳 Indian (IN)' }
];

function populateVoices() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return setTimeout(populateVoices, 200);
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;

    voiceSelect.innerHTML = '';

    targetAccents.forEach(accent => {
        const matches = voices.filter(v => v.lang.replace('_', '-').includes(accent.id));
        if (matches.length > 0) {
            let bestMatch = matches.find(v =>
                v.name.includes('Google') || v.name.includes('Premium') ||
                v.name.includes('Natural') || v.name.includes('Siri')
            ) || matches[0];

            const opt = document.createElement('option');
            opt.value = bestMatch.name;
            opt.textContent = accent.label;
            voiceSelect.appendChild(opt);
        }
    });

    if (voiceSelect.options.length === 0 && voices.length > 0) {
        const opt = document.createElement('option');
        opt.value = voices[0].name;
        opt.textContent = '🤖 Default System Voice';
        voiceSelect.appendChild(opt);
    }
}

export function getSelectedVoice() {
    const voiceSelect = document.getElementById('voiceSelect');
    return window.speechSynthesis.getVoices().find(v => v.name === voiceSelect?.value);
}

export function initTTS() {
    window.speechSynthesis.cancel();
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;

    document.getElementById('playAudioBtn')?.addEventListener('click', () => {
        if (speechSynthesis.paused) {
            speechSynthesis.resume();
            document.getElementById('playAudioBtn').innerHTML = '<i class="fa-solid fa-pause"></i>';
            return;
        }
        if (speechSynthesis.speaking) {
            speechSynthesis.pause();
            document.getElementById('playAudioBtn').innerHTML = '<i class="fa-solid fa-play"></i>';
            return;
        }
        const aiOutput = document.getElementById('aiOutput');
        const userInput = document.getElementById('userInput');
        const t = window.getSelection().toString() || aiOutput.innerText || userInput.value;
        if (!t || t.includes("Ready")) return;

        speechSynthesis.cancel();
        speechParams.utterance = new SpeechSynthesisUtterance(t);
        const selVoice = getSelectedVoice();
        if (selVoice) speechParams.utterance.voice = selVoice;
        speechParams.utterance.rate = speechParams.speeds[speechParams.index];
        speechParams.utterance.onend = () => {
            document.getElementById('playAudioBtn').innerHTML = '<i class="fa-solid fa-play"></i>';
        };
        speechSynthesis.speak(speechParams.utterance);
        document.getElementById('playAudioBtn').innerHTML = '<i class="fa-solid fa-pause"></i>';
    });

    document.getElementById('stopAudioBtn')?.addEventListener('click', () => {
        speechSynthesis.cancel();
        document.getElementById('playAudioBtn').innerHTML = '<i class="fa-solid fa-play"></i>';
    });

    document.getElementById('speedBtn')?.addEventListener('click', () => {
        speechParams.index = (speechParams.index + 1) % speechParams.speeds.length;
        document.getElementById('speedBtn').innerText = speechParams.speeds[speechParams.index] + 'x';
    });
}
