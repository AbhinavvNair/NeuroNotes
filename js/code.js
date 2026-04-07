import { showToast } from './api.js';

export function enableLiveCode(container = document.getElementById('aiOutput')) {
    container.querySelectorAll('pre code').forEach(block => {
        const pre = block.parentElement;
        if (pre.classList.contains('processed')) return;
        pre.classList.add('processed');
        pre.style.position = 'relative';

        const head = document.createElement('div');
        head.className = 'code-header';
        head.innerHTML = `<div class="window-dots"><span></span><span></span><span></span></div>`;

        const actions = document.createElement('div');
        actions.className = 'code-actions';

        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        copyBtn.onclick = () => { navigator.clipboard.writeText(block.innerText); showToast("Copied!"); };

        const snapBtn = document.createElement('button');
        snapBtn.innerHTML = '<i class="fa-solid fa-camera"></i>';
        snapBtn.onclick = () => {
            showToast("Snapping...");
            const c = pre.cloneNode(true);
            c.style = "width:800px; padding:40px; background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:20px; position:fixed; top:-999px;";
            c.querySelector('.code-actions')?.remove();
            document.body.appendChild(c);
            html2canvas(c, { backgroundColor: null, scale: 2 }).then(canvas => {
                const a = document.createElement('a');
                a.download = 'code.png';
                a.href = canvas.toDataURL();
                a.click();
                c.remove();
                showToast("Saved! 📸");
            });
        };

        actions.append(copyBtn, snapBtn);

        if (block.className.includes('js')) {
            const runBtn = document.createElement('button');
            runBtn.className = 'run-btn-small';
            runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run';
            runBtn.onclick = () => executeCode(block, pre);
            actions.append(runBtn);
        }

        head.appendChild(actions);
        pre.insertBefore(head, block);
    });
}

export function executeCode(block, pre) {
    pre.nextElementSibling?.classList.contains('code-output') && pre.nextElementSibling.remove();
    const out = document.createElement('div');
    out.className = 'code-output show';
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    try {
        const logs = [];
        iframe.contentWindow.console = {
            log: (...a) => logs.push(a.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ')),
            error: (...a) => logs.push('Error: ' + a.join(' ')),
            warn: (...a) => logs.push('Warn: ' + a.join(' ')),
        };
        iframe.contentWindow.eval(block.innerText);
        out.innerText = logs.length ? logs.join('\n') : "> Executed";
        out.style.color = "#10b981";
    } catch (e) {
        out.innerText = "Error: " + e.message;
        out.style.color = "#ef4444";
    } finally {
        document.body.removeChild(iframe);
    }
    pre.after(out);
}
