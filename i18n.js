// Language strings for CopyTabs extension
const i18n = {
    ja: {
        // Button texts
        copyThisTab: "Copy Title & URL",
        copyAllTabs: "Copy Title & URL",
        markThisTab: "Mark",
        markAllTabs: "Mark",
        viewAllTabs: "すべてのタブ",
        pageTitle: "マークされたタブ一覧",
        settingsLink: "設定を開く",
        deleteButton: "削除",
        
        // Settings page
        settingsTitle: "CopyTabs 設定 / CopyTabs Settings",
        languageLabel: "言語 / Language:",
        languageAuto: "自動 (ブラウザに基づく) / Auto (Based on browser)",
        languageJapanese: "日本語 / Japanese",
        languageEnglish: "英語 / English",
        saveButton: "保存 / Save",
        settingsSaved: "設定を保存しました！ / Settings saved successfully!",
        
        // Success messages
        copied: "コピーしました！",
        marked: "マークしました！",
        markedTabs: "個のタブをマークしました！",
        
        // Error messages
        error: "エラーが発生しました",
        quotaExceeded: "ストレージ容量制限に達しました。古いタブを削除してください。",
        dataTooLarge: "保存データが大きすぎます。古いタブを削除してください。",
        exception: "例外が発生しました",
        
        // Other messages
        noTabs: "タブが見つかりません",
        noNewTabs: "新しいタブはありません",
        noMarkedTabs: "マークされたタブはありません",
        alreadyMarked: "すでにマークされています",
        markDateTime: "マーク日時"
    },
    en: {
        // Button texts
        copyThisTab: "Copy Title & URL",
        copyAllTabs: "Copy Title & URL",
        markThisTab: "Mark",
        markAllTabs: "Mark",
        viewAllTabs: "All Tabs",
        pageTitle: "Marked Tabs List",
        settingsLink: "Open Settings",
        deleteButton: "Delete",
        
        // Settings page
        settingsTitle: "CopyTabs Settings",
        languageLabel: "Language:",
        languageAuto: "Auto (Based on browser)",
        languageJapanese: "Japanese",
        languageEnglish: "English",
        saveButton: "Save",
        settingsSaved: "Settings saved successfully!",
        
        // Success messages
        copied: "Copied!",
        marked: "Marked!",
        markedTabs: " tabs marked!",
        
        // Error messages
        error: "An error occurred",
        quotaExceeded: "Storage quota exceeded. Please delete old tabs.",
        dataTooLarge: "Storage data is too large. Please delete old tabs.",
        exception: "An exception occurred",
        
        // Other messages
        noTabs: "No tabs found",
        noNewTabs: "No new tabs",
        noMarkedTabs: "No marked tabs",
        alreadyMarked: "Already marked",
        markDateTime: "Mark Date/Time"
    },
    
    // Add getString method to i18n object
    getString: function(key) {
        const lang = getUserLanguage();
        if (this[lang] && this[lang][key]) {
            return this[lang][key];
        }
        // Fallback to English if key not found in current language
        if (this.en && this.en[key]) {
            return this.en[key];
        }
        // Return the key itself if not found in any language
        return key;
    },
    
    // Add setLanguage and resetLanguage methods to i18n object
    setLanguage: function(lang) {
        currentLanguage = lang;
    },
    
    resetLanguage: function() {
        currentLanguage = null;
    }
};

// Current language
let currentLanguage = null;

// Get the user's preferred language
function getUserLanguage() {
    // If language is explicitly set, use that
    if (currentLanguage && currentLanguage !== 'auto') {
        return currentLanguage;
    }
    
    // Otherwise use browser language
    return navigator.language.startsWith('ja') ? 'ja' : 'en';
}

// Load language setting from storage
function loadLanguageSetting() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['language'], function(result) {
            if (result.language) {
                currentLanguage = result.language;
            } else {
                // If no language is set, use browser language
                currentLanguage = navigator.language.startsWith('ja') ? 'ja' : 'en';
            }
            resolve();
        });
    });
}

// Initialize by loading language setting
loadLanguageSetting().then(() => {
    // Language setting is now loaded
    console.log('Language setting initialized:', currentLanguage);
});

// Export the functions
window.i18n = i18n; 