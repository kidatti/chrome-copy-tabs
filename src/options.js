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
});

// Load saved settings from storage
function loadSettings() {
    chrome.storage.sync.get(['language'], function(result) {
        const languageSelect = document.getElementById('language-select');
        
        if (result.language) {
            languageSelect.value = result.language;
        } else {
            // Default to auto if no language setting is saved
            languageSelect.value = 'auto';
        }
    });
}

// Save settings to storage
function saveSettings() {
    const languageSelect = document.getElementById('language-select');
    const selectedLanguage = languageSelect.value;
    
    chrome.storage.sync.set({
        language: selectedLanguage
    }, function() {
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
    });
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
function updateLanguageUI() {
    chrome.storage.sync.get(['language'], function(result) {
        const language = result.language || 'auto';
        
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
            document.getElementById('language-section-title').textContent = '🌐 ' + languageSettingsText;
            document.getElementById('auto-option').textContent = i18n.getString('languageAuto');
            document.getElementById('ja-option').textContent = i18n.getString('languageJapanese');
            document.getElementById('en-option').textContent = i18n.getString('languageEnglish');
            document.getElementById('save-button').textContent = '💾 ' + i18n.getString('saveButton');
            
            // Data management section
            document.getElementById('data-management-title').textContent = '📁 ' + (i18n.getString('dataManagement') || 'Data Management');
            document.getElementById('export-label').textContent = '📤 ' + (i18n.getString('exportData') || 'Export Data:');
            document.getElementById('export-description').textContent = i18n.getString('exportDescription') || 'Download all your data as a JSON backup file.';
            document.getElementById('export-button').textContent = '📥 ' + (i18n.getString('exportJson') || 'Export JSON');
            document.getElementById('import-label').textContent = '📥 ' + (i18n.getString('importData') || 'Import Data:');
            document.getElementById('import-button').textContent = '📤 ' + (i18n.getString('importJson') || 'Import JSON');
            document.getElementById('clear-data-button').textContent = '🗑️ ' + (i18n.getString('clearAllData') || 'Clear All Data');
            
            // Storage section
            document.getElementById('storage-contents-title').textContent = '🔍 ' + i18n.getString('storageContents');
            document.getElementById('refresh-storage-button').textContent = '🔄 ' + i18n.getString('refreshButton');
            
            // Update modal texts
            updateModalTexts();
        }, 100);
    });
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
    document.getElementById('clear-data-title').textContent = '🗑️ ' + (i18n.getString('clearAllData') || 'Clear All Data');
    document.getElementById('clear-data-message').textContent = i18n.getString('confirmClear') || 'This will permanently delete all your data. Are you sure?';
    document.getElementById('clear-data-cancel').textContent = i18n.getString('cancel') || 'Cancel';
    document.getElementById('clear-data-confirm').textContent = i18n.getString('delete') || 'Delete All';
    
    document.getElementById('import-data-title').textContent = '📥 ' + (i18n.getString('importData') || 'Import Data');
    document.getElementById('import-data-message').textContent = i18n.getString('confirmImport') || 'This will replace all current data. Are you sure?';
    document.getElementById('import-data-cancel').textContent = i18n.getString('cancel') || 'Cancel';
    document.getElementById('import-data-confirm').textContent = i18n.getString('importJson') || 'Import';
}

// Open all tabs page
function openAllTabsPage() {
    // Check if all_tabs.html is already open
    chrome.tabs.query({url: chrome.runtime.getURL('all_tabs.html')}, function(tabs) {
        if (tabs.length > 0) {
            // If tab exists, switch to it
            chrome.tabs.update(tabs[0].id, {active: true});
            chrome.windows.update(tabs[0].windowId, {focused: true});
        } else {
            // Create a new tab if it doesn't exist
            chrome.tabs.create({
                url: 'all_tabs.html'
            });
        }
    });
}

// Display all storage contents in JSON format
function displayStorageContents() {
    const storageJsonElement = document.getElementById('storage-json');
    storageJsonElement.textContent = 'Loading...';
    
    // Get all data from chrome.storage.sync
    chrome.storage.sync.get(null, function(items) {
        // Format the data as indented JSON
        const jsonString = JSON.stringify(items, null, 2);
        
        // Display the JSON in the storage-json div
        storageJsonElement.textContent = jsonString;
    });
}

// Export all data as JSON file
function exportData() {
    chrome.storage.sync.get(null, function(items) {
        // Add metadata to the export
        const exportData = {
            exportDate: new Date().toISOString(),
            version: chrome.runtime.getManifest().version,
            data: items
        };
        
        // Create JSON string
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create blob and download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `copytabs-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        showStatus(i18n.getString('exportSuccess') || 'Data exported successfully!', 'success', 'data-status');
    });
}

// Perform import data (called from modal)
function performImportData() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            
            // Check if it's a valid export format
            let dataToImport;
            if (importData.data && importData.exportDate) {
                // New format with metadata
                dataToImport = importData.data;
            } else {
                // Old format or direct data
                dataToImport = importData;
            }
            
            // Clear existing data first
            chrome.storage.sync.clear(function() {
                // Import new data
                chrome.storage.sync.set(dataToImport, function() {
                    if (chrome.runtime.lastError) {
                        showStatus(i18n.getString('importError') || 'Import failed: ' + chrome.runtime.lastError.message, 'error', 'data-status');
                    } else {
                        showStatus(i18n.getString('importSuccess') || 'Data imported successfully!', 'success', 'data-status');
                        displayStorageContents();
                        loadSettings(); // Reload settings
                    }
                });
            });
        } catch (error) {
            showStatus(i18n.getString('invalidFile') || 'Invalid JSON file format.', 'error', 'data-status');
        }
    };
    
    reader.readAsText(file);
}

// Perform clear all data (called from modal)
function performClearData() {
    chrome.storage.sync.clear(function() {
        if (chrome.runtime.lastError) {
            showStatus(i18n.getString('clearError') || 'Failed to clear data: ' + chrome.runtime.lastError.message, 'error', 'data-status');
        } else {
            showStatus(i18n.getString('clearSuccess') || 'All data cleared successfully!', 'success', 'data-status');
            displayStorageContents();
            loadSettings(); // Reset settings to default
        }
    });
} 