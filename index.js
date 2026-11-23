// Guided Swipe
// Press '>' (swipe right → new swipe) or Regenerate with text in the input box:
//   that text is injected for THAT generation only, then the box is cleared.
// Empty input box: plain swipe, untouched ST behaviour.

const MODULE = 'guided_swipe';
const PROMPT_KEY = 'guided_swipe_injection';

// Stable ST constants (script.js: extension_prompt_types / extension_prompt_roles)
const IN_CHAT = 1;
// Both leave the input box untouched in ST, so its text is free to use as guidance.
const GUIDED_TYPES = new Set(['swipe', 'regenerate']);
const ROLES = { system: 0, user: 1 };

// Phrased as an explicit out-of-character order. The old wording read like an in-story remark,
// so (reasoning) models tried to reconcile it with the scenario instead of following it.
const DEFAULT_TEMPLATE = '[OOC: The user rerolled your last response and gave this direction for the new one. '
    + 'It is an instruction from the user, not something said or done in the story. '
    + 'Follow it, even where it conflicts with earlier messages, the scenario or character details:\n{text}]';
const OLD_DEFAULT_TEMPLATE = 'User has said they want this to be taken into account: {text}';

const DEFAULTS = {
    enabled: true,
    role: 'system',
    template: DEFAULT_TEMPLATE,
};

let active = null; // { text } while a guided swipe is running
let startTimeout = null;

function ctx() {
    return SillyTavern.getContext();
}

function settings() {
    const all = ctx().extensionSettings;
    const s = Object.assign({}, DEFAULTS, all[MODULE] || {});
    if (s.template === OLD_DEFAULT_TEMPLATE) s.template = DEFAULT_TEMPLATE; // untouched old default → upgrade
    if (!(s.role in ROLES)) s.role = DEFAULTS.role;
    all[MODULE] = s;
    return s;
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
    ctx().setExtensionPrompt(PROMPT_KEY, '', IN_CHAT, 0, false, ROLES.system);
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
    if (dryRun || !GUIDED_TYPES.has(type)) return;
    if (active) return; // nested call (tool-call recursion / group member) – keep current injection
    const s = settings();
    if (!s.enabled) return;

    const text = (textarea()?.value ?? '').trim();
    if (!text) return; // empty box = normal swipe/regenerate
    if (text.startsWith('/')) return; // a slash command (e.g. /regen) being run from the box, not guidance

    const prompt = String(s.template || DEFAULTS.template).split('{text}').join(text);
    ctx().setExtensionPrompt(PROMPT_KEY, prompt, IN_CHAT, 0, false, ROLES[s.role] ?? ROLES.system);
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
          <label for="guided_swipe_role">Send as</label>
          <select id="guided_swipe_role" class="text_pole">
            <option value="system">System message</option>
            <option value="user">User message</option>
          </select>
          <label for="guided_swipe_template">Template (<code>{text}</code> = your input)</label>
          <textarea id="guided_swipe_template" class="text_pole" rows="5"></textarea>
          <div id="guided_swipe_reset" class="menu_button menu_button_icon" title="Restore the default template">
            <i class="fa-solid fa-rotate-left"></i><span>Reset template</span>
          </div>
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
    const role = /** @type {HTMLSelectElement} */ (document.getElementById('guided_swipe_role'));
    role.value = s.role;
    role.addEventListener('change', () => {
        settings().role = role.value;
        ctx().saveSettingsDebounced();
    });
    document.getElementById('guided_swipe_reset').addEventListener('click', () => {
        tpl.value = DEFAULT_TEMPLATE;
        settings().template = DEFAULT_TEMPLATE;
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
