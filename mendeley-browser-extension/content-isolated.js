// content-isolated.js
console.log('[Mendeley Syncer] Isolated content script active.');

// Listen for genuine API tokens from the main-world fetch interceptor (content-main.js)
window.addEventListener('message', function(event) {
  if (event.source !== window) return;

  if (event.data && event.data.type === 'MENDELEY_AUTH_TOKEN') {
    const token = event.data.token;
    
    // Read current stored token first to avoid unnecessary writes
    chrome.storage.local.get(['mendeley_auth_token'], function(data) {
      if (data.mendeley_auth_token !== token) {
        chrome.storage.local.set({ mendeley_auth_token: token }, function() {
          console.log('[Mendeley Syncer] Automatically updated stored API Bearer token.');
        });
      }
    });
  }
});

// Listen for commands from popup.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'GET_STATUS') {
    chrome.storage.local.get(['mendeley_auth_token', 'local_server_url'], function(data) {
      sendResponse({
        hasToken: !!data.mendeley_auth_token,
        token: data.mendeley_auth_token || null,
        serverUrl: data.local_server_url || 'http://localhost:3000'
      });
    });
    return true; // Keep channel open
  }

  if (request.action === 'SYNC_LIBRARY') {
    const serverUrl = request.serverUrl || 'http://localhost:3000';
    chrome.storage.local.set({ local_server_url: serverUrl });

    // Single source of truth: retrieve directly from local storage
    chrome.storage.local.get(['mendeley_auth_token'], async function(data) {
      const token = data.mendeley_auth_token;
      if (!token) {
        sendResponse({ success: false, error: 'No Mendeley authentication token found. Please reload your Mendeley library tab.' });
        return;
      }

      try {
        console.log('[Mendeley Syncer] Initiating sync. Target URL:', serverUrl);
        const documents = await fetchAllMendeleyDocuments(token, function(progressMsg) {
          try {
            chrome.runtime.sendMessage({ action: 'SYNC_PROGRESS', message: progressMsg });
          } catch(e) {}
        });

        console.log(`[Mendeley Syncer] Sync fetched ${documents.length} papers. Posting to ${serverUrl}...`);

        const importRes = await fetch(`${serverUrl}/api/references/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ references: documents })
        });

        if (!importRes.ok) {
          const errMsg = await importRes.text();
          throw new Error(`Local server rejected import: ${importRes.status} ${errMsg}`);
        }

        const result = await importRes.json();
        console.log('[Mendeley Syncer] Local repository sync succeeded.');
        sendResponse({ success: true, count: documents.length });
      } catch (err) {
        console.error('[Mendeley Syncer] Sync execution failed:', err);
        
        // Self-healing: if we get a 401, wipe the invalid token from storage immediately
        if (err.message && err.message.includes('401')) {
          chrome.storage.local.remove(['mendeley_auth_token'], () => {
            console.log('[Mendeley Syncer] Automatically wiped invalid auth token from storage due to 401.');
          });
        }
        
        sendResponse({ success: false, error: err.message });
      }
    });
    return true; // Keep channel open
  }
});

// Recursive paginated fetcher
async function fetchAllMendeleyDocuments(authToken, progressCallback) {
  let allDocs = [];
  const limit = 200;
  let url = `https://api.mendeley.com/documents?limit=${limit}&view=all`;
  
  progressCallback('Sync started. Accessing Mendeley catalog...');

  while (url) {
    const res = await fetch(url, {
      headers: {
        'Authorization': authToken,
        'Accept': 'application/vnd.mendeley-document.1+json'
      }
    });

    if (!res.ok) {
      throw new Error(`Mendeley API returned error status: ${res.status}`);
    }

    const docs = await res.json();
    if (!docs || docs.length === 0) {
      break;
    }

    allDocs = allDocs.concat(docs);
    progressCallback(`Retrieved ${allDocs.length} references...`);

    // Parse Link header pagination
    const linkHeader = res.headers.get('Link') || res.headers.get('link');
    url = null;
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        url = nextMatch[1];
      }
    }

    if (docs.length < limit) {
      break;
    }
  }

  return allDocs;
}
