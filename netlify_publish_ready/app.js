"use strict";

const API_BASE = "";
const REFRESH_INTERVAL = 15000;

const state = {
    currentTab: "players",
    players: [],
    teams: [],
    matches: [],
    isAdmin: false,
    loading: new Set()
};

const $ = (selector) => document.querySelector(selector);

const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value ?? "";
}

function setStatus(selector, message, isError = false) {
    const element = $(selector);
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);
}

function getTelegramInitData() {
    return window.Telegram?.WebApp?.initData || "";
}

async function api(path, options = {}) {
    const headers = {
        "X-Telegram-Init-Data": getTelegramInitData(),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message =
            typeof data === "object" && data !== null
                ? data.error || data.message
                : data;

        throw new Error(message || `Ошибка сервера: ${response.status}`);
    }

    return data;
}

function showError(message) {
    console.error("[EURO 2028]", message);

    let element = $("#app-error");

    if (!element) {
        element = document.createElement("div");
        element.id = "app-error";
        element.setAttribute("role", "alert");
        element.style.cssText =
            "margin:12px 0;padding:12px;border-radius:12px;" +
            "background:#512b35;color:#fff;font-size:14px;";

        const container = document.querySelector("main") || document.body;
        container.prepend(element);
    }

    element.textContent = message;
}

function clearError() {
    $("#app-error")?.remove();
}

/* ---------- Вкладки ---------- */

function showTab(tabName) {
    const section = document.getElementById(tabName);

    if (!section || !section.classList.contains("tab-section")) {
        console.warn(`Не найдена секция вкладки: ${tabName}`);
        return;
    }

    state.currentTab = tabName;

    document.querySelectorAll(".tab-section").forEach((item) => {
        const isActive = item.id === tabName;
        item.classList.toggle("hidden", !isActive);
        item.setAttribute("aria-hidden", String(!isActive));
    });

    document.querySelectorAll("[data-tab]").forEach((button) => {
        const isActive = button.dataset.tab === tabName;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    const loaders = {
        players: loadPlayers,
        teams: loadTeams,
        matches: loadMatches
    };

    if (loaders[tabName]) {
        loaders[tabName]().catch((error) => showError(error.message));
    }
}

function setupTabs() {
    document.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            showTab(button.dataset.tab);
        });
    });

    showTab("players");
}

/* ---------- Игроки ---------- */

async function loadPlayers() {
    if (state.loading.has("players")) return;

    state.loading.add("players");

    try {
        const data = await api("/api/players");
        state.players = Array.isArray(data) ? data : data.players || [];
        renderPlayers();
        updateStats();
        clearError();
    } finally {
        state.loading.delete("players");
    }
}

function renderPlayers() {
    const container = $("#player-list");
    if (!container) return;

    const search = ($("#search")?.value || "").trim().toLowerCase();

    const players = state.players.filter((player) => {
        const text = [
            player.roblox_nick,
            player.telegram_username,
            player.team_name,
            player.country_name
        ].join(" ").toLowerCase();

        return text.includes(search);
    });

    if (!players.length) {
        container.innerHTML = '<p class="empty-state">Игроки не найдены</p>';
        return;
    }

    container.innerHTML = players.map((player) => `
        <article class="player-card">
            <div class="player-info">
                <strong>${escapeHTML(player.roblox_nick || player.telegram_username || "Игрок")}</strong>
                <span>${escapeHTML(player.team_name || "Без сборной")}</span>
            </div>
            <div class="player-stats">
                <span>⚽ ${Number(player.goals || 0)}</span>
                <span>🎯 ${Number(player.assists || 0)}</span>
                <span>🧤 ${Number(player.saves || 0)}</span>
            </div>
        </article>
    `).join("");
}

/* ---------- Сборные ---------- */

async function loadTeams() {
    if (state.loading.has("teams")) return;

    state.loading.add("teams");

    try {
        const data = await api("/api/teams");
        state.teams = Array.isArray(data) ? data : data.teams || [];
        renderTeams();
        fillTeamSelects();
        updateStats();
        clearError();
    } finally {
        state.loading.delete("teams");
    }
}

function renderTeams() {
    const container = $("#team-list");
    if (!container) return;

    const search = ($("#search")?.value || "").trim().toLowerCase();

    const teams = state.teams.filter((team) =>
        `${team.name || ""} ${team.country_code || ""}`
            .toLowerCase()
            .includes(search)
    );

    if (!teams.length) {
        container.innerHTML = '<p class="empty-state">Сборные не найдены</p>';
        return;
    }

    container.innerHTML = teams.map((team) => `
        <article class="team-card">
            <div class="team-flag">${escapeHTML(team.flag || "🏳️")}</div>
            <div class="team-info">
                <strong>${escapeHTML(team.name || "Сборная")}</strong>
                <span>${Number(team.player_count || 0)} игроков</span>
            </div>
        </article>
    `).join("");
}

/* ---------- Матчи ---------- */

async function loadMatches() {
    if (state.loading.has("matches")) return;

    state.loading.add("matches");

    try {
        const data = await api("/api/matches");
        state.matches = Array.isArray(data) ? data : data.matches || [];
        renderMatches();
        updateStats();
        clearError();
    } finally {
        state.loading.delete("matches");
    }
}

function formatDate(value) {
    if (!value) return "Дата не назначена";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function renderMatches() {
    const container = $("#match-list");
    if (!container) return;

    if (!state.matches.length) {
        container.innerHTML = '<p class="empty-state">Матчей пока нет</p>';
        return;
    }

    const matches = [...state.matches].sort((a, b) =>
        String(a.match_datetime || "").localeCompare(
            String(b.match_datetime || "")
        )
    );

    container.innerHTML = matches.map((match) => {
        const home = match.home_team_name || match.home_name || "Сборная 1";
        const away = match.away_team_name || match.away_name || "Сборная 2";

        const scoreAvailable =
            match.home_score !== null &&
            match.home_score !== undefined &&
            match.away_score !== null &&
            match.away_score !== undefined;

        const score = scoreAvailable
            ? `${Number(match.home_score)} : ${Number(match.away_score)}`
            : "VS";

        const status = match.status === "finished"
            ? "Завершён"
            : match.status === "live"
                ? "Идёт матч"
                : "Запланирован";

        return `
            <article class="match-card">
                <div class="match-date">${escapeHTML(formatDate(match.match_datetime))}</div>
                <div class="match-teams">
                    <strong>${escapeHTML(home)}</strong>
                    <span class="match-score">${escapeHTML(score)}</span>
                    <strong>${escapeHTML(away)}</strong>
                </div>
                <div class="match-status">${escapeHTML(status)}</div>
            </article>
        `;
    }).join("");
}

/* ---------- Статистика ---------- */

function updateStats() {
    setText("#player-count", state.players.length);
    setText("#team-count", state.teams.length);
    setText("#match-count", state.matches.length);
}

/* ---------- Админка ---------- */

async function setupAdmin() {
    const panel = $("#admin");
    if (!panel) return;

    try {
        const data = await api("/api/me");
        state.isAdmin = Boolean(data.is_admin);

        panel.classList.toggle("hidden", !state.isAdmin);

        if (state.isAdmin) {
            fillTeamSelects();
        }
    } catch (error) {
        state.isAdmin = false;
        panel.classList.add("hidden");
        console.warn("Не удалось проверить права администратора:", error.message);
    }
}

function fillTeamSelects() {
    const selects = ["#team-select", "#home-team", "#away-team"];

    selects.forEach((selector) => {
        const select = $(selector);
        if (!select) return;

        const previousValue = select.value;

        select.innerHTML = '<option value="">Выбери сборную</option>';

        state.teams.forEach((team) => {
            const option = document.createElement("option");
            option.value = team.id;
            option.textContent = `${team.flag || ""} ${team.name}`;
            select.appendChild(option);
        });

        if ([...select.options].some((option) => option.value === previousValue)) {
            select.value = previousValue;
        }
    });
}

function setupMatchForm() {
    const form = $("#match-form");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!state.isAdmin) {
            setStatus("#match-form-status", "Нет прав администратора", true);
            return;
        }

        const homeTeam = $("#home-team")?.value;
        const awayTeam = $("#away-team")?.value;
        const matchDateTime = $("#match-datetime")?.value;

        if (!homeTeam || !awayTeam || !matchDateTime) {
            setStatus("#match-form-status", "Заполни все поля", true);
            return;
        }

        if (homeTeam === awayTeam) {
            setStatus("#match-form-status", "Выбери две разные сборные", true);
            return;
        }

        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        try {
            await api("/api/admin/match", {
                method: "POST",
                body: JSON.stringify({
                    home_team_id: Number(homeTeam),
                    away_team_id: Number(awayTeam),
                    match_datetime: matchDateTime
                })
            });

            setStatus("#match-form-status", "Матч создан!");
            form.reset();

            await loadMatches();
            showTab("matches");
        } catch (error) {
            setStatus("#match-form-status", error.message, true);
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

/* ---------- Поиск и запуск ---------- */

function setupSearch() {
    $("#search")?.addEventListener("input", () => {
        renderPlayers();
        renderTeams();
    });
}

async function refreshCurrentTab() {
    try {
        if (state.currentTab === "players") await loadPlayers();
        if (state.currentTab === "teams") await loadTeams();
        if (state.currentTab === "matches") await loadMatches();
    } catch (error) {
        showError(`Не удалось обновить данные: ${error.message}`);
    }
}

async function initApp() {
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    setupTabs();
    setupSearch();
    setupMatchForm();

    await Promise.allSettled([
        loadPlayers(),
        loadTeams(),
        loadMatches(),
        setupAdmin()
    ]);

    updateStats();

    window.setInterval(refreshCurrentTab, REFRESH_INTERVAL);
}

document.addEventListener("DOMContentLoaded", initApp);
