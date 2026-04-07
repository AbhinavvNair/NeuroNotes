export const promptPresets = {
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

function updateAIModeBadge(preset) {
    const aiBadge = document.getElementById("aiModeBadge");
    if (!aiBadge) return;
    aiBadge.classList.add("hide");
    setTimeout(() => {
        aiBadge.textContent = presetLabels[preset] || "Custom ✏";
        aiBadge.classList.remove("hide");
        aiBadge.classList.add("show");
    }, 150);
}

export function getSystemPrompt() {
    const activePreset = localStorage.getItem("ai_preset") || "summary";
    if (activePreset === "custom") return localStorage.getItem("ai_custom_prompt") || "";
    return promptPresets[activePreset] || "";
}

export function initPresets() {
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
            promptTextarea.value = localStorage.getItem("ai_custom_prompt") || "";
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

    document.addEventListener('click', (event) => {
        const wrapper = document.querySelector('.select-wrapper');
        if (!wrapper || !presetSelect) return;
        if (!event.composedPath().includes(wrapper)) presetSelect.blur();
    });
}
