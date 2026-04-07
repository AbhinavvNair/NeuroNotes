export const API_BASE = window.location.origin;

export const showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
};

export const apiFetch = async (url, opts = {}) => {
    const t = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (t) opts.headers = { ...opts.headers, "Authorization": "Bearer " + t };
    const res = await fetch(url, opts);
    if (res.status === 401) {
        document.dispatchEvent(new CustomEvent('auth:logout', {
            detail: "Session expired. Please login again."
        }));
        throw new Error("Unauthorized");
    }
    return res;
};

export const streamText = async (container, rawText, onFinish) => {
    container.classList.remove('empty-state');
    container.classList.add('typing-cursor');
    let i = 0, buffer = '';
    return new Promise(resolve => {
        const timer = setInterval(() => {
            buffer += rawText.substring(i, i + 8);
            i += 8;
            container.innerHTML = marked.parse(buffer);
            container.scrollTop = container.scrollHeight;
            if (i >= rawText.length) {
                clearInterval(timer);
                container.innerHTML = marked.parse(rawText);
                container.classList.remove('typing-cursor');
                if (onFinish) onFinish();
                resolve();
            }
        }, 16);
    });
};
