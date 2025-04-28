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
        document.getElementById('viewAllTabs').addEventListener('click', openAllTabsWindow);
        
        // Get current tab info
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                document.getElementById('title').innerHTML = tabs[0].title;
                document.getElementById('url').innerHTML = tabs[0].url;
            }
        });
        
        // Update button texts
        document.getElementById('copyCurrentTab').innerHTML = i18n.getString('copyThisTab');
        document.getElementById('copyAllTabs').innerHTML = i18n.getString('copyAllTabs');
        document.getElementById('markCurrentTab').innerHTML = i18n.getString('markThisTab');
        document.getElementById('markAllTabs').innerHTML = i18n.getString('markAllTabs');
        document.getElementById('viewAllTabs').innerHTML = i18n.getString('viewAllTabs');
        
        count();
        loadMarkedTabs();
        
        // Update view all button
        updateViewAllButton();
        
        // Add settings link
        addSettingsLink();
    });
});

function count() {
    chrome.tabs.query({}, function(tabs) {
        const total = tabs.length;
        document.getElementById('copyAllTabs').innerHTML = i18n.getString('copyAllTabs') + " (" + total + ")";
        document.getElementById('markAllTabs').innerHTML = i18n.getString('markAllTabs') + " (" + total + ")";
    });
}

function getActiveTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            let text = tabs[0].title + "\n" + tabs[0].url;
            document.getElementById('input').value = text;
            copy();
            document.getElementById('copyCurrentTab').innerHTML = i18n.getString('copied');
            setTimeout(() => {
                document.getElementById('copyCurrentTab').innerHTML = i18n.getString('copyThisTab');
            }, 2000);
        }
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
            document.getElementById('copyAllTabs').innerHTML = i18n.getString('copyAllTabs') + " (" + tabs.length + ")";
        }, 2000);
    });
}

function copy() {
    const copyText = document.querySelector("#input");
    copyText.select();
    document.execCommand("copy");
}

function markCurrentTab() {
    getActiveTab().then(tabs => {
        if (tabs.length === 0) {
            document.getElementById('markCurrentTab').innerHTML = i18n.getString('noTabs');
            setTimeout(() => {
                document.getElementById('markCurrentTab').innerHTML = i18n.getString('markThisTab');
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
                            document.getElementById('markCurrentTab').innerHTML = i18n.getString('markThisTab');
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
    const tab = {
        id: Date.now(),
        title: chromeTab.title,
        url: chromeTab.url,
        timestamp: new Date().toISOString(),
        locked: false
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
                document.getElementById('markCurrentTab').innerHTML = i18n.getString('markThisTab');
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
    const viewAllButton = document.getElementById('viewAllTabs');
    
    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];
        
        if (dataKeys.length > 0) {
            viewAllButton.style.display = 'block';
            viewAllButton.innerHTML = i18n.getString('viewAllTabs') + " (" + dataKeys.length + ")";
        } else {
            viewAllButton.style.display = 'none';
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
        settingsLink.style.marginTop = '10px';
        settingsLink.style.fontSize = '12px';
        settingsLink.style.color = '#2196F3';
        settingsLink.style.cursor = 'pointer';
        settingsLink.style.textDecoration = 'underline';
        
        // Load language setting before setting the text
        chrome.storage.sync.get(['language'], function(result) {
            if (result.language) {
                i18n.setLanguage(result.language);
            } else {
                i18n.resetLanguage();
            }
            settingsLink.innerHTML = i18n.getString('settingsLink');
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
    // Create a new window to display all tabs
    chrome.windows.create({
        url: 'all_tabs.html',
        type: 'popup',
        width: 800,
        height: 600
    });
}