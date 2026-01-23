document.addEventListener('DOMContentLoaded', () => {
    const rawInput = document.getElementById('rawInput');
    const refineBtn = document.getElementById('refineBtn');
    const aiOutput = document.getElementById('aiOutput');

    // 1. Check if elements exist to prevent crashes
    if (!rawInput || !refineBtn || !aiOutput) {
        console.error("CRITICAL ERROR: HTML elements not found. Check IDs in index.html");
        return;
    }

    refineBtn.addEventListener('click', async () => {
        const text = rawInput.value.trim();
        
        if (!text) {
            alert("Please enter some text first!");
            return;
        }

        // Show loading state
        refineBtn.disabled = true;
        refineBtn.textContent = "Generating...";
        aiOutput.innerHTML = '<div class="empty-state">Thinking...</div>';

        try {
            // 2. Call the Backend API
            const response = await fetch('http://127.0.0.1:8000/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: text,
                    max_tokens: 200,    // You can adjust this length
                    temperature: 0.7    // Creativity (0.0 to 1.0)
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            // 3. Safety Check: Did we get a response?
            // The backend sends { "response": "..." }
            if (data && data.response) {
                // Parse Markdown safely
                aiOutput.innerHTML = marked.parse(data.response);
            } else {
                aiOutput.innerHTML = '<p style="color:red">Error: Empty response from AI.</p>';
                console.error("Backend response structure:", data);
            }

        } catch (error) {
            console.error('Error:', error);
            aiOutput.innerHTML = `<p style="color: red;">Error connecting to brain: ${error.message}</p>`;
        } finally {
            // Reset button
            refineBtn.disabled = false;
            refineBtn.textContent = "Refine with AI";
        }
    });
});