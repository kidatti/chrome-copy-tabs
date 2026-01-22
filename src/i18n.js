// Language strings for CopyTabs extension
const i18n = {
    ja: {
        // Button texts
        copyThisTab: "このタブ",
        copyAllTabs: "すべてのタブ",
        markThisTab: "タブを保存",
        markAllTabs: "すべてのタブを保存",
        viewAllTabs: "すべてのタブ",
        pageTitle: "マークされたタブ一覧",
        settingsLink: "設定を開く",
        deleteButton: "削除",

        // Section titles
        saveThisTabSection: "タブを保存",
        copyTitleUrl: "タイトル & URLをコピー",
        exportTabContent: "タブの内容をエクスポート",
        
        // Settings page
        settingsTitle: "CopyTabs 設定",
        languageSettings: "言語設定",
        languageLabel: "言語:",
        languageAuto: "自動 (ブラウザに従う)",
        languageJapanese: "日本語",
        languageEnglish: "English",
        saveButton: "保存",
        settingsSaved: "設定を保存しました！",
        dataManagement: "データ管理",
        dataManagementDescription: "拡張機能のデータをバックアップ、復元、削除できます。",
        exportData: "データエクスポート",
        exportDescription: "すべてのデータをJSONバックアップファイルとしてダウンロードします。",
        exportJson: "JSONエクスポート",
        importData: "データインポート",
        importDescription: "以前にエクスポートしたJSONファイルからデータを復元します。",
        importJson: "JSONインポート",
        clearAllData: "全データ削除",
        storageContents: "ストレージ内容",
        storageDescription: "デバッグ用に保存されているすべてのデータをJSON形式で表示します。",
        refreshButton: "更新",
        exportSuccess: "データのエクスポートが完了しました！",
        importSuccess: "データのインポートが完了しました！",
        clearSuccess: "すべてのデータが削除されました！",
        selectFile: "インポートするファイルを選択してください。",
        confirmImport: "現在のデータがすべて置き換えられます。よろしいですか？",
        confirmClear: "すべてのデータが完全に削除されます。よろしいですか？",
        importError: "インポートに失敗しました",
        clearError: "データの削除に失敗しました",
        invalidFile: "無効なJSONファイル形式です。",
        
        // Success messages
        copied: "コピーしました！",
        marked: "保存しました！",
        markedTabs: "個のタブを保存しました！",
        
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
        addFolderTitle: "新しいフォルダ",
        folderLabel: "フォルダ名:",
        folderNamePlaceholder: "フォルダ名を入力",
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
        newFolderNamePlaceholder: "新しいフォルダ名を入力",
        deleteFolderTitle: "フォルダ削除",
        deleteFolderMessage: "このフォルダを削除しますか？",
        deleteFolderWarning: "フォルダ内のタブは未分類に移動されます。",

        // Copy buttons
        copyUrls: "URLをコピー",
        copyTitlesUrls: "タイトル & URLをコピー",
        copyButton: "コピー",

        // Edit tab
        editTab: "編集",
        editTabModalTitle: "タブ編集",
        editTabTitleLabel: "タイトル:",
        editTabUrlLabel: "URL:",

        // Placeholders
        enterTabTitle: "タイトルを入力",
        enterTabUrl: "URLを入力"
    },
    en: {
        // Button texts
        copyThisTab: "This Tab",
        copyAllTabs: "All Tabs",
        markThisTab: "Save This Tab",
        markAllTabs: "Save All Tabs",
        viewAllTabs: "All Tabs",
        pageTitle: "Marked Tabs List",
        settingsLink: "Open Settings",
        deleteButton: "Delete",

        // Section titles
        saveThisTabSection: "Save This Tab",
        copyTitleUrl: "Copy Title & URL",
        exportTabContent: "Export Tab Content",
        
        // Settings page
        settingsTitle: "CopyTabs Settings",
        languageSettings: "Language Settings",
        languageLabel: "Language:",
        languageAuto: "Auto (Based on browser)",
        languageJapanese: "日本語",
        languageEnglish: "English",
        saveButton: "Save",
        settingsSaved: "Settings saved successfully!",
        dataManagement: "Data Management",
        dataManagementDescription: "Backup, restore, or clear your extension data.",
        exportData: "Export Data",
        exportDescription: "Download all your data as a JSON backup file.",
        exportJson: "Export JSON",
        importData: "Import Data",
        importDescription: "Restore your data from a previously exported JSON file.",
        importJson: "Import JSON",
        clearAllData: "Clear All Data",
        storageContents: "Storage Contents",
        storageDescription: "View all stored data in JSON format for debugging purposes.",
        refreshButton: "Refresh",
        exportSuccess: "Data exported successfully!",
        importSuccess: "Data imported successfully!",
        clearSuccess: "All data cleared successfully!",
        selectFile: "Please select a file to import.",
        confirmImport: "This will replace all current data. Are you sure?",
        confirmClear: "This will permanently delete all your data. Are you sure?",
        importError: "Import failed",
        clearError: "Failed to clear data",
        invalidFile: "Invalid JSON file format.",
        
        // Success messages
        copied: "Copied!",
        marked: "Saved!",
        markedTabs: " tabs saved!",
        
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
        addFolderTitle: "New Folder",
        folderLabel: "Folder name:",
        folderNamePlaceholder: "Enter folder name",
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
        newFolderNamePlaceholder: "Enter new folder name",
        deleteFolderTitle: "Delete Folder",
        deleteFolderMessage: "Delete this folder?",
        deleteFolderWarning: "Tabs in this folder will be moved to uncategorized.",

        // Copy buttons
        copyUrls: "Copy URLs",
        copyTitlesUrls: "Copy Titles & URLs",
        copyButton: "Copy",

        // Edit tab
        editTab: "Edit",
        editTabModalTitle: "Edit Tab",
        editTabTitleLabel: "Title:",
        editTabUrlLabel: "URL:",

        // Placeholders
        enterTabTitle: "Enter title",
        enterTabUrl: "Enter URL"
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
            }
            // If no language is set, keep 'auto' (default value)
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