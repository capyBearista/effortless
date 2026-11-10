<p align="center">
  <img src="docs/readme/banner.png" alt="effortless, a Claude Code mod: one bar above the prompt that picks the reasoning effort for every prompt" width="100%">
</p>

<p align="center">
  <a href="#install"><b>Install</b></a> ·
  <a href="#what-the-bar-shows"><b>What it shows</b></a> ·
  <a href="#pick-your-judge"><b>Judges</b></a>
</p>

https://github.com/user-attachments/assets/9b5af48e-2ad8-4826-9443-4aeea1306664

> [!NOTE]
> **Fork: decision-model chain.** This fork of [HeyCubit/effortless](https://github.com/HeyCubit/effortless) can ask an ordered list of decision models before Haiku, on OpenCode Zen, OpenRouter or TypeSafe. Each failure (error, timeout, unusable answer) passes to the next model; a model with no key is skipped. When none answers, Haiku judges and one toast says why.
>
> Set it up in effortless itself: the setup guide's decision-model step offers free Jev on OpenCode Zen, an OpenRouter key or a TypeSafe key, and Settings → Judge → **Models** adds, reorders and removes models. A key pasted there is kept in `~/.config/openrouter/effortless.env` (owner-only), since a mod cannot write Claude Code's secret settings. The same options are in `/plugin` → effortless → Configure:
>
> | Setting | Example |
> |---|---|
> | `decisionModels` | `openrouter/liquid/d1-ultra, openrouter/perplexity/pplx-decider-v1.2, typesafe/jev-latest` |
> | `openrouterKey` | your OpenRouter key (or `OPENROUTER_API_KEY` in the environment) |
> | `judgeTimeoutMs` / `judgeBudgetMs` | per model / all models together, in ms, default 4000 / 8000. Any positive whole number is used as typed; a prompt can wait up to the budget before Claude starts |
>
> Prefixes: `opencode/<model>` (Zen, free models need no key), `openrouter/<publisher>/<model>`, `typesafe/<model>` (TypeSafe key). Left empty, Haiku judges alone. Every call sends your next message (up to 4,000 characters) and the last reply's tail to that provider, so only list providers you are happy to send that to.
>
> **Fork: a detailed Full handoff.** Full checks git and writes a detailed `HANDOFF.md` (original task, work completed, work remaining, attempted approaches, critical context, current state, suggested skills) to `docs/internal/`, `docs/local/` or `docs/`, whichever exists first, else the project root. Its turn runs at Medium, whatever the last prompt was judged, then the effort goes back. The handoff bar has an optional field for what the next session is for, used by Quick and Full alike (`/effortless handoff full <focus>` does the same).
>
> Install: `claude plugin marketplace add capyBearista/effortless`, then `claude plugin install effortless@capybearista` (uninstall `effortless@effortless` first). Update with `claude plugin marketplace update capybearista` and `claude plugin update effortless@capybearista`.

A Claude Code mod that picks the reasoning effort for every prompt. Quick questions get **Low**, hard jobs get **High**,
and you never touch the Effort control. On real coding tasks it cut the cost of Opus by **21%** against Anthropic's
recommended medium, **29%** against high and **42%** against xhigh, with every answer still right
([the benchmark](#what-it-saves-measured)). One bar above the prompt also shows how full the chat is, how long the
prompt cache stays warm, and hands off or compacts in one click when a chat gets heavy.

<p align="center">
  <img src="docs/readme/story.gif" alt="effortless in a Claude Code chat: effort per prompt, Handoff, cold cache, heavy chat, limits and settings" width="100%">
</p>

## Powered by Haiku

Haiku costs a fraction of the chat model, and Anthropic names compaction and quick, well-defined work among what
it is built for. effortless uses it in two places:

| | |
|---|---|
| **The judge** | reads each prompt and picks the effort, in about a second, on your own Claude login |
| **Compaction** | every compaction, `/compact` and the automatic one included, is summarized by Haiku. If Haiku fails, Claude Code compacts as usual |

Compaction is switched in Settings → Handoff → Compact with.

## Install

Two ways. Both take a minute and need no terminal.

**1. Ask Claude** (easiest). Paste this into Claude Code and press Enter:

```text
Install the effortless plugin for me: run `claude plugin marketplace add capyBearista/effortless` and then `claude plugin install effortless@capybearista`. When both succeed, tell me to run /reload-plugins.
```

**2. Commands.** Type these two lines in Claude Code's chat box:

```text
/plugin marketplace add capyBearista/effortless
```

```text
/plugin install effortless@capybearista
```

Or in a terminal, in one line:

```bash
claude plugin marketplace add capyBearista/effortless; claude plugin install effortless@capybearista
```

Then run `/reload-plugins` (or restart Claude Code). A short setup opens above the prompt: keep **Haiku** alone (one click,
no key, runs on your own Claude login) or add a **decision model** (free Jev on OpenCode Zen needs no key; Jev is about 4x faster than Haiku at effort calls), lean cheaper or
smarter, and pick how handoffs are written. Run `/effortless setup` to go through it again, or change any of it in ⚙.

To update: `claude plugin marketplace update capybearista; claude plugin update effortless@capybearista`, then restart Claude Code.

## What the bar shows

<p align="center"><img src="docs/readme/hero.gif" alt="The bar: Deciding, then Low for a quick question, then High for a refactor" width="100%"></p>

| On the bar | Means |
|---|---|
| **High · Opus** | the effort Auto picked for this prompt, and the model the chat runs on. `Deciding` while the judge thinks; a switch flashes violet and fades to white |
| **◔ 38%** | how full the chat's context is |
| **cache 59:00** | time until the prompt cache goes cold, after which the next message pays full price to re-read the chat |
| *Haiku: a refactor…* | who judged and why |
| **Auto** | switches the judge on and off. Changing effort in the app yourself also turns Auto off at your next message, and says so: you always win |
| **Compact** | compacts the chat. It turns into a glowing **Handoff** when Haiku says a fresh chat would pay off, with Compact as quiet text beside it. Set Settings → Handoff → Handoff button to **Always** to keep Handoff on the bar |
| **⚙** | settings |

Prefer it quiet? Settings → Customize has a **Minimal** look with no bar. It also sets the **Appearance** (match, dark or light: in the desktop app, Match follows the app's own light or dark; in the terminal, Claude Code's theme) and the **Theme** (violet, Claude orange or cherry blossom).

### When a chat gets heavy

When the cache has gone cold on a big chat, the bar turns to ice with **Compact** and **Handoff**:

<p align="center"><img src="docs/readme/cold.gif" alt="The Chat went cold bar, breathing" width="100%"></p>

**Handoff** writes a summary of the chat and carries on in a clean one. **Quick** takes a few seconds; **Full** checks
git and saves a detailed `HANDOFF.md` under `docs/` (or the project root), at Medium effort, or runs your own skill. An optional field says what the next session is for. Then clear and carry on, clear and wait, or keep the chat and copy.

<p align="center"><img src="docs/readme/handoff.png" alt="The Handoff bar with Quick and Full" width="100%"></p>

**Compact** takes an optional note for what the summary should keep. Every compaction, also `/compact` and the automatic one, is written by **Haiku** by default, which Anthropic recommends for compaction at a fraction of the chat model's price; if Haiku fails, Claude Code compacts as usual. Switch it in Settings → Handoff → Compact with.

<p align="center"><img src="docs/readme/compact.png" alt="The Compact bar with an optional summary field" width="100%"></p>

The bar also warns when a chat is getting swamped (each message re-reads a lot of context), when a 5-hour or weekly
limit passes 80% (with a Save mode that caps effort at Medium), and when your judge stops answering.

### Settings

<p align="center"><img src="docs/readme/settings.png" alt="The settings panel: Effort, Judge, Handoff, Customize" width="100%"></p>

## Haiku, and decision models if you add them

Haiku runs on your own Claude login and needs no key. It always makes the handoff call: from 30% of context, every second message, it reads what the chat was for, the trail of topics, the last reply and how full the context is, and says a fresh chat would suit only for a clear reason. Then the Compact button turns into a lit Handoff with the reason. Want Handoff on the bar all the time? Settings → Handoff → Handoff button → **Always**.

Haiku also picks the effort, unless you add a decision model, a faster one such as `typesafe/jev-latest` (TypeSafe's Jev, about 0.25 s against about 1 s). The decision models answer the effort first, in order, and Haiku steps in whenever they are unsure or none answers. Run `/plugin configure effortless@capybearista` in Claude Code, or use the setup guide or the Judge card in Settings.

| Setting | What it does |
|---|---|
| `auto` (default) | The decision models first, in the order set, then Haiku. With none set: Haiku alone |
| `haiku` | Haiku only, a key is never used |

A key set with `/plugin configure` is kept in Claude Code's secure storage. A key pasted in the setup guide or the Judge card is written in plain text to `~/.config/jev/.env`, never to a file of this repo. If every decision model fails or runs out of time, Haiku judges that prompt and effortless tells you why once per session (out of credits, key rejected, no answer).

Short follow-ups such as "go", "ok" or "yes" keep the effort already picked and ask no judge.

The judge is not told which model the chat runs on, nor the effort in force. It gives one effort for each of Haiku, Sonnet, Opus and Fable, each on that model's own scale (a migration can be max on Haiku and high on Opus), and effortless applies the answer for the model in use. Switch models mid-chat and the pick follows that model's own answer. When a decision model is unsure of the answer for your model, Haiku has a second look; when it is still unsure, the effort stays as it was and the band says `kept`. `/effortless debug` shows the judge's answers next to what was applied.

Pick a level yourself by clicking it in the band: effortless runs `/effort <level>` in the app and turns Auto off, and the band says `manual`. Auto on again hands the effort back to the judge at your next prompt. Where the app refuses the run, the command goes into the prompt box for you to send.

## Keys and trust

- The default judge needs **no key**: Haiku runs on your own Claude login.
- A key is only needed for some decision models (OpenRouter, TypeSafe); free Jev on OpenCode Zen needs none. Enter it with `/plugin configure`, never on the command line, so it stays out of your shell history: Claude Code then keeps it in its secure storage. A key pasted in the setup guide or the Judge card is saved in plain text to `~/.config/jev/.env` instead, so prefer `/plugin configure` on a shared machine.
- Each key is sent only to its own provider (the OpenRouter key to OpenRouter, the TypeSafe key to TypeSafe), and to nothing else. Use a key with a spending limit if your provider offers one.
- Like any Claude Code plugin, this mod runs code on your machine. Its code is in [`hooks/`](hooks/): read it before you install if you do not know the author. The programs it starts are `claude` itself (to uninstall the mod when you press that button) and `chmod` (to keep a key file it saves readable only by you).

## What it saves, measured

Four real coding tasks in a fresh copy of this repo, each run 3 times with effortless on and with it off, through
Anthropic's API so the cost is real. Every answer was checked. Run 2026-10-10, 96 runs:

| Opus 5.5 | Correct | Cost per task | Requests | Time |
| --- | --- | --- | --- | --- |
| medium (recommended), no effortless | 12 of 12 | $0.190 | 7.3 | 24 s |
| high, no effortless | 12 of 12 | $0.209 | 8.0 | 27 s |
| xhigh, no effortless | 12 of 12 | $0.257 | 9.9 | 44 s |
| **effortless on** | **12 of 12** | **$0.149** | **5.8** | **20 s** |

That is **21%** less than medium, **29%** less than high and **42%** less than xhigh. On Sonnet it came out even
against medium (Sonnet at medium is already lean) and saved 10% against high and 35% against xhigh.

The saving comes from fewer steps: every request rereads the whole chat, and at a lower effort the model makes fewer of
them. Over 80k requests of real Claude Code use, about 76% of the cost was that reread, 16% cache writes and 8% output.
Keeping chats short and compacting before the cache goes cold saves on the same 76%; that is what the countdown is for.

Limits: four tasks, three runs each, mostly easy work where effortless goes low. On hard work it picks more effort and
saves less. Fresh chats through the API, not long chats on a plan. Run it again with `bash bench/agentic/run.sh`;
all numbers and limits are in [bench/RESULTS.md](bench/RESULTS.md).

## Models

effortless assumes every Opus, Sonnet, Haiku and Fable release keeps the prompt cache when effort changes. Claude Code's docs say that holds for Opus, Sonnet and Haiku 5.5 and for Fable 5.1 and later. effortless does not check the version, so on older models, which rewrite the cache, and on Bedrock, Google Cloud's Agent Platform, a Claude apps gateway, with `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` set, or in a HIPAA organisation, Auto still changes effort and each change can rewrite the cache. Models outside those four families pause Auto, and the footer says `Paused`.

## Split view

In the desktop app's split view, Claude Code draws plugin bars only in the left pane. The right pane still draws
replies, so when a chat went cold, is getting swamped or runs hot, a small card in the bar's colours hangs under the
newest reply, naming the command that does what the bar's button would: `/compact`, `/effortless handoff` or
`/effortless save`.

## In the terminal

effortless draws in the terminal CLI too, with moving pixel art in its bands. Claude Code may not load a plugin's code
there yet: if `/effortless` says the mod is not loaded after a restart, add this to `~/.claude/settings.json` and
restart:

```json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }
```

Tested on Claude Code 2.1.285 (stable), 2.1.286 and 2.1.288 at 80 and 120 columns. Below 90 columns the bands leave their art out.

## Commands

| Command | Does |
|---|---|
| `/effortless settings` | opens the settings panel |
| `/effortless setup` | runs the setup again |
| `/effortless auto` | Auto on or off |
| `/effortless handoff` / `handoff full` [focus] | hands off without the bar, with your last choice of what follows; text after it is what the next session is for |
| `/effortless stats` | what the prompts Auto steered cost this session, per effort, and what the judge took (Haiku split by why it was asked) |
| `/effortless cold`, `swamp`, `hot`, `down` | shows that bar now, to try it |
| `/effortless debug` | what the mod sees, and on its last line the model and effort the last request ran on |

## Open source

effortless is MIT licensed. Like any Claude Code plugin it runs code on your machine, so the whole mod is here to read:
[`hooks/`](hooks/). It sends nothing anywhere except your prompt to the judge you picked.

## Develop

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

`tools/render-band` draws the bar the way the desktop app does, without opening it; the images in this README come from it.

## License

[MIT](LICENSE)
