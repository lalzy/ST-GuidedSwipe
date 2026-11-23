// Guided Swipe
// Press '>' (swipe right → new swipe) with text in the input box:
//   that text is injected for THAT generation only, then the box is cleared.
// Empty input box: plain swipe, untouched ST behaviour.

const MODULE = 'guided_swipe';
const PROMPT_KEY = 'guided_swipe_injection';

// Stable ST constants (script.js: extension_prompt_types / extension_prompt_roles)
const IN_CHAT = 1;
const ROLE_SYSTEM = 0;

const DEFAULTS = {
    enabled: true,
    template: 'User has said they want this to be taken into account: {text}',
};

let active = null; // { text } while a guided swipe is running
let startTimeout = null;

function ctx() {
    return SillyTavern.getContext();
}

function settings() {
    const all = ctx().extensionSettings;
    all[MODULE] = Object.assign({}, DEFAULTS, all[MODULE] || {});
    return all[MODULE];
}

function textarea() {
    return /** @type {HTMLTextAreaElement} */ (document.getElementById('send_textarea'));
}

function setBox(value) {
    const ta = textarea();
    if (!ta) return;
    ta.value = value;
    ta.dispatchEvent(new Event('input', { bubbles: true })); // resize + draft save
}

function clearInjection() {
    ctx().setExtensionPrompt(PROMPT_KEY, '', IN_CHAT, 0, false, ROLE_SYSTEM);
}

function finish({ restore = false } = {}) {
    if (!active) return;
    if (startTimeout) clearTimeout(startTimeout);
    startTimeout = null;
    clearInjection();
    // If the generation was stopped/failed, give the user their text back.
    if (restore && textarea() && textarea().value.trim() === '') setBox(active.text);
    active = null;
}

function onGenerationStarted(type, _params, dryRun) {
    if (dryRun || type !== 'swipe') return;
    if (active) return; // nested call (tool-call recursion / group member) – keep current injection
    const s = settings();
    if (!s.enabled) return;

    const text = (textarea()?.value ?? '').trim();
    if (!text) return; // empty box = normal swipe

    const prompt = String(s.template || DEFAULTS.template).split('{text}').join(text);
    ctx().setExtensionPrompt(PROMPT_KEY, prompt, IN_CHAT, 0, false, ROLE_SYSTEM);
    active = { text };
    setBox('');
    console.log(`[${MODULE}] guided swipe:`, prompt);

    // Safety net: never leave the injection hanging around.
    startTimeout = setTimeout(() => finish({ restore: true }), 10 * 60 * 1000);
}

// ST fires ENDED first, then STOPPED (stopGeneration → hideStopButton → emit STOPPED).
// Defer cleanup a moment so a user-stop can be detected and the text restored.
function onGenerationEnded() {
    if (!active) return;
    const run = active;
    setTimeout(() => { if (active === run) finish({ restore: !!run.stopped }); }, 100);
}

function onGenerationStopped() {
    if (active) active.stopped = true;
}

function onChatChanged() {
    finish();
}

function addSettingsUi() {
    const s = settings();
    const html = `
    <div class="guided-swipe-settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Guided Swipe</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <label class="checkbox_label">
            <input id="guided_swipe_enabled" type="checkbox" ${s.enabled ? 'checked' : ''}>
            <span>Enabled</span>
          </label>
          <label for="guided_swipe_template">Template (<code>{text}</code> = your input)</label>
          <textarea id="guided_swipe_template" class="text_pole" rows="3"></textarea>
          <small>Text in the input box + '&gt;' = new swipe with that text injected (once). Empty box = normal swipe.</small>
        </div>
      </div>
    </div>`;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return;
    host.insertAdjacentHTML('beforeend', html);

    const tpl = /** @type {HTMLTextAreaElement} */ (document.getElementById('guided_swipe_template'));
    tpl.value = s.template;
    tpl.addEventListener('input', () => {
        settings().template = tpl.value;
        ctx().saveSettingsDebounced();
    });
    document.getElementById('guided_swipe_enabled').addEventListener('change', (e) => {
        settings().enabled = /** @type {HTMLInputElement} */ (e.target).checked;
        ctx().saveSettingsDebounced();
    });
}

(function init() {
    const { eventSource, event_types } = ctx();
    settings();
    clearInjection();
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
    eventSource.on(event_types.GENERATION_STOPPED, onGenerationStopped);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    addSettingsUi();
})();
