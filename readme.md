# Guided Swipe

Guide your rerolls.

I didn't like the Guided Generations extension. It does too much (state tracking, extra buttons, and so on) when all I wanted was a feature that every LLM service out there has: **an intuitive way to guide the retry.**

Guided Swipe does exactly that and nothing else. No new buttons: it uses the swipe arrow and Regenerate you already use.

---

## How to use

1. **Type** what you want the model to take into account into the normal message box, e.g. *"make her angrier"*, *"shorter, and don't speak for me"*.
2. **Press the swipe-right arrow (`>`)** on the model's last message, the same button you'd use to generate a new swipe, **or use Regenerate** (☰ menu → Regenerate).

The new response is generated with this note added to the end of the prompt:

```
[OOC: The user rerolled your last response and gave this direction for the new one. It is an instruction from the user, not something said or done in the story. Follow it, even where it conflicts with earlier messages, the scenario or character details:
make her angrier]
```

It's worded as an out-of-character order on purpose. A softer note ("the user wants this taken into account") gets treated by models, especially reasoning models, as something said in the story that they try to fit into the scene, instead of something they must follow.

The message box is then cleared. The note applies **to that one response only**, so your next swipe or regenerate is a normal one again unless you type something new.

**Empty message box = normal swipe/regenerate.** Nothing changes; it's plain SillyTavern behaviour.

---

## Details

- **Where the note goes:** it's the very last message in the prompt (depth 0), so it's the last thing the model reads. It's sent as a system message by default; see *Send as* below.
- **It isn't saved in the chat.** The note only exists for that one generation. It doesn't show up as a message or stay in later prompts.
- **Stopping gives your text back.** If you press Stop during a guided swipe or regenerate, your note is put back into the message box.
- **Mobile works too.** Swipe gestures trigger it just like the arrow does.
- **Doesn't touch** normal Send, Continue, or anything else. Slash commands like `/regen` typed into the box run as normal and aren't used as a note.

---

## Settings

**Extensions → Guided Swipe**

| Setting | Default | What it does |
|---|---|---|
| Enabled | On | Turns guided swipes on or off |
| Send as | System message | **System** or **User** message. If your model or preset tends to ignore system messages in the middle of a chat, switch to User |
| Template | the OOC note shown above | The note sent to the model. `{text}` is replaced with what you typed. **Reset template** restores the default |

You can rewrite the template however you like, e.g. `[OOC: {text}]`.

---

## Installation

Put the `GuidedSwipe` folder in `SillyTavern/data/default-user/extensions/` and reload SillyTavern.

**If you use Guided Generations, disable it**, so the two don't both act on the same swipe.

---

## Good to know

- **Group chats:** guided swipes work, but Regenerate in a group chat goes through ST's normal send instead, so text in the box is sent as a regular message there.
- **ST's auto-swipe counts as a swipe.** If auto-swipe fires while you have text typed in the message box, that text is used as the note and cleared.
