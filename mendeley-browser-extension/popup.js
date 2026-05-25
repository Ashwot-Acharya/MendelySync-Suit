// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const mendeleyDot = document.getElementById('mendeley-dot');
  const mendeleyStatusText = document.getElementById('mendeley-status-text');
  const statusHint = document.getElementById('status-hint');
  const serverUrlInput = document.getElementById('server-url');
  const syncBtn = document.getElementById('sync-btn');
  const logConsole = document.getElementById('log-console');

  function log(msg, type = 'info') {
    const div = document.createElement('div');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    div.textContent = `[${timeStr}] ${msg}`;
    if (type === 'error') div.className = 'console-error';
    if (type === 'success') div.className = 'console-success';
    logConsole.appendChild(div);
    logConsole.scrollTop = logConsole.scrollHeight;
  }

  // Find active tab
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (err) {
    log('Error querying browser tabs.', 'error');
    return;
  }

  const activeTab = tabs[0];
  const isOnMendeley = activeTab && activeTab.url && activeTab.url.includes('mendeley.com');

  if (!isOnMendeley) {
    log('Syncer offline: Open Mendeley Library page first.', 'error');
    mendeleyDot.className = 'dot inactive';
    mendeleyStatusText.textContent = 'Not on Mendeley';
    statusHint.innerHTML = 'Go to <a href="https://www.mendeley.com/reference-manager/library/all-references/" target="_blank" style="color: var(--primary); text-decoration: none;">Mendeley Library</a> to start.';
    syncBtn.disabled = true;
    return;
  }

  // Manual Token Wiring
  const toggleManualBtn = document.getElementById('toggle-manual-token');
  const manualContainer = document.getElementById('manual-token-container');
  const manualInput = document.getElementById('manual-token-input');
  const saveTokenBtn = document.getElementById('save-token-btn');

  toggleManualBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const isHidden = manualContainer.style.display === 'none';
    manualContainer.style.display = isHidden ? 'flex' : 'none';
  });

  saveTokenBtn.addEventListener('click', () => {
    let rawToken = manualInput.value.trim();
    if (!rawToken) {
      log('Cleared manual token override.', 'warning');
      chrome.storage.local.remove(['mendeley_auth_token'], () => checkStatus());
      return;
    }

    // Auto-prefix Bearer if needed
    if (!rawToken.startsWith('Bearer ') && rawToken.startsWith('eyJ')) {
      rawToken = `Bearer ${rawToken}`;
      manualInput.value = rawToken;
    }

    chrome.storage.local.set({ mendeley_auth_token: rawToken }, () => {
      log('Saved manual token override.', 'success');
      checkStatus();
    });
  });

  // Load URL & Token config
  chrome.storage.local.get(['local_server_url', 'mendeley_auth_token'], (res) => {
    if (res.local_server_url) {
      serverUrlInput.value = res.local_server_url;
    }
    if (res.mendeley_auth_token) {
      manualInput.value = res.mendeley_auth_token;
    }
  });

  // Query tab for auth status
  function checkStatus() {
    chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        log('Waiting for Mendeley connection... Refresh the page.', 'error');
        mendeleyDot.className = 'dot inactive';
        mendeleyStatusText.textContent = 'Offline';
        syncBtn.disabled = true;
        return;
      }

      if (response.serverUrl) {
        serverUrlInput.value = response.serverUrl;
      }

      if (response.hasToken) {
        mendeleyDot.className = 'dot active';
        mendeleyStatusText.textContent = 'Connected';
        mendeleyStatusText.style.color = 'var(--success)';
        statusHint.textContent = 'Authentication captured! Ready to sync.';
        syncBtn.disabled = false;
        log('Session authentication loaded. Ready.');
      } else {
        mendeleyDot.className = 'dot inactive';
        mendeleyStatusText.textContent = 'Acquiring Auth Token...';
        statusHint.textContent = 'Refresh or scroll the Mendeley library page to prompt login detection.';
        syncBtn.disabled = true;
        log('Waiting for active bearer token...');
      }
    });
  }

  // Run initial check and set simple interval
  checkStatus();
  const statusInterval = setInterval(checkStatus, 3000);

  // Monitor logs from content.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'SYNC_PROGRESS') {
      log(message.message);
    }
  });

  // Sync click action
  syncBtn.addEventListener('click', () => {
    const serverUrl = serverUrlInput.value.trim();
    if (!serverUrl) {
      log('Please supply your server URL.', 'error');
      return;
    }

    clearInterval(statusInterval);
    syncBtn.disabled = true;
    log('Sync started. Fetching Mendeley database...');

    chrome.tabs.sendMessage(activeTab.id, { action: 'SYNC_LIBRARY', serverUrl: serverUrl }, (response) => {
      // Restart background status check
      setInterval(checkStatus, 3000);

      if (chrome.runtime.lastError || !response) {
        log('Communication failed with Mendeley tab.', 'error');
        syncBtn.disabled = false;
        return;
      }

      if (response.success) {
        log(`Success! Synchronized ${response.count} items.`, 'success');
        log('Check local server dashboard to view.', 'success');
      } else {
        log(`Failed: ${response.error}`, 'error');
        syncBtn.disabled = false;
      }
    });
  });
});
