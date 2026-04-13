// Settings page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings
    loadSettings();

    // Add event listener for save button
    document.getElementById('save-button').addEventListener('click', saveSettings);

    // Add event listener for refresh storage button
    document.getElementById('refresh-storage-button').addEventListener('click', displayStorageContents);

    // Add event listener for all tabs icon
    document.getElementById('allTabsIcon').addEventListener('click', openAllTabsPage);

    // Add event listeners for data management - ensure no duplicates
    const exportButton = document.getElementById('export-button');
    exportButton.removeEventListener('click', exportData);
    exportButton.addEventListener('click', exportData);

    const importButton = document.getElementById('import-button');
    importButton.removeEventListener('click', showImportModal);
    importButton.addEventListener('click', showImportModal);

    const clearButton = document.getElementById('clear-data-button');
    clearButton.removeEventListener('click', showClearDataModal);
    clearButton.addEventListener('click', showClearDataModal);

    // Add modal event listeners
    initializeModals();

    // Update UI with current language
    updateLanguageUI();

    // Display storage contents when page loads
    displayStorageContents();

    // Display storage usage
    displayStorageUsage();
});

// Load saved settings from storage
async function loadSettings() {
    const result = await chrome.storage.sync.get(['language']);
    const languageSelect = document.getElementById('language-select');

    if (result.language) {
        languageSelect.value = result.language;
    } else {
        languageSelect.value = 'en';
    }
}

// Save settings to storage
async function saveSettings() {
    const languageSelect = document.getElementById('language-select');
    const selectedLanguage = languageSelect.value;

    await chrome.storage.sync.set({ language: selectedLanguage });

    // Set the language directly before showing message
    if (selectedLanguage !== 'auto') {
        i18n.setLanguage(selectedLanguage);
    } else {
        i18n.setLanguage('auto');
    }

    // Update the UI language
    updateLanguageUI();

    // Then show success message with correct language
    showStatus(i18n.getString('settingsSaved'), 'success');

    // Refresh the storage display
    displayStorageContents();
    displayStorageUsage();
}

// Show status message
function showStatus(message, type, targetId = 'language-status') {
    const statusElement = document.getElementById(targetId);
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
    statusElement.style.display = 'block';

    // Hide the message after 3 seconds
    setTimeout(function() {
        statusElement.style.display = 'none';
    }, 3000);
}

// Update UI language based on selected language
async function updateLanguageUI() {
    const result = await chrome.storage.sync.get(['language']);
    const language = result.language || 'en';

    // Set the language for i18n
    if (language !== 'auto') {
        i18n.setLanguage(language);
    } else {
        i18n.setLanguage('auto');
    }

    // Wait a bit for i18n to initialize, then update UI
    setTimeout(() => {
        // Update UI elements
        document.getElementById('settings-title').textContent = i18n.getString('settingsTitle') || 'CopyTabs Settings';

        // Language section
        const languageSettingsText = i18n.getString('languageSettings') || 'Language Settings';
        document.getElementById('language-section-title').innerHTML = '<img src="images/language.svg" alt="">' + languageSettingsText;
        document.getElementById('auto-option').textContent = i18n.getString('languageAuto');
        document.getElementById('ja-option').textContent = i18n.getString('languageJapanese');
        document.getElementById('en-option').textContent = i18n.getString('languageEnglish');
        document.getElementById('save-button').innerHTML = '<img src="images/save_white.svg" alt="">' + i18n.getString('saveButton');

        // Data management section
        document.getElementById('data-management-title').innerHTML = '<img src="images/folder_open.svg" alt="">' + (i18n.getString('dataManagement') || 'Data Management');
        document.getElementById('export-label').innerHTML = '<img src="images/upload.svg" alt="" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 6px;">' + (i18n.getString('exportData') || 'Export Data:');
        document.getElementById('export-description').textContent = i18n.getString('exportDescription') || 'Download all your data as a JSON backup file.';
        document.getElementById('export-button').innerHTML = '<img src="images/download_white.svg" alt="">' + (i18n.getString('exportJson') || 'Export JSON');
        document.getElementById('import-label').innerHTML = '<img src="images/download.svg" alt="" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 6px;">' + (i18n.getString('importData') || 'Import Data:');
        document.getElementById('import-button').innerHTML = '<img src="images/upload_white.svg" alt="">' + (i18n.getString('importJson') || 'Import JSON');
        document.getElementById('clear-data-button').innerHTML = '<img src="images/delete_white.svg" alt="">' + (i18n.getString('clearAllData') || 'Clear All Data');

        // Storage section
        document.getElementById('storage-contents-title').innerHTML = '<img src="images/search.svg" alt="">' + i18n.getString('storageContents');
        document.getElementById('refresh-storage-button').innerHTML = '<img src="images/refresh_white.svg" alt="">' + i18n.getString('refreshButton');

        // Storage usage section
        const storageUsageTitle = document.getElementById('storage-usage-title');
        if (storageUsageTitle) {
            storageUsageTitle.innerHTML = '<img src="images/storage.svg" alt="">' + (i18n.getString('storageUsage') || 'Storage Usage');
        }

        // Update modal texts
        updateModalTexts();
    }, 100);
}

// Initialize modal functionality
function initializeModals() {
    const overlay = document.getElementById('modal-overlay');

    // Close modal when clicking overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeAllModals();
        }
    });

    // Modal button event listeners
    document.getElementById('clear-data-cancel').addEventListener('click', closeAllModals);
    document.getElementById('clear-data-confirm').addEventListener('click', confirmClearData);
    document.getElementById('import-data-cancel').addEventListener('click', closeAllModals);
    document.getElementById('import-data-confirm').addEventListener('click', confirmImportData);

    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// Modal control functions
function showModal(modalId) {
    console.log('showModal called with modalId:', modalId);
    // First close any open modals
    closeAllModals();
    // Then show the requested modal
    document.getElementById('modal-overlay').classList.add('show');
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        console.log('Modal shown:', modalId);
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeAllModals() {
    console.log('closeAllModals called');
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
        console.log('Removed show class from modal:', modal.id);
    });
}

function showClearDataModal() {
    console.log('showClearDataModal called');
    showModal('clear-data-modal');
}

function showImportModal() {
    console.log('showImportModal called');
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];

    if (!file) {
        showStatus(i18n.getString('selectFile') || 'Please select a file to import.', 'error', 'data-status');
        return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        showStatus(i18n.getString('fileTooLarge') || 'File is too large. Maximum size is 5MB.', 'error', 'data-status');
        return;
    }

    showModal('import-data-modal');
}

function confirmClearData() {
    closeAllModals();
    performClearData();
}

function confirmImportData() {
    closeAllModals();
    performImportData();
}

// Update modal texts with current language
function updateModalTexts() {
    document.getElementById('clear-data-title').innerHTML = '<img src="images/delete.svg" alt="">' + (i18n.getString('clearAllData') || 'Clear All Data');
    document.getElementById('clear-data-message').textContent = i18n.getString('confirmClear') || 'This will permanently delete all your data. Are you sure?';
    document.getElementById('clear-data-cancel').textContent = i18n.getString('cancel') || 'Cancel';
    document.getElementById('clear-data-confirm').textContent = i18n.getString('delete') || 'Delete All';

    document.getElementById('import-data-title').innerHTML = '<img src="images/download.svg" alt="">' + (i18n.getString('importData') || 'Import Data');
    document.getElementById('import-data-message').textContent = i18n.getString('confirmImport') || 'This will replace all current data. Are you sure?';
    document.getElementById('import-data-cancel').textContent = i18n.getString('cancel') || 'Cancel';
    document.getElementById('import-data-confirm').textContent = i18n.getString('importJson') || 'Import';
}

// Open all tabs page
async function openAllTabsPage() {
    const tabs = await chrome.tabs.query({url: chrome.runtime.getURL('all_tabs.html')});
    if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, {active: true});
        await chrome.windows.update(tabs[0].windowId, {focused: true});
    } else {
        await chrome.tabs.create({ url: 'all_tabs.html' });
    }
}

// Display all storage contents in JSON format
async function displayStorageContents() {
    const storageJsonElement = document.getElementById('storage-json');
    storageJsonElement.textContent = 'Loading...';

    const items = await chrome.storage.sync.get(null);
    const jsonString = JSON.stringify(items, null, 2);
    storageJsonElement.textContent = jsonString;
}

// Display storage usage with progress bar
async function displayStorageUsage() {
    const bytesInUse = await chrome.storage.sync.getBytesInUse(null);
    const quotaBytes = chrome.storage.sync.QUOTA_BYTES || 102400;
    const percentage = Math.round((bytesInUse / quotaBytes) * 100);

    const progressBar = document.getElementById('storage-progress-bar');
    const usageText = document.getElementById('storage-usage-text');

    if (!progressBar || !usageText) return;

    progressBar.style.width = Math.min(percentage, 100) + '%';
    usageText.textContent = `${bytesInUse.toLocaleString()} / ${quotaBytes.toLocaleString()} bytes (${percentage}%)`;

    // Color coding
    progressBar.classList.remove('warning', 'danger');
    if (percentage >= 90) {
        progressBar.classList.add('danger');
    } else if (percentage >= 80) {
        progressBar.classList.add('warning');
    }
}

// Export all data as JSON file
async function exportData() {
    const items = await chrome.storage.sync.get(null);

    const exportPayload = {
        exportDate: new Date().toISOString(),
        version: chrome.runtime.getManifest().version,
        data: items
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `copytabs-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showStatus(i18n.getString('exportSuccess') || 'Data exported successfully!', 'success', 'data-status');
}

// Perform import data (called from modal)
function performImportData() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importData = JSON.parse(e.target.result);

            let dataToImport;
            if (importData.data && importData.exportDate) {
                dataToImport = importData.data;
            } else {
                dataToImport = importData;
            }

            await chrome.storage.sync.clear();
            await chrome.storage.sync.set(dataToImport);

            if (chrome.runtime.lastError) {
                showStatus(i18n.getString('importError') || 'Import failed: ' + chrome.runtime.lastError.message, 'error', 'data-status');
            } else {
                showStatus(i18n.getString('importSuccess') || 'Data imported successfully!', 'success', 'data-status');
                displayStorageContents();
                displayStorageUsage();
                loadSettings();
            }
        } catch (error) {
            showStatus(i18n.getString('invalidFile') || 'Invalid JSON file format.', 'error', 'data-status');
        }
    };

    reader.readAsText(file);
}

// Perform clear all data (called from modal)
async function performClearData() {
    await chrome.storage.sync.clear();

    if (chrome.runtime.lastError) {
        showStatus(i18n.getString('clearError') || 'Failed to clear data: ' + chrome.runtime.lastError.message, 'error', 'data-status');
    } else {
        showStatus(i18n.getString('clearSuccess') || 'All data cleared successfully!', 'success', 'data-status');
        displayStorageContents();
        displayStorageUsage();
        loadSettings();
    }
}
