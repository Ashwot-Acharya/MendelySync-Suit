// app.js
document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let allReferences = [];
  let filteredReferences = [];
  let selectedType = null;
  let selectedYear = null;
  let searchQuery = '';

  // DOM Elements
  const referencesContainer = document.getElementById('references-container');
  const searchInput = document.getElementById('search-input');
  const displayedCount = document.getElementById('displayed-count');
  const totalCount = document.getElementById('total-count');
  
  // Stats
  const statTotalRef = document.getElementById('stat-total-references');
  const statJournals = document.getElementById('stat-journals');
  const statRecentYear = document.getElementById('stat-recent-year');
  
  // Sidebar Filters
  const filterTypesContainer = document.getElementById('filter-types-container');
  const filterYearsContainer = document.getElementById('filter-years-container');
  const ipAddressList = document.getElementById('ip-address-list');

  // Modals & Triggers
  const btnPhoneSync = document.getElementById('btn-phone-sync');
  const btnClearDb = document.getElementById('btn-clear-db');
  
  const detailModal = document.getElementById('detail-modal');
  const modalClose = document.getElementById('modal-close');
  const modalDocType = document.getElementById('modal-doc-type');
  const modalDocTitle = document.getElementById('modal-doc-title');
  const modalDocAuthors = document.getElementById('modal-doc-authors');
  const modalDocSource = document.getElementById('modal-doc-source');
  const modalDocYear = document.getElementById('modal-doc-year');
  const modalDocDoi = document.getElementById('modal-doc-doi');
  const modalDocAbstract = document.getElementById('modal-doc-abstract');
  const modalDocTags = document.getElementById('modal-doc-tags');
  const modalTagsSection = document.getElementById('modal-tags-section');
  const modalDocRaw = document.getElementById('modal-doc-raw');

  const syncModal = document.getElementById('sync-modal');
  const syncModalClose = document.getElementById('sync-modal-close');
  const syncModalOk = document.getElementById('sync-modal-ok');
  const modalIpsContainer = document.getElementById('modal-ips-container');

  // --- 1. CORE DATA ACQUISITION ---
  async function loadDashboardData() {
    try {
      showLoadingState();
      
      // Fetch references
      const refResponse = await fetch('/api/references');
      const refData = await refResponse.json();
      allReferences = refData.references || [];
      filteredReferences = [...allReferences];
      
      // Fetch system/IP status
      const sysResponse = await fetch('/api/system/status');
      const sysData = await sysResponse.json();
      
      // Render components
      populateStats(allReferences);
      populateFilters(allReferences);
      populateIPAddresses(sysData.localIPs, sysData.serverPort);
      renderReferencesList();
    } catch (err) {
      console.error('Dashboard loading error:', err);
      showErrorState('Failed to fetch data from the local repository server.');
    }
  }

  // --- 2. RENDER ENGINE ---
  function renderReferencesList() {
    referencesContainer.innerHTML = '';
    
    if (filteredReferences.length === 0) {
      referencesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <h3>No papers found</h3>
          <p>${allReferences.length === 0 ? "Your local repository is currently empty. Use the Firefox extension to import your Mendeley library." : "No references match your current search queries or filter selections."}</p>
        </div>
      `;
      displayedCount.textContent = 0;
      totalCount.textContent = allReferences.length;
      return;
    }

    filteredReferences.forEach(ref => {
      const card = document.createElement('article');
      card.className = 'ref-card';
      
      // Author parsing helper for card display
      let authorDisplay = 'Unknown Authors';
      if (ref.authors && ref.authors.length > 0) {
        authorDisplay = ref.authors.map(a => {
          if (a.first_name && a.last_name) return `${a.first_name} ${a.last_name}`;
          if (a.last_name) return a.last_name;
          if (a.first_name) return a.first_name;
          return '';
        }).filter(Boolean).join(', ');
      }
      
      // Limit author length if extremely long
      if (authorDisplay.length > 90) {
        authorDisplay = authorDisplay.substring(0, 85) + '... et al.';
      }

      const badgeClass = `badge-${(ref.type || 'generic').toLowerCase()}`;

      card.innerHTML = `
        <div class="ref-header">
          <span class="badge ${badgeClass}">${ref.type || 'generic'}</span>
          <span class="ref-year">${ref.year || 'N/A'}</span>
        </div>
        <h3 class="ref-title">${escapeHTML(ref.title)}</h3>
        <p class="ref-authors">${escapeHTML(authorDisplay)}</p>
        ${ref.source ? `<p class="ref-source">${escapeHTML(ref.source)}</p>` : ''}
      `;

      card.addEventListener('click', () => openDetailModal(ref));
      referencesContainer.appendChild(card);
    });

    displayedCount.textContent = filteredReferences.length;
    totalCount.textContent = allReferences.length;
  }

  // --- 3. DYNAMIC SEARCH & SIDEBAR FILTERING ---
  function applyFilters() {
    filteredReferences = allReferences.filter(ref => {
      // 1. Search Query filter
      let matchesSearch = true;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        
        const titleMatch = ref.title && ref.title.toLowerCase().includes(query);
        const sourceMatch = ref.source && ref.source.toLowerCase().includes(query);
        const abstractMatch = ref.abstract && ref.abstract.toLowerCase().includes(query);
        const yearMatch = ref.year && ref.year.toString().includes(query);
        
        let authorMatch = false;
        if (ref.authors && ref.authors.length > 0) {
          authorMatch = ref.authors.some(a => 
            (a.first_name && a.first_name.toLowerCase().includes(query)) ||
            (a.last_name && a.last_name.toLowerCase().includes(query))
          );
        }

        matchesSearch = titleMatch || sourceMatch || abstractMatch || yearMatch || authorMatch;
      }

      // 2. Type Filter
      let matchesType = true;
      if (selectedType) {
        matchesType = ref.type === selectedType;
      }

      // 3. Year Filter
      let matchesYear = true;
      if (selectedYear) {
        matchesYear = ref.year === selectedYear;
      }

      return matchesSearch && matchesType && matchesYear;
    });

    renderReferencesList();
  }

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    applyFilters();
  });

  // --- 4. SIDEBAR FILTER METRICS GENERATION ---
  function populateFilters(references) {
    // Generate document type counts
    const typeCounts = {};
    const yearCounts = {};
    
    references.forEach(ref => {
      if (ref.type) {
        typeCounts[ref.type] = (typeCounts[ref.type] || 0) + 1;
      }
      if (ref.year) {
        yearCounts[ref.year] = (yearCounts[ref.year] || 0) + 1;
      }
    });

    // Populate Types Sidebar
    filterTypesContainer.innerHTML = '';
    const sortedTypes = Object.keys(typeCounts).sort();
    
    if (sortedTypes.length > 0) {
      sortedTypes.forEach(type => {
        const item = document.createElement('div');
        item.className = `filter-item ${selectedType === type ? 'active' : ''}`;
        item.innerHTML = `
          <span>${type}</span>
          <span class="filter-count">${typeCounts[type]}</span>
        `;
        item.addEventListener('click', () => {
          if (selectedType === type) {
            selectedType = null;
          } else {
            selectedType = type;
          }
          populateFilters(references); // Refresh selected highlights
          applyFilters();
        });
        filterTypesContainer.appendChild(item);
      });
    } else {
      filterTypesContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No categories.</div>`;
    }

    // Populate Years Sidebar
    filterYearsContainer.innerHTML = '';
    const sortedYears = Object.keys(yearCounts).sort((a, b) => b - a); // Descending years
    
    if (sortedYears.length > 0) {
      sortedYears.forEach(yearStr => {
        const year = parseInt(yearStr, 10);
        const item = document.createElement('div');
        item.className = `filter-item ${selectedYear === year ? 'active' : ''}`;
        item.innerHTML = `
          <span>${year}</span>
          <span class="filter-count">${yearCounts[yearStr]}</span>
        `;
        item.addEventListener('click', () => {
          if (selectedYear === year) {
            selectedYear = null;
          } else {
            selectedYear = year;
          }
          populateFilters(references); // Refresh selected highlights
          applyFilters();
        });
        filterYearsContainer.appendChild(item);
      });
    } else {
      filterYearsContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No dates.</div>`;
    }
  }

  // --- 5. METRICS GRID GENERATION ---
  function populateStats(references) {
    statTotalRef.textContent = references.length;
    
    const journalCount = references.filter(r => (r.type || '').toLowerCase() === 'journal').length;
    statJournals.textContent = journalCount;

    const years = references.map(r => r.year).filter(Boolean);
    if (years.length > 0) {
      statRecentYear.textContent = Math.max(...years);
    } else {
      statRecentYear.textContent = 'N/A';
    }
  }

  // --- 6. MOBILE SYNC PAIRING ---
  function populateIPAddresses(ips, port) {
    ipAddressList.innerHTML = '';
    modalIpsContainer.innerHTML = '';

    if (!ips || ips.length === 0) {
      const empty = `<div class="ip-item"><span>No network IP found. Connect your machine to Wi-Fi.</span></div>`;
      ipAddressList.innerHTML = empty;
      modalIpsContainer.innerHTML = empty;
      return;
    }

    ips.forEach(ip => {
      const url = `http://${ip.address}:${port}`;
      
      // For sidebar
      const item = document.createElement('div');
      item.className = 'ip-item';
      item.innerHTML = `
        <span>${ip.interface}</span>
        <span>${url}</span>
      `;
      ipAddressList.appendChild(item);

      // For Modal
      const modalItem = document.createElement('div');
      modalItem.className = 'ip-item';
      modalItem.style.background = 'rgba(255, 255, 255, 0.03)';
      modalItem.style.border = '1px solid var(--card-border)';
      modalItem.style.cursor = 'pointer';
      modalItem.innerHTML = `
        <span style="color: var(--text-bright); font-weight: 500;">${ip.interface}</span>
        <span style="font-weight: 600; color: var(--primary); font-family: monospace;">${url}</span>
      `;
      modalItem.addEventListener('click', () => {
        navigator.clipboard.writeText(url);
        alert(`Copied server URL to clipboard: ${url}`);
      });
      modalIpsContainer.appendChild(modalItem);
    });
  }

  // --- 7. DETAILS DRAWER MODAL ---
  function openDetailModal(ref) {
    const badgeClass = `badge-${(ref.type || 'generic').toLowerCase()}`;
    modalDocType.className = `badge ${badgeClass}`;
    modalDocType.textContent = ref.type || 'generic';
    
    modalDocTitle.textContent = ref.title || 'Untitled Reference';
    
    // Formatting Authors
    let authorsStr = 'No Authors Listed';
    if (ref.authors && ref.authors.length > 0) {
      authorsStr = ref.authors.map(a => `${a.first_name || ''} ${a.last_name || ''}`.trim()).join(', ');
    }
    modalDocAuthors.textContent = authorsStr;
    
    modalDocSource.textContent = ref.source || 'No publisher/source specified';
    modalDocYear.textContent = ref.year || 'N/A';
    modalDocDoi.textContent = ref.doi || 'No DOI assigned';
    modalDocAbstract.textContent = ref.abstract || 'No abstract is available for this reference document.';

    // Tags rendering
    let mendeleyData = {};
    try {
      mendeleyData = ref.raw_json ? JSON.parse(ref.raw_json) : {};
    } catch(e) {}

    const tags = mendeleyData.tags || [];
    if (tags.length > 0) {
      modalTagsSection.style.display = 'block';
      modalDocTags.innerHTML = '';
      tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        modalDocTags.appendChild(span);
      });
    } else {
      modalTagsSection.style.display = 'none';
    }

    // Raw JSON presentation
    modalDocRaw.textContent = JSON.stringify(mendeleyData, null, 2);

    // Open Modal
    detailModal.classList.add('active');
    detailModal.setAttribute('aria-hidden', 'false');
  }

  function closeDetailModal() {
    detailModal.classList.remove('active');
    detailModal.setAttribute('aria-hidden', 'true');
  }

  modalClose.addEventListener('click', closeDetailModal);
  
  // Close modals on clicking backdrop
  window.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
    if (e.target === syncModal) closeSyncModal();
  });

  // --- 8. SYNC GUIDE MODAL ---
  function openSyncModal() {
    syncModal.classList.add('active');
    syncModal.setAttribute('aria-hidden', 'false');
  }

  function closeSyncModal() {
    syncModal.classList.remove('active');
    syncModal.setAttribute('aria-hidden', 'true');
  }

  btnPhoneSync.addEventListener('click', openSyncModal);
  syncModalClose.addEventListener('click', closeSyncModal);
  syncModalOk.addEventListener('click', closeSyncModal);

  // --- 9. WIPE DATABASE CORE ACTION ---
  btnClearDb.addEventListener('click', async () => {
    const confirmWipe = confirm('⚠️ WARNING:\nAre you sure you want to permanently clear the local database? This will delete all saved references inside SQLite.');
    if (!confirmWipe) return;

    try {
      const res = await fetch('/api/references', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('Database cleared successfully.');
        loadDashboardData();
      } else {
        alert('Failed to clear database: ' + data.error);
      }
    } catch (err) {
      alert('Network error trying to wipe database: ' + err.message);
    }
  });

  // --- 10. SYSTEM VISUAL FEEDBACK STATES ---
  function showLoadingState() {
    referencesContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Accessing local SQLite repository...</p>
      </div>
    `;
  }

  function showErrorState(msg) {
    referencesContainer.innerHTML = `
      <div class="empty-state" style="border-color: rgba(239, 68, 68, 0.2);">
        <div class="empty-state-icon" style="filter: hue-rotate(280deg);">⚠️</div>
        <h3>Repository Error</h3>
        <p>${msg}</p>
        <button id="btn-retry-load" class="btn btn-secondary" style="margin-top: 10px;">Retry Loading</button>
      </div>
    `;
    const retryBtn = document.getElementById('btn-retry-load');
    if (retryBtn) {
      retryBtn.addEventListener('click', loadDashboardData);
    }
  }

  // Helper escape HTML
  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // Load everything on launch
  loadDashboardData();
});
