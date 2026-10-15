const storageKey = "susi-world-v1";
const themeStorageKey = "susi-world-theme-v1";
const today = new Date();
const todayKey = toDateKey(today);
const quotes = [
  "You don’t have to do it all today. Just the next kind thing.",
  "Small steps still take you somewhere lovely.",
  "A soft day is still a day well spent.",
  "You’re allowed to begin again, as many times as you need.",
  "Make a little room for whatever makes you feel like you."
];
let toastTimer;
let state = loadState();
let activeGame = null;
let memoryState = null;
let moodChartRange = "week";

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadState() {
  const storage = getStorage();
  if (!storage) return { todos: [], moods: [], notes: [] };
  try {
    const saved = JSON.parse(storage.getItem(storageKey) || "{}");
    return normalizeState(saved);
  } catch {
    return { todos: [], moods: [], notes: [] };
  }
}

function normalizeState(saved) {
  const colors = new Set(["pink", "peach", "lilac", "mint"]);
  return {
    todos: (Array.isArray(saved.todos) ? saved.todos : []).filter((todo) => todo && typeof todo.text === "string").map((todo) => ({
      id: typeof todo.id === "string" ? todo.id : crypto.randomUUID(),
      text: todo.text,
      done: Boolean(todo.done)
    })),
    moods: (Array.isArray(saved.moods) ? saved.moods : []).filter((mood) => mood && /^\d{4}-\d{2}-\d{2}$/.test(mood.date) && Number(mood.score) >= 1 && Number(mood.score) <= 5).map((mood) => ({
      date: mood.date,
      score: Number(mood.score),
      emoji: typeof mood.emoji === "string" ? mood.emoji : "😌",
      label: typeof mood.label === "string" ? mood.label : "Okay",
      note: typeof mood.note === "string" ? mood.note : ""
    })),
    notes: (Array.isArray(saved.notes) ? saved.notes : []).filter((note) => note && typeof note.text === "string").map((note) => ({
      id: typeof note.id === "string" ? note.id : crypto.randomUUID(),
      text: note.text,
      color: colors.has(note.color) ? note.color : "pink",
      tags: Array.isArray(note.tags) ? note.tags.filter((tag) => typeof tag === "string").slice(0, 12) : [],
      createdAt: Number.isFinite(Number(note.createdAt)) ? Number(note.createdAt) : Date.now()
    }))
  };
}

function persist() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage errors, such as in private or restricted browser contexts.
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatDate(dateString, options = { month: "short", day: "numeric" }) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, options);
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function renderTodos() {
  const openTodos = state.todos.filter((todo) => !todo.done);
  const todoMarkup = (todo) => `
    <li class="todo-item${todo.done ? " done" : ""}">
      <button class="todo-toggle" data-toggle-todo="${todo.id}" aria-label="${todo.done ? "Mark incomplete" : "Complete"}: ${escapeHtml(todo.text)}">${todo.done ? "✓" : ""}</button>
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button class="icon-button" data-delete-todo="${todo.id}" aria-label="Delete to-do: ${escapeHtml(todo.text)}">×</button>
    </li>`;
  document.querySelector("#todoList").innerHTML = state.todos.map(todoMarkup).join("");
  document.querySelector("#homeTodos").innerHTML = openTodos.slice(0, 3).map(todoMarkup).join("");
  document.querySelector("#statTodos").textContent = openTodos.length;
  document.querySelector("#todoCount").textContent = `${openTodos.length} open`;
  document.querySelector("#todoEmpty").hidden = state.todos.length > 0;
  document.querySelector("#homeTodosEmpty").hidden = openTodos.length > 0;
}

function renderMoodChart(moods) {
  const moodByDate = new Map(moods.map((mood) => [mood.date, mood]));
  const dayCount = moodChartRange === "month" ? 30 : 7;
  const chartDays = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (dayCount - index - 1));
    const key = toDateKey(date);
    const mood = moodByDate.get(key);
    const label = moodChartRange === "week"
      ? date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)
      : (index % 5 === 0 || index === dayCount - 1 ? String(date.getDate()) : "");
    return `<div class="chart-day" title="${escapeHtml(formatDate(key))}: ${mood ? `${mood.score} out of 5` : "no check-in"}">
      <div class="chart-bar${mood ? "" : " is-empty"}" style="height:${mood ? Math.max(12, mood.score * 15) : 5}px"></div><span>${escapeHtml(label)}</span>
    </div>`;
  });
  const chart = document.querySelector("#moodChart");
  chart.dataset.range = moodChartRange;
  chart.innerHTML = chartDays.join("");
  document.querySelectorAll("[data-chart-range]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.chartRange === moodChartRange));
  });
  const streakDates = new Set(moods.map((mood) => mood.date));
  const streakStart = new Date();
  if (!streakDates.has(todayKey)) streakStart.setDate(streakStart.getDate() - 1);
  let streak = 0;
  while (streakDates.has(toDateKey(streakStart))) {
    streak += 1;
    streakStart.setDate(streakStart.getDate() - 1);
  }
  document.querySelector("#moodStreakCount").textContent = streak;
  document.querySelector("#moodStreakLabel").textContent = streak === 1 ? "day streak" : "day streak";
  document.querySelector("#moodBadges").innerHTML = [3, 7, 30].map((milestone) => `
    <div class="streak-badge${streak >= milestone ? " earned" : ""}" title="${streak >= milestone ? `${milestone}-day badge earned` : `Check in for ${milestone} days in a row`}" aria-label="${streak >= milestone ? `${milestone}-day badge earned` : `${milestone}-day badge locked`}">
      <strong>${milestone}</strong><span>days</span>
    </div>`).join("");
}

function renderMoods() {
  const moods = [...state.moods].sort((left, right) => right.date.localeCompare(left.date));
  const todayMood = moods.find((mood) => mood.date === todayKey);
  const form = document.querySelector("#moodForm");
  document.querySelector("#statMood").textContent = todayMood?.emoji || "—";
  document.querySelector("#moodSavedHint").textContent = todayMood ? "Today’s check-in is saved." : "Your check-in stays just with you.";
  form.querySelectorAll('input[name="mood"]').forEach((input) => {
    input.checked = todayMood ? input.value.startsWith(`${todayMood.score}|`) : false;
  });
  document.querySelector("#moodNote").value = todayMood?.note || "";

  renderMoodChart(moods);
  const recent = moods.slice(0, 14);
  document.querySelector("#moodList").innerHTML = recent.map((mood) => `
    <li><span class="history-emoji" aria-hidden="true">${escapeHtml(mood.emoji)}</span><div class="history-copy"><strong>${escapeHtml(mood.label)}</strong>${mood.note ? `<span>${escapeHtml(mood.note)}</span>` : ""}</div><span class="history-date">${escapeHtml(mood.date === todayKey ? "Today" : formatDate(mood.date))}</span></li>`).join("");
  document.querySelector("#moodEmpty").hidden = recent.length > 0;
}

function renderNotes() {
  const notes = [...state.notes].sort((left, right) => right.createdAt - left.createdAt);
  const search = document.querySelector("#noteSearch").value.trim().toLocaleLowerCase();
  const dateFilter = document.querySelector("#noteDateFilter").value;
  const filteredNotes = notes.filter((note) => {
    const tags = Array.isArray(note.tags) ? note.tags : [];
    const matchesSearch = !search || note.text.toLocaleLowerCase().includes(search) || tags.some((tag) => tag.toLocaleLowerCase().includes(search));
    const matchesDate = !dateFilter || toDateKey(new Date(note.createdAt)) === dateFilter;
    return matchesSearch && matchesDate;
  });
  document.querySelector("#statNotes").textContent = notes.length;
  document.querySelector("#homeNote").innerHTML = notes[0] ? `
    <div class="note-slip">${escapeHtml(notes[0].text).replace(/\n/g, "<br>")}<span class="note-date">${escapeHtml(formatDate(toDateKey(new Date(notes[0].createdAt))))}</span></div>` : "";
  document.querySelector("#homeNoteEmpty").hidden = notes.length > 0;
  document.querySelector("#noteGrid").innerHTML = filteredNotes.map((note) => `
    <article class="note-card" data-color="${escapeHtml(note.color)}"><p>${escapeHtml(note.text)}</p>${note.tags?.length ? `<div class="note-tags">${note.tags.map((tag) => `<span class="note-tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}<footer><span>${escapeHtml(formatDate(toDateKey(new Date(note.createdAt))))}</span><button class="icon-button" data-delete-note="${note.id}" aria-label="Delete note">×</button></footer></article>`).join("");
  document.querySelector("#notesEmpty").hidden = notes.length > 0;
  document.querySelector("#notesNoResults").hidden = notes.length === 0 || filteredNotes.length > 0;
}

function render() {
  renderTodos();
  renderMoods();
  renderNotes();
}

function navigate(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    const active = view.id === `view-${viewName}`;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    const active = button.dataset.go === viewName;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(button.dataset.go);
  });
});

document.querySelector("#todoForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#todoInput");
  const text = input.value.trim();
  if (!text) return input.focus();
  state.todos.unshift({ id: crypto.randomUUID(), text, done: false });
  persist();
  renderTodos();
  input.value = "";
  showToast("Added to your list");
});

document.querySelector("#newQuote").addEventListener("click", () => {
  const quoteElement = document.querySelector("#quote");
  const nextQuotes = quotes.filter((quote) => quote !== quoteElement.textContent);
  quoteElement.textContent = nextQuotes[Math.floor(Math.random() * nextQuotes.length)];
});

document.querySelectorAll("[data-chart-range]").forEach((button) => {
  button.addEventListener("click", () => {
    moodChartRange = button.dataset.chartRange;
    renderMoodChart([...state.moods].sort((left, right) => right.date.localeCompare(left.date)));
  });
});

document.querySelector("#noteSearch").addEventListener("input", renderNotes);
document.querySelector("#noteDateFilter").addEventListener("change", renderNotes);
document.querySelector("#clearNoteFilters").addEventListener("click", () => {
  document.querySelector("#noteSearch").value = "";
  document.querySelector("#noteDateFilter").value = "";
  renderNotes();
});

function applyTheme(theme) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = selectedTheme;
  const button = document.querySelector("#themeToggle");
  const label = selectedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  button.textContent = selectedTheme === "dark" ? "☼" : "◐";
  button.setAttribute("aria-label", label);
  button.title = label;
  document.querySelector('meta[name="theme-color"]').content = selectedTheme === "dark" ? "#202823" : "#f7f3e9";
}

function saveThemePreference(theme) {
  try {
    getStorage()?.setItem(themeStorageKey, theme);
  } catch {
    // Keep the current theme even when browser storage is unavailable.
  }
}

const storedTheme = getStorage()?.getItem(themeStorageKey) || "light";
applyTheme(storedTheme);
document.querySelector("#themeToggle").addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  saveThemePreference(nextTheme);
});

document.querySelector("#exportData").addEventListener("click", () => {
  const backup = {
    format: "susi-world-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: document.body.dataset.theme,
    data: state
  };
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(file);
  link.href = objectUrl;
  link.download = `susi-world-backup-${todayKey}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  showToast("Backup downloaded");
});

document.querySelector("#importData").addEventListener("click", () => document.querySelector("#importFile").click());
document.querySelector("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (backup.format !== "susi-world-backup" || backup.version !== 1 || !backup.data || !Array.isArray(backup.data.todos) || !Array.isArray(backup.data.moods) || !Array.isArray(backup.data.notes)) {
      throw new Error("This file is not a Susi World backup.");
    }
    if (!window.confirm("Import this backup and replace the data currently saved in this browser?")) return;
    state = normalizeState(backup.data);
    persist();
    if (backup.theme === "dark" || backup.theme === "light") {
      applyTheme(backup.theme);
      saveThemePreference(backup.theme);
    }
    render();
    showToast("Backup restored");
  } catch (error) {
    showToast(error instanceof SyntaxError ? "That file is not valid JSON" : error.message || "Could not import that backup");
  } finally {
    event.target.value = "";
  }
});

document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-toggle-todo]");
  const deleteTodo = event.target.closest("[data-delete-todo]");
  const deleteNote = event.target.closest("[data-delete-note]");
  const startGame = event.target.closest("[data-start-game]");
  const memoryCard = event.target.closest("[data-memory-card]");
  const ticCell = event.target.closest("[data-tic-cell]");
  const sequenceChoice = event.target.closest("[data-sequence-choice]");
  if (startGame) {
    startGameView(startGame.dataset.startGame);
    return;
  }
  if (event.target.closest("#gameBack")) {
    document.querySelector("#gamePlay").hidden = true;
    document.querySelector("#gameCatalog").hidden = false;
    activeGame = null;
    memoryState = null;
    return;
  }
  if (memoryCard) {
    flipMemoryCard(Number(memoryCard.dataset.memoryCard));
    return;
  }
  if (ticCell) {
    playTicCell(Number(ticCell.dataset.ticCell));
    return;
  }
  if (sequenceChoice) {
    answerSequence(Number(sequenceChoice.dataset.sequenceChoice));
    return;
  }
  if (event.target.closest("#ticReset")) {
    startGameView("tictactoe");
    return;
  }
  if (event.target.closest("#memoryReset")) {
    startGameView("memory");
    return;
  }
  if (event.target.closest("#sequenceNext")) {
    startGameView("sequence");
    return;
  }
  if (event.target.closest("#codeReset")) {
    startGameView("codebreaker");
    return;
  }
  if (toggle) {
    const todo = state.todos.find((item) => item.id === toggle.dataset.toggleTodo);
    if (!todo) return;
    todo.done = !todo.done;
    persist();
    renderTodos();
  } else if (deleteTodo) {
    state.todos = state.todos.filter((item) => item.id !== deleteTodo.dataset.deleteTodo);
    persist();
    renderTodos();
    showToast("To-do removed");
  } else if (deleteNote) {
    state.notes = state.notes.filter((item) => item.id !== deleteNote.dataset.deleteNote);
    persist();
    renderNotes();
    showToast("Note removed");
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "codeForm") return;
  event.preventDefault();
  submitCodeGuess();
});

document.querySelector("#moodForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const selected = document.querySelector('input[name="mood"]:checked');
  if (!selected) {
    showToast("Choose the face that feels closest");
    return;
  }
  const [score, emoji] = selected.value.split("|");
  const labels = ["", "Low", "Meh", "Okay", "Good", "Amazing"];
  const checkIn = { date: todayKey, score: Number(score), emoji, label: labels[Number(score)], note: document.querySelector("#moodNote").value.trim() };
  state.moods = [checkIn, ...state.moods.filter((mood) => mood.date !== todayKey)];
  persist();
  renderMoods();
  showToast("Check-in saved");
});

document.querySelector("#noteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#noteInput");
  const text = input.value.trim();
  if (!text) return input.focus();
  const color = document.querySelector('input[name="color"]:checked').value;
  const tags = [...new Set(document.querySelector("#noteTags").value.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => tag.slice(0, 30)))].slice(0, 12);
  state.notes.unshift({ id: crypto.randomUUID(), text, color, tags, createdAt: Date.now() });
  persist();
  renderNotes();
  input.value = "";
  document.querySelector("#noteTags").value = "";
  showToast("A little note to keep");
});

document.querySelector("#today").textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
document.querySelector("#todayShort").textContent = today.toLocaleDateString(undefined, { month: "long", day: "numeric" });
document.querySelector("#quote").textContent = quotes[Math.floor(Math.random() * quotes.length)];

let installPrompt = null;
const installButton = document.querySelector("#installBtn");
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standaloneMediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : { matches: false };
const isStandalone = standaloneMediaQuery.matches || window.navigator.standalone === true;
if (installButton) installButton.hidden = isStandalone;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  if (installButton) installButton.hidden = false;
});

if (installButton) {
  installButton.addEventListener("click", async () => {
    if (!installPrompt) {
      showToast(isIos ? "Tap Share, then choose Add to Home Screen." : "Choose Install Susi World from your browser menu.");
      return;
    }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    if (choice.outcome === "accepted") installButton.hidden = true;
  });
}

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  if (installButton) installButton.hidden = true;
  showToast("Susi World is installed");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

const sequences = [
  { numbers: "2, 5, 10, 17, ?", answer: 26, choices: [24, 25, 26, 28], hint: "The gaps grow by 2 each time." },
  { numbers: "3, 6, 12, 24, ?", answer: 48, choices: [36, 42, 48, 54], hint: "Each number doubles." },
  { numbers: "1, 4, 9, 16, ?", answer: 25, choices: [20, 24, 25, 36], hint: "These are square numbers." },
  { numbers: "1, 1, 2, 3, 5, ?", answer: 8, choices: [7, 8, 9, 10], hint: "Add the previous two numbers." },
  { numbers: "30, 27, 21, 12, ?", answer: 0, choices: [-3, 0, 1, 3], hint: "Subtract 3, then 6, then 9…" }
];

function startGameView(game) {
  activeGame = game;
  document.querySelector("#gameCatalog").hidden = true;
  document.querySelector("#gamePlay").hidden = false;
  if (game === "tictactoe") {
    activeGame = { name: game, board: Array(9).fill(""), finished: false };
    renderTicTacToe();
  } else if (game === "memory") {
    const faces = ["✿", "☀", "☾", "♧", "♫", "♡", "✦", "☂"];
    const deck = [...faces, ...faces].sort(() => Math.random() - 0.5);
    memoryState = { deck, flipped: [], matched: new Set(), moves: 0, locked: false, finished: false };
    renderMemory();
  } else if (game === "sequence") {
    const puzzle = sequences[Math.floor(Math.random() * sequences.length)];
    activeGame = { name: game, puzzle, answered: false };
    renderSequence();
  } else if (game === "codebreaker") {
    const digits = ["1", "2", "3", "4", "5", "6"].sort(() => Math.random() - 0.5);
    activeGame = { name: game, secret: digits.slice(0, 4), guesses: [], finished: false };
    renderCodebreaker();
  }
}

function getTicWinner(board) {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (const [first, second, third] of lines) {
    if (board[first] && board[first] === board[second] && board[first] === board[third]) return board[first];
  }
  return board.every(Boolean) ? "draw" : null;
}

function scoreTicBoard(board, depth) {
  const winner = getTicWinner(board);
  if (winner === "O") return 10 - depth;
  if (winner === "X") return depth - 10;
  return 0;
}

function minimax(board, player, depth) {
  const winner = getTicWinner(board);
  if (winner) return scoreTicBoard(board, depth);
  const scores = [];
  board.forEach((cell, index) => {
    if (cell) return;
    const next = [...board];
    next[index] = player;
    scores.push(minimax(next, player === "O" ? "X" : "O", depth + 1));
  });
  return player === "O" ? Math.max(...scores) : Math.min(...scores);
}

function bestTicMove(board) {
  let bestScore = -Infinity;
  let bestMove = -1;
  board.forEach((cell, index) => {
    if (cell) return;
    const next = [...board];
    next[index] = "O";
    const score = minimax(next, "X", 1);
    if (score > bestScore) {
      bestScore = score;
      bestMove = index;
    }
  });
  return bestMove;
}

function renderTicTacToe(status = "Your turn. You’re X; the computer is O.") {
  const game = activeGame;
  document.querySelector("#gameContent").innerHTML = `
    <section class="game-panel"><header class="game-heading"><p class="eyebrow">TWO IN A ROW? ONE MORE.</p><h2>Tic-tac-toe</h2><p>Play X. The computer will do its best.</p></header>
      <p class="game-status" id="ticStatus" aria-live="polite">${status}</p>
      <div class="tic-board" role="group" aria-label="Tic-tac-toe board">${game.board.map((mark, index) => `<button class="tic-cell" data-mark="${mark}" data-tic-cell="${index}" aria-label="Square ${index + 1}${mark ? `, ${mark}` : ""}" ${mark || game.finished ? "disabled" : ""}>${mark}</button>`).join("")}</div>
      ${game.finished ? '<div class="game-actions"><button class="game-secondary" id="ticReset">Play again</button></div>' : ""}
    </section>`;
}

function playTicCell(index) {
  if (!activeGame || activeGame.name !== "tictactoe" || activeGame.finished || activeGame.board[index]) return;
  activeGame.board[index] = "X";
  let result = getTicWinner(activeGame.board);
  if (result) {
    activeGame.finished = true;
    renderTicTacToe(result === "X" ? "Three in a row. You win!" : "A thoughtful draw.");
    return;
  }
  renderTicTacToe("The computer is thinking…");
  const game = activeGame;
  setTimeout(() => {
    if (activeGame !== game || game.finished) return;
    const move = bestTicMove(game.board);
    if (move >= 0) game.board[move] = "O";
    result = getTicWinner(game.board);
    if (result) game.finished = true;
    renderTicTacToe(result === "O" ? "The computer got three in a row." : result === "draw" ? "A thoughtful draw." : "Your turn. You’re X; the computer is O.");
  }, 300);
}

function renderMemory() {
  const game = memoryState;
  if (!game) return;
  const status = game.finished ? `Lovely work! You found every pair in ${game.moves} turns.` : `${game.moves} ${game.moves === 1 ? "turn" : "turns"} · ${game.matched.size / 2} of 8 pairs`;
  document.querySelector("#gameContent").innerHTML = `
    <section class="game-panel"><header class="game-heading"><p class="eyebrow">TAKE A GOOD LOOK</p><h2>Memory match</h2><p>Turn over two at a time and find the matching symbols.</p></header>
      <p class="game-status" aria-live="polite">${status}</p>
      <div class="memory-board" role="group" aria-label="Memory cards">${game.deck.map((face, index) => {
        const matched = game.matched.has(index);
        const revealed = matched || game.flipped.includes(index);
        return `<button class="memory-card${matched ? " matched" : revealed ? " revealed" : ""}" data-memory-card="${index}" aria-label="${matched ? `Matched ${face}` : revealed ? face : `Card ${index + 1}, hidden`}" ${matched || revealed || game.locked ? "disabled" : ""}>${revealed ? face : "·"}</button>`;
      }).join("")}</div>
      <div class="game-actions"><button class="game-secondary" id="memoryReset">Shuffle and start over</button></div>
    </section>`;
}

function flipMemoryCard(index) {
  const game = memoryState;
  if (!game || game.locked || game.flipped.includes(index) || game.matched.has(index)) return;
  game.flipped.push(index);
  if (game.flipped.length === 2) {
    game.moves += 1;
    const [first, second] = game.flipped;
    if (game.deck[first] === game.deck[second]) {
      game.matched.add(first);
      game.matched.add(second);
      game.flipped = [];
      game.finished = game.matched.size === game.deck.length;
    } else {
      game.locked = true;
      renderMemory();
      setTimeout(() => {
        if (memoryState !== game) return;
        game.flipped = [];
        game.locked = false;
        renderMemory();
      }, 700);
      return;
    }
  }
  renderMemory();
}

function renderSequence(feedback = "Pick the number that belongs next.", selectedAnswer = null) {
  const game = activeGame;
  const puzzle = game.puzzle;
  document.querySelector("#gameContent").innerHTML = `
    <section class="game-panel"><header class="game-heading"><p class="eyebrow">FOLLOW THE PATTERN</p><h2>Number trail</h2><p>Every sequence has a little rule hiding inside it.</p></header>
      <p class="sequence-number" aria-label="${puzzle.numbers.replaceAll("?", "blank")}">${puzzle.numbers}</p>
      <div class="choice-grid" role="group" aria-label="Choose the next number">${puzzle.choices.map((choice) => `<button class="choice-button${selectedAnswer === choice ? choice === puzzle.answer ? " correct" : " incorrect" : ""}" data-sequence-choice="${choice}" ${game.answered ? "disabled" : ""}>${choice}</button>`).join("")}</div>
      <p class="game-status" aria-live="polite">${feedback}</p>
      ${game.answered ? '<div class="game-actions"><button class="game-secondary" id="sequenceNext">Another sequence</button></div>' : ""}
    </section>`;
}

function answerSequence(answer) {
  if (!activeGame || activeGame.name !== "sequence" || activeGame.answered) return;
  activeGame.answered = true;
  const correct = answer === activeGame.puzzle.answer;
  const feedback = correct ? `That’s it! ${activeGame.puzzle.hint}` : `Not quite. ${activeGame.puzzle.hint}`;
  renderSequence(feedback, answer);
}

function renderCodebreaker(message = "A secret code uses four different digits from 1 to 6.") {
  const game = activeGame;
  document.querySelector("#gameContent").innerHTML = `
    <section class="game-panel"><header class="game-heading"><p class="eyebrow">A LITTLE DEDUCTION</p><h2>Codebreaker</h2><p>Guess the hidden four-digit code. Exact matches and right digits are counted separately.</p></header>
      <p class="game-status" aria-live="polite">${message}</p>
      ${game.finished ? "" : '<form class="code-form" id="codeForm"><label class="sr-only" for="codeGuess">Enter four different digits from 1 to 6</label><input class="code-input" id="codeGuess" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[1-6]{4}" placeholder="1234" /><button class="primary-button" type="submit">Guess <span aria-hidden="true">→</span></button></form>'}
      <ul class="code-history" aria-label="Previous guesses">${game.guesses.map((guess) => `<li><strong>${guess.digits.join("")}</strong><span>${guess.exact} exact · ${guess.close} right digit${guess.close === 1 ? "" : "s"}</span></li>`).join("")}</ul>
      ${game.finished ? '<div class="game-actions"><button class="game-secondary" id="codeReset">New code</button></div>' : `<p class="empty-state" style="text-align:center">${8 - game.guesses.length} ${8 - game.guesses.length === 1 ? "guess" : "guesses"} left</p>`}
    </section>`;
}

function submitCodeGuess() {
  const game = activeGame;
  const input = document.querySelector("#codeGuess");
  const digits = input.value.trim().split("");
  if (digits.length !== 4 || digits.some((digit) => !"123456".includes(digit)) || new Set(digits).size !== 4) {
    input.setCustomValidity("Use four different digits from 1 to 6.");
    input.reportValidity();
    input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
    return;
  }
  const exact = digits.reduce((total, digit, index) => total + Number(digit === game.secret[index]), 0);
  const close = digits.filter((digit) => game.secret.includes(digit)).length - exact;
  game.guesses.push({ digits, exact, close });
  if (exact === 4) {
    game.finished = true;
    renderCodebreaker(`You cracked it in ${game.guesses.length} ${game.guesses.length === 1 ? "guess" : "guesses"}!`);
  } else if (game.guesses.length === 8) {
    game.finished = true;
    renderCodebreaker(`That was the last guess. The code was ${game.secret.join("")}.`);
  } else {
    renderCodebreaker("Not quite. Use the clues to narrow it down.");
  }
}

render();