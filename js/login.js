/**
 * RallyMate Tournament System - Login & Spectator Entrance Logic
 */

const syncDefaults = {
    apiKey: 'AIzaSyB9O2S3FAGq-74ekhNXLFAiSpeFGOvtcV8',
    projectId: 'pickleball-tournament-8240a',
    databaseURL: 'https://pickleball-tournament-8240a-default-rtdb.asia-southeast1.firebasedatabase.app/',
    room: 'tournament'
};

let db = null;
let auth = null;

// Initialize Firebase
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    setupCodeInputListeners();
    setupGenericListeners();
});

function initFirebase() {
    try {
        if (!window.firebase) {
            console.error("Firebase SDK missing");
            return;
        }

        const appConfig = {
            apiKey: syncDefaults.apiKey,
            projectId: syncDefaults.projectId,
            databaseURL: syncDefaults.databaseURL,
            authDomain: `${syncDefaults.projectId}.firebaseapp.com`
        };

        if (firebase.apps.length === 0) {
            firebase.initializeApp(appConfig);
        }

        db = firebase.database();
        auth = firebase.auth();

        // Check if user is already signed in (redirect to index.html if so)
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log("User already signed in, redirecting to index.html");
                window.location.href = 'index.html';
            }
        });

    } catch (err) {
        console.error("Firebase Init Error:", err);
    }
}

// 6-Character Code Inputs behavior: Auto-focus next field
function setupCodeInputListeners() {
    const boxes = document.querySelectorAll('.code-box');
    boxes.forEach(box => {
        box.addEventListener('input', (e) => {
            const val = e.target.value;
            const idx = parseInt(e.target.dataset.idx);

            // Force alphanumeric uppercase
            e.target.value = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

            if (e.target.value.length > 0 && idx < 5) {
                const next = document.getElementById(`c${idx + 1}`);
                if (next) next.focus();
            }

            // Check if all boxes are filled
            const code = getEnteredCode();
            if (code.length === 6) {
                // Auto trigger code submission
                joinByCode();
            }
        });

        box.addEventListener('keydown', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (e.key === 'Backspace' && e.target.value.length === 0 && idx > 0) {
                const prev = document.getElementById(`c${idx - 1}`);
                if (prev) {
                    prev.focus();
                    prev.value = '';
                }
            }
        });
    });
}

function setupGenericListeners() {
    // Add Click listener to google button explicitly to ensure it works
    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', loginWithGoogle);
    }

    // Add Join Code button listener
    const joinBtn = document.getElementById('join-code-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', joinByCode);
    }

    // Browse Public button listener
    const browseBtn = document.getElementById('browse-public-btn');
    if (browseBtn) {
        browseBtn.addEventListener('click', togglePublicList);
    }
}

function getEnteredCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        const box = document.getElementById(`c${i}`);
        if (box) {
            code += box.value.trim();
        }
    }
    return code.toUpperCase();
}

async function loginWithGoogle() {
    const errorEl = document.getElementById('signin-error');
    if (errorEl) errorEl.style.display = 'none';

    if (!auth) {
        alert("Firebase Auth is not initialized yet.");
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        // Authentication state changes observer redirects to index.html automatically
    } catch (err) {
        console.error("Google Sign-In Error:", err);
        if (errorEl) {
            errorEl.innerText = "Failed to sign in: " + err.message;
            errorEl.style.display = 'block';
        }
    }
}

async function joinByCode() {
    const code = getEnteredCode();
    const errorEl = document.getElementById('code-error');
    const loaderEl = document.getElementById('code-loading');

    if (errorEl) errorEl.style.display = 'none';

    if (code.length < 6) {
        if (errorEl) {
            errorEl.innerText = "Please enter all 6 characters of the code.";
            errorEl.style.display = 'block';
        }
        return;
    }

    if (!db) {
        alert("Database connection is offline.");
        return;
    }

    if (loaderEl) loaderEl.style.display = 'block';

    try {
        const snapshot = await db.ref('tournamentKeys/' + code).once('value');
        if (loaderEl) loaderEl.style.display = 'none';

        if (snapshot.exists()) {
            let roomId = snapshot.val();
            // In case it's stored as an object or simple string
            if (roomId && typeof roomId === 'object') {
                roomId = roomId.roomId;
            }

            if (roomId) {
                console.log(`Found tournament for code ${code}: ${roomId}`);
                enterAsSpectator(roomId);
            } else {
                showCodeError("Invalid key structure in database.");
            }
        } else {
            showCodeError("Tournament key not found. Please verify the code.");
        }
    } catch (err) {
        if (loaderEl) loaderEl.style.display = 'none';
        console.error("Code lookup error:", err);
        showCodeError("Database lookup failed: " + err.message);
    }
}

function showCodeError(msg) {
    const errorEl = document.getElementById('code-error');
    if (errorEl) {
        errorEl.innerText = msg;
        errorEl.style.display = 'block';
    }
}

function enterAsSpectator(roomId) {
    // 1. Fetch current config to merge or create new
    let syncConfig = { ...syncDefaults };
    const stored = localStorage.getItem('pickleball_firebase_config');
    if (stored) {
        try {
            syncConfig = { ...syncConfig, ...JSON.parse(stored) };
        } catch (e) {}
    }

    // 2. Set the target room
    syncConfig.room = roomId;
    localStorage.setItem('pickleball_firebase_config', JSON.stringify(syncConfig));

    // 3. Mark session flags
    sessionStorage.setItem('spectator_mode', 'true');
    sessionStorage.setItem('spectator_room', roomId);

    // 4. Redirect
    window.location.href = 'index.html';
}

let publicListVisible = false;

async function togglePublicList() {
    const panel = document.getElementById('public-tournaments-panel');
    const btn = document.getElementById('browse-public-btn');
    if (!panel) return;

    publicListVisible = !publicListVisible;
    if (publicListVisible) {
        panel.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Hide Public Tournaments';
        await loadPublicTournaments();
    } else {
        panel.style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-list"></i> Browse Public Tournaments';
    }
}

async function loadPublicTournaments() {
    const listEl = document.getElementById('public-tournaments-list');
    if (!listEl) return;

    listEl.innerHTML = `
        <div class="public-list-loading">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Fetching public tournaments...
        </div>
    `;

    if (!db) {
        listEl.innerHTML = `<div class="public-list-empty">Database connection unavailable.</div>`;
        return;
    }

    try {
        const snapshot = await db.ref('tournaments').once('value');
        listEl.innerHTML = '';

        if (!snapshot.exists()) {
            listEl.innerHTML = `<div class="public-list-empty">No tournaments found.</div>`;
            return;
        }

        let publicRooms = [];
        snapshot.forEach(child => {
            const roomId = child.key;
            const data = child.val();
            const meta = data.meta || {};
            const state = data.data || {};

            // Check if isPrivate is explicitly false or not set (fallback to public if no meta exists)
            const isPrivate = meta.isPrivate === true;

            if (!isPrivate) {
                const name = meta.name || roomId;
                const playerCount = (state.players) ? state.players.length : 0;
                publicRooms.push({ id: roomId, name: name, players: playerCount });
            }
        });

        if (publicRooms.length === 0) {
            listEl.innerHTML = `<div class="public-list-empty">No public tournaments available.</div>`;
            return;
        }

        publicRooms.forEach(room => {
            const item = document.createElement('div');
            item.className = 'public-item';
            item.innerHTML = `
                <div class="public-item-name">${room.name}</div>
                <div class="public-item-players"><i class="fa-solid fa-users"></i> ${room.players} players</div>
            `;
            item.onclick = () => enterAsSpectator(room.id);
            listEl.appendChild(item);
        });

    } catch (err) {
        console.error("Error loading public tournaments:", err);
        listEl.innerHTML = `<div class="public-list-empty">Failed to load: ${err.message}</div>`;
    }
}
