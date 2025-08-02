// Language strings for CopyTabs extension
const i18n = {
    ja: {
        // Button texts
        copyThisTab: "このタブ",
        copyAllTabs: "すべてのタブ",
        markThisTab: "このタブ",
        markAllTabs: "すべてのタブ",
        viewAllTabs: "すべてのタブ",
        pageTitle: "マークされたタブ一覧",
        settingsLink: "設定を開く",
        deleteButton: "削除",
        
        // Settings page
        settingsTitle: "CopyTabs 設定",
        languageLabel: "言語:",
        languageAuto: "Auto (Based on browser) / 自動 (ブラウザに基づく)",
        languageJapanese: "日本語",
        languageEnglish: "英語",
        saveButton: "保存",
        settingsSaved: "設定を保存しました！",
        storageContents: "ストレージ内容",
        refreshButton: "更新",
        
        // Success messages
        copied: "コピーしました！",
        marked: "マークしました！",
        markedTabs: "個のタブをマークしました！",
        
        // Error messages
        error: "エラーが発生しました",
        quotaExceeded: "ストレージ容量制限に達しました。古いタブを削除してください。",
        dataTooLarge: "保存データが大きすぎます。古いタブを削除してください。",
        exception: "例外が発生しました",
        failedToExtract: "コンテンツの抽出に失敗しました",
        
        // Other messages
        noTabs: "タブが見つかりません",
        noNewTabs: "新しいタブはありません",
        noMarkedTabs: "マークされたタブはありません",
        alreadyMarked: "すでにマークされています",
        markDateTime: "マーク日時",
        
        // Folder related
        folders: "フォルダ",
        uncategorized: "未分類",
        addFolder: "+ 新しいフォルダ",
        folderLabel: "フォルダ:",
        setDefault: "デフォルトに設定",
        defaultFolderSet: "デフォルトフォルダ設定済み",
        enterFolderName: "フォルダ名を入力してください:",
        enterNewFolderName: "新しいフォルダ名を入力してください:",
        deleteFolderConfirm: "このフォルダを削除しますか？フォルダ内のタブは未分類に移動されます。",
        noTabsInFolder: "このフォルダにはタブがありません",
        cancel: "キャンセル",
        create: "作成",
        change: "変更",
        delete: "削除",
        renameFolderTitle: "フォルダ名変更",
        newFolderNameLabel: "新しいフォルダ名:",
        deleteFolderTitle: "フォルダ削除",
        deleteFolderMessage: "このフォルダを削除しますか？",
        deleteFolderWarning: "フォルダ内のタブは未分類に移動されます。"
    },
    en: {
        // Button texts
        copyThisTab: "This Tab",
        copyAllTabs: "All Tabs",
        markThisTab: "This Tab",
        markAllTabs: "All Tabs",
        viewAllTabs: "All Tabs",
        pageTitle: "Marked Tabs List",
        settingsLink: "Open Settings",
        deleteButton: "Delete",
        
        // Settings page
        settingsTitle: "CopyTabs Settings",
        languageLabel: "Language:",
        languageAuto: "Auto (Based on browser) / 自動 (ブラウザに基づく)",
        languageJapanese: "Japanese",
        languageEnglish: "English",
        saveButton: "Save",
        settingsSaved: "Settings saved successfully!",
        storageContents: "Storage Contents",
        refreshButton: "Refresh",
        
        // Success messages
        copied: "Copied!",
        marked: "Marked!",
        markedTabs: " tabs marked!",
        
        // Error messages
        error: "An error occurred",
        quotaExceeded: "Storage quota exceeded. Please delete old tabs.",
        dataTooLarge: "Storage data is too large. Please delete old tabs.",
        exception: "An exception occurred",
        failedToExtract: "Failed to extract content",
        
        // Other messages
        noTabs: "No tabs found",
        noNewTabs: "No new tabs",
        noMarkedTabs: "No marked tabs",
        alreadyMarked: "Already marked",
        markDateTime: "Mark Date/Time",
        
        // Folder related
        folders: "Folders",
        uncategorized: "Uncategorized",
        addFolder: "+ New Folder",
        folderLabel: "Folder:",
        setDefault: "Set as Default",
        defaultFolderSet: "Default Folder Set",
        enterFolderName: "Enter folder name:",
        enterNewFolderName: "Enter new folder name:",
        deleteFolderConfirm: "Delete this folder? Tabs in this folder will be moved to uncategorized.",
        noTabsInFolder: "No tabs in this folder",
        cancel: "Cancel",
        create: "Create",
        change: "Change",
        delete: "Delete",
        renameFolderTitle: "Rename Folder",
        newFolderNameLabel: "New folder name:",
        deleteFolderTitle: "Delete Folder",
        deleteFolderMessage: "Delete this folder?",
        deleteFolderWarning: "Tabs in this folder will be moved to uncategorized."
    },
    
    // Add getString method to i18n object
    getString: function(key) {
        const lang = getUserLanguage();
        console.log('i18n.getString:', key, 'currentLanguage:', currentLanguage, 'resolved lang:', lang);
        if (this[lang] && this[lang][key]) {
            console.log('Found in', lang, ':', this[lang][key]);
            return this[lang][key];
        }
        // Fallback to English if key not found in current language
        if (this.en && this.en[key]) {
            console.log('Fallback to EN:', this.en[key]);
            return this.en[key];
        }
        // Return the key itself if not found in any language
        console.log('Key not found, returning key:', key);
        return key;
    },
    
    // Add setLanguage and resetLanguage methods to i18n object
    setLanguage: function(lang) {
        console.log('i18n.setLanguage called with:', lang, 'previous:', currentLanguage);
        currentLanguage = lang;
        console.log('currentLanguage set to:', currentLanguage);
    },
    
    resetLanguage: function() {
        currentLanguage = 'auto';
    }
};

// Current language
let currentLanguage = 'auto';

// Get the user's preferred language
function getUserLanguage() {
    // If language is explicitly set, use that
    if (currentLanguage && currentLanguage !== 'auto') {
        return currentLanguage;
    }
    
    // Otherwise use browser language
    const browserLang = navigator.language;
    const detectedLang = browserLang.startsWith('ja') ? 'ja' : 'en';
    console.log('Browser language:', browserLang, '-> Detected:', detectedLang);
    return detectedLang;
}

// Load language setting from storage
function loadLanguageSetting() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['language'], function(result) {
            if (result.language) {
                currentLanguage = result.language;
            } else {
                // If no language is set, default to auto
                currentLanguage = 'auto';
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