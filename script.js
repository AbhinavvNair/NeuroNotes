document.addEventListener('DOMContentLoaded', () => {
    
    // 1. SELECT ELEMENTS
    const userInput = document.getElementById('userInput');
    const aiOutput = document.getElementById('aiOutput');
    const processBtn = document.getElementById('processBtn');

    // 2. BACKEND URL
    const API_URL = "http://127.0.0.1:8000/generate";

    // 3. EVENT LISTENER
    processBtn.addEventListener('click', async () => {
        const text = userInput.value.trim();
        
        if (!text) {
            alert("Please enter some text first!");
            return;
        }

        // LOCK UI
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
        aiOutput.innerHTML = `
            <div class="empty-state" style="opacity: 0.8;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>EduLLM is thinking...</p>
            </div>
        `;

        try {
            // CALL PYTHON
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: text })
            });

            const data = await response.json();

            // DISPLAY RESULT
            if (window.marked) {
                aiOutput.innerHTML = marked.parse(data.generated_text);
            } else {
                aiOutput.innerText = data.generated_text;
            }

        } catch (error) {
            console.error("Error:", error);
            aiOutput.innerHTML = `
                <div style="color: #ef4444; padding: 20px; text-align: center;">
                    <i class="fa-solid fa-triangle-exclamation"></i><br>
                    <strong>Connection Failed</strong><br>
                    Is the backend running?
                </div>
            `;
        }

        // UNLOCK UI
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Refine with AI';
    });
});