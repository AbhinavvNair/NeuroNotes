import { showToast } from './api.js';

export async function renderMermaidDiagrams(container = document.getElementById('aiOutput')) {
    const blocks = container.querySelectorAll('pre code');
    let foundDiagram = false;

    blocks.forEach(block => {
        const text = block.textContent.trim();
        if (
            block.className.includes('language-mermaid') ||
            text.startsWith('graph ') ||
            text.startsWith('flowchart ') ||
            text.startsWith('mindmap')
        ) {
            foundDiagram = true;
            const pre = block.parentElement;

            const wrapper = document.createElement('div');
            wrapper.className = 'diagram-wrapper';
            wrapper.style.padding = '20px';
            wrapper.style.background = 'rgba(0,0,0,0.2)';
            wrapper.style.borderRadius = '12px';
            wrapper.style.marginTop = '20px';
            wrapper.style.border = '1px solid var(--border)';
            wrapper.style.overflowX = 'auto';
            wrapper.style.textAlign = 'center';

            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.textContent = text.replace(/```mermaid/g, '').replace(/```/g, '').trim();

            wrapper.appendChild(mermaidDiv);
            pre.replaceWith(wrapper);
        }
    });

    if (foundDiagram) {
        try {
            if (typeof mermaid === 'undefined') return showToast("Diagram engine loading...");
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });
            await mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
        } catch (e) {
            console.error("Mermaid Render Error:", e);
            showToast("Syntax error in diagram.");
        }
    }
}
