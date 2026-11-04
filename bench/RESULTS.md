# Benchmarks

One benchmark you can run again. None is a lab result: small task sets, few runs. Read the limits under each.

## 1. How much does effortless save? (`bash bench/agentic/run.sh`)

The question people ask: same work, with effortless on and with it off, what does it cost and is the answer still right?

Four coding tasks in a fresh copy of this repo: find and explain a setting, add doc comments without touching code, write and run a small script, and trace a flow through several files. Each ran 3 times per setup, on Opus 5.5 and Sonnet 5.5, through Anthropic's API (an API key, so the cost is real list price). Without effortless the app sat at medium, high or xhigh. With it, the app started on medium and effortless picked the effort for each prompt. Every answer was checked: the right fact, no file touched that should not be, the script printing the right number. Run 2026-10-10, 96 runs.

**Opus 5.5**

| Setup | Correct | Cost per task | Requests per task | Time per task |
| --- | --- | --- | --- | --- |
| medium (Anthropic's recommendation), no effortless | 12 of 12 | $0.190 | 7.3 | 24 s |
| high, no effortless | 12 of 12 | $0.209 | 8.0 | 27 s |
| xhigh, no effortless | 12 of 12 | $0.257 | 9.9 | 44 s |
| **effortless on** | **12 of 12** | **$0.149** | **5.8** | **20 s** |

effortless saved **21%** against medium, **29%** against high and **42%** against xhigh, with every answer still right. It picked low 9 times and medium 3 times.

**Sonnet 5.5**

| Setup | Correct | Cost per task | Requests per task | Time per task |
| --- | --- | --- | --- | --- |
| medium, no effortless | 12 of 12 | $0.092 | 6.4 | 15 s |
| high, no effortless | 12 of 12 | $0.107 | 8.8 | 20 s |
| xhigh, no effortless | 12 of 12 | $0.146 | 11.4 | 31 s |
| **effortless on** | **12 of 12** | **$0.096** | **7.5** | **18 s** |

On Sonnet it came out even against medium (4% more, inside the noise), and saved **10%** against high and **35%** against xhigh.

What it says:
- The saving comes from fewer steps, not only less thinking. Every request rereads the whole chat, and at low effort the model took fewer of them (5.8 against 7.3 on Opus medium).
- It is faster too: 20 s per task against 24 s on Opus medium.
- Sonnet at medium is already lean, so there is little to take off it.

Limits:
- Four tasks, three runs each. The percentages could move a few points on a rerun.
- Mostly easy tasks, where effortless goes low and saves the most. On hard tasks it picks more effort and saves less; not measured here.
- The checks test the right fact, file or number, not how well an answer is written.
- Fresh chats through the API. Long chats in the app, and plan usage, were not measured.
- The judge (Haiku) adds about $0.001 to $0.002 per prompt and is not in the figures.

Every run: `bench/results/agentic-2026-10-10.md` and `.json`.
