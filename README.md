# Tour Practice Coach

### [▶ Try the live demo →](https://arshitha231.github.io/tour-practice-coach/)

[![Live Demo](https://img.shields.io/badge/demo-live-6E4F72?style=for-the-badge&logo=githubpages&logoColor=white)](https://arshitha231.github.io/tour-practice-coach/)
[![Chrome Required](https://img.shields.io/badge/browser-Chrome-D4B678?style=for-the-badge&logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![No Backend](https://img.shields.io/badge/backend-none-6B8E5C?style=for-the-badge)](https://github.com/Arshitha231/tour-practice-coach#tech-stack)

A browser-based practice tool that trains university tour guides on the four
things they're actually graded on: **content accuracy, voice projection, energy,
and audience engagement**. Runs entirely in the browser — no backend, no cost
to deploy, no sign-up.

Originally built to prepare for the UW Bothell orientation tour test.

> **Open in Google Chrome.** Grant microphone + camera permissions when
> prompted. Everything runs on-device: your audio/video never leaves your
> laptop (except Chrome's own speech recognition, which is a browser API).

## What it does

Give a practice tour in front of your laptop. The app listens, watches, and
grades you against a strict-supervisor rubric. Every session is saved so you
can track improvement over time.

- 🎤 **Live transcript** with filler words highlighted red and story cues
  highlighted blue
- 📏 **Position Coach** — stand ~10 ft from your laptop; the app measures
  distance from your face (close range) or shoulders (far range, up to ~15 ft)
  using MediaPipe body-pose detection
- ✊ **Hands-free start/stop** — hold up a closed fist to auto-start/stop
  practice. Uses MediaPipe's pre-trained Gesture Recognizer (one of 7
  built-in gestures, no training required)
- 📖 **Tour manual upload** (PDF or Word) — the app extracts up to 80 key
  terms (proper nouns, dates, place names) and grades your **Accuracy** on
  how many you mention
- 📊 **Dashboard** with trend chart over time and clickable session history —
  every session's full feedback report is saved and re-openable
- ❓ **GarageBand-style help** — click `?` once to inspect any feature, click
  again for a guided tour

## Grading rubric (strict supervisor, out of 100)

| Category | Weight | How it's scored |
|---|---|---|
| Accuracy of Information | 20 | % of manual's key terms you mentioned |
| Storytelling | 20 | Narrative cues detected vs. target (default 5) |
| Voice Projection | 15 | % of session above loudness threshold |
| Energy (words/min) | 15 | How close to target WPM (default 150) |
| Ice Breaker Questions | 15 | Audience-directed questions detected vs. target |
| Filler Control | 15 | Filler rate / min (polished speakers: < 0.3) |

Flagged filler words include `um`, `uh`, `like`, `basically`, `actually`,
`you know`, `kind of`, and `guys` (as exclusionary language — tour guides are
coached to use "everyone" or "y'all").

## Running it locally

Requires **Google Chrome** (speech recognition is Chrome-only in browsers today).

```bash
cd tour-practice-app
python3 -m http.server 4500
```

Open http://localhost:4500 in Chrome and grant microphone + camera access.

Everything else runs client-side — MediaPipe models and `pdfjs` / `mammoth`
are loaded from CDN on first use (~5 MB, cached after).

## Tech stack

Pure HTML / CSS / vanilla JavaScript. No build step, no framework.

- **Web Speech API** — live transcript, filler/story/ice-breaker detection
- **Web Audio API** — real-time RMS volume analysis for projection meter
- **MediaPipe Tasks Vision** (via CDN):
  - `FaceDetector` (BlazeFace short-range) for close-range distance
  - `PoseLandmarker` for shoulder-based distance at longer range
  - `GestureRecognizer` for closed-fist detection
- **pdfjs-dist** — client-side PDF text extraction
- **mammoth** — client-side Word (.docx) text extraction
- **localStorage** — session persistence (never leaves the user's browser)

## Known limitations

Honestly documented in the app's own Help panel:

- **"um" and "uh" often not counted** — Chrome's speech recognizer strips
  disfluencies as noise. Word-based fillers (`like`, `basically`, `you know`,
  `guys`, etc.) are caught reliably.
- **Fist gesture less reliable at 10+ ft** — the hand is only a few pixels
  wide at that distance. Works more reliably at 6–8 ft.
- **Accuracy uses exact word matching** — "the fountain" won't match
  "Drumheller Fountain" in the manual. The metric is meant to catch skipped
  sections, not nit-pick phrasing.
- **No OCR** — image-only scanned PDFs can't be read.
- **Chrome only** — Safari and Firefox don't support the Web Speech API.

## File structure

```
tour-practice-app/
├── index.html         # Markup + data-help annotations
├── app.js             # All logic (~1,900 lines)
├── style.css          # Light-theme design system
├── .claude/
│   └── launch.json    # Dev-server config
└── README.md
```

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built with help from [Claude Code](https://claude.com/claude-code).
