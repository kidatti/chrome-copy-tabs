window.onload = function() {
    // Load language setting
    chrome.storage.sync.get(['language'], function(result) {
        if (result.language) {
            i18n.setLanguage(result.language);
        } else {
            i18n.resetLanguage();
        }
    });
};

// Function to update UI elements with current language
function updateUI() {
    // Update button texts
    document.getElementById('copyCurrentTab').innerHTML = '<span class="icon-this-tab"></span>' + i18n.getString('copyThisTab');
    document.getElementById('copyAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('copyAllTabs');
    document.getElementById('markCurrentTab').innerHTML = '<span class="icon-this-tab"></span>' + i18n.getString('markThisTab');
    document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs');
    // Header icon doesn't need text update
    
    // Update other UI elements as needed
    const settingsLink = document.querySelector('.settings-link');
    if (settingsLink) {
        settingsLink.textContent = i18n.getString('settingsLink');
    }
}

// Load language setting when the page is loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadLanguageSetting();
        updateUI();
    } catch (error) {
        console.error('Failed to load language setting:', error);
    }
});

document.addEventListener("DOMContentLoaded", function(){
    // Load language setting first
    chrome.storage.sync.get(['language'], function(result) {
        if (result.language) {
            i18n.setLanguage(result.language);
        } else {
            i18n.resetLanguage();
        }
        
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
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                document.getElementById('title').innerHTML = tabs[0].title;
                document.getElementById('url').innerHTML = tabs[0].url;
            }
        });
        
        // Update button texts
        document.getElementById('copyCurrentTab').innerHTML = '<span class="icon-this-tab"></span>' + i18n.getString('copyThisTab');
        document.getElementById('copyAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('copyAllTabs');
        document.getElementById('markCurrentTab').innerHTML = '<span class="icon-this-tab"></span>' + i18n.getString('markThisTab');
        document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs');
        // Header icon doesn't need text update
        
        count();
        loadMarkedTabs();
        
        // Update view all button
        updateViewAllButton();
        
        // Add settings link
        addSettingsLink();
        
        // Initialize folder UI texts
        initializeFolderUI();
        
        // Load folders for popup
        loadFoldersForPopup();
        loadDefaultFolder();
        
        // Add folder select event listeners
        document.getElementById('folder-select').addEventListener('change', onFolderSelectChange);
        document.getElementById('set-default-folder').addEventListener('click', setDefaultFolder);
    });
});

function count() {
    chrome.tabs.query({}, function(tabs) {
        const total = tabs.length;
        document.getElementById('copyAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('copyAllTabs') + " (" + total + ")";;
        document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs') + " (" + total + ")";
    });
}

function getActiveTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                let text = tabs[0].title + "\n" + tabs[0].url;
                document.getElementById('input').value = text;
                copy();
                document.getElementById('copyCurrentTab').innerHTML = i18n.getString('copied');
                setTimeout(() => {
                    document.getElementById('copyCurrentTab').innerHTML = '<span class="icon-this-tab"></span>' + i18n.getString('copyThisTab');
                }, 2000);
            }
            resolve(tabs);
        });
    });
}

function getAllTabs() {
    chrome.tabs.query({}, function(tabs) {
        let text = "";
        tabs.forEach(tab => {
            text += tab.title + "\n" + tab.url + "\n";
        });
        document.getElementById('input').value = text;
        copy();
        document.getElementById('copyAllTabs').innerHTML = i18n.getString('copied');
        setTimeout(() => {
            document.getElementById('copyAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('copyAllTabs') + " (" + tabs.length + ")";;
        }, 2000);
    });
}

function copy() {
    const copyText = document.querySelector("#input");
    copyText.select();
    document.execCommand("copy");
}

function markCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) {
            document.getElementById('markCurrentTab').innerHTML = i18n.getString('noTabs');
            setTimeout(() => {
                document.getElementById('markCurrentTab').innerHTML = '<span class="icon-this-tab"></span>' + i18n.getString('markThisTab');
            }, 2000);
            return;
        }
        
        const currentUrl = tabs[0].url;
        
        chrome.storage.sync.get(['dataKeys'], function(result) {
            const dataKeys = result.dataKeys || [];
            
            if (dataKeys.length > 0) {
                // Get all tab data using the dataKeys
                chrome.storage.sync.get(dataKeys, function(tabsData) {
                    const allTabs = dataKeys.map(key => tabsData[key]);
                    
                    // Check if the URL is already in marked tabs
                    const isDuplicate = allTabs.some(tab => tab.url === currentUrl);
                    
                    if (isDuplicate) {
                        document.getElementById('markCurrentTab').innerHTML = i18n.getString('alreadyMarked');
                        setTimeout(() => {
                            document.getElementById('markCurrentTab').innerHTML = '<span class="icon-this-tab"></span>' + i18n.getString('markThisTab');
                        }, 2000);
                        return;
                    }
                    
                    addNewTab(tabs[0]);
                });
            } else {
                addNewTab(tabs[0]);
            }
        });
    });
}

// Helper function to add a new tab
function addNewTab(chromeTab) {
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
    
    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];
        const newKey = `mark-${dataKeys.length + 1}`;
        const updatedKeys = [...dataKeys, newKey];
        
        // Create a storage update object
        const updateData = {
            dataKeys: updatedKeys,
            [newKey]: tab
        };
        
        chrome.storage.sync.set(updateData, function() {
            loadMarkedTabs();
            document.getElementById('markCurrentTab').innerHTML = i18n.getString('marked');
            setTimeout(() => {
                document.getElementById('markCurrentTab').innerHTML = '<span class="icon-this-tab"></span>' + i18n.getString('markThisTab');
            }, 2000);
        });
    });
}

// Function to migrate from old markedTabs format to new dataKeys format
function migrateFromMarkedTabs() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['markedTabs'], function(result) {
            if (!result.markedTabs) {
                // No markedTabs data to migrate
                resolve();
                return;
            }

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
            chrome.storage.sync.set(storageData, function() {
                console.log("Migration completed: converted markedTabs to dataKeys format");
                
                // Remove old markedTabs data
                chrome.storage.sync.remove(['markedTabs'], function() {
                    console.log("Removed old markedTabs data");
                    resolve();
                });
            });
        });
    });
}

// Modify existing loadMarkedTabs function to use new storage format
function loadMarkedTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';
    
    // Check for and migrate old format if needed
    migrateFromMarkedTabs().then(() => {
        chrome.storage.sync.get(['dataKeys'], function(result) {
            const dataKeys = result.dataKeys || [];
            
            if (dataKeys.length === 0) {
                tabList.innerHTML = '<div class="no-tabs">' + i18n.getString('noMarkedTabs') + '</div>';
                updateViewAllButton();
                return;
            }
            
            // Get all tab data using the dataKeys
            chrome.storage.sync.get(dataKeys, function(tabsData) {
                const allTabs = dataKeys.map(key => tabsData[key]);
                
                // Sort tabs by timestamp (newest first)
                allTabs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                // Display only the latest 5 tabs in the popup
                const tabsToShow = allTabs.slice(0, 5);
                
                tabsToShow.forEach(tab => {
                    const tabElement = document.createElement('div');
                    tabElement.className = 'tab-item';
                    tabElement.innerHTML = `
                        <div class="tab-info" data-url="${tab.url}">
                            <div class="tab-title">${tab.title}</div>
                            <div class="tab-url">${tab.url}</div>
                        </div>
                        <button class="delete-btn" data-id="${tab.id}" ${tab.locked ? 'style="display: none;"' : ''}>${i18n.getString('deleteButton')}</button>
                    `;
                    
                    // Add click event to open the tab
                    const tabInfo = tabElement.querySelector('.tab-info');
                    tabInfo.addEventListener('click', function() {
                        const url = this.getAttribute('data-url');
                        chrome.tabs.create({ url: url });
                    });
                    
                    // Add cursor pointer style to tab info
                    tabInfo.style.cursor = 'pointer';
                    
                    // Add click event to delete button
                    const deleteBtn = tabElement.querySelector('.delete-btn');
                    deleteBtn.addEventListener('click', function() {
                        const tabId = this.getAttribute('data-id');
                        deleteTab(tabId);
                    });
                    
                    tabList.appendChild(tabElement);
                });
                
                updateViewAllButton();
            });
        });
    });
}

function deleteTab(tabId) {
    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];
        
        // Find which key contains the tab with the given ID
        chrome.storage.sync.get(dataKeys, function(tabsData) {
            // Find the key that contains the tab with the given ID
            const keyToRemove = dataKeys.find(key => tabsData[key] && tabsData[key].id == tabId);
            
            if (!keyToRemove) {
                return;
            }
            
            // Create updated dataKeys array without the removed key
            const updatedDataKeys = dataKeys.filter(key => key !== keyToRemove);
            
            // Create a storage update object
            const updateData = { dataKeys: updatedDataKeys };
            
            // Remove the tab data
            chrome.storage.sync.remove([keyToRemove], function() {
                // Update the dataKeys array
                chrome.storage.sync.set(updateData, function() {
                    loadMarkedTabs();
                });
            });
        });
    });
}

function updateViewAllButton() {
    const tabCountElement = document.getElementById('tabCount');
    const viewAllContainer = document.getElementById('viewAllTabsIcon');
    
    chrome.storage.sync.get(['dataKeys'], function(result) {
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
    });
}

function addSettingsLink() {
    // Check if the settings link already exists
    let settingsLink = document.querySelector('.settings-link');
    
    if (!settingsLink) {
        // Create the settings link
        settingsLink = document.createElement('div');
        settingsLink.className = 'settings-link';
        settingsLink.style.textAlign = 'center';
        settingsLink.style.marginTop = '16px';
        settingsLink.style.padding = '8px 16px';
        settingsLink.style.fontSize = '14px';
        settingsLink.style.color = 'white';
        settingsLink.style.background = 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
        settingsLink.style.borderRadius = '8px';
        settingsLink.style.cursor = 'pointer';
        settingsLink.style.textDecoration = 'none';
        settingsLink.style.transition = 'all 0.3s ease';
        settingsLink.style.display = 'inline-flex';
        settingsLink.style.alignItems = 'center';
        settingsLink.style.gap = '8px';
        settingsLink.style.justifyContent = 'center';
        settingsLink.style.width = '100%';
        settingsLink.style.boxSizing = 'border-box';
        
        // Load language setting before setting the text
        chrome.storage.sync.get(['language'], function(result) {
            if (result.language) {
                i18n.setLanguage(result.language);
            } else {
                i18n.resetLanguage();
            }
            settingsLink.innerHTML = '⚙️ ' + i18n.getString('settingsLink');
        });
        
        // Add hover effects
        settingsLink.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 6px 20px rgba(108, 117, 125, 0.4)';
        });
        
        settingsLink.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
        
        // Add click event to open options page
        settingsLink.addEventListener('click', function() {
            chrome.runtime.openOptionsPage();
        });
        
        // Add to the popup at the bottom
        const tabList = document.getElementById('tab-list');
        tabList.parentNode.insertBefore(settingsLink, tabList.nextSibling);
        
        // Add storage size info
        addStorageSizeInfo();
    }
}

// Function to display storage size information
function addStorageSizeInfo() {
    // Create storage info element
    const storageInfo = document.createElement('div');
    storageInfo.className = 'storage-info';
    storageInfo.style.textAlign = 'center';
    storageInfo.style.marginTop = '5px';
    storageInfo.style.fontSize = '10px';
    storageInfo.style.color = '#666';
    
    // Get storage size
    chrome.storage.sync.get(null, function(items) {
        const size = JSON.stringify(items).length;
        const sizeKB = (size / 1024).toFixed(2);
        storageInfo.innerHTML = `Storage: ${sizeKB} KB / 100 KB`;
        
        // Add to the popup after settings link
        const settingsLink = document.querySelector('.settings-link');
        settingsLink.parentNode.insertBefore(storageInfo, settingsLink.nextSibling);
    });
}

function openAllTabsWindow() {
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

function markAllTabs() {
    chrome.tabs.query({}, function(tabs) {
        if (tabs.length === 0) {
            document.getElementById('markAllTabs').innerHTML = i18n.getString('noTabs');
            setTimeout(() => {
                document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs') + " (" + tabs.length + ")";
            }, 2000);
            return;
        }
        
        chrome.storage.sync.get(['dataKeys'], function(result) {
            const dataKeys = result.dataKeys || [];
            
            // Get all existing tabs
            if (dataKeys.length > 0) {
                chrome.storage.sync.get(dataKeys, function(tabsData) {
                    const existingTabs = dataKeys.map(key => tabsData[key]);
                    processNewTabs(tabs, existingTabs);
                });
            } else {
                processNewTabs(tabs, []);
            }
        });
    });
}

// Helper function to process new tabs
function processNewTabs(chromeTabs, existingTabs) {
    // Get selected folder from popup
    const selectedFolderId = document.getElementById('folder-select').value;
    const folderId = selectedFolderId === 'null' ? null : selectedFolderId;
    
    // Create a set of existing URLs for quick lookup
    const existingUrls = new Set(existingTabs.map(tab => tab.url));
    
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
        document.getElementById('markAllTabs').innerHTML = i18n.getString('noNewTabs');
        setTimeout(() => {
            chrome.tabs.query({}, function(tabs) {
                document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs') + " (" + tabs.length + ")";
            });
        }, 2000);
        return;
    }
    
    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];
        
        // Create new keys and prepare update data
        const updateData = {
            dataKeys: [...dataKeys]
        };
        
        newTabs.forEach((tab, index) => {
            const newKey = `mark-${dataKeys.length + index + 1}`;
            updateData.dataKeys.push(newKey);
            updateData[newKey] = tab;
        });
        
        // Check if we're approaching the storage limit
        const dataSize = JSON.stringify(updateData).length;
        
        if (dataSize > 90000) { // Chrome sync storage limit is around 100KB
            document.getElementById('markAllTabs').innerHTML = i18n.getString('quotaExceeded');
            setTimeout(() => {
                chrome.tabs.query({}, function(tabs) {
                    document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs') + " (" + tabs.length + ")";
                });
            }, 2000);
            return;
        }
        
        // Use a callback to ensure the storage is updated
        try {
            chrome.storage.sync.set(updateData, function() {
                if (chrome.runtime.lastError) {
                    console.error("Error saving to storage:", chrome.runtime.lastError);
                    
                    // Display a user-friendly error message based on the error type
                    let errorMessage = i18n.getString('error');
                    if (chrome.runtime.lastError.message.includes("QUOTA_BYTES_PER_ITEM")) {
                        errorMessage = i18n.getString('dataTooLarge');
                    } else if (chrome.runtime.lastError.message.includes("QUOTA_BYTES")) {
                        errorMessage = i18n.getString('quotaExceeded');
                    }
                    
                    document.getElementById('markAllTabs').innerHTML = errorMessage;
                    setTimeout(() => {
                        chrome.tabs.query({}, function(tabs) {
                            document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs') + " (" + tabs.length + ")";
                        });
                    }, 3000);
                    return;
                }
                
                // Force reload the marked tabs
                loadMarkedTabs();
                
                document.getElementById('markAllTabs').innerHTML = newTabsCount + i18n.getString('markedTabs');
                setTimeout(() => {
                    chrome.tabs.query({}, function(tabs) {
                        document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs') + " (" + tabs.length + ")";
                    });
                }, 2000);
            });
        } catch (error) {
            console.error("Exception when saving to storage:", error);
            document.getElementById('markAllTabs').innerHTML = i18n.getString('exception');
            setTimeout(() => {
                chrome.tabs.query({}, function(tabs) {
                    document.getElementById('markAllTabs').innerHTML = '<span class="icon-all-tabs"></span>' + i18n.getString('markAllTabs') + " (" + tabs.length + ")";
                });
            }, 2000);
        }
    });
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
    document.getElementById('folder-label').textContent = i18n.getString('folderLabel');
    document.getElementById('uncategorized-option').textContent = i18n.getString('uncategorized');
    document.getElementById('set-default-folder').title = i18n.getString('setDefault');
}

// Load folders for popup
function loadFoldersForPopup() {
    chrome.storage.sync.get(['folders'], function(result) {
        const folders = result.folders || [];
        const folderSelect = document.getElementById('folder-select');
        
        // Clear existing options except the first one
        folderSelect.innerHTML = `<option value="null">${i18n.getString('uncategorized')}</option>`;
        
        // Add folder options
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            folderSelect.appendChild(option);
        });
    });
}

// Load default folder setting
function loadDefaultFolder() {
    chrome.storage.sync.get(['defaultFolderId'], function(result) {
        const defaultFolderId = result.defaultFolderId;
        const folderSelect = document.getElementById('folder-select');
        const setDefaultBtn = document.getElementById('set-default-folder');
        
        if (defaultFolderId !== undefined) {
            folderSelect.value = defaultFolderId || 'null';
            if (defaultFolderId) {
                setDefaultBtn.classList.add('active');
                setDefaultBtn.title = i18n.getString('defaultFolderSet');
            }
        }
    });
}

// Handle folder selection change
function onFolderSelectChange() {
    const selectedFolderId = document.getElementById('folder-select').value;
    const setDefaultBtn = document.getElementById('set-default-folder');
    
    // Update default button state
    chrome.storage.sync.get(['defaultFolderId'], function(result) {
        const currentDefault = result.defaultFolderId;
        const newFolderId = selectedFolderId === 'null' ? null : selectedFolderId;
        
        if (currentDefault === newFolderId) {
            setDefaultBtn.classList.add('active');
            setDefaultBtn.title = i18n.getString('defaultFolderSet');
        } else {
            setDefaultBtn.classList.remove('active');
            setDefaultBtn.title = i18n.getString('setDefault');
        }
    });
}

// Set default folder
function setDefaultFolder() {
    const selectedFolderId = document.getElementById('folder-select').value;
    const folderId = selectedFolderId === 'null' ? null : selectedFolderId;
    const setDefaultBtn = document.getElementById('set-default-folder');
    
    chrome.storage.sync.set({ defaultFolderId: folderId }, function() {
        setDefaultBtn.classList.add('active');
        setDefaultBtn.title = i18n.getString('defaultFolderSet');
        
        // Show confirmation
        const originalText = setDefaultBtn.innerHTML;
        setDefaultBtn.innerHTML = '✓';
        setTimeout(() => {
            setDefaultBtn.innerHTML = originalText;
        }, 1000);
    });
}