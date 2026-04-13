// Function to update UI elements with current language
function updateUI() {
    // Update section titles
    document.getElementById('copy-section-title').textContent = i18n.getString('copyTitleUrl');
    document.getElementById('export-section-title').textContent = i18n.getString('exportTabContent');

    // Update button texts (simplified without icons)
    document.getElementById('copyCurrentTab').textContent = i18n.getString('copyThisTab');
    document.getElementById('copyAllTabs').textContent = i18n.getString('copyAllTabs');
    document.getElementById('markCurrentTab').textContent = i18n.getString('markThisTab');
    document.getElementById('markAllTabs').textContent = i18n.getString('markAllTabs');

    // Update other UI elements as needed
    const settingsLink = document.querySelector('.settings-link');
    if (settingsLink) {
        settingsLink.textContent = i18n.getString('settingsLink');
    }
}

document.addEventListener("DOMContentLoaded", async function(){
    // Show development badge if loaded from local files (not from Chrome Web Store)
    const manifestData = chrome.runtime.getManifest();
    // Chrome Web Store extensions have 'update_url', local extensions don't
    const isLocalDevelopment = !('update_url' in manifestData);
    if (isLocalDevelopment) {
        const devBadge = document.getElementById('devBadge');
        if (devBadge) {
            devBadge.style.display = 'block';
        }
    }

    // Load language setting first
    const langResult = await chrome.storage.sync.get(['language']);
    console.log('Contents.js language setting:', langResult.language);
    if (langResult.language) {
        i18n.setLanguage(langResult.language);
    } else {
        console.log('No language setting found, defaulting to English');
        i18n.setLanguage('en');
    }

    // Update UI with current language
    updateUI();

    // Then set up event listeners and update UI
    document.getElementById('copyCurrentTab').addEventListener('click', getActiveTab);
    document.getElementById('copyAllTabs').addEventListener('click', getAllTabs);
    document.getElementById('markCurrentTab').addEventListener('click', markCurrentTab);
    document.getElementById('markAllTabs').addEventListener('click', markAllTabs);
    document.getElementById('viewAllTabsIcon').addEventListener('click', openAllTabsWindow);
    document.getElementById('exportHtmlCurrentTab').addEventListener('click', exportHtmlCurrentTab);
    document.getElementById('exportHtmlArticleCurrentTab').addEventListener('click', exportHtmlArticleCurrentTab);
    document.getElementById('exportMarkdownCurrentTab').addEventListener('click', exportMarkdownCurrentTab);

    // Get current tab info
    const activeTabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (activeTabs[0]) {
        document.getElementById('title').textContent = activeTabs[0].title;
        document.getElementById('url').textContent = activeTabs[0].url;

        // Update current tab info display
        document.getElementById('current-tab-title').textContent = activeTabs[0].title;
        document.getElementById('current-tab-url').textContent = activeTabs[0].url;
    }

    // Button texts are now updated in updateUI() function

    count();
    loadMarkedTabs();

    // Update view all button
    updateViewAllButton();

    // Initialize settings icon
    initializeSettingsIcon();

    // Initialize folder UI texts
    initializeFolderUI();

    // Load folders for popup
    loadFoldersForPopup();
    loadDefaultFolder();

    // Add folder select event listener to save last selected folder
    document.getElementById('folder-select').addEventListener('change', saveLastSelectedFolder);
});

// Listen for storage changes to update language and folders
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync' && changes.language) {
        console.log('Popup: Language setting changed to:', changes.language.newValue);

        // Set the new language
        if (changes.language.newValue) {
            if (changes.language.newValue !== 'auto') {
                i18n.setLanguage(changes.language.newValue);
            } else {
                i18n.setLanguage('auto');
            }
        } else {
            i18n.setLanguage('en');
        }

        // Update UI with new language
        updateUI();
        // Reload other UI elements
        initializeFolderUI();
        loadFoldersForPopup();
        loadDefaultFolder();

        // Update settings icon tooltip
        const settingsIcon = document.getElementById('settingsIcon');
        if (settingsIcon) {
            settingsIcon.title = i18n.getString('settingsLink') || 'Settings';
        }

        // Reload marked tabs to update any displayed text
        loadMarkedTabs();
    }

    // Listen for folder changes and update folder select
    if (namespace === 'sync' && changes.folders) {
        loadFoldersForPopup();
    }
});

async function count() {
    const tabs = await chrome.tabs.query({});
    const total = tabs.length;
    document.getElementById('copyAllTabs').textContent = i18n.getString('copyAllTabs') + " (" + total + ")";
    document.getElementById('markAllTabs').textContent = i18n.getString('markAllTabs') + " (" + total + ")";
}

async function getActiveTab() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
        let text = tabs[0].title + "\n" + tabs[0].url;
        document.getElementById('input').value = text;
        copy();
        document.getElementById('copyCurrentTab').textContent = i18n.getString('copied');
        setTimeout(() => {
            document.getElementById('copyCurrentTab').textContent = i18n.getString('copyThisTab');
        }, 2000);
    }
    return tabs;
}

async function getAllTabs() {
    const tabs = await chrome.tabs.query({});
    let text = "";
    tabs.forEach(tab => {
        text += tab.title + "\n" + tab.url + "\n";
    });
    document.getElementById('input').value = text;
    copy();
    document.getElementById('copyAllTabs').textContent = i18n.getString('copied');
    setTimeout(() => {
        document.getElementById('copyAllTabs').textContent = i18n.getString('copyAllTabs') + " (" + tabs.length + ")";
    }, 2000);
}

function copy() {
    const copyText = document.querySelector("#input");
    copyText.select();
    document.execCommand("copy");
}

async function markCurrentTab() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length === 0) {
        document.getElementById('markCurrentTab').textContent = i18n.getString('noTabs');
        setTimeout(() => {
            document.getElementById('markCurrentTab').textContent = i18n.getString('markThisTab');
        }, 2000);
        return;
    }

    const currentUrl = tabs[0].url;

    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    if (dataKeys.length > 0) {
        const tabsData = await chrome.storage.sync.get(dataKeys);
        const allTabs = dataKeys.map(key => tabsData[key]).filter(tab => tab !== null && tab !== undefined);

        // Check if the URL is already in marked tabs
        const isDuplicate = allTabs.some(tab => tab && tab.url === currentUrl);

        if (isDuplicate) {
            document.getElementById('markCurrentTab').textContent = i18n.getString('alreadyMarked');
            setTimeout(() => {
                document.getElementById('markCurrentTab').textContent = i18n.getString('markThisTab');
            }, 2000);
            return;
        }
    }

    await addNewTab(tabs[0]);
}

// Helper function to add a new tab
async function addNewTab(chromeTab) {
    // Get selected folder from popup
    const selectedFolderId = document.getElementById('folder-select').value;
    const folderId = selectedFolderId === 'null' ? null : selectedFolderId;

    const tab = {
        id: Date.now(),
        title: chromeTab.title,
        url: chromeTab.url,
        timestamp: new Date().toISOString(),
        locked: false,
        folderId: folderId
    };

    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];
    // Generate a unique key that doesn't already exist
    let counter = dataKeys.length + 1;
    let newKey = `mark-${counter}`;
    while (dataKeys.includes(newKey)) {
        counter++;
        newKey = `mark-${counter}`;
    }
    const updatedKeys = [...dataKeys, newKey];

    // Create a storage update object
    const updateData = {
        dataKeys: updatedKeys,
        [newKey]: tab
    };

    await chrome.storage.sync.set(updateData);

    // Immediately update the tab list
    loadMarkedTabs();

    document.getElementById('markCurrentTab').textContent = i18n.getString('marked');
    setTimeout(() => {
        document.getElementById('markCurrentTab').textContent = i18n.getString('markThisTab');
    }, 2000);
}

// Function to clean up duplicate dataKeys
async function cleanupDuplicateDataKeys() {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    if (dataKeys.length === 0) return;

    // Remove duplicates from dataKeys
    const uniqueDataKeys = [...new Set(dataKeys)];

    if (uniqueDataKeys.length !== dataKeys.length) {
        console.log(`Found duplicate dataKeys. Cleaning up: ${dataKeys.length} -> ${uniqueDataKeys.length}`);
        await chrome.storage.sync.set({ dataKeys: uniqueDataKeys });
        console.log("DataKeys cleaned up successfully");
    }
}

// Function to migrate from old markedTabs format to new dataKeys format
async function migrateFromMarkedTabs() {
    const result = await chrome.storage.sync.get(['markedTabs']);
    if (!result.markedTabs) return;

    const markedTabs = result.markedTabs;
    const dataKeys = [];
    const storageData = {};

    // Create new format data
    markedTabs.forEach((tab, index) => {
        const keyName = `mark-${index + 1}`;
        dataKeys.push(keyName);
        storageData[keyName] = tab;
    });

    // Add dataKeys to storage data
    storageData.dataKeys = dataKeys;

    // Save new format data
    await chrome.storage.sync.set(storageData);
    console.log("Migration completed: converted markedTabs to dataKeys format");

    // Remove old markedTabs data
    await chrome.storage.sync.remove(['markedTabs']);
    console.log("Removed old markedTabs data");
}

// Modify existing loadMarkedTabs function to use new storage format
async function loadMarkedTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';

    // Check for and migrate old format if needed, then cleanup duplicates
    await migrateFromMarkedTabs();
    await cleanupDuplicateDataKeys();

    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    if (dataKeys.length === 0) {
        tabList.innerHTML = '<div class="no-tabs">' + i18n.getString('noMarkedTabs') + '</div>';
        updateViewAllButton();
        return;
    }

    // Get all tab data using the dataKeys
    const tabsData = await chrome.storage.sync.get(dataKeys);
    const allTabs = dataKeys.map(key => tabsData[key]).filter(tab => tab !== null && tab !== undefined);

    // Sort tabs by timestamp (newest first)
    allTabs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Display only the latest 5 tabs in the popup
    const tabsToShow = allTabs.slice(0, 5);

    tabsToShow.forEach(tab => {
        // Ensure locked property exists for backward compatibility
        if (tab.locked === undefined) {
            tab.locked = false;
        }

        const tabElement = document.createElement('div');
        tabElement.className = 'tab-item';

        const tabInfo = document.createElement('div');
        tabInfo.className = 'tab-info';
        tabInfo.setAttribute('data-url', tab.url);

        const tabTitle = document.createElement('div');
        tabTitle.className = 'tab-title';
        tabTitle.textContent = tab.title;

        const tabUrl = document.createElement('div');
        tabUrl.className = 'tab-url';
        tabUrl.textContent = tab.url;

        tabInfo.appendChild(tabTitle);
        tabInfo.appendChild(tabUrl);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('data-id', String(tab.id));
        if (tab.locked) deleteBtn.style.display = 'none';
        deleteBtn.textContent = i18n.getString('deleteButton');

        tabElement.appendChild(tabInfo);
        tabElement.appendChild(deleteBtn);

        // Add click event to open the tab
        tabInfo.addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            chrome.tabs.create({ url: url });
        });

        // Add cursor pointer style to tab info
        tabInfo.style.cursor = 'pointer';

        // Add click event to delete button
        deleteBtn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-id');
            deleteTab(tabId);
        });

        tabList.appendChild(tabElement);
    });

    updateViewAllButton();
}

async function deleteTab(tabId) {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    const tabsData = await chrome.storage.sync.get(dataKeys);
    const keyToRemove = dataKeys.find(key => tabsData[key] && String(tabsData[key].id) === String(tabId));

    if (!keyToRemove) return;

    const updatedDataKeys = dataKeys.filter(key => key !== keyToRemove);

    await chrome.storage.sync.remove([keyToRemove]);
    await chrome.storage.sync.set({ dataKeys: updatedDataKeys });
    loadMarkedTabs();
}

async function updateViewAllButton() {
    const tabCountElement = document.getElementById('tabCount');
    const viewAllContainer = document.getElementById('viewAllTabsIcon');

    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];
    const count = dataKeys.length;

    if (tabCountElement) {
        tabCountElement.textContent = count;
    }

    if (viewAllContainer) {
        if (count > 0) {
            viewAllContainer.title = `View All Tabs (${count})`;
            viewAllContainer.style.opacity = '1';
        } else {
            viewAllContainer.title = 'View All Tabs';
            viewAllContainer.style.opacity = '0.6';
        }
    }
}

// Initialize settings icon
async function initializeSettingsIcon() {
    const settingsIcon = document.getElementById('settingsIcon');
    if (settingsIcon) {
        const result = await chrome.storage.sync.get(['language']);
        if (result.language) {
            i18n.setLanguage(result.language);
        } else {
            i18n.setLanguage('auto');
        }
        settingsIcon.title = i18n.getString('settingsLink') || 'Settings';

        // Add click event to open options page
        settingsIcon.addEventListener('click', function() {
            chrome.runtime.openOptionsPage();
        });
    }
}

async function openAllTabsWindow() {
    const tabs = await chrome.tabs.query({url: chrome.runtime.getURL('all_tabs.html')});
    if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, {active: true});
        await chrome.windows.update(tabs[0].windowId, {focused: true});
    } else {
        await chrome.tabs.create({ url: 'all_tabs.html' });
    }
}

async function markAllTabs() {
    const tabs = await chrome.tabs.query({});
    if (tabs.length === 0) {
        document.getElementById('markAllTabs').textContent = i18n.getString('noTabs');
        setTimeout(() => {
            document.getElementById('markAllTabs').textContent = i18n.getString('markAllTabs') + " (" + tabs.length + ")";
        }, 2000);
        return;
    }

    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    let existingTabs = [];
    if (dataKeys.length > 0) {
        const tabsData = await chrome.storage.sync.get(dataKeys);
        existingTabs = dataKeys.map(key => tabsData[key]).filter(tab => tab !== null && tab !== undefined);
    }

    await processNewTabs(tabs, existingTabs);
}

// Helper function to process new tabs
async function processNewTabs(chromeTabs, existingTabs) {
    // Get selected folder from popup
    const selectedFolderId = document.getElementById('folder-select').value;
    const folderId = selectedFolderId === 'null' ? null : selectedFolderId;

    // Create a set of existing URLs for quick lookup
    const existingUrls = new Set(existingTabs.filter(tab => tab && tab.url).map(tab => tab.url));

    let newTabs = [];

    // Add all tabs to marked tabs, skipping duplicates
    chromeTabs.forEach(tab => {
        if (!existingUrls.has(tab.url)) {
            const tabData = {
                id: Date.now() + Math.random(), // Ensure unique ID
                title: tab.title,
                url: tab.url,
                timestamp: new Date().toISOString(),
                locked: false,
                folderId: folderId
            };
            newTabs.push(tabData);
            existingUrls.add(tab.url);
        }
    });

    const newTabsCount = newTabs.length;

    if (newTabsCount === 0) {
        document.getElementById('markAllTabs').textContent = i18n.getString('noNewTabs');
        setTimeout(async () => {
            const tabs = await chrome.tabs.query({});
            document.getElementById('markAllTabs').textContent = i18n.getString('markAllTabs') + " (" + tabs.length + ")";
        }, 2000);
        return;
    }

    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    // Create new keys and prepare update data
    const updateData = {
        dataKeys: [...dataKeys]
    };

    newTabs.forEach((tab, index) => {
        // Generate a unique key that doesn't already exist
        let counter = dataKeys.length + index + 1;
        let newKey = `mark-${counter}`;
        while (updateData.dataKeys.includes(newKey)) {
            counter++;
            newKey = `mark-${counter}`;
        }
        updateData.dataKeys.push(newKey);
        updateData[newKey] = tab;
    });

    // Check if we're approaching the storage limit
    const dataSize = JSON.stringify(updateData).length;

    if (dataSize > 90000) { // Chrome sync storage limit is around 100KB
        document.getElementById('markAllTabs').textContent = i18n.getString('quotaExceeded');
        setTimeout(async () => {
            const tabs = await chrome.tabs.query({});
            document.getElementById('markAllTabs').textContent = i18n.getString('markAllTabs') + " (" + tabs.length + ")";
        }, 2000);
        return;
    }

    try {
        await chrome.storage.sync.set(updateData);

        if (chrome.runtime.lastError) {
            console.error("Error saving to storage:", chrome.runtime.lastError);

            let errorMessage = i18n.getString('error');
            if (chrome.runtime.lastError.message.includes("QUOTA_BYTES_PER_ITEM")) {
                errorMessage = i18n.getString('dataTooLarge');
            } else if (chrome.runtime.lastError.message.includes("QUOTA_BYTES")) {
                errorMessage = i18n.getString('quotaExceeded');
            }

            document.getElementById('markAllTabs').textContent = errorMessage;
            setTimeout(async () => {
                const tabs = await chrome.tabs.query({});
                document.getElementById('markAllTabs').textContent = i18n.getString('markAllTabs') + " (" + tabs.length + ")";
            }, 3000);
            return;
        }

        // Immediately update the tab list
        loadMarkedTabs();

        document.getElementById('markAllTabs').textContent = newTabsCount + i18n.getString('markedTabs');
        setTimeout(async () => {
            const tabs = await chrome.tabs.query({});
            document.getElementById('markAllTabs').textContent = i18n.getString('markAllTabs') + " (" + tabs.length + ")";
        }, 2000);
    } catch (error) {
        console.error("Exception when saving to storage:", error);
        document.getElementById('markAllTabs').textContent = i18n.getString('exception');
        setTimeout(async () => {
            const tabs = await chrome.tabs.query({});
            document.getElementById('markAllTabs').textContent = i18n.getString('markAllTabs') + " (" + tabs.length + ")";
        }, 2000);
    }
}

function exportHtmlCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || !tabs[0]) {
            console.error("No active tab found");
            showMessage(i18n.getString('error'), 'error');
            return;
        }

        console.log("Executing script in tab:", tabs[0].id);

        // Execute the script directly
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            function: function() {
                try {
                    // Get the current page's HTML
                    return document.documentElement.outerHTML;
                } catch (error) {
                    console.error("Error getting HTML:", error);
                    return `ERROR: ${error.message}`;
                }
            }
        }, function(results) {
            if (chrome.runtime.lastError) {
                console.error("Error executing script:", chrome.runtime.lastError);
                showMessage(chrome.runtime.lastError.message || 'Script execution failed', 'error');
                return;
            }

            if (results && results[0] && results[0].result) {
                const result = results[0].result;
                if (typeof result === 'string' && result.startsWith('ERROR:')) {
                    console.error("Error getting HTML:", result);
                    showMessage(i18n.getString('error'), 'error');
                    return;
                }

                document.getElementById('input').value = result;
                copy();
                showMessage(i18n.getString('copied'), 'success');
            } else {
                console.error("No HTML content received");
                showMessage(i18n.getString('error'), 'error');
            }
        });
    });
}

function exportHtmlArticleCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) {
            showMessage(i18n.getString('noTabs'), 'error');
            return;
        }

        // First inject readability.js
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['readability.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error injecting readability.js:', chrome.runtime.lastError);
                showMessage(chrome.runtime.lastError.message || 'Failed to inject readability.js', 'error');
                return;
            }

            // Then execute the content extraction
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: extractArticleContent
            }, (results) => {
                if (chrome.runtime.lastError) {
                    console.error('Error executing script:', chrome.runtime.lastError);
                    showMessage(chrome.runtime.lastError.message || 'Script execution failed', 'error');
                    return;
                }

                if (results && results[0] && results[0].result) {
                    const articleContent = results[0].result;
                    if (articleContent === null) {
                        showMessage(i18n.getString('failedToExtract'), 'error');
                        return;
                    }
                    document.getElementById('input').value = articleContent;
                    copy();
                    showMessage(i18n.getString('copied'), 'success');
                } else {
                    console.error('No results from content extraction');
                    showMessage(i18n.getString('failedToExtract'), 'error');
                }
            });
        });
    });
}

function extractArticleContent() {
    try {
        console.log('Starting article extraction...');
        const documentClone = document.cloneNode(true);

        // Check if Readability is available
        if (typeof Readability === 'undefined') {
            console.error('Readability is not defined');
            return null;
        }

        console.log('Creating Readability instance...');
        const reader = new Readability(documentClone);

        console.log('Parsing article...');
        const article = reader.parse();

        if (!article) {
            console.error('Failed to parse article');
            return null;
        }

        console.log('Article parsed successfully:', {
            title: article.title,
            contentLength: article.content.length
        });

        // Create a clean HTML document with the article content
        const cleanHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${article.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            font-size: 2em;
            margin-bottom: 1em;
        }
        img {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    <h1>${article.title}</h1>
    ${article.content}
</body>
</html>`;

        return cleanHtml;
    } catch (error) {
        console.error('Error in extractArticleContent:', error);
        return null;
    }
}

function showMessage(message, type) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = message;
    messageElement.className = type;
    messageElement.style.display = 'block';
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 3000);
}

function exportMarkdownCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) {
            showMessage(i18n.getString('noTabs'), 'error');
            return;
        }

        // First inject readability.js
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['readability.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error injecting readability.js:', chrome.runtime.lastError);
                showMessage(chrome.runtime.lastError.message || 'Failed to inject readability.js', 'error');
                return;
            }

            // Then execute the content extraction and conversion
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: extractAndConvertToMarkdown
            }, (results) => {
                if (chrome.runtime.lastError) {
                    console.error('Error executing script:', chrome.runtime.lastError);
                    showMessage(chrome.runtime.lastError.message || 'Script execution failed', 'error');
                    return;
                }

                if (results && results[0] && results[0].result) {
                    const markdownContent = results[0].result;
                    if (markdownContent === null) {
                        showMessage(i18n.getString('failedToExtract'), 'error');
                        return;
                    }
                    document.getElementById('input').value = markdownContent;
                    copy();
                    showMessage(i18n.getString('copied'), 'success');
                } else {
                    console.error('No results from content extraction');
                    showMessage(i18n.getString('failedToExtract'), 'error');
                }
            });
        });
    });
}

function extractAndConvertToMarkdown() {
    try {
        console.log('Starting article extraction...');
        const documentClone = document.cloneNode(true);

        // Check if Readability is available
        if (typeof Readability === 'undefined') {
            console.error('Readability is not defined');
            return null;
        }

        console.log('Creating Readability instance...');
        const reader = new Readability(documentClone);

        console.log('Parsing article...');
        const article = reader.parse();

        if (!article) {
            console.error('Failed to parse article');
            return null;
        }

        console.log('Article parsed successfully:', {
            title: article.title,
            contentLength: article.content.length
        });

        // Create a temporary div to parse the HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = article.content;

        // Convert to Markdown
        let markdown = `# ${article.title}\n\n`;

        // Process each node in the article content
        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                let content = '';
                for (const child of node.childNodes) {
                    content += processNode(child);
                }

                switch (node.tagName.toLowerCase()) {
                    case 'h1':
                        return `\n# ${content}\n\n`;
                    case 'h2':
                        return `\n## ${content}\n\n`;
                    case 'h3':
                        return `\n### ${content}\n\n`;
                    case 'h4':
                        return `\n#### ${content}\n\n`;
                    case 'h5':
                        return `\n##### ${content}\n\n`;
                    case 'h6':
                        return `\n###### ${content}\n\n`;
                    case 'p':
                        return `\n${content}\n\n`;
                    case 'br':
                        return '\n';
                    case 'strong':
                    case 'b':
                        return `**${content}**`;
                    case 'em':
                    case 'i':
                        return `*${content}*`;
                    case 'a':
                        const href = node.getAttribute('href');
                        return href ? `[${content}](${href})` : content;
                    case 'img':
                        const src = node.getAttribute('src');
                        const alt = node.getAttribute('alt') || '';
                        return src ? `![${alt}](${src})` : '';
                    case 'ul':
                        return `\n${content}\n`;
                    case 'ol':
                        return `\n${content}\n`;
                    case 'li':
                        return `- ${content}\n`;
                    case 'blockquote':
                        return `\n> ${content}\n\n`;
                    case 'code':
                        return `\`${content}\``;
                    case 'pre':
                        return `\n\`\`\`\n${content}\n\`\`\`\n\n`;
                    default:
                        return content;
                }
            }

            return '';
        }

        // Process the article content
        markdown += processNode(tempDiv);

        // Clean up the markdown
        markdown = markdown
            .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
            .replace(/\s+$/gm, '')      // Remove trailing whitespace
            .trim();

        return markdown;
    } catch (error) {
        console.error('Error in extractAndConvertToMarkdown:', error);
        return null;
    }
}

// Initialize folder UI texts
function initializeFolderUI() {
    document.getElementById('uncategorized-option').textContent = i18n.getString('uncategorized');
}

// Load folders for popup (with tree hierarchy)
async function loadFoldersForPopup() {
    const result = await chrome.storage.sync.get(['folders', 'uncategorizedName']);
    const folders = result.folders || [];
    const uncategorizedName = result.uncategorizedName || i18n.getString('uncategorized');
    const folderSelect = document.getElementById('folder-select');

    // Clear existing options except the first one
    folderSelect.innerHTML = `<option value="null">${uncategorizedName}</option>`;

    // Build tree and add options with indentation
    const tree = buildFolderTreeForPopup(folders);
    addFolderOptionsToSelect(folderSelect, tree, 0);
}

// Build folder tree from flat list (for popup)
function buildFolderTreeForPopup(folders, parentId = null) {
    return folders
        .filter(folder => (folder.parentId || null) === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(folder => ({
            ...folder,
            children: buildFolderTreeForPopup(folders, folder.id)
        }));
}

// Add folder options to select with indentation
function addFolderOptionsToSelect(selectElement, tree, level) {
    tree.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        // Add indentation prefix for hierarchy
        const indent = level > 0 ? '\u00A0\u00A0'.repeat(level) + '\u2514\u00A0' : '';
        option.textContent = indent + folder.name;
        selectElement.appendChild(option);

        // Add children recursively
        if (folder.children && folder.children.length > 0) {
            addFolderOptionsToSelect(selectElement, folder.children, level + 1);
        }
    });
}

// Load last selected folder
async function loadDefaultFolder() {
    const result = await chrome.storage.sync.get(['lastSelectedFolder']);
    const lastSelectedFolder = result.lastSelectedFolder;
    const folderSelect = document.getElementById('folder-select');

    if (lastSelectedFolder !== undefined) {
        folderSelect.value = lastSelectedFolder || 'null';
    }
}

// Save last selected folder when user changes selection
function saveLastSelectedFolder() {
    const selectedFolderId = document.getElementById('folder-select').value;
    const folderId = selectedFolderId === 'null' ? null : selectedFolderId;

    chrome.storage.sync.set({ lastSelectedFolder: folderId });
}
