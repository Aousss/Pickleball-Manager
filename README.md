# RallyMate - Tournament Manager

An elegant, real-time Pickleball tournament management application designed with a glassmorphic dark-theme user interface. Built with HTML, Vanilla CSS, JavaScript, and Firebase Realtime Database.

---

## 🎨 Design System & Colors

The interface uses a modern, high-contrast sport court aesthetic.

| Token Name | Hex Code | Visual Reference | Purpose |
| :--- | :--- | :--- | :--- |
| **Deep Sea Green** | `#075056` | 🟢 Primary | Core court brand branding, primary buttons and main focus borders |
| **Blaze Orange** | `#FF5B04` | 🟠 Accent | Glowing highlights, active buttons, invitation codes, and key interactive triggers |
| **Court Blue** | `#3C85D4` | 🔵 Secondary | Auxiliary stats, secondary charts, and sub-nav badges |
| **Success Emerald** | `#10B981` | 🟢 Success | Wins, points additions, and online sync status |
| **Danger Crimson** | `#EF4444` | 🔴 Danger | Losses, wipes, offline/errors, and deletion warnings |
| **Mirage Black** | `#16232A` | ⚫ Background | Deep dark blue-grey canvas background & glass card bases |
| **Wild Sand** | `#E4EEF0` | ⚪ Contrast Text | Main high-contrast text and clean foreground elements |

---

## ⚙️ System Modules

The system is organized into modular pages to ensure high performance and clean structure:

### 1. 🔑 Gatekeeper & Authorization (`login.html`)
- Handles system entry point.
- **Host & Scorekeeper Access**: Redirects to Google Sign-in to authenticate organizers.
- **Spectator (Private access)**: Input box for entering a 6-character alphanumeric key (e.g. `264UYF`) to view secure private tournaments.
- **Spectator (Public access)**: Real-time public directory listing all open, non-private tournaments.

### 2. 🛠️ Tournament Configuration (`index.html`)
- Allows hosts to create and select tournaments.
- Features a **"Make Private"** checkbox configuration.
- Generates a shareable **6-character alphanumeric invitation code** for private tournaments.
- Input forms for quick addition of participants (one name per line).
- Actions to launch the tournament schedule and wipe database entries.

### 3. 🏓 Live Matches Tracker (`matches.html`)
- Displays ongoing rounds, matches, court numbers, and live timing statistics.
- Host/Scorekeeper scoring console to edit scores, decrement errors, and record active games.
- Real-time updates push automatically to spectators as scores change.

### 4. 🏆 Leaderboard & Rankings (`rankings.html`)
- Real-time tournament table calculated dynamically.
- Tracks player points, matches won, matches lost, and point differentials.
- Automatically handles tie-breakers.

### 5. 📊 Comparative Analytics (`analytics.html`)
- Features Head-to-Head comparison tools.
- Select two players to view comparative performance records, historic matches, and statistical summaries.

---

## ⚡ Tech Stack
- **Frontend**: HTML5, Vanilla CSS3 (Custom design system variables), JavaScript (ES6 Modules)
- **Database / Auth**: Firebase Realtime Database, Firebase Authentication (Google OAuth)
