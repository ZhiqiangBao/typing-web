English | [中文](README.md)

# Typing Web

A typing practice web app built with vanilla HTML/CSS/JavaScript, featuring a minimalist focused design, training profile statistics and chart visualization, and bilingual UI support (Chinese/English). All data is stored locally in the browser — no login required, no backend database needed.

## 🚀 Online Demo

👉 **[https://zhiqiangbao.github.io/typing-web/](https://zhiqiangbao.github.io/typing-web/)**

> The demo version is deployed via GitHub Pages and runs without a Python server. For local development, use the method below.

## Features

### Practice Mode
- Built-in multi-genre text materials: Lolita, In Search of Lost Time, One Hundred Years of Solitude, Tang poetry, English proverbs, Python/SQL/C++ code snippets, and more
- Real-time display: progress, accuracy, WPM (English) / CPM (Chinese), error count
- Character-level highlighting: untyped = gray · correct = dark ink · error = red strikethrough · current position = theme-colored underline cursor
- Supports random document switch / dropdown to select a specific document / reset current progress
- Paste disabled, auto-lock input after completion, Esc to reset / Ctrl+Enter to change document
- Remembers the last practiced document

### Zen Mode
- Immersive typing experience similar to keybr.com
- **Hidden input box**: All text is revealed, free from input box distractions
- **Backspace disabled**: The Backspace key is completely blocked — you cannot modify typed content
- **Error retention**: Incorrect characters remain marked in red until the end of the exercise
- **Press Esc to exit**: Exit Zen mode at any time and save current progress
- **Independent statistics**: Training records in Zen mode are marked separately and can be filtered in the profile

### Chinese IME Optimization
- Correct handling for input methods like Pinyin/Wubi
- Uses `compositionstart` / `compositionend` events to ensure correctness is only judged after Chinese characters are confirmed and committed
- Intermediate states during Pinyin input do not trigger error detection

### Training Profile
- **Overview Statistics**: Total training sessions, total accuracy, historical max WPM, average WPM
- **Today's Statistics**: Today's training sessions, today's accuracy, today's max WPM, today's average WPM
- **WPM Trend Chart**: Line chart showing speed changes over the last 30 sessions (vertical layout, top-right legend)
- **Error Count Bar Chart**: Bar chart showing error counts over the last 30 sessions
- **Accuracy Trend Chart**: Line chart showing accuracy trends over the last 30 sessions (percentage)
- **Profile Filtering**: Supports "All" and "Zen Mode" sub-dataset filtering for independent data view
- History list: Last 30 session details (time, document, WPM/CPM, accuracy, error count)
- Zen mode records marked with a "Zen" badge
- Export / Import JSON history backup (maximum 500 records retained)
- One-click clear history (with confirmation dialog)

### Bilingual UI
- Support Chinese / English interface switching
- All system text, buttons, and chart titles support bilingual display
- Language preference saved in localStorage, auto-applied on next visit

### Theme Switching
5 built-in themes with real-time switching and persistent storage:
- System (default)
- Light Blue
- Dark
- Beige
- Green

## Quick Start

### Requirements
- Python 3.7+ (only used to start the local static server)
- Modern browser (Chrome / Edge / Firefox / Safari)

### Launch

```bash
python server.py              # Default port 8000
python server.py --port 8080  # Specify port
python server.py --open       # Auto-open browser after start
```

Console output after start:

```
Typing app running at http://127.0.0.1:8000/  (Ctrl+C to stop)
```

Open **http://127.0.0.1:8000/** in your browser to start using it.

Press `Ctrl + C` to stop the server.

### Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `Tab` | Switch to next document |
| `Esc` | Reset progress (normal mode) / Exit Zen mode |
| `Ctrl + Enter` | Change document (random) |
| `Ctrl + 1` | Switch to Practice view |
| `Ctrl + 2` | Switch to Profile view |

## Project Structure

```
typing-web/
├── server.py          # Local static server (with /api/docs endpoint, path security check)
├── index.html         # Page structure (Practice / Profile views, filter tabs)
├── style.css          # Styles and 4 themes, Zen mode styles
├── app.js             # Business logic: input detection, Zen mode, IME handling, stats, charts
├── docs/              # Text materials (.txt / .md)
│   ├── lolita_en.txt
│   ├── lolita_zh_1.txt
│   ├── proust_en.txt
│   ├── tang_poems.txt
│   ├── code_cpp.txt
│   ├── python_code.txt
│   └── ...
├── vendor/
│   └── chart.umd.min.js  # Chart.js local version
├── test_smoke.py      # Smoke tests (covering static files, docs, API, path security, etc.)
├── README.md
└── README.en.md
```

### Adding Custom Documents

Drop any `.txt` or `.md` file into the `docs/` directory. Refresh the page and it will appear in the document dropdown.

The `categorize()` function at the top of `app.js` automatically groups documents by filename prefix:
- `xxx_en.txt` → labeled as "English"
- `xxx_zh.txt` → labeled as "Chinese"
- `code_xxx` / `python_code` / `sql_query`, etc. → grouped under "Code / Symbols"
- Others → automatically grouped under "Other"

## Data Storage

All training records and theme preferences are stored in the browser's `localStorage`:

| Key | Content | Format |
|---|---|---|
| `typing_history` | Array of historical training records | JSON |
| `typing_theme` | Current theme | `blue` / `dark` / `beige` / `green` |
| `typing_zen` | Zen mode toggle | `"0"` / `"1"` |
| `typing_profile_filter` | Profile filter state | `"all"` / `"zen"` |

Each history record field:

```json
{
  "ts": 1718000000000,        // Timestamp
  "day": "2026-07-14",        // Date (local timezone)
  "doc": "lolita_en.txt",     // Document filename
  "wpm": 65,                  // Backward-compatible; English WPM or Chinese converted value
  "speed": 65,                // Current speed value
  "speedUnit": "wpm",         // "wpm" | "cpm"
  "acc": 98,                  // Current accuracy (0-100)
  "errors": 3,                // Error character count
  "typed": 412,               // Total typed characters
  "correct": 409,             // Correct characters
  "errorPairs": {"a": 2, "b": 1}, // Error-prone character pairs (optional)
  "zen": false                // Whether this was a Zen mode session
}
```

> **Note**: Data is bound to the browser/domain. Clearing browser cache, switching browsers, or opening in private mode will cause history records to be lost. For cross-device syncing, you need to extend with a backend API.

## Statistics Methodology

- **Total Training Sessions**: Total count of saved history records
- **Total Accuracy**: `Σ correct characters / Σ typed characters × 100` (character-weighted, more accurate than simple average)
- **Max WPM**: The maximum value across all records
- **Average WPM**: `Σ WPM per session / record count`
- **Today's Statistics**: Only counts records where the `day` field equals today
- **Zen Mode Filter**: Only counts records where the `zen` field is `true`

## Tech Stack

- **Frontend**: Vanilla HTML5 / CSS3 / JavaScript (no build step, no framework)
- **Charts**: Chart.js 4.4.1 (local vendor import, no CDN dependency)
- **Backend**: Python `http.server` (standard library, zero dependencies)

## FAQ

### Page shows "Unable to connect to server"
Confirm that `server.py` is running. If port 8000 is occupied, modify the `PORT` constant in `server.py`.

### Chart colors don't update after theme switching
Chart redraws automatically when switching themes. If the Profile view is not open, it will re-render when you navigate to it.

### No data in Profile after completing a practice
- Confirm the input field has filled the entire document (progress 100%)
- Check if the browser has disabled `localStorage` (may be restricted in private mode)

### How to switch documents in Zen mode
In Zen mode, the `Tab` key switches to the previous/next document, and `Esc` exits Zen mode.

## License

MIT