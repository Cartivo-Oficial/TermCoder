# termexplorer — your study buddy

**termexplorer** is termcoder's sister AI, tuned for **school and studying** instead of code.
It explains topics, summarizes your notes, helps with homework (showing the steps so you
actually learn), and builds study aids like flashcards, practice questions, and revision
plans. It's meant to be easy for anyone to use — you don't need to know programming.

## Turn it on

In the desktop app, click the **model** chip and pick **"termexplorer — study & schoolwork
tutor."** That's it — the whole conversation is now in study mode. (In the terminal, set
your model to `termexplorer/auto` in the config.)

Like termcoder, it's **free to run** with a local model (Ollama) or a free API key
(Google Gemini) — see the main README's "Free / no-cost setup."

## What to ask it

Just chat naturally. Some examples:

- **Explain:** "Explain photosynthesis like I'm 14, with an example."
- **Summarize:** "Summarize these notes into the key points." (drag a file in, or paste)
- **Homework help:** "Help me solve this equation — show each step so I understand it."
- **Flashcards:** "Make 10 flashcards from this chapter."
- **Practice:** "Give me 5 practice questions on the French Revolution, with answers."
- **Plan:** "Make me a 1-week study plan for my biology exam on Friday."
- **Essays:** "Help me outline an argumentative essay about renewable energy."
- **Research:** "What year did X happen, and cite a source?" (it searches the web and cites)

It replies in your language, uses headings and bullet points so it's easy to study from,
and can **save a summary or study guide to a file** if you ask.

## How it helps you learn (not cheat)

termexplorer shows the **reasoning and worked steps**, points out mistakes kindly, and
encourages you to try things yourself — so you understand the material and can do your own
best work. It's a tutor, not an answer machine.

## Flashcards & spaced repetition

termexplorer can turn any topic into flashcards and quiz you on them over time using
spaced repetition (the SM-2 algorithm), so you review each card right before you'd
forget it. Decks and your streak sync across devices via GitHub (`/sync`).

In the CLI:

- `/flashcards <topic>` — write a deck of cards about a topic (or paste your notes).
- `/decks` — list your decks, how many are due, and your day streak.
- `/review [deck]` — study the due cards: read the front, press enter to reveal the
  answer, then rate how well you knew it (0 = blackout … 5 = easy).

In the desktop app, click **📚 Study** (top-right of the chat) for the same with buttons:
generate a deck, see what's due, and review.

> Generating cards uses the model; on the free model it can be slow or busy — try again,
> or connect a free Gemini key (`/key google …`) for fast, reliable generation. Reviewing
> existing cards is fully local and always works.

## Share it with friends

Anyone can install termcoder (see the main [README](../README.md)) and switch to the
termexplorer model — no coding needed. Point them here.
