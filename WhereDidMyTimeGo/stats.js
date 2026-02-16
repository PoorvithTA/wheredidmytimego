// Theme Management
const shortcutpopup = document.getElementsByClassName("keyboard-banner");
const themeToggle = document.getElementById("themeToggle");

setTimeout(() => {
  shortcutpopup[0].style.display = "none";
}, 120000);

function initTheme() {
  chrome.storage.local.get(["theme"], (result) => {
    const theme = result.theme || "auto";
    applyTheme(theme);
  });
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.innerHTML =
      '<span class="material-symbols-rounded">light_mode</span>';
  } else if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    themeToggle.innerHTML =
      '<span class="material-symbols-rounded">dark_mode</span>';
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeToggle.innerHTML =
      '<span class="material-symbols-rounded">contrast</span>';
  }
}

themeToggle.addEventListener("click", () => {
  chrome.storage.local.get(["theme"], (result) => {
    const currentTheme = result.theme || "auto";
    let newTheme;

    if (currentTheme === "auto") {
      newTheme = "light";
    } else if (currentTheme === "light") {
      newTheme = "dark";
    } else {
      newTheme = "auto";
    }

    chrome.storage.local.set({ theme: newTheme });
    applyTheme(newTheme);
  });
});

// Utility Functions
function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0 && m === 0) return "< 1m";
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTimeDetailed(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  let parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && h === 0) parts.push(`${s}s`);
  return parts.length > 0 ? parts.join(" ") : "< 1s";
}

function getFavicon(domain) {
  if (domain === "browser-settings") {
    return '<span class="material-symbols-rounded site-icon-large fallback">settings</span>';
  }
  if (domain === "localhost") {
    return '<span class="material-symbols-rounded site-icon-large fallback">code</span>';
  }

  return `<img 
    src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" 
    class="site-icon-large favicon"
    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
    <span class="material-symbols-rounded site-icon-large fallback" style="display:none;">language</span>`;
}

function getDomainName(domain) {
  if (domain === "browser-settings") return "Browser Settings";
  if (domain === "localhost") return "Localhost Development";
  return domain;
}

function calculatePercentage(time, maxTime) {
  if (maxTime === 0) return 0;
  return Math.min((time / maxTime) * 100, 100);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Tab Navigation
const tabButtons = document.querySelectorAll(".nav-tab");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.dataset.tab;

    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(tabName).classList.add("active");

    loadTabData(tabName);
  });
});

// Overview Tab
async function loadOverviewTab() {
  try {
    const data = await chrome.storage.local.get(["dailyData", "lifetimeData"]);
    const dailyData = data.dailyData || {};
    const lifetimeData = data.lifetimeData || {};

    const dailySites = Object.entries(dailyData).filter(([d, t]) => d && t > 0);
    const lifetimeSites = Object.entries(lifetimeData).filter(
      ([d, t]) => d && t > 0,
    );

    const totalToday = dailySites.reduce((sum, [_, time]) => sum + time, 0);
    const totalLifetime = lifetimeSites.reduce(
      (sum, [_, time]) => sum + time,
      0,
    );

    dailySites.sort((a, b) => b[1] - a[1]);
    lifetimeSites.sort((a, b) => b[1] - a[1]);

    // Update hero
    document.getElementById("heroTotalTime").textContent =
      formatTime(totalToday);

    // Update overview stats
    document.getElementById("overviewTotalToday").textContent =
      formatTime(totalToday);
    document.getElementById("overviewLifetime").textContent =
      formatTime(totalLifetime);
    document.getElementById("overviewSites").textContent = dailySites.length;
    document.getElementById("overviewTopSite").textContent =
      dailySites.length > 0 ? getDomainName(dailySites[0][0]) : "—";

    // Render top sites today
    const topSitesContainer = document.getElementById("topSitesContainer");
    topSitesContainer.innerHTML = "";

    const topDaily = dailySites.slice(0, 6);
    const maxDaily = topDaily.length > 0 ? topDaily[0][1] : 0;

    if (topDaily.length === 0) {
      topSitesContainer.innerHTML =
        '<div class="empty-message">No sites visited today yet</div>';
    } else {
      topDaily.forEach(([domain, time], index) => {
        const card = createSiteCardGrid(domain, time, index, maxDaily);
        topSitesContainer.appendChild(card);
      });
    }

    // Render lifetime sites
    const lifetimeContainer = document.getElementById("lifetimeSitesContainer");
    lifetimeContainer.innerHTML = "";

    const topLifetime = lifetimeSites.slice(0, 10);
    const maxLifetime = topLifetime.length > 0 ? topLifetime[0][1] : 0;

    if (topLifetime.length === 0) {
      lifetimeContainer.innerHTML =
        '<div class="empty-message">No lifetime data yet</div>';
    } else {
      topLifetime.forEach(([domain, time], index) => {
        const card = createSiteCardList(domain, time, index + 1, maxLifetime);
        lifetimeContainer.appendChild(card);
      });
    }
  } catch (error) {
    console.error("Error loading overview:", error);
  }
}

function createSiteCardGrid(domain, time, index, maxTime) {
  const card = document.createElement("div");
  card.className = "site-card-grid";
  card.style.animationDelay = `${index * 0.05}s`;

  const percentage = calculatePercentage(time, maxTime);

  card.innerHTML = `
    <div class="site-icon-wrapper-center">
      ${getFavicon(domain)}
    </div>
    <a href="${domain.startsWith("http") ? domain : `https://${domain}`}" 
       target="_blank" 
       class="site-name-grid"
       title="${getDomainName(domain)}">
      ${getDomainName(domain)}
    </a>
    <div class="site-time-grid">${formatTime(time)}</div>
    <div class="progress-bar-grid">
      <div class="progress-fill" style="width: ${percentage}%"></div>
    </div>
  `;

  return card;
}

function createSiteCardList(domain, time, rank, maxTime) {
  const card = document.createElement("div");
  card.className = "site-card-list";
  card.style.animationDelay = `${(rank - 1) * 0.03}s`;

  const percentage = calculatePercentage(time, maxTime);

  card.innerHTML = `
    <div class="site-rank-badge">${rank}</div>
    <div class="site-icon-wrapper">
      ${getFavicon(domain)}
    </div>
    <div class="site-details">
      <a href="${domain.startsWith("http") ? domain : `https://${domain}`}" 
         target="_blank" 
         class="site-name-list"
         title="${getDomainName(domain)}">
        ${getDomainName(domain)}
      </a>
      <div class="progress-bar-list">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
    </div>
    <div class="site-time-list">${formatTime(time)}</div>
  `;

  return card;
}

// All Sites Tab
let currentSiteFilter = "daily";

async function loadAllSitesTab() {
  const searchInput = document.getElementById("siteSearch");
  const filterSelect = document.getElementById("siteFilter");

  filterSelect.value = currentSiteFilter;

  filterSelect.addEventListener("change", () => {
    currentSiteFilter = filterSelect.value;
    renderAllSites(searchInput.value);
  });

  searchInput.addEventListener("input", (e) => {
    renderAllSites(e.target.value);
  });

  await renderAllSites("");
}

async function renderAllSites(searchTerm = "") {
  try {
    const data = await chrome.storage.local.get(["dailyData", "lifetimeData"]);
    const sourceData =
      currentSiteFilter === "daily"
        ? data.dailyData || {}
        : data.lifetimeData || {};

    const sites = Object.entries(sourceData)
      .filter(([domain, time]) => {
        if (!domain || time <= 0) return false;
        if (searchTerm) {
          return domain.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => b[1] - a[1]);

    const container = document.getElementById("allSitesContainer");
    container.innerHTML = "";

    if (sites.length === 0) {
      container.innerHTML = '<div class="empty-message">No sites found</div>';
      return;
    }

    const maxTime = sites[0][1];

    sites.forEach(([domain, time], index) => {
      const card = createSiteCardList(domain, time, index + 1, maxTime);
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error rendering sites:", error);
  }
}

// Sessions Tab
async function loadSessionsTab() {
  const searchInput = document.getElementById("sessionSearch");
  const filterSelect = document.getElementById("sessionDateFilter");

  filterSelect.addEventListener("change", () =>
    renderSessions(searchInput.value, filterSelect.value),
  );
  searchInput.addEventListener("input", (e) =>
    renderSessions(e.target.value, filterSelect.value),
  );

  await renderSessions("", "today");
}

async function renderSessions(searchTerm = "", dateFilter = "today") {
  try {
    const data = await chrome.storage.local.get(["sessionData"]);
    const sessions = data.sessionData || [];

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const filtered = sessions.filter((session) => {
      if (dateFilter === "today" && session.date !== today) return false;
      if (dateFilter === "yesterday" && session.date !== yesterdayStr)
        return false;
      if (dateFilter === "week") {
        const sessionDate = new Date(session.date);
        if (sessionDate < weekAgo) return false;
      }

      if (
        searchTerm &&
        !session.domain.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => b.startTime - a.startTime);

    const container = document.getElementById("sessionsContainer");
    container.innerHTML = "";

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="empty-message">No sessions found</div>';
      return;
    }

    const groupedByDate = {};
    filtered.forEach((session) => {
      if (!groupedByDate[session.date]) {
        groupedByDate[session.date] = [];
      }
      groupedByDate[session.date].push(session);
    });

    Object.entries(groupedByDate).forEach(([date, sessions]) => {
      const dateHeader = document.createElement("div");
      dateHeader.className = "session-date-header";
      dateHeader.textContent = formatDate(date);
      container.appendChild(dateHeader);

      sessions.forEach((session, index) => {
        const sessionCard = createSessionCard(session, index);
        container.appendChild(sessionCard);
      });
    });
  } catch (error) {
    console.error("Error rendering sessions:", error);
  }
}

function createSessionCard(session, index) {
  const card = document.createElement("div");
  card.className = "session-card";
  card.style.animationDelay = `${index * 0.02}s`;

  card.innerHTML = `
    <div class="session-icon-wrapper">
      ${getFavicon(session.domain)}
    </div>
    <div class="session-details">
      <div class="session-domain">${getDomainName(session.domain)}</div>
      <div class="session-time-range">
        ${formatTimestamp(session.startTime)} → ${formatTimestamp(session.endTime)}
      </div>
    </div>
    <div class="session-duration">${formatTimeDetailed(session.duration)}</div>
  `;

  return card;
}

// Limits Tab
async function loadLimitsTab() {
  const addLimitBtn = document.getElementById("addLimitBtn");
  const modal = document.getElementById("addLimitModal");
  const closeButtons = modal.querySelectorAll(".close-modal");
  const saveLimitBtn = document.getElementById("saveLimitBtn");

  addLimitBtn.addEventListener("click", () => {
    modal.style.display = "flex";
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  });

  saveLimitBtn.addEventListener("click", async () => {
    const domain = document.getElementById("limitDomain").value.trim();
    const minutes = parseInt(document.getElementById("limitMinutes").value);

    if (!domain || minutes <= 0) {
      alert("Please enter a valid domain and limit");
      return;
    }

    const data = await chrome.storage.local.get(["limits"]);
    const limits = data.limits || {};
    limits[domain] = minutes * 60; // Convert minutes to seconds

    await chrome.storage.local.set({ limits });

    modal.style.display = "none";
    document.getElementById("limitDomain").value = "";
    document.getElementById("limitMinutes").value = "30";

    await renderLimits();
  });

  await renderLimits();
}

async function renderLimits() {
  try {
    const data = await chrome.storage.local.get(["limits", "dailyData"]);
    const limits = data.limits || {};
    const dailyData = data.dailyData || {};

    const container = document.getElementById("limitsContainer");
    container.innerHTML = "";

    const limitEntries = Object.entries(limits);

    if (limitEntries.length === 0) {
      container.innerHTML =
        '<div class="empty-message">No limits set. Click "Add Limit" to create one.</div>';
      return;
    }

    limitEntries.forEach(([domain, limitSeconds], index) => {
      const timeSpent = dailyData[domain] || 0;
      const percentage = calculatePercentage(timeSpent, limitSeconds);
      const isExceeded = timeSpent >= limitSeconds;

      const card = document.createElement("div");
      card.className = `limit-card ${isExceeded ? "exceeded" : ""}`;
      card.style.animationDelay = `${index * 0.05}s`;

      card.innerHTML = `
        <div class="limit-header">
          <div class="limit-icon-wrapper">
            ${getFavicon(domain)}
          </div>
          <div class="limit-info">
            <div class="limit-domain">${getDomainName(domain)}</div>
            <div class="limit-stats">
              ${formatTime(timeSpent)} / ${formatTime(limitSeconds)}
              ${isExceeded ? '<span class="exceeded-badge">Exceeded</span>' : ""}
            </div>
          </div>
          <button class="remove-limit-btn" data-domain="${domain}">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
        <div class="limit-progress-bar">
          <div class="limit-progress-fill ${isExceeded ? "exceeded" : ""}" style="width: ${percentage}%"></div>
        </div>
      `;

      container.appendChild(card);
    });

    document.querySelectorAll(".remove-limit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const domain = btn.dataset.domain;
        const data = await chrome.storage.local.get(["limits"]);
        const limits = data.limits || {};
        delete limits[domain];
        await chrome.storage.local.set({ limits });
        await renderLimits();
      });
    });
  } catch (error) {
    console.error("Error rendering limits:", error);
  }
}

// Settings Tab
function loadSettingsTab() {
  const exportBtn = document.getElementById("exportDataBtn");
  const importFile = document.getElementById("importDataFile");
  const clearTodayBtn = document.getElementById("clearTodayBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  exportBtn.addEventListener("click", exportData);
  importFile.addEventListener("change", importData);
  clearTodayBtn.addEventListener("click", clearTodayData);
  clearAllBtn.addEventListener("click", clearAllData);
}

async function exportData() {
  try {
    const data = await chrome.storage.local.get([
      "dailyData",
      "lifetimeData",
      "sessionData",
      "limits",
    ]);

    const exportObj = {
      exportDate: new Date().toISOString(),
      version: "5.0",
      data: data,
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `WhereDidMyTimeGo_Export_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert("Data exported successfully!");
  } catch (error) {
    console.error("Error exporting data:", error);
    alert("Failed to export data");
  }
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importObj = JSON.parse(text);

    if (!importObj.data) {
      alert("Invalid import file format");
      return;
    }

    await chrome.storage.local.set(importObj.data);
    alert("Data imported successfully!");
    location.reload();
  } catch (error) {
    console.error("Error importing data:", error);
    alert("Failed to import data");
  }
}

async function clearTodayData() {
  if (
    !confirm(
      "Are you sure you want to clear today's data? This cannot be undone.",
    )
  ) {
    return;
  }

  try {
    await chrome.storage.local.set({ dailyData: {} });
    alert("Today's data cleared");
    location.reload();
  } catch (error) {
    console.error("Error clearing today data:", error);
    alert("Failed to clear data");
  }
}

async function clearAllData() {
  if (
    !confirm("Are you sure you want to delete ALL data? This cannot be undone.")
  ) {
    return;
  }

  const secondConfirm = confirm(
    "This will permanently delete all your tracking data. Continue?",
  );
  if (!secondConfirm) return;

  try {
    await chrome.storage.local.clear();
    alert("All data cleared");
    location.reload();
  } catch (error) {
    console.error("Error clearing all data:", error);
    alert("Failed to clear data");
  }
}

// Tab Data Loader
async function loadTabData(tabName) {
  switch (tabName) {
    case "overview":
      await loadOverviewTab();
      break;
    case "sites":
      await loadAllSitesTab();
      break;
    case "sessions":
      await loadSessionsTab();
      break;
    case "limits":
      await loadLimitsTab();
      break;
    case "settings":
      loadSettingsTab();
      break;
  }
}

// Initialize
initTheme();
loadOverviewTab();

// Auto-refresh overview
setInterval(() => {
  const activeTab = document.querySelector(".tab-content.active");
  if (activeTab.id === "overview") {
    loadOverviewTab();
  }
}, 10000);
