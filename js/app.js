/**
 * Pickleball Tournament System
 * Logic for managing players, matches, and rankings.
 */

// State
let state = {
    players: [],
    matches: [],
    playoffMatches: [], // Separate list for playoffs
    currentRound: 0,
    settings: {
        matchLimit: 20
    },
    isPlayoffStarted: false,
    lockedStats: null, // To store the frozen Regular Season standings
    rankingSort: { key: 'won', dir: 'desc' }
};

// DOM Elements
const elements = {
    navBtns: document.querySelectorAll('.nav-btn'),
    screens: document.querySelectorAll('.screen'),
    playerInput: document.getElementById('player-input'),
    addPlayerBtn: document.getElementById('add-player-btn'),
    playerList: document.getElementById('player-list'),
    startTournamentBtn: document.getElementById('start-tournament-btn'),
    startPlayoffsBtn: document.getElementById('start-playoffs-btn'),
    resetAllBtn: document.getElementById('reset-all-btn'),
    generateRoundBtn: document.getElementById('generate-round-btn'),
    matchesList: document.getElementById('matches-list'),
    playoffSection: document.getElementById('playoff-section'),
    playoffMatchesList: document.getElementById('playoff-matches-list'),
    rankingBody: document.getElementById('ranking-body'),
    scoringModal: document.getElementById('scoring-modal'),
    closeModalBtn: document.querySelector('.close-modal'),
    teamANames: document.getElementById('team-a-names'),
    teamBNames: document.getElementById('team-b-names'),
    scoreA: document.getElementById('score-a'),
    scoreB: document.getElementById('score-b'),
    btnScoreA: document.getElementById('btn-score-a'),
    btnScoreB: document.getElementById('btn-score-b'),
    btnMinusA: document.getElementById('btn-minus-a'),
    btnMinusB: document.getElementById('btn-minus-b'),
    finishMatchBtn: document.getElementById('finish-match-btn'),
    matchLimitInput: document.getElementById('match-limit'),
    championDisplay: document.getElementById('champion-display'),
    // Share & Data
    shareMatchesBtn: document.getElementById('share-matches-btn'),
    shareRankingsBtn: document.getElementById('share-rankings-btn'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),
    // Firebase
    fbApiKey: document.getElementById('fb-api-key'),
    fbProjectId: document.getElementById('fb-project-id'),
    fbDbUrl: document.getElementById('fb-db-url'),
    fbRoom: document.getElementById('fb-room'),
    fbConnectBtn: document.getElementById('fb-connect-btn'),
    syncStatus: document.getElementById('sync-status'),
    // Tournament Management
    tournamentSelect: document.getElementById('tournament-select'),
    newTournamentName: document.getElementById('new-tournament-name'),
    createTournamentBtn: document.getElementById('create-tournament-btn'),
    tournamentStatus: document.getElementById('tournament-status'),
    // Head to Head
    h2hPlayer1: document.getElementById('h2h-player-1'),
    h2hPlayer2: document.getElementById('h2h-player-2'),
    h2hResults: document.getElementById('h2h-results'),
    // Timer
    timerClock: document.getElementById('timer-clock')
};

// Timer variables
let timerInterval = null;
let timerStartedAt = null; // To track start time for live calculation
let baseElapsedTime = 0;   // Accumulated time before last pause

// Variables for temporary match scoring
let currentMatchId = null;
let tempScoreA = 0;
let tempScoreB = 0;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();


    // Initialize inputs from state
    if (elements.matchLimitInput) {
        elements.matchLimitInput.value = state.settings.matchLimit || 20;
    }

    // Full UI Refresh
    refreshUI();
    setupEventListeners();

    // Start global timer loop for the matches list
    setInterval(updateListTimers, 1000);
});

function setupEventListeners() {
    // Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;

            // UI Update
            elements.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            elements.screens.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });


    // Settings
    elements.matchLimitInput.addEventListener('change', (e) => {
        state.settings.matchLimit = parseInt(e.target.value) || 20;
        saveState();
        updateMatchHeader();
    });

    // Player Management
    elements.addPlayerBtn.addEventListener('click', addPlayer);
    elements.playerInput.addEventListener('keypress', (e) => {
        // If it's a textarea, Enter should add a newline (which is a divider), 
        // but we can also allow Ctrl+Enter to submit.
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addPlayer();
        }
    });

    elements.startTournamentBtn.addEventListener('click', () => {
        if (state.players.length < 4) {
            alert('You need at least 4 players to start.');
            return;
        }

        // If no matches exist, generate initial schedule automatically
        if (state.matches.length === 0) {
            regenerateSchedule();
        }

        navigateTo('matches-screen');
    });

    // Playoff Logic
    if (elements.startPlayoffsBtn) {
        elements.startPlayoffsBtn.addEventListener('click', startPlayoffs);
    }

    elements.resetAllBtn.addEventListener('click', () => {
        if (confirm('Are you sure? This will delete all data.')) {
            state = {
                players: [],
                matches: [],
                playoffMatches: [],
                currentRound: 0,
                settings: { matchLimit: 20 },
                isPlayoffStarted: false,
                lockedStats: null
            };
            elements.matchLimitInput.value = 20;
            saveState();
            refreshUI(); // Use new helper
            alert("System Reset.");
        }
    });

    // Match Management
    elements.generateRoundBtn.addEventListener('click', regenerateSchedule);

    // Scoring Modal
    elements.closeModalBtn.addEventListener('click', closeScoringModal);
    elements.btnScoreA.addEventListener('click', () => updateTempScore('A', 1));
    elements.btnScoreB.addEventListener('click', () => updateTempScore('B', 1));
    elements.btnMinusA.addEventListener('click', () => updateTempScore('A', -1));
    elements.btnMinusB.addEventListener('click', () => updateTempScore('B', -1));
    elements.finishMatchBtn.addEventListener('click', finishMatch);

    const resetMatchBtn = document.getElementById('reset-match-btn');
    if (resetMatchBtn) {
        resetMatchBtn.addEventListener('click', resetMatchScore);
    }

    // Share & Data Listeners
    if (elements.shareMatchesBtn) elements.shareMatchesBtn.addEventListener('click', shareMatches);
    if (elements.shareRankingsBtn) elements.shareRankingsBtn.addEventListener('click', shareRankings);

    // Leaderboard Sorting
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (state.rankingSort.key === key) {
                state.rankingSort.dir = state.rankingSort.dir === 'desc' ? 'asc' : 'desc';
            } else {
                state.rankingSort.key = key;
                // Default 'lost' to ascending (least losses at top)
                state.rankingSort.dir = key === 'lost' ? 'asc' : 'desc';
            }
            saveState();
            refreshUI(); // Use refreshUI instead of updateRankings to ensure everything is in sync
        });
    });

    // Firebase Connect
    if (elements.fbConnectBtn) {
        elements.fbConnectBtn.addEventListener('click', () => {
            saveFirebaseConfig();
            initFirebase();
        });
    }

    // Tournament Management
    if (elements.createTournamentBtn) {
        elements.createTournamentBtn.addEventListener('click', createNewTournament);
    }
    if (elements.newTournamentName) {
        elements.newTournamentName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createNewTournament();
        });
    }
    if (elements.tournamentSelect) {
        elements.tournamentSelect.addEventListener('change', switchTournament);
    }

    // Head-to-Head Listeners
    if (elements.h2hPlayer1) {
        elements.h2hPlayer1.addEventListener('change', renderH2H);
    }
    if (elements.h2hPlayer2) {
        elements.h2hPlayer2.addEventListener('change', renderH2H);
    }

    // Auto-expand textarea
    if (elements.playerInput && elements.playerInput.tagName === 'TEXTAREA') {
        elements.playerInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    // Head to Head
    if (elements.h2hPlayer1) elements.h2hPlayer1.addEventListener('change', renderH2H);
    if (elements.h2hPlayer2) elements.h2hPlayer2.addEventListener('change', renderH2H);
}

// --- Navigation Helper ---
function navigateTo(screenId) {
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.target === screenId);
    });
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.toggle('active', s.id === screenId);
    });
}

// --- Player Logic ---
function startPlayoffs() {
    // TOGGLE LOGIC: If started, allow cancel
    if (state.isPlayoffStarted) {
        if (!confirm("Unlock Standings and Cancel Playoffs? \n\nThis will hide the championship match and revert the leaderboard to live stats.")) return;

        state.isPlayoffStarted = false;
        state.lockedStats = null;
        // We don't delete the match data, just hide it via the flag, 
        // but if they start again, it gets overwritten.

        saveState();
        renderMatches();
        updateRankings();
        updateMatchHeader();
        return;
    }

    // 1. Validation
    if (state.matches.filter(m => m.completed).length === 0) {
        alert("Play at least some matches before starting playoffs!");
        return;
    }

    if (!confirm("Start Playoffs? \n\n1. Regular Season Standings will be LOCKED.\n2. Only the Top 4 Ranked players will advance.\n3. A Championship match will appear in the Matches screen.")) {
        return;
    }

    // 2. Identify Top 4
    // We must use strict ranking logic here
    const sorted = [...state.players].sort((a, b) => {
        if (b.stats.won !== a.stats.won) return b.stats.won - a.stats.won;
        return b.stats.points - a.stats.points;
    });

    const top4 = sorted.slice(0, 4);
    if (top4.length < 4) {
        alert("Need at least 4 players for playoffs.");
        return;
    }

    // 3. Freeze Stats
    state.isPlayoffStarted = true;
    // Deep copy current player stats to lockedStats
    state.lockedStats = state.players.map(p => ({
        id: p.id,
        name: p.name,
        stats: { ...p.stats }
    }));

    // 4. Create Final Match(es)
    state.playoffMatches = []; // Reset any old playoff data

    // Ask for Format
    const isBestOf3 = confirm("Play Championship as Best of 3 Series?\n\nOK = Yes (Best of 3)\nCancel = No (1 Match Winner Takes All)");
    const matchCount = isBestOf3 ? 3 : 1;

    const p1 = top4[0];
    const p2 = top4[1];
    const p3 = top4[2];
    const p4 = top4[3];

    for (let i = 1; i <= matchCount; i++) {
        let label = null;
        if (isBestOf3) {
            label = `Game ${i}`;
            if (i === 3) label += " (If Needed)";
        }

        const finalMatch = {
            id: 'final-' + Date.now() + '-' + i,
            round: 999, // Special Playoff Round
            teamA: [p1.id, p4.id], // 1 & 4
            teamB: [p2.id, p3.id], // 2 & 3
            scoreA: 0,
            scoreB: 0,
            completed: false,
            isPlayoff: true,
            playoffLabel: label,
            elapsedTime: 0,
            isLive: false
        };
        state.playoffMatches.push(finalMatch);
    }

    saveState();

    renderMatches(); // Will show new playoff section
    updateRankings(); // Will lock table
    updateMatchHeader();

    navigateTo('matches-screen');
    alert(`Playoffs Started! ${isBestOf3 ? 'Best of 3 Series' : 'Single Match Championship'} created.`);
}

function addPlayer() {
    if (document.body.classList.contains('viewer-mode')) {
        alert("You are in Viewer Mode. Switch to Admin mode in Setup to add players.");
        return;
    }

    if (!syncConfig.room || syncConfig.room === "") {
        alert("Please select or create an active tournament before adding players.");
        return;
    }

    const rawInput = elements.playerInput.value;
    if (!rawInput.trim()) return;

    // Split by newlines OR commas (allowing spaces within names for "First Last")
    const names = rawInput.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");

    if (names.length === 0) return;

    if (!state.players) state.players = [];

    names.forEach(name => {
        // Check if player already exists (case-insensitive)
        if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            console.log("Skipping duplicate player:", name);
            return;
        }

        const newPlayer = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            name: name,
            stats: { assigned: 0, completed: 0, won: 0, lost: 0, points: 0, livePoints: 0 }
        };

        state.players.push(newPlayer);
    });

    elements.playerInput.value = '';
    elements.playerInput.style.height = 'auto';

    saveState();
    refreshUI();

    if (names.length === 1) {
        updateSyncStatus(`Added ${names[0]}`);
    } else {
        updateSyncStatus(`Added ${names.length} players`);
    }
}

function removePlayer(id) {
    if (confirm('Remove this player?')) {
        state.players = state.players.filter(p => p.id !== id);
        saveState();
        refreshUI();
    }
}

function renderPlayers() {
    elements.playerList.innerHTML = '';

    if (state.players.length === 0) {
        elements.playerList.innerHTML = '<li class="empty-state">No players added yet.</li>';
        return;
    }

    state.players.forEach(player => {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.innerHTML = `
            <span>${player.name}</span>
            <button class="delete-btn" onclick="removePlayer('${player.id}')"><i class="fa-solid fa-trash"></i></button>
        `;
        elements.playerList.appendChild(li);
    });
}

// Global scope for onclick
window.removePlayer = removePlayer;

// --- Match Logic ---
function regenerateSchedule() {
    if (document.body.classList.contains('viewer-mode')) return;

    if (!state.players || state.players.length < 4) {
        alert('Not enough players (min 4).');
        return;
    }

    const limit = state.settings.matchLimit || 20;
    const completedMatches = (state.matches || []).filter(m => m.completed);

    if (completedMatches.length >= limit) {
        alert(`You already have ${completedMatches.length} completed matches. Increase the limit to generate more.`);
        state.matches = completedMatches;
        saveState();
        refreshUI();
        return;
    }

    if (state.matches && state.matches.length > completedMatches.length) {
        if (!confirm("This will reshuffle all UNPLAYED matches. Completed matches will stay. Continue?")) return;
    }

    // 1. Build history matrices for Fairness (Variety)
    const partnerHistory = {}; // count of times p1 partnered with p2
    const opponentHistory = {}; // count of times p1 opposed p2

    const increment = (obj, id1, id2) => {
        const key = [id1, id2].sort().join('|');
        obj[key] = (obj[key] || 0) + 1;
    };
    const getCount = (obj, id1, id2) => {
        const key = [id1, id2].sort().join('|');
        return obj[key] || 0;
    };

    // Analyze completed matches
    completedMatches.forEach(m => {
        increment(partnerHistory, m.teamA[0], m.teamA[1]);
        increment(partnerHistory, m.teamB[0], m.teamB[1]);
        m.teamA.forEach(a => m.teamB.forEach(b => increment(opponentHistory, a, b)));
    });

    state.matches = completedMatches;

    // 2. Generation Loop
    let currentCount = state.matches.length;
    let newMatchesList = [];

    // Local tracking of play counts
    let playersPool = state.players.map(p => ({
        id: p.id,
        count: 0
    }));

    // Pre-seed counts from completed matches
    state.matches.forEach(m => {
        [...m.teamA, ...m.teamB].forEach(pid => {
            const p = playersPool.find(item => item.id === pid);
            if (p) p.count++;
        });
    });

    let safety = 0;
    while (currentCount < limit && safety < 1000) {
        safety++;

        // 3. Selection: Strictly enforce Max Difference 1
        // We calculate the minimum count in the entire pool
        const minC = Math.min(...playersPool.map(p => p.count));

        // Players who are at the absolute minimum
        let eligible = playersPool.filter(p => p.count === minC);

        let p = [];
        if (eligible.length >= 4) {
            // We have enough people at the minimum to fill a match
            // Shuffle them for variety and pick 4
            eligible.sort(() => Math.random() - 0.5);
            p = eligible.slice(0, 4);
        } else {
            // We MUST take everyone at the minimum count
            p = [...eligible];
            // Then fill the remaining spots from those at minC + 1
            let nextLayer = playersPool.filter(p => p.count === minC + 1);
            nextLayer.sort(() => Math.random() - 0.5);
            p = p.concat(nextLayer.slice(0, 4 - p.length));
        }

        const pIds = p.map(item => item.id);

        /**
         * 4. Optimization: evaluate the 3 possible ways to pair these 4 players
         * Option 1: (0,1) vs (2,3)
         * Option 2: (0,2) vs (1,3)
         * Option 3: (0,3) vs (1,2)
         */
        const configs = [
            { tA: [pIds[0], pIds[1]], tB: [pIds[2], pIds[3]] },
            { tA: [pIds[0], pIds[2]], tB: [pIds[1], pIds[3]] },
            { tA: [pIds[0], pIds[3]], tB: [pIds[1], pIds[2]] }
        ];

        let bestConfig = null;
        let minPenalty = Infinity;

        configs.forEach(cfg => {
            // Penalty for repeating Partners
            const p1Freq = getCount(partnerHistory, cfg.tA[0], cfg.tA[1]);
            const p2Freq = getCount(partnerHistory, cfg.tB[0], cfg.tB[1]);

            // Weighting: 
            // 0 repeats = 0 penalty (favors "minimum 1")
            // 1 repeat  = 50 penalty (allows "at most 2" if needed)
            // 2+ repeats = 2000 penalty (heavily discourages > 2)
            let pPenalty = 0;
            pPenalty += (p1Freq === 0) ? 0 : (p1Freq === 1 ? 50 : 2000);
            pPenalty += (p2Freq === 0) ? 0 : (p2Freq === 1 ? 50 : 2000);

            // Penalty for repeating Opponents (Weight 2)
            let oPenalty = 0;
            cfg.tA.forEach(a => cfg.tB.forEach(b => {
                oPenalty += getCount(opponentHistory, a, b);
            }));

            const totalPenalty = pPenalty + (oPenalty * 2);

            if (totalPenalty < minPenalty) {
                minPenalty = totalPenalty;
                bestConfig = cfg;
            } else if (totalPenalty === minPenalty && Math.random() > 0.5) {
                bestConfig = cfg;
            }
        });

        // 5. Commit Match
        const maxRound = state.matches.reduce((max, m) => Math.max(max, m.round || 0), 0) +
            newMatchesList.reduce((max, m) => Math.max(max, m.round || 0), 0);

        const match = {
            id: 'm-' + Date.now() + '-' + safety,
            round: maxRound + 1,
            teamA: bestConfig.tA,
            teamB: bestConfig.tB,
            scoreA: 0,
            scoreB: 0,
            completed: false,
            elapsedTime: 0,
            isLive: false
        };

        newMatchesList.push(match);

        // Update temporary metrics for next loop iteration
        increment(partnerHistory, bestConfig.tA[0], bestConfig.tA[1]);
        increment(partnerHistory, bestConfig.tB[0], bestConfig.tB[1]);
        bestConfig.tA.forEach(a => bestConfig.tB.forEach(b => increment(opponentHistory, a, b)));

        p.forEach(item => item.count++);
        currentCount++;
    }

    state.matches = [...state.matches, ...newMatchesList];
    saveState();
    refreshUI();
}

function updateMatchHeader() {
    const limit = state.settings.matchLimit || 20;
    const count = state.matches.length;
    const completedCount = state.matches.filter(m => m.completed).length;

    const header = document.querySelector('#matches-screen h2');
    if (header) {
        header.innerText = `Matches (${completedCount} done / ${limit} total)`;
    }

    elements.generateRoundBtn.style.opacity = '1';
    elements.generateRoundBtn.disabled = false;

    if (count === 0) {
        elements.generateRoundBtn.innerText = 'Generate Schedule';
    } else {
        elements.generateRoundBtn.innerText = 'Update Schedule';
    }
}

function renderMatches() {
    // 1. Pre-calculate pairing frequencies up to each match
    const partnerFreq = {};
    const matchFreqMap = {};

    state.matches.forEach(m => {
        const keyA = [...m.teamA].sort().join('|');
        const keyB = [...m.teamB].sort().join('|');

        partnerFreq[keyA] = (partnerFreq[keyA] || 0) + 1;
        partnerFreq[keyB] = (partnerFreq[keyB] || 0) + 1;

        matchFreqMap[m.id] = { a: partnerFreq[keyA], b: partnerFreq[keyB] };
    });

    // 2. Regular Matches
    elements.matchesList.innerHTML = '';
    if (state.matches.length === 0) {
        elements.matchesList.innerHTML = `
            <div class="empty-state-card">
                <i class="fa-solid fa-table-tennis-paddle-ball"></i>
                <p>No active matches. Start the tournament or generate a round.</p>
            </div>
        `;
    } else {
        state.matches.forEach(match => {
            elements.matchesList.appendChild(createMatchCard(match, matchFreqMap[match.id]));
        });
    }

    // 2. Playoff Matches
    if (state.isPlayoffStarted && state.playoffMatches.length > 0) {
        elements.playoffSection.style.display = 'block';
        elements.playoffMatchesList.innerHTML = '';
        state.playoffMatches.forEach(match => {
            elements.playoffMatchesList.appendChild(createMatchCard(match));
        });

        // Check for winner
        checkPlayoffWinner();
    } else {
        if (elements.playoffSection) elements.playoffSection.style.display = 'none';
        if (elements.championDisplay) elements.championDisplay.style.display = 'none';
    }
}

function checkPlayoffWinner() {
    if (!elements.championDisplay) return;

    let winsA = 0;
    let winsB = 0;
    let requiredWins = 1;

    // Determine format
    // If we have > 1 scheduled playoff matches, it's Best of 3 (so need 2 wins)
    // Actually simpler: Best of 3 means length is 3 (or 2 if 3rd not needed yet? No we generated all)
    // Let's check max ID count or just assumption based on previous logic.
    // Previous logic generated 1 or 3 matches.
    if (state.playoffMatches.length > 1) {
        requiredWins = 2;
    }

    const firstMatch = state.playoffMatches[0];
    const p1 = getPlayer(firstMatch.teamA[0]);
    const p2 = getPlayer(firstMatch.teamA[1]);
    const p3 = getPlayer(firstMatch.teamB[0]);
    const p4 = getPlayer(firstMatch.teamB[1]);

    state.playoffMatches.forEach(m => {
        if (!m.completed) return;
        if (m.scoreA > m.scoreB) winsA++;
        else if (m.scoreB > m.scoreA) winsB++;
    });

    let winnerName = '';
    let winnerFound = false;

    if (winsA >= requiredWins) {
        winnerName = `${p1.name} & ${p2.name}`;
        winnerFound = true;
    } else if (winsB >= requiredWins) {
        winnerName = `${p3.name} & ${p4.name}`;
        winnerFound = true;
    }

    if (winnerFound) {
        elements.championDisplay.style.display = 'block';
        elements.championDisplay.innerHTML = `
            <div style="background: linear-gradient(135deg, var(--warning), #b45309); padding: 24px; border-radius: var(--radius-md); color: black; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.4); animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <div style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; opacity: 0.8; letter-spacing: 1px;">Tournament Champions</div>
                <div style="font-size: 2rem; font-weight: 900; line-height: 1.1; margin-bottom: 12px;">
                    <i class="fa-solid fa-crown" style="margin-right: 8px;"></i>
                    ${winnerName}
                    <i class="fa-solid fa-crown" style="margin-left: 8px;"></i>
                </div>
                <div style="font-size: 1rem; font-weight: 700; opacity: 0.9;">Score: ${Math.max(winsA, winsB)} - ${Math.min(winsA, winsB)}</div>
            </div>
            <style>
                @keyframes popIn { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            </style>
        `;
    } else {
        elements.championDisplay.style.display = 'none';
        elements.championDisplay.innerHTML = '';
    }
}

function createMatchCard(match, pairingInfo = null) {
    const p1 = getPlayer(match.teamA[0]);
    const p2 = getPlayer(match.teamA[1]);
    const p3 = getPlayer(match.teamB[0]);
    const p4 = getPlayer(match.teamB[1]);

    if (!p1 || !p2 || !p3 || !p4) return document.createElement('div');

    const div = document.createElement('div');
    div.className = `match-card ${match.completed ? 'completed' : ''}`;
    if (match.isPlayoff) div.style.borderColor = 'var(--warning)';

    div.onclick = () => openScoringModal(match.id);

    let title = '';
    if (match.isPlayoff) {
        const label = match.playoffLabel ? ` - ${match.playoffLabel}` : '';
        title = `<div style="color:var(--warning); font-weight:800; font-size:0.75rem; margin-bottom:8px; text-transform: uppercase; letter-spacing: 1px;">🏆 CHAMPIONSHIP MATCH${label}</div>`;
    }

    div.innerHTML = `
        <div class="match-card-content" style="width: 100%;">
            ${title}
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px;">
                <div class="match-team team-a" style="flex: 1; text-align: right; font-weight: 700; font-size: 0.95rem; line-height: 1.3;">
                    ${p1.name}<br>${p2.name}
                </div>
                
                <div class="match-score-center" style="min-width: 90px; text-align: center;">
                    ${(match.completed || match.isLive)
            ? `<span style="font-size: 1.5rem; font-weight: 900; color: var(--accent); letter-spacing: 2px;">${match.scoreA}:${match.scoreB}</span>`
            : '<span style="font-size: 0.65rem; font-weight: 800; opacity: 0.4; text-transform: uppercase; letter-spacing: 1.5px;">Ready</span>'
        }
                </div>

                <div class="match-team team-b" style="flex: 1; text-align: left; font-weight: 700; font-size: 0.95rem; line-height: 1.3;">
                    ${p3.name}<br>${p4.name}
                </div>
            </div>
            <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,0.03); pt: 8px;">
                <div style="display: flex; justify-content: center; align-items: center; gap: 12px;">
                    <div class="match-status ${match.completed ? 'done' : ''}" style="margin: 0; font-size: 0.65rem; opacity: 0.6;">
                        ${match.completed ? 'MATCH COMPLETED' : (match.isLive ? '' : 'AWAITING SCORE')}
                    </div>
                    ${match.isLive && !match.completed ? `
                        <div class="live-label">
                            <span class="live-dot"></span> LIVE
                        </div>
                    ` : ''}
                    <div class="match-duration-box" data-match-id="${match.id}" style="font-size: 0.75rem; color: var(--accent); font-weight: 700; font-family: monospace; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-clock" style="font-size: 0.6rem; opacity: 0.7;"></i>
                        <span class="duration-text">${formatTimeDisplay(calculateCurrentMatchTime(match))}</span>
                    </div>
                </div>
                
                ${pairingInfo ? `
                <div class="pairing-info" style="font-size: 0.65rem; color: var(--text-secondary); display: flex; justify-content: center; gap: 10px; font-weight: 600; opacity: 0.8;">
                    <span>num of match paired:</span>
                    <span style="${pairingInfo.a > 2 ? 'color: #fbbf24;' : ''}">Team A: ${pairingInfo.a}${pairingInfo.a > 2 ? ' ⚠️' : ''}</span>
                    <span style="${pairingInfo.b > 2 ? 'color: #fbbf24;' : ''}">Team B: ${pairingInfo.b}${pairingInfo.b > 2 ? ' ⚠️' : ''}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    return div;
}

function getPlayer(id) {
    return state.players.find(p => p.id === id);
}

// --- Scoring Logic ---
function openScoringModal(matchId) {
    // Find in matches OR playoffMatches
    let match = state.matches.find(m => m.id === matchId);
    if (!match) match = state.playoffMatches.find(m => m.id === matchId);

    if (!match) return;

    currentMatchId = matchId;
    tempScoreA = match.scoreA;
    tempScoreB = match.scoreB;

    const p1 = getPlayer(match.teamA[0]);
    const p2 = getPlayer(match.teamA[1]);
    const p3 = getPlayer(match.teamB[0]);
    const p4 = getPlayer(match.teamB[1]);

    elements.teamANames.innerText = `${p1.name} & ${p2.name}`;
    elements.teamBNames.innerText = `${p3.name} & ${p4.name}`;

    updateScoreDisplay();
    elements.scoringModal.classList.add('active');

    // Start Timer Logic
    if (!match.completed && !match.isLive) {
        match.isLive = true;
        match.timerStartedAt = Date.now();
        saveState();
    }

    startTimer(match);
}

function closeScoringModal() {
    elements.scoringModal.classList.remove('active');
    stopTimer(); // Just clear the UI interval, don't stop match.isLive
    currentMatchId = null;
}

function updateTempScore(team, delta) {
    if (team === 'A') {
        tempScoreA = Math.max(0, tempScoreA + delta);
    } else {
        tempScoreB = Math.max(0, tempScoreB + delta);
    }
    updateScoreDisplay();

    // Sync with state so other users see live updates
    let match = state.matches.find(m => m.id === currentMatchId);
    if (!match) match = state.playoffMatches.find(m => m.id === currentMatchId);

    if (match) {
        match.scoreA = tempScoreA;
        match.scoreB = tempScoreB;

        // If score changes, ensure timer is LIVE (only if not completed)
        if (!match.isLive && !match.completed) {
            match.isLive = true;
            match.timerStartedAt = Date.now();
            startTimer(match);
        }

        // Push update to cloud
        saveState();
        refreshUI(); // Immediate local feedback
    }
}

function updateScoreDisplay() {
    elements.scoreA.innerText = tempScoreA;
    elements.scoreB.innerText = tempScoreB;
}

function finishMatch() {
    if (!currentMatchId) return;

    let match = state.matches.find(m => m.id === currentMatchId);
    if (!match) match = state.playoffMatches.find(m => m.id === currentMatchId);

    if (!match) {
        closeScoringModal();
        return;
    }

    // Save scores
    match.scoreA = tempScoreA;
    match.scoreB = tempScoreB;
    match.completed = true;
    match.isLive = false; // Force end live status

    // Stop Timer Logic
    if (match.timerStartedAt) {
        const now = Date.now();
        match.elapsedTime += Math.floor((now - match.timerStartedAt) / 1000);
        match.timerStartedAt = null; // Reset start marker
    }

    // Close first for better UX, then save/refresh
    closeScoringModal();
    refreshUI();
    saveState();
}

function resetMatchScore() {
    if (!currentMatchId) return;

    if (!confirm('Are you sure you want to reset this match? It will be marked as incomplete.')) return;

    let match = state.matches.find(m => m.id === currentMatchId);
    if (!match) match = state.playoffMatches.find(m => m.id === currentMatchId);

    if (!match) {
        closeScoringModal();
        return;
    }

    match.scoreA = 0;
    match.scoreB = 0;
    match.completed = false;
    match.elapsedTime = 0;
    match.isLive = false;

    // Close first, then process
    closeScoringModal();
    refreshUI();
    saveState();
}

// Timer Functions
function startTimer(match) {
    if (timerInterval) clearInterval(timerInterval);

    // Update display once immediately
    updateTimerDisplay(match);

    timerInterval = setInterval(() => {
        updateTimerDisplay(match);
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
}

function updateTimerDisplay(match) {
    if (!elements.timerClock) return;
    elements.timerClock.innerText = formatTimeDisplay(calculateCurrentMatchTime(match));
}

// Global Match List Timers
function updateListTimers() {
    // Only bother if we are on the matches screen
    const matchesScreen = document.getElementById('matches-screen');
    if (!matchesScreen || !matchesScreen.classList.contains('active')) return;

    document.querySelectorAll('.match-duration-box').forEach(box => {
        const matchId = box.dataset.matchId;
        // Find match in state
        let match = state.matches.find(m => m.id === matchId);
        if (!match) match = state.playoffMatches.find(m => m.id === matchId);

        if (match && match.isLive && !match.completed) {
            const textEl = box.querySelector('.duration-text');
            if (textEl) textEl.innerText = formatTimeDisplay(calculateCurrentMatchTime(match));

            // Also update the live score in the list for spectators
            const scoreEl = box.closest('.match-card').querySelector('.match-score-center');
            if (scoreEl) {
                scoreEl.innerHTML = `<span style="font-size: 1.3rem; font-weight: 800; color: var(--accent);">${match.scoreA} : ${match.scoreB}</span>`;
            }
        }
    });
}

function calculateCurrentMatchTime(match) {
    let totalSeconds = match.elapsedTime || 0;
    if (match.isLive && match.timerStartedAt) {
        const now = Date.now();
        const liveSeconds = Math.floor((now - match.timerStartedAt) / 1000);
        totalSeconds += liveSeconds;
    }
    return totalSeconds;
}

function formatTimeDisplay(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// --- Ranking Logic ---
function recalculateStats() {
    if (!state.players || !Array.isArray(state.players)) return;

    // Reset stats to new structure
    state.players.forEach(p => {
        p.stats = { assigned: 0, completed: 0, won: 0, lost: 0, points: 0, livePoints: 0 };
        p.isLivePlaying = false;
        p.liveSide = null;
        p.liveMatchColorIndex = 0;
    });

    if (!state.matches || !Array.isArray(state.matches)) return;

    let liveMatchCount = 0;
    const liveMatchMap = new Map();

    state.matches.forEach(m => {
        const playersIds = [...m.teamA, ...m.teamB];

        if (m.isLive && !m.completed) {
            if (!liveMatchMap.has(m.id)) {
                liveMatchMap.set(m.id, liveMatchCount++);
            }
        }

        playersIds.forEach(pid => {
            const p = getPlayer(pid);
            if (p) {
                p.stats.assigned++;

                if (m.isLive && !m.completed) {
                    p.isLivePlaying = true;
                    p.liveSide = m.teamA.includes(pid) ? 'A' : 'B';
                    p.liveMatchColorIndex = liveMatchMap.get(m.id);
                    if (p.liveSide === 'A') p.stats.livePoints += (m.scoreA || 0);
                    else p.stats.livePoints += (m.scoreB || 0);
                }

                if (m.completed) {
                    p.stats.completed++;
                    if (m.teamA.includes(pid)) {
                        p.stats.points += (m.scoreA || 0);
                        if (m.scoreA > m.scoreB) p.stats.won++;
                        else if (m.scoreA < m.scoreB) p.stats.lost++;
                    } else {
                        p.stats.points += (m.scoreB || 0);
                        if (m.scoreB > m.scoreA) p.stats.won++;
                        else if (m.scoreB < m.scoreA) p.stats.lost++;
                    }
                }
            }
        });
    });
}

function getH2HResult(id1, id2) {
    let p1Wins = 0;
    let p2Wins = 0;

    // Use Regular Matches for H2H tie-breaker
    state.matches.forEach(m => {
        if (!m.completed) return;
        const p1A = m.teamA.includes(id1);
        const p1B = m.teamB.includes(id1);
        const p2A = m.teamA.includes(id2);
        const p2B = m.teamB.includes(id2);

        // Count only matches where they were opponents
        if ((p1A && p2B) || (p1B && p2A)) {
            const teamAWon = m.scoreA > m.scoreB;
            if (p1A) {
                if (teamAWon) p1Wins++; else p2Wins++;
            } else {
                if (!teamAWon) p1Wins++; else p2Wins++;
            }
        }
    });

    if (p1Wins > p2Wins) return -1; // Player 1 ranks higher
    if (p2Wins > p1Wins) return 1;  // Player 2 ranks higher
    return 0;
}

function updateRankings() {
    // If playoffs started, use LOCKED stats for rendering
    let displayPlayers = [];
    let isLocked = false;

    if (state.isPlayoffStarted && state.lockedStats) {
        displayPlayers = state.lockedStats;
        isLocked = true;

        // Update Button to "Cancel" state
        if (elements.startPlayoffsBtn) {
            elements.startPlayoffsBtn.style.display = 'inline-block';
            elements.startPlayoffsBtn.innerText = "Cancel Playoffs";
            elements.startPlayoffsBtn.style.background = "#ef4444"; // Red for cancel
            elements.startPlayoffsBtn.style.color = "white";
        }

        const headerH2 = document.querySelector('#ranking-screen h2');
        if (headerH2 && !headerH2.innerHTML.includes('LOCKED')) {
            headerH2.innerHTML = 'Leaderboard <span style="font-size:0.4em; background:#ef4444; padding:2px 6px; border-radius:4px; vertical-align:middle;">LOCKED</span>';
        }

    } else {
        // Live stats matches
        displayPlayers = state.players.map(p => ({
            ...p
        }));

        // Reset Header
        const headerH2 = document.querySelector('#ranking-screen h2');
        if (headerH2) headerH2.innerHTML = 'Leaderboard';

        // Show button if we have players
        if (state.players.length >= 4) {
            if (elements.startPlayoffsBtn) {
                elements.startPlayoffsBtn.style.display = 'inline-block';
                elements.startPlayoffsBtn.innerText = "Start Playoffs (Top 4)";
                elements.startPlayoffsBtn.style.background = "linear-gradient(135deg, #fbbf24, #d97706)";
                elements.startPlayoffsBtn.style.color = "black";
            }
        } else {
            if (elements.startPlayoffsBtn) elements.startPlayoffsBtn.style.display = 'none';
        }
    }

    // Update Header Icons
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.toggle('active', th.dataset.sort === state.rankingSort.key);
        const icon = th.querySelector('i');
        if (icon) {
            if (th.dataset.sort === state.rankingSort.key) {
                icon.className = state.rankingSort.dir === 'desc' ? 'fa-solid fa-sort-down' : 'fa-solid fa-sort-up';
            } else {
                icon.className = 'fa-solid fa-sort';
            }
        }
    });

    // Sort: Wins -> H2H -> Pts
    const sorted = [...displayPlayers].sort((a, b) => {
        const key = state.rankingSort.key;
        const isAsc = state.rankingSort.dir === 'asc';
        const dir = isAsc ? 1 : -1;

        // 1. Primary Sort (clicked column)
        const valA = key === 'points' ? (a.stats.points + (a.stats.livePoints || 0)) : a.stats[key];
        const valB = key === 'points' ? (b.stats.points + (b.stats.livePoints || 0)) : b.stats[key];

        if (valA !== valB) {
            return (valA - valB) * dir;
        }

        // --- Tie Breaking (Standard Standing Rules) ---

        // 2. Fallback to Wins (if not already primary)
        if (key !== 'won' && b.stats.won !== a.stats.won) {
            return b.stats.won - a.stats.won;
        }

        // 3. Head-to-Head
        const h2h = getH2HResult(a.id, b.id);
        if (h2h !== 0) return h2h;

        // 4. Total Points (if not already primary)
        const totalA = a.stats.points + (a.stats.livePoints || 0);
        const totalB = b.stats.points + (b.stats.livePoints || 0);
        return totalB - totalA;
    });

    elements.rankingBody.innerHTML = '';

    sorted.forEach((p, index) => {
        const tr = document.createElement('tr');
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        const playDisplay = `${p.stats.completed}/${p.stats.assigned}`;
        const totalPoints = p.stats.points + (p.stats.livePoints || 0);

        // Find if player is live and their side
        const isLive = p.isLivePlaying;
        const side = p.liveSide; // 'A' or 'B'
        const colorIdx = p.liveMatchColorIndex || 0;

        let rowStyle = '';
        let dotColor = '#ef4444';
        let accentColor = 'var(--accent)';

        const colorPalettes = [
            { a: '#6366f1', b: '#d946ef', bgA: 'rgba(99, 102, 241, 0.1)', bgB: 'rgba(217, 70, 239, 0.1)' }, // Indigo / Fuchsia
            { a: '#10b981', b: '#f59e0b', bgA: 'rgba(16, 185, 129, 0.1)', bgB: 'rgba(245, 158, 11, 0.1)' }, // Emerald / Amber
            { a: '#0ea5e9', b: '#f43f5e', bgA: 'rgba(14, 165, 233, 0.1)', bgB: 'rgba(244, 63, 94, 0.1)' }  // Sky / Rose
        ];

        if (isLive) {
            const palette = colorPalettes[colorIdx % colorPalettes.length];
            if (side === 'A') {
                rowStyle = `background: ${palette.bgA};`;
                dotColor = palette.a;
                accentColor = palette.a;
            } else {
                rowStyle = `background: ${palette.bgB};`;
                dotColor = palette.b;
                accentColor = palette.b;
            }
            tr.setAttribute('style', rowStyle);
        }

        const liveMarker = isLive ? `<span class="live-label" style="display:inline-flex; margin-left:5px;"><span class="live-dot" style="background-color: ${dotColor}; box-shadow: 0 0 5px ${dotColor};"></span></span>` : '';

        tr.innerHTML = `
            <td class="${rankClass}"><span class="rank-bg">${index + 1}</span></td>
            <td style="font-weight: 600;">${p.name}${liveMarker}</td>
            <td style="color: ${isLive ? accentColor : 'inherit'};">${playDisplay}</td>
            <td style="color: var(--success); opacity: ${isLive ? '0.4' : '1'};">${p.stats.won}</td>
            <td style="color: var(--danger); opacity: ${isLive ? '0.4' : '1'};">${p.stats.lost}</td>
            <td style="color: ${isLive ? accentColor : 'inherit'}; font-weight: ${isLive ? '800' : '600'};">${totalPoints}</td>
        `;
        elements.rankingBody.appendChild(tr);
    });
}

// --- Persistence & Online Sync (Firebase) ---
let db = null; // Realtime Database instance
const syncDefaults = {
    apiKey: 'AIzaSyB9O2S3FAGq-74ekhNXLFAiSpeFGOvtcV8',
    projectId: 'pickleball-tournament-8240a',
    databaseURL: 'https://pickleball-tournament-8240a-default-rtdb.asia-southeast1.firebasedatabase.app/',
    room: 'tournament'
};
let syncConfig = { ...syncDefaults };
let tournamentsList = [];

function loadFirebaseConfig() {
    const stored = localStorage.getItem('pickleball_firebase_config');
    if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults, but prioritize stored values if they are NOT empty strings
        for (const key in syncDefaults) {
            if (parsed[key] && parsed[key] !== "") {
                syncConfig[key] = parsed[key];
            }
        }
    }

    // Always populate the input fields with current config
    if (elements.fbApiKey) elements.fbApiKey.value = syncConfig.apiKey || '';
    if (elements.fbProjectId) elements.fbProjectId.value = syncConfig.projectId || '';
    if (elements.fbDbUrl) elements.fbDbUrl.value = syncConfig.databaseURL || '';
    if (elements.fbRoom) elements.fbRoom.value = syncConfig.room || '';

    if (syncConfig.apiKey && syncConfig.projectId) {
        initFirebase();
    }
}

function saveFirebaseConfig(overrideRoom = null) {
    if (elements.fbApiKey) syncConfig.apiKey = elements.fbApiKey.value.trim();
    if (elements.fbProjectId) syncConfig.projectId = elements.fbProjectId.value.trim();
    if (elements.fbDbUrl) syncConfig.databaseURL = elements.fbDbUrl.value.trim();

    // If an overrideRoom is provided (e.g. from create/switch), use that.
    // Otherwise, take from input.
    if (overrideRoom) {
        syncConfig.room = overrideRoom;
        if (elements.fbRoom) elements.fbRoom.value = overrideRoom;
    } else if (elements.fbRoom) {
        syncConfig.room = elements.fbRoom.value.trim() || 'my-tournament';
    }

    localStorage.setItem('pickleball_firebase_config', JSON.stringify(syncConfig));
    updateSyncStatus("Config saved.");
}

function updateSyncStatus(msg, isError = false) {
    if (elements.syncStatus) {
        elements.syncStatus.innerText = msg;
        elements.syncStatus.style.color = isError ? '#ef4444' : '#22c55e';
    }
}

function initFirebase() {
    if (!syncConfig.apiKey || !syncConfig.projectId) return;

    try {
        if (!window.firebase) {
            updateSyncStatus("Firebase SDK missing", true);
            return;
        }

        const appConfig = {
            apiKey: syncConfig.apiKey,
            projectId: syncConfig.projectId,
            databaseURL: syncConfig.databaseURL,
            authDomain: `${syncConfig.projectId}.firebaseapp.com`
        };

        // Initialize only once
        if (firebase.apps.length === 0) {
            firebase.initializeApp(appConfig);
        }

        // Fix: Use the global db variable declared at line 1248 instead of shadowing it
        db = firebase.database();
        window.db = db; // Global reference for transparency
        updateSyncStatus("Cloud Connected.");

        // Start Listening IMMEDIATELY
        subscribeToRoom();

        // Load and watch tournaments list
        watchTournamentsList();

    } catch (err) {
        console.error("Firebase Init Error:", err);
        updateSyncStatus("Connection failed.", true);
    }
}

let activeRoomRef = null;

function subscribeToRoom() {
    const db = window.db;
    if (!db || !syncConfig.room) return;

    // Stop previous listener if any
    if (activeRoomRef) activeRoomRef.off();

    updateSyncStatus(`Joining ${syncConfig.room}...`);
    activeRoomRef = db.ref('tournaments/' + syncConfig.room);

    activeRoomRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && val.data) {
            console.log("Cloud sync received for room:", syncConfig.room);
            const cloudState = val.data;

            // Only update if data is actually different (simple check)
            // or if we are not the one who just pushed (updatedAt check)

            state = cloudState;
            migrateState();
            recalculateStats();

            localStorage.setItem('pickleball_state', JSON.stringify(state));
            refreshUI();
            updateSyncStatus("Live Sync: " + syncConfig.room);
        } else {
            console.log("No data for room:", syncConfig.room);
            // If we are admin and room is empty, we might want to push current state?
            // For now, just stay as is or reset if it's a brand new room.
            if (!document.body.classList.contains('viewer-mode') && (state.players.length > 0 || state.matches.length > 0)) {
                pushToCloud();
            }
        }
    }, (error) => {
        console.error("RTDB Sync Error:", error);
        updateSyncStatus("Sync error: check connection.", true);
    });
}

function watchTournamentsList() {
    if (db) {
        db.ref('tournaments').on('value', (snapshot) => {
            tournamentsList = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    tournamentsList.push({ id: childSnapshot.key });
                });
            }
            renderTournamentSelect();
        });
    } else {
        // Local Mode: Load from localStorage
        const localList = localStorage.getItem('pickleball_tournaments_list');
        tournamentsList = localList ? JSON.parse(localList) : [];
        renderTournamentSelect();
    }
}

function saveState() {
    // 1. Save Local (Current State)
    localStorage.setItem('pickleball_state', JSON.stringify(state));

    // 1.b Save Local (Tournament Specific)
    if (!db && syncConfig.room) {
        localStorage.setItem(`tournament_${syncConfig.room}`, JSON.stringify(state));
    }

    // 2. Save Online (if connected)
    if (db) {
        pushToCloud();
    }
}

function loadState() {
    // 0. Load Config
    loadFirebaseConfig();

    // 1. Load Local
    if (!db && syncConfig.room) {
        // If in Local Mode, try to load the specific tournament state
        const savedTournament = localStorage.getItem(`tournament_${syncConfig.room}`);
        if (savedTournament) {
            state = JSON.parse(savedTournament);
            migrateState();
            refreshUI();
            return;
        }
    }

    // Fallback/Legacy loading
    const saved = localStorage.getItem('pickleball_state');
    if (saved) {
        const loaded = JSON.parse(saved);
        state = { ...state, ...loaded };
        migrateState();
    }

    // Load tournaments list if in local mode
    if (!db) {
        watchTournamentsList();
    }

    // Note: initFirebase in loadFirebaseConfig triggers subscribeToRoom
}

function migrateState() {
    if (!state.playoffMatches) state.playoffMatches = [];
    if (typeof state.isPlayoffStarted === 'undefined') state.isPlayoffStarted = false;
    if (!state.lockedStats) state.lockedStats = null;
    if (!state.settings) state.settings = { matchLimit: 20 };
    if (!state.rankingSort) state.rankingSort = { key: 'won', dir: 'desc' };
}

async function pushToCloud() {
    const db = window.db;
    if (!db) return;

    // Viewer Check: Viewers (checked via DOM class) usually shouldn't write.
    // However, Firebase Rules backend should really enforce this if critical.
    if (document.body.classList.contains('viewer-mode')) return;

    try {
        await db.ref('tournaments/' + syncConfig.room).set({
            data: state,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        updateSyncStatus("Synced just now.");
    } catch (err) {
        console.error("Push Error:", err);
        updateSyncStatus("Push Failed: " + err.message, true);
    }
}

function refreshUI() {
    // Force a recount of all assigned/completed matches before rendering rankings
    recalculateStats();

    if (elements.matchLimitInput) elements.matchLimitInput.value = state.settings.matchLimit || 20;

    // Disable Player Input if no room selected
    const hasRoom = syncConfig && syncConfig.room && syncConfig.room !== "";
    const isAdmin = !document.body.classList.contains('viewer-mode');

    if (elements.playerInput) elements.playerInput.disabled = !hasRoom || !isAdmin;
    if (elements.addPlayerBtn) elements.addPlayerBtn.disabled = !hasRoom || !isAdmin;
    if (elements.startTournamentBtn) elements.startTournamentBtn.disabled = !hasRoom || !isAdmin;

    if (!hasRoom && elements.playerInput) {
        elements.playerInput.placeholder = "⚠️ GO TO SETUP: CREATE or SELECT a tournament first!";
        elements.playerInput.style.background = "rgba(239, 68, 68, 0.05)";
    } else if (elements.playerInput) {
        elements.playerInput.placeholder = "Enter names (one per line)...";
        elements.playerInput.style.background = "";
    }

    renderPlayers();
    renderMatches();
    updateRankings();
    updateMatchHeader();
    updateH2HPlayers();
    renderH2H();
}

// --- Sharing & Data Management ---
function shareMatches() {
    let text = "🏓 Pickleball Matches:\n\n";

    if (state.matches.length === 0 && state.playoffMatches.length === 0) {
        alert("No matches to share.");
        return;
    }

    // Regular Matches
    state.matches.forEach((m, i) => {
        const p1 = getPlayer(m.teamA[0])?.name || 'Unknown';
        const p2 = getPlayer(m.teamA[1])?.name || 'Unknown';
        const p3 = getPlayer(m.teamB[0])?.name || 'Unknown';
        const p4 = getPlayer(m.teamB[1])?.name || 'Unknown';

        const score = m.completed ? `(${m.scoreA}-${m.scoreB})` : '(Vs)';

        text += `${i + 1}. ${p1}&${p2} vs ${p3}&${p4} ${score}\n`;
    });

    // Playoffs
    if (state.playoffMatches.length > 0) {
        text += "\n🏆 Championship Playoffs:\n";
        state.playoffMatches.forEach((m) => {
            const p1 = getPlayer(m.teamA[0])?.name || 'Unknown';
            const p2 = getPlayer(m.teamA[1])?.name || 'Unknown';
            const p3 = getPlayer(m.teamB[0])?.name || 'Unknown';
            const p4 = getPlayer(m.teamB[1])?.name || 'Unknown';

            const label = m.playoffLabel ? `[${m.playoffLabel}] ` : '';
            const score = m.completed ? `(${m.scoreA}-${m.scoreB})` : '(Vs)';

            text += `${label}${p1}&${p2} vs ${p3}&${p4} ${score}\n`;
        });
    }

    copyToClipboard(text);
}

function shareRankings() {
    let displayPlayers = state.isPlayoffStarted && state.lockedStats ? state.lockedStats : state.players;

    // Use the SAME three-tier sorting logic as the UI
    const sorted = [...displayPlayers].sort((a, b) => {
        const key = state.rankingSort.key;
        const dir = state.rankingSort.dir === 'asc' ? 1 : -1;

        const valA = key === 'points' ? (a.stats.points + (a.stats.livePoints || 0)) : (a.stats[key] || 0);
        const valB = key === 'points' ? (b.stats.points + (b.stats.livePoints || 0)) : (b.stats[key] || 0);

        if (valA !== valB) {
            return (valA - valB) * dir;
        }

        // Tie Breakers
        if (key !== 'won' && b.stats.won !== a.stats.won) return b.stats.won - a.stats.won;
        const h2h = getH2HResult(a.id, b.id);
        if (h2h !== 0) return h2h;

        const totalA = a.stats.points + (a.stats.livePoints || 0);
        const totalB = b.stats.points + (b.stats.livePoints || 0);
        return totalB - totalA;
    });

    let text = "🏆 Pickleball Leaderboard:\n\n";
    text += `Rank | Player | W-L | Pts (Sorted by ${state.rankingSort.key} ${state.rankingSort.dir})\n`;
    text += "---------------------------\n";

    sorted.forEach((p, i) => {
        text += `${i + 1}. ${p.name} | ${p.stats.won}-${p.stats.lost} | ${p.stats.points}\n`;
    });

    copyToClipboard(text);
}

function exportData() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pickleball_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function triggerImport() {
    if (!confirm("Importing data will OVERWRITE all current tournament data. Continue?")) return;
    elements.importFile.click();
}

function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const importedState = JSON.parse(event.target.result);

            // Basic validation
            if (!importedState.players || !importedState.matches) {
                throw new Error("Invalid format");
            }

            state = importedState;
            saveState();

            // Reload UI
            elements.matchLimitInput.value = state.settings?.matchLimit || 20;
            recalculateStats();
            renderMatches();
            renderPlayers();
            updateRankings();
            updateMatchHeader();

            alert("Data restored successfully!");
        } catch (err) {
            alert("Failed to import data: " + err.message);
        }
    };
    reader.readAsText(file);

    // Reset input so valid change event fires if same file selected again
    e.target.value = '';
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert("Copied to clipboard!\n\nYou can now paste it into WhatsApp or Email.");
    } catch (err) {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; // Avoid scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert("Copied to clipboard!");
        } catch (err) {
            alert('Unable to copy automatically. Please take a screenshot instead.');
        }
        document.body.removeChild(textArea);
    }
}

// --- Tournament Multi-Tenancy ---


function renderTournamentSelect() {
    if (!elements.tournamentSelect) return;

    elements.tournamentSelect.innerHTML = '<option value="">-- No Tournament Selected --</option>';

    tournamentsList.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.id;
        if (t.id === syncConfig.room) {
            opt.selected = true;
        }
        elements.tournamentSelect.appendChild(opt);
    });
}

function switchTournament(e) {
    const roomId = e.target.value;
    if (!roomId) return;

    if (db) {
        // Cloud Mode
        saveFirebaseConfig(roomId);
        subscribeToRoom();
    } else {
        // Local Mode
        syncConfig.room = roomId;
        localStorage.setItem('pickleball_firebase_config', JSON.stringify(syncConfig));

        // Load local state
        const saved = localStorage.getItem(`tournament_${roomId}`);
        if (saved) {
            state = JSON.parse(saved);
        } else {
            // New local room or fallback
            state = {
                players: [],
                matches: [],
                playoffMatches: [],
                currentRound: 0,
                settings: { matchLimit: 20 },
                isPlayoffStarted: false,
                lockedStats: null,
                rankingSort: { key: 'won', dir: 'desc' }
            };
        }
        localStorage.setItem('pickleball_state', JSON.stringify(state));
        refreshUI();
    }

    if (elements.tournamentStatus) {
        elements.tournamentStatus.innerText = `Switched to: ${roomId}`;
        setTimeout(() => {
            elements.tournamentStatus.innerText = "";
        }, 3000);
    }
}

async function createNewTournament() {
    const name = elements.newTournamentName.value.trim();
    if (!name) {
        alert("Please enter a tournament name.");
        return;
    }

    // Check if already exists in tournamentsList
    if (tournamentsList.some(t => t.id.toLowerCase() === name.toLowerCase())) {
        if (!confirm(`A tournament named "${name}" already exists. Overwrite?`)) return;
    }

    const stateToSave = {
        players: [],
        matches: [],
        playoffMatches: [],
        currentRound: 0,
        settings: { matchLimit: 20 },
        isPlayoffStarted: false,
        lockedStats: null,
        rankingSort: { key: 'won', dir: 'desc' }
    };

    try {
        if (db) {
            // Cloud Mode
            await db.ref('tournaments/' + name).set({
                data: stateToSave,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
        } else {
            // Local Mode
            if (!tournamentsList.some(t => t.id === name)) {
                tournamentsList.push({ id: name });
                localStorage.setItem('pickleball_tournaments_list', JSON.stringify(tournamentsList));
            }
            localStorage.setItem(`tournament_${name}`, JSON.stringify(stateToSave));
            updateSyncStatus("Created in Local Storage.");
        }

        elements.newTournamentName.value = '';

        // Switch to the new one
        if (db) {
            saveFirebaseConfig(name);
            subscribeToRoom();
        } else {
            syncConfig.room = name;
            localStorage.setItem('pickleball_firebase_config', JSON.stringify(syncConfig));
            state = stateToSave;
            localStorage.setItem('pickleball_state', JSON.stringify(state));
            refreshUI();
        }

        alert(`Tournament "${name}" created and loaded!`);
    } catch (err) {
        console.error("Create Tournament Error:", err);
        alert("Failed to create tournament: " + err.message);
    }
}

// --- Head to Head Logic ---
function updateH2HPlayers() {
    if (!elements.h2hPlayer1 || !elements.h2hPlayer2) return;

    const val1 = elements.h2hPlayer1.value;
    const val2 = elements.h2hPlayer2.value;

    // Save current selection to restore after re-render if possible
    elements.h2hPlayer1.innerHTML = '<option value="">Select Player...</option>';
    elements.h2hPlayer2.innerHTML = '<option value="">Select Player...</option>';

    // Sort players by name for easier selection
    const sortedPlayers = [...state.players].sort((a, b) => a.name.localeCompare(b.name));

    sortedPlayers.forEach(p => {
        const opt1 = document.createElement('option');
        opt1.value = p.id;
        opt1.textContent = p.name;
        elements.h2hPlayer1.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = p.id;
        opt2.textContent = p.name;
        elements.h2hPlayer2.appendChild(opt2);
    });

    // Restore values
    elements.h2hPlayer1.value = val1;
    elements.h2hPlayer2.value = val2;
}

function renderH2H() {
    if (!elements.h2hResults) return;

    const id1 = elements.h2hPlayer1.value;
    const id2 = elements.h2hPlayer2.value;

    if (!id1 || !id2 || id1 === id2) {
        elements.h2hResults.innerHTML = `
            <div class="empty-state glass-card" style="padding: 40px; text-align: center; opacity: 0.5;">
                <i class="fa-solid fa-layer-group" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
                ${id1 === id2 && id1 ? 'Please select two different players' : 'Select two players to see their match history'}
            </div>
        `;
        return;
    }

    const p1 = getPlayer(id1);
    const p2 = getPlayer(id2);

    // Find all matches featuring both players
    // There are two scenarios:
    // 1. Together (same team)
    // 2. Against (opposite teams)

    const sharedMatches = state.matches.filter(m => {
        const allInvolved = [...m.teamA, ...m.teamB];
        return allInvolved.includes(id1) && allInvolved.includes(id2);
    });

    let statsA = { played: 0, won: 0, lost: 0, points: 0 }; // Player 1 stats when playing AGAINST Player 2
    let statsTogether = { played: 0, won: 0, lost: 0 }; // Stats when playing TOGETHER

    const partnerFreq = {};
    state.matches.forEach(m => {
        const keyA = [...m.teamA].sort().join('|');
        const keyB = [...m.teamB].sort().join('|');
        partnerFreq[keyA] = (partnerFreq[keyA] || 0) + 1;
        partnerFreq[keyB] = (partnerFreq[keyB] || 0) + 1;
    });

    const matchHistoryHTML = sharedMatches.map(m => {
        const isP1TeamA = m.teamA.includes(id1);
        const isP2TeamA = m.teamA.includes(id2);

        const isTogether = isP1TeamA === isP2TeamA;
        const isCompleted = m.completed;

        if (isCompleted) {
            if (isTogether) {
                statsTogether.played++;
                const won = isP1TeamA ? (m.scoreA > m.scoreB) : (m.scoreB > m.scoreA);
                if (won) statsTogether.won++;
                else statsTogether.lost++;
            } else {
                statsA.played++;
                const p1WonAgainstP2 = isP1TeamA ? (m.scoreA > m.scoreB) : (m.scoreB > m.scoreA);
                if (p1WonAgainstP2) statsA.won++;
                else statsA.lost++;
                statsA.points += isP1TeamA ? m.scoreA : m.scoreB;
            }
        }

        const teamANames = m.teamA.map(id => getPlayer(id)?.name || 'Unknown').join(' & ');
        const teamBNames = m.teamB.map(id => getPlayer(id)?.name || 'Unknown').join(' & ');
        const scoreDisplay = m.completed ? `${m.scoreA} - ${m.scoreB}` : 'VS';

        let pairingLabel = '';
        if (isTogether) {
            const key = [id1, id2].sort().join('|');
            const count = partnerFreq[key] || 0;
            pairingLabel = `<span style="font-size: 0.65rem; color: var(--text-secondary); margin-left: 8px;">(Pairing #${count}${count > 2 ? ' ⚠️' : ''})</span>`;
        }

        const typeLabel = isTogether ?
            `<span style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">PARTNERS ${pairingLabel}</span>` :
            '<span style="background: var(--accent); color: black; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">OPPONENTS</span>';

        return `
            <div class="match-card glass-card ${m.completed ? 'completed' : ''}" style="margin-bottom: 10px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    ${typeLabel}
                    <span style="font-size: 0.75rem; padding-left: 5px; opacity: 0.6;">${m.completed ? ' Completed' : ' Pending'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; text-align: center;">
                    <div style="flex: 1; font-weight: 600; font-size: 0.9rem; ${isP1TeamA ? 'color: var(--primary);' : ''}">${teamANames}</div>
                    <div style="width: 60px; font-weight: 800; font-size: 1.1rem; color: var(--accent);">${scoreDisplay}</div>
                    <div style="flex: 1; font-weight: 600; font-size: 0.9rem; ${!isP1TeamA ? 'color: var(--primary);' : ''}">${teamBNames}</div>
                </div>
            </div>
        `;
    }).join('');

    elements.h2hResults.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div class="glass-card" style="padding: 15px; text-align: center; border-left: 4px solid var(--accent);">
                <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; margin-bottom: 5px;">Vs Each Other</div>
                <div style="font-size: 1.5rem; font-weight: 800;">${statsA.won} <span style="font-size: 1rem; opacity: 0.5;">-</span> ${statsA.lost}</div>
                <div style="font-size: 0.75rem; opacity: 0.6;">${p1.name} wins - losses</div>
            </div>
            <div class="glass-card" style="padding: 15px; text-align: center; border-left: 4px solid var(--primary);">
                <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; margin-bottom: 5px;">As Partners</div>
                <div style="font-size: 1.5rem; font-weight: 800;">${statsTogether.won} <span style="font-size: 1rem; opacity: 0.5;">-</span> ${statsTogether.lost}</div>
                <div style="font-size: 0.75rem; opacity: 0.6;">Wins - Losses together</div>
            </div>
        </div>
        
        <h3 style="font-size: 1rem; margin-bottom: 15px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">Match History (${sharedMatches.length})</h3>
        ${sharedMatches.length > 0 ? matchHistoryHTML : '<div class="empty-state glass-card" style="padding: 20px; text-align: center; opacity: 0.5;">No matches played together yet.</div>'}
    `;
}
