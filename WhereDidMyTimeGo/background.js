// ========================================
// TIME TRACKING ENGINE
// ========================================

let currentDomain = null;
let currentTabId = null;
let startTime = null;
let sessionId = null;
let isWindowFocused = true;
let lastSaveTime = Date.now();

// Generate unique session ID
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Extract clean domain from URL
function getDomain(url) {
  try {
    const u = new URL(url);

    if (!u.hostname) return null;

    // Handle Chrome internal pages
    if (
      u.protocol === "chrome:" ||
      u.protocol === "about:" ||
      u.protocol === "chrome-extension:"
    ) {
      return "browser-settings";
    }

    // Handle localhost
    if (u.hostname === "localhost" || u.hostname.startsWith("127.")) {
      return "localhost";
    }

    // Must have a valid hostname
    if (!u.hostname.includes(".")) return null;

    // Return clean domain (remove www.)
    let domain = u.hostname;
    if (domain.startsWith("www.")) {
      domain = domain.substring(4);
    }

    return domain;
  } catch {
    return null;
  }
}

// Save accumulated time and session data
async function saveTime() {
  if (!currentDomain || !startTime || !isWindowFocused) return;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  // Prevent negative or zero time
  if (elapsed <= 0) return;

  // Prevent inflation from rapid switching (ignore < 1 second)
  if (elapsed < 1) {
    startTime = Date.now();
    return;
  }

  try {
    const data = await chrome.storage.local.get([
      "dailyData",
      "lifetimeData",
      "sessionData",
      "limits",
      "lastResetDate",
    ]);

    const daily = data.dailyData || {};
    const lifetime = data.lifetimeData || {};
    const sessions = data.sessionData || [];
    const limits = data.limits || {};

    // Update domain totals
    daily[currentDomain] = (daily[currentDomain] || 0) + elapsed;
    lifetime[currentDomain] = (lifetime[currentDomain] || 0) + elapsed;

    // Save session data
    const session = {
      id: sessionId,
      domain: currentDomain,
      tabId: currentTabId,
      startTime: startTime,
      endTime: Date.now(),
      duration: elapsed,
      date: new Date().toISOString().split("T")[0],
    };

    sessions.push(session);

    // Keep only last 1000 sessions to prevent storage bloat
    if (sessions.length > 1000) {
      sessions.shift();
    }

    // Save to storage
    await chrome.storage.local.set({
      dailyData: daily,
      lifetimeData: lifetime,
      sessionData: sessions,
    });

    // Check if site limit exceeded
    if (limits[currentDomain]) {
      const limit = limits[currentDomain];
      const timeSpent = daily[currentDomain] || 0;

      if (timeSpent >= limit && currentTabId) {
        // Redirect to blocked page
        chrome.tabs.update(currentTabId, {
          url: chrome.runtime.getURL(
            `blocked.html?domain=${encodeURIComponent(currentDomain)}&time=${timeSpent}&limit=${limit}`,
          ),
        });
      }
    }

    lastSaveTime = Date.now();
  } catch (error) {
    console.error("Error saving time:", error);
  }
}

// Start tracking a new tab
async function startTracking(tab) {
  // Save previous session first
  await saveTime();

  // Reset tracking state
  currentDomain = getDomain(tab.url);
  currentTabId = tab.id;
  startTime = Date.now();
  sessionId = generateSessionId();

  // Don't track invalid domains
  if (!currentDomain) {
    currentDomain = null;
    currentTabId = null;
    startTime = null;
    sessionId = null;
  }
}

// Stop tracking
async function stopTracking() {
  await saveTime();
  currentDomain = null;
  currentTabId = null;
  startTime = null;
  sessionId = null;
}

// ========================================
// EVENT LISTENERS
// ========================================

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);

    await checkAndBlock(tabId, tab.url);

    if (isWindowFocused) {
      await startTracking(tab);
    }
  } catch (error) {
    console.error("Error on tab activation:", error);
  }
});


chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.url) {
    await checkAndBlock(tabId, info.url);

    if (tabId === currentTabId && isWindowFocused) {
      await startTracking(tab);
    }
  }
});

// Track window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus (minimized, switched to another app)
    isWindowFocused = false;
    await saveTime();
  } else {
    // Window gained focus
    isWindowFocused = true;

    // Get current active tab in focused window
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId: windowId,
      });
      if (tab) {
        await startTracking(tab);
      }
    } catch (error) {
      console.error("Error on window focus:", error);
    }
  }
});

// Save data periodically (every 5 seconds)
setInterval(async () => {
  if (isWindowFocused && currentDomain && startTime) {
    await saveTime();
    // Reset start time to continue tracking
    startTime = Date.now();
  }
}, 5000);

// ========================================
// DAILY RESET
// ========================================

// Check if we need to reset daily data
async function checkDailyReset() {
  const today = new Date().toISOString().split("T")[0];
  const data = await chrome.storage.local.get(["lastResetDate"]);

  if (data.lastResetDate !== today) {
    // Reset daily data
    await chrome.storage.local.set({
      dailyData: {},
      lastResetDate: today,
    });
    console.log("Daily data reset for new day:", today);
  }
}

// Check for daily reset every minute
setInterval(checkDailyReset, 60000);

// Check on startup
checkDailyReset();

// Calculate time until next midnight for alarm
function getMillisecondsUntilMidnight() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

// Create daily reset alarm
chrome.alarms.create("dailyReset", {
  when: Date.now() + getMillisecondsUntilMidnight(),
  periodInMinutes: 1440, // 24 hours
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "dailyReset") {
    await checkDailyReset();
  }
});

// ========================================
// INITIALIZE
// ========================================

// Get initial active tab on startup
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (tabs[0]) {
    await startTracking(tabs[0]);
  }
});

// Initialize storage structure
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([
    "dailyData",
    "lifetimeData",
    "sessionData",
    "limits",
    "lastResetDate",
  ]);

  if (!data.dailyData) await chrome.storage.local.set({ dailyData: {} });
  if (!data.lifetimeData) await chrome.storage.local.set({ lifetimeData: {} });
  if (!data.sessionData) await chrome.storage.local.set({ sessionData: [] });
  if (!data.limits) await chrome.storage.local.set({ limits: {} });
  if (!data.lastResetDate)
    await chrome.storage.local.set({
      lastResetDate: new Date().toISOString().split("T")[0],
    });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-dashboard") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("stats.html"),
    });
  }
});

async function checkAndBlock(tabId, url) {
  const domain = getDomain(url);
  if (!domain) return;

  const data = await chrome.storage.local.get(["dailyData", "limits"]);
  const daily = data.dailyData || {};
  const limits = data.limits || {};

  if (limits[domain] && daily[domain] >= limits[domain]) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(
        `blocked.html?domain=${encodeURIComponent(domain)}&time=${daily[domain]}&limit=${limits[domain]}`,
      ),
    });
  }
}
