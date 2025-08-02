// Settings page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings
    loadSettings();
    
    // Add event listener for save button
    document.getElementById('save-button').addEventListener('click', saveSettings);
    
    // Add event listener for refresh storage button
    document.getElementById('refresh-storage-button').addEventListener('click', displayStorageContents);
    
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
        // Show success message
        showStatus(i18n.getString('settingsSaved'), 'success');
        
        // Update the UI language
        updateLanguageUI();
        
        // Refresh the storage display
        displayStorageContents();
    });
}

// Show status message
function showStatus(message, type) {
    const statusElement = document.getElementById('status');
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
            i18n.resetLanguage();
        }
        
        // Update UI elements
        document.getElementById('settings-title').textContent = i18n.getString('settingsTitle');
        document.getElementById('language-label').textContent = i18n.getString('languageLabel');
        document.getElementById('auto-option').textContent = i18n.getString('languageAuto');
        document.getElementById('ja-option').textContent = i18n.getString('languageJapanese');
        document.getElementById('en-option').textContent = i18n.getString('languageEnglish');
        document.getElementById('save-button').textContent = i18n.getString('saveButton');
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