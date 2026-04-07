import { apiFetch, API_BASE, showToast } from './api.js';

export function initQuiz() {
    const el = id => document.getElementById(id);

    let currentQuizData = [];
    let userAnswers = [];
    let quizTimerInterval = null;
    let timeRemaining = 0;
    let totalTime = 0;
    let quizConfig = { count: 5, difficulty: 'Intermediate', timeLimit: 0 };

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

    function showQuizPhase(phaseId) {
        ['quizSetupWrap', 'quizExamWrap'].forEach(id => { if (el(id)) el(id).style.display = 'none'; });
        ['quizActive', 'quizResults'].forEach(id => { if (el(id)) el(id).classList.add('hidden'); });

        if (phaseId === 'quizSetup') {
            el('quizSetupWrap').style.display = 'flex';
        } else if (phaseId === 'quizActive') {
            el('quizExamWrap').style.display = 'block';
            el('quizActive').classList.remove('hidden');
            const header = document.querySelector('.quiz-active-header');
            if (header) {
                header.style.position = 'relative';
                header.style.background = 'var(--bg-panel)';
                header.style.top = '0';
                header.style.zIndex = '2000';
            }
        } else if (phaseId === 'quizResults') {
            el('quizExamWrap').style.display = 'block';
            el('quizResults').classList.remove('hidden');
        }
    }

    el('quizArenaToggle')?.addEventListener('click', () => {
        el('quizTopic').value = "";
        showQuizPhase('quizSetup');
        el('quizScreen').classList.remove('hidden');
    });

    el('closeQuizBtn')?.addEventListener('click', () => {
        clearInterval(quizTimerInterval);
        el('quizScreen').classList.add('hidden');
    });

    el('playAgainQuizBtn')?.addEventListener('click', () => showQuizPhase('quizSetup'));

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

    el('generateQuizBtn')?.addEventListener('click', async () => {
        const topicInput = el('quizTopic').value.trim();
        const userInput = document.getElementById('userInput');
        const topic = topicInput || (userInput?.value ? "the exact content provided in the context" : "General Knowledge");

        const btn = el('generateQuizBtn');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Forging Exam...';
        btn.disabled = true;

        const prompt = `Generate a ${quizConfig.count}-question multiple-choice exam about "${topic}". Difficulty should be ${quizConfig.difficulty}. Return ONLY a valid JSON array. Each object must have: "question" (string), "options" (array of exactly 4 strings), "correctIndex" (integer 0-3), and "explanation" (short string). No markdown, no conversational text.`;
        const contextText = (!topicInput || topicInput.toLowerCase() === "my notes") && userInput?.value
            ? `\n\nContext Note to Base Exam On:\n${userInput.value.substring(0, 3000)}`
            : "";

        try {
            const res = await apiFetch(`${API_BASE}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: prompt + contextText, temperature: 0.2 })
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

    function gradeQuiz() {
        clearInterval(quizTimerInterval);
        let score = 0;
        const feedbackContainer = el('quizFeedbackContainer');
        feedbackContainer.innerHTML = '';

        currentQuizData.forEach((q, i) => {
            const isCorrect = userAnswers[i] === q.correctIndex;
            if (isCorrect) score++;
            const feedbackCard = document.createElement('div');
            feedbackCard.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
            const userAnswerText = userAnswers[i] !== null
                ? q.options[userAnswers[i]]
                : "<span style='color:#ef4444; font-weight: bold;'>Skipped (No Answer)</span>";
            feedbackCard.innerHTML = `
                <strong>${i + 1}. ${q.question}</strong><br>
                <span style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-top: 5px;">Your answer: ${userAnswerText}</span>
                <div style="margin-top: 10px;">
                    ${isCorrect
                        ? '<span style="color:#22c55e"><i class="fa-solid fa-check"></i> Correct!</span>'
                        : `<span style="color:#ef4444"><i class="fa-solid fa-xmark"></i> Incorrect.</span> The right answer was: <strong>${q.options[q.correctIndex]}</strong>`}
                </div>
                <div style="margin-top: 10px; font-size: 0.9rem; opacity: 0.9; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px;">
                    <em>💡 ${q.explanation}</em>
                </div>`;
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
        const examWrap = el('quizExamWrap');
        if (examWrap) examWrap.scrollTop = 0;
        const reviewWrap = document.querySelector('#quizScreen .fc-review-wrap');
        if (reviewWrap) reviewWrap.scrollTop = 0;
    }

    el('submitQuizBtn')?.addEventListener('click', () => {
        const missedCount = userAnswers.filter(a => a === null).length;
        if (missedCount > 0) showToast(`⚠️ Submitting with ${missedCount} unanswered questions!`);
        gradeQuiz();
    });
}
