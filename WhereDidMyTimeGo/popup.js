// DOM Elements
const container = document.getElementById("topList");
const emptyState = document.getElementById("emptyState");
const button = document.getElementById("viewStats");
const totalTodayEl = document.getElementById("totalToday");
const sitesCountEl = document.getElementById("sitesCount");
const themeToggle = document.getElementById("themeToggle");

// Theme Management
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
    // Auto mode - follow system preference
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

// Format seconds to readable time
function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0 && m === 0) return "< 1m";
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Get favicon or fallback icon
function getFavicon(domain) {
  if (domain === "browser-settings") {
    return '<span class="material-symbols-rounded site-icon fallback">settings</span>';
  }
  if (domain === "localhost") {
    return '<span class="material-symbols-rounded site-icon fallback">code</span>';
  }

  return `<img 
    src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" 
    class="site-icon favicon"
    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
    <span class="material-symbols-rounded site-icon fallback" style="display:none;">language</span>`;
}

// Get domain display name
function getDomainName(domain) {
  if (domain === "browser-settings") return "Browser Settings";
  if (domain === "localhost") return "Localhost Development";
  return domain;
}

// Calculate percentage for progress bar
function calculatePercentage(time, maxTime) {
  if (maxTime === 0) return 0;
  return Math.min((time / maxTime) * 100, 100);
}

// Create site card
function createSiteCard(domain, seconds, rank, maxTime) {
  const card = document.createElement("div");
  card.className = "site-card";
  card.style.animationDelay = `${rank * 0.05}s`;

  const percentage = calculatePercentage(seconds, maxTime);

  card.innerHTML = `
    <div class="site-rank">${rank}</div>
    <div class="site-icon-wrapper">
      ${getFavicon(domain)}
    </div>
    <div class="site-info">
      <a href="${domain.startsWith("http") ? domain : `https://${domain}`}" 
         target="_blank" 
         class="site-name"
         title="${getDomainName(domain)}">
        ${getDomainName(domain)}
      </a>
      <div class="site-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    </div>
    <div class="site-time">${formatTime(seconds)}</div>
  `;

  return card;
}

// Load and display data
async function loadData() {
  try {
    const data = await chrome.storage.local.get(["dailyData"]);
    const dailyData = data.dailyData || {};

    // Filter and sort sites
    const sites = Object.entries(dailyData)
      .filter(([domain, time]) => domain && time > 0)
      .sort((a, b) => b[1] - a[1]);

    // Update quick stats
    const totalTime = sites.reduce((sum, [_, time]) => sum + time, 0);
    totalTodayEl.textContent = formatTime(totalTime);
    sitesCountEl.textContent = sites.length;

    // Clear container
    container.innerHTML = "";

    if (sites.length === 0) {
      emptyState.style.display = "flex";
      container.style.display = "none";
    } else {
      emptyState.style.display = "none";
      container.style.display = "flex";

      // Get top 5 sites
      const top5 = sites.slice(0, 5);
      const maxTime = top5[0][1]; // Highest time for percentage calculation

      // Create cards
      top5.forEach(([domain, seconds], index) => {
        const card = createSiteCard(domain, seconds, index + 1, maxTime);
        container.appendChild(card);
      });
    }
  } catch (error) {
    console.error("Error loading data:", error);
    emptyState.style.display = "flex";
    container.style.display = "none";
  }
}



// Initialize
initTheme();
loadData();

// Auto-refresh every 5 seconds
setInterval(loadData, 5000);
