"use strict";

/*
 * EURO 2028 TOUCH FOOTBALL
 *
 * Если у тебя уже есть адрес API, укажи его ниже.
 * Например: https://your-server.example.com/api
 *
 * GitHub Pages сам по себе не запускает Python backend.
 */
const API_BASE = "";

const ENDPOINTS = {
  players: "/players",
  teams: "/teams",
  matches: "/matches",
  stats: "/stats"
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  players: $("#players-list"),
  teams: $("#teams-list"),
  matches: $("#matches-list"),
  stats: $("#stats-list"),
  playersCount: $("#players-count"),
  teamsCount: $("#teams-count"),
  matchesCount: $("#matches-count"),
  status: $("#app-status")
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function setStatus(message, isError = false) {
  if (!elements.status) return;

  elements.status.textContent = message;
  elements.status.className = isError ? "error" : "muted";
}

function asArray(data) {
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    for (const key of ["items", "results", "data", "players", "teams", "matches", "stats"]) {
      if (Array.isArray(data[key])) return data[key];
    }
  }

  return [];
}

function getName(item, fallback = "Без названия") {
  return item?.name
    ?? item?.username
    ?? item?.full_name
    ?? item?.player_name
    ?? item?.team_name
    ?? fallback;
}

async function fetchData(endpoint) {
  if (!API_BASE) {
    throw new Error("API не настроен");
  }

  const base = API_BASE.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const response = await fetch(base + path, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`API ответил HTTP ${response.status}`);
  }

  return asArray(await response.json());
}

function showMessage(container, message, error = false) {
  if (!container) return;

  container.innerHTML = `
    <article class="card">
      <p class="${error ? "error" : "muted"}">${escapeHTML(message)}</p>
    </article>
  `;
}

function renderPlayers(players) {
  if (!elements.players) return;

  if (!players.length) {
    showMessage(elements.players, "Пока нет данных об игроках.");
    return;
  }

  elements.players.innerHTML = players.map((player) => `
    <article class="player-card">
      <p class="eyebrow">PLAYER</p>
      <h3>${escapeHTML(getName(player, "Игрок"))}</h3>
      <p>Команда: ${escapeHTML(player.team_name ?? player.team ?? "Не указана")}</p>
      <p>Номер: ${escapeHTML(player.number ?? player.jersey_number ?? "—")}</p>
    </article>
  `).join("");
}

function renderTeams(teams) {
  if (!elements.teams) return;

  if (!teams.length) {
    showMessage(elements.teams, "Пока нет зарегистрированных команд.");
    return;
  }

  elements.teams.innerHTML = teams.map((team) => `
    <article class="team-card">
      <p class="eyebrow">TEAM</p>
      <h3>${escapeHTML(getName(team, "Команда"))}</h3>
      <p>${escapeHTML(team.description ?? team.group_name ?? "")}</p>
    </article>
  `).join("");
}

function renderMatches(matches) {
  if (!elements.matches) return;

  if (!matches.length) {
    showMessage(elements.matches, "Пока нет матчей.");
    return;
  }

  elements.matches.innerHTML = matches.map((match) => {
    const home = match.home_team_name
      ?? match.team1_name
      ?? match.home_team
      ?? match.team1
      ?? "Команда 1";

    const away = match.away_team_name
      ?? match.team2_name
      ?? match.away_team
      ?? match.team2
      ?? "Команда 2";

    const score = match.score
      ?? (
        match.home_score != null && match.away_score != null
          ? `${match.home_score} : ${match.away_score}`
          : match.team1_score != null && match.team2_score != null
            ? `${match.team1_score} : ${match.team2_score}`
            : "VS"
      );

    return `
      <article class="match-card">
        <p class="eyebrow">${escapeHTML(match.status ?? match.round ?? "EURO 2028")}</p>
        <h3>${escapeHTML(home)}</h3>
        <p class="match-score">${escapeHTML(score)}</p>
        <h3>${escapeHTML(away)}</h3>
        <p>${escapeHTML(match.date ?? match.match_date ?? match.datetime ?? "Дата не указана")}</p>
        <p>${escapeHTML(match.venue ?? match.location ?? "")}</p>
      </article>
    `;
  }).join("");
}

function renderStats(stats) {
  if (!elements.stats) return;

  if (!stats.length) {
    showMessage(elements.stats, "Статистика пока недоступна.");
    return;
  }

  elements.stats.innerHTML = stats.map((item) => `
    <article class="stat-card">
      <h3>${escapeHTML(getName(item, "Игрок"))}</h3>
      <p>Голы: ${escapeHTML(item.goals ?? 0)}</p>
      <p>Ассисты: ${escapeHTML(item.assists ?? 0)}</p>
      <p>Матчи: ${escapeHTML(item.matches_played ?? item.matches ?? "—")}</p>
    </article>
  `).join("");
}

async function loadSection(endpoint, container, renderer, label) {
  try {
    const data = await fetchData(endpoint);
    renderer(data);
    return data;
  } catch (error) {
    console.error(`Не удалось загрузить ${label}:`, error);

    const message = error.message === "API не настроен"
      ? "Для загрузки данных нужно подключить сервер API."
      : `Не удалось загрузить ${label}. Проверь адрес API и сервер.`;

    showMessage(container, message, true);
    return null;
  }
}

async function initApp() {
  setStatus("Загрузка данных турнира...");

  if (!API_BASE) {
    showMessage(elements.players, "API ещё не подключён.");
    showMessage(elements.teams, "API ещё не подключён.");
    showMessage(elements.matches, "API ещё не подключён.");
    showMessage(elements.stats, "API ещё не подключён.");

    if (elements.playersCount) elements.playersCount.textContent = "—";
    if (elements.teamsCount) elements.teamsCount.textContent = "—";
    if (elements.matchesCount) elements.matchesCount.textContent = "—";

    setStatus("Сайт открыт. Для отображения данных подключи адрес работающего API.", true);
    return;
  }

  const [players, teams, matches, stats] = await Promise.all([
    loadSection(ENDPOINTS.players, elements.players, renderPlayers, "игроков"),
    loadSection(ENDPOINTS.teams, elements.teams, renderTeams, "команды"),
    loadSection(ENDPOINTS.matches, elements.matches, renderMatches, "матчи"),
    loadSection(ENDPOINTS.stats, elements.stats, renderStats, "статистику")
  ]);

  if (elements.playersCount && players) {
    elements.playersCount.textContent = players.length;
  }

  if (elements.teamsCount && teams) {
    elements.teamsCount.textContent = teams.length;
  }

  if (elements.matchesCount && matches) {
    elements.matchesCount.textContent = matches.length;
  }

  const failed = [players, teams, matches, stats].some((value) => value === null);

  setStatus(
    failed
      ? "Некоторые данные не загрузились. Проверь настройки API."
      : "Данные турнира загружены."
    ,
    failed
  );
}

document.addEventListener("DOMContentLoaded", initApp);
