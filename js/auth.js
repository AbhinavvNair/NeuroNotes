import { apiFetch, API_BASE, showToast } from './api.js';
import { state } from './state.js';
import { loadNotes } from './notes.js';

export function forceLogout(msg = "Session expired. Please login again.") {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginScreen').style.display = 'flex';
    const userInput = document.getElementById('userInput');
    const aiOutput = document.getElementById('aiOutput');
    if (userInput) userInput.value = "";
    if (aiOutput) {
        aiOutput.innerHTML = '<i class="fa-solid fa-sparkles"></i><p>Ready for refinement</p>';
        aiOutput.classList.add('empty-state');
    }
    state.lastGeneratedNoteId = null;
    state.currentRawResponse = "";
    showToast(msg);
}

function updateUserUI(email) {
    const nameEl = document.querySelector(".user-info .name");
    const avEl = document.querySelector(".user-avatar");
    if (!nameEl || !avEl) return;
    nameEl.textContent = email.split("@")[0];
    avEl.textContent = email.substring(0, 2).toUpperCase();
}

export async function validateSession() {
    if (!(localStorage.getItem("access_token") || sessionStorage.getItem("access_token"))) {
        return forceLogout("Please login to continue");
    }
    try {
        const res = await apiFetch(`${API_BASE}/me`);
        if (!res.ok) throw new Error();
        const email = (await res.json()).email;
        updateUserUI(email);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').classList.remove('hidden');
        await loadNotes();
    } catch { forceLogout(); }
}

export function initAuth() {
    // Listen for 401 events from apiFetch
    document.addEventListener('auth:logout', e => forceLogout(e.detail));

    // Password toggle (eye icon)
    document.querySelectorAll('.password-toggle').forEach(t => {
        t.addEventListener('click', () => {
            const target = document.getElementById(t.dataset.target);
            if (!target) return;
            const isPassword = target.type === 'password';
            target.type = isPassword ? 'text' : 'password';
            t.innerHTML = `<i class="fa-solid fa-eye${isPassword ? '-slash' : ''}"></i>`;
        });
    });

    // Toggle login / register
    let isReg = false;
    document.getElementById('toggleAuthMode')?.addEventListener('click', () => {
        isReg = !isReg;
        document.getElementById('confirmPasswordGroup').classList.toggle('hidden', !isReg);
        document.getElementById('loginError').classList.add('hidden');
        document.getElementById('loginSubmitBtn').innerHTML = isReg
            ? 'Create Account <i class="fa-solid fa-user-plus"></i>'
            : 'Enter Workspace <i class="fa-solid fa-arrow-right"></i>';
        document.getElementById('toggleAuthMode').innerText = isReg
            ? "Already have an account? Login"
            : "Don't have an account? Register";
    });

    document.getElementById('loginSubmitBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPass').value.trim();
        const conf = document.getElementById('confirmPass')?.value.trim();

        if (!email || !pass) return showLoginError("Enter email and password");
        if (isReg && pass.length < 8) return showLoginError("Password must be at least 8 characters");
        if (isReg && pass !== conf) return showLoginError("Passwords do not match");

        try {
            if (isReg) {
                const r = await fetch(`${API_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password: pass })
                });
                if (!r.ok) {
                    const err = await r.json();
                    const msg = Array.isArray(err.detail) ? err.detail[0]?.msg : err.detail;
                    throw new Error(msg || "Registration failed");
                }
                showToast("Account created. Please login.");
                document.getElementById('toggleAuthMode').click();
                return;
            }
            const fd = new URLSearchParams();
            fd.append("username", email);
            fd.append("password", pass);
            const r = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: fd
            });
            if (!r.ok) throw new Error((await r.json()).detail || "Invalid credentials");
            const loginData = await r.json();
            sessionStorage.setItem("access_token", loginData.access_token);
            updateUserUI(email);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('appContainer').classList.remove('hidden');
            await loadNotes();
        } catch (e) { showLoginError(e.message); }
    });

    // User section dropdown
    const userSection = document.getElementById('userSection');
    document.getElementById('userToggleBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        userSection?.classList.toggle('open');
    });
    document.addEventListener('click', () => userSection?.classList.remove('open'));

    // Settings modal
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('hidden');
        setTimeout(() => document.getElementById('settingsModal').classList.add('show'), 10);
    });
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('show');
        setTimeout(() => document.getElementById('settingsModal').classList.add('hidden'), 200);
    });
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
        const presetSelect = document.getElementById("promptPresetSelect");
        const promptTextarea = document.getElementById("settingPrompt");
        if (presetSelect?.value === "custom") {
            localStorage.setItem("ai_custom_prompt", promptTextarea.value.trim());
        }
        showToast("Preferences Saved!");
        document.getElementById('closeSettingsBtn').click();
    });

    // Change password
    document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
        const old_p = document.getElementById('currentPassword').value.trim();
        const new_p = document.getElementById('newPassword').value.trim();
        const conf_p = document.getElementById('confirmNewPassword').value.trim();
        if (!old_p || !new_p) return showToast("Fill all fields");
        if (new_p.length < 8) return showToast("New password must be at least 8 characters");
        if (new_p !== conf_p) return showToast("Passwords don't match");
        try {
            const r = await apiFetch(`${API_BASE}/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ old_password: old_p, new_password: new_p })
            });
            if (!r.ok) throw new Error("Incorrect current password");
            showToast("Password updated");
            document.getElementById('currentPassword').value = "";
            document.getElementById('newPassword').value = "";
            document.getElementById('confirmNewPassword').value = "";
        } catch (e) { showToast(e.message); }
    });
}

function showLoginError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.classList.remove('hidden');
}
