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
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            const currentUrl = tabs[0].url;
            
            // Check if the URL already exists in marked tabs
            chrome.storage.sync.get(['markedTabs'], function(result) {
                const markedTabs = result.markedTabs || [];
                
                // Check for duplicate URL
                const isDuplicate = markedTabs.some(tab => tab.url === currentUrl);
                
                if (isDuplicate) {
                    document.getElementById('markCurrentTab').innerHTML = i18n.getString('alreadyMarked');
                    setTimeout(() => {
                        document.getElementById('markCurrentTab').innerHTML = i18n.getString('markThisTab');
                    }, 2000);
                    return;
                }
                
                const tab = {
                    id: Date.now(),
                    title: tabs[0].title,
                    url: currentUrl,
                    timestamp: new Date().toISOString()
                };
                
                markedTabs.push(tab);
                chrome.storage.sync.set({markedTabs: markedTabs}, function() {
                    loadMarkedTabs();
                    document.getElementById('markCurrentTab').innerHTML = i18n.getString('marked');
                    setTimeout(() => {
                        document.getElementById('markCurrentTab').innerHTML = i18n.getString('markThisTab');
                    }, 2000);
                });
            });
        }
    });
}

// Function to clean up old marked tabs when storage is approaching the limit
function cleanupMarkedTabs() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['markedTabs'], function(result) {
            let markedTabs = result.markedTabs || [];
            
            // If we have less than 50 tabs, no need to clean up
            if (markedTabs.length < 50) {
                resolve(markedTabs);
                return;
            }
            
            // Sort tabs by timestamp (oldest first)
            markedTabs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Keep only the newest 50 tabs
            markedTabs = markedTabs.slice(-50);
            
            // Save the cleaned up tabs
            chrome.storage.sync.set({markedTabs: markedTabs}, function() {
                console.log("Cleaned up marked tabs, now have:", markedTabs.length);
                resolve(markedTabs);
            });
        });
    });
}

function markAllTabs() {
    console.log("markAllTabs function called");
    
    // First, clean up old marked tabs if necessary
    cleanupMarkedTabs().then(cleanedMarkedTabs => {
        // Use chrome.tabs.query with a more specific query
        chrome.tabs.query({}, function(tabs) {
            console.log("Tabs found:", tabs.length);
            
            if (tabs.length === 0) {
                document.getElementById('markAllTabs').innerHTML = i18n.getString('noTabs');
                setTimeout(() => {
                    document.getElementById('markAllTabs').innerHTML = i18n.getString('markAllTabs');
                }, 2000);
                return;
            }
            
            // Use the cleaned up marked tabs
            let markedTabs = cleanedMarkedTabs;
            console.log("Using cleaned up marked tabs:", markedTabs.length);
            
            // Create a set of existing URLs for quick lookup
            const existingUrls = new Set(markedTabs.map(tab => tab.url));
            console.log("Existing URLs count:", existingUrls.size);
            
            let newTabsCount = 0;
            
            // Add all tabs to marked tabs, skipping duplicates
            tabs.forEach(tab => {
                if (!existingUrls.has(tab.url)) {
                    const tabData = {
                        id: Date.now() + Math.random(), // Ensure unique ID
                        title: tab.title,
                        url: tab.url,
                        timestamp: new Date().toISOString()
                    };
                    markedTabs.push(tabData);
                    existingUrls.add(tab.url);
                    newTabsCount++;
                    console.log("Added tab:", tab.title, tab.url);
                }
            });
            
            console.log("New tabs to add:", newTabsCount);
            console.log("Total marked tabs after adding:", markedTabs.length);
            
            if (newTabsCount === 0) {
                document.getElementById('markAllTabs').innerHTML = i18n.getString('noNewTabs');
                setTimeout(() => {
                    document.getElementById('markAllTabs').innerHTML = i18n.getString('markAllTabs');
                }, 2000);
                return;
            }
            
            // Check if we're approaching the storage limit
            const dataSize = JSON.stringify(markedTabs).length;
            console.log("Data size:", dataSize, "bytes");
            
            if (dataSize > 90000) { // Chrome sync storage limit is around 100KB
                document.getElementById('markAllTabs').innerHTML = i18n.getString('quotaExceeded');
                setTimeout(() => {
                    document.getElementById('markAllTabs').innerHTML = i18n.getString('markAllTabs');
                }, 2000);
                return;
            }
            
            // Use a callback to ensure the storage is updated
            try {
                chrome.storage.sync.set({markedTabs: markedTabs}, function() {
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
                            document.getElementById('markAllTabs').innerHTML = i18n.getString('markAllTabs');
                        }, 3000);
                        return;
                    }
                    
                    console.log("Storage updated successfully, new total:", markedTabs.length);
                    
                    // Force reload the marked tabs
                    loadMarkedTabs();
                    
                    document.getElementById('markAllTabs').innerHTML = newTabsCount + i18n.getString('markedTabs');
                    setTimeout(() => {
                        document.getElementById('markAllTabs').innerHTML = i18n.getString('markAllTabs');
                    }, 2000);
                });
            } catch (error) {
                console.error("Exception when saving to storage:", error);
                document.getElementById('markAllTabs').innerHTML = i18n.getString('exception');
                setTimeout(() => {
                    document.getElementById('markAllTabs').innerHTML = i18n.getString('markAllTabs');
                }, 2000);
            }
        });
    });
}

function loadMarkedTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';
    
    chrome.storage.sync.get(['markedTabs'], function(result) {
        const markedTabs = result.markedTabs || [];
        
        if (markedTabs.length === 0) {
            tabList.innerHTML = '<div class="no-tabs">' + i18n.getString('noMarkedTabs') + '</div>';
            return;
        }
        
        // Sort tabs by timestamp (newest first)
        markedTabs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Display only the latest 5 tabs in the popup
        const tabsToShow = markedTabs.slice(0, 5);
        
        tabsToShow.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = 'tab-item';
            tabElement.innerHTML = `
                <div class="tab-info" data-url="${tab.url}">
                    <div class="tab-title">${tab.title}</div>
                    <div class="tab-url">${tab.url}</div>
                </div>
                <button class="delete-btn" data-id="${tab.id}">${i18n.getString('deleteButton')}</button>
            `;
            
            // Add click event to open the tab
            const tabInfo = tabElement.querySelector('.tab-info');
            tabInfo.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                chrome.tabs.create({ url: url });
            });
            
            // Add cursor pointer style to tab info
            tabInfo.style.cursor = 'pointer';
            
            const deleteBtn = tabElement.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent triggering the tab open when clicking delete
                deleteTab(tab.id);
            });
            
            tabList.appendChild(tabElement);
        });
        
        // Update the view all button
        updateViewAllButton();
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

function deleteTab(tabId) {
    chrome.storage.sync.get(['markedTabs'], function(result) {
        const markedTabs = result.markedTabs || [];
        const updatedTabs = markedTabs.filter(tab => tab.id !== tabId);
        
        chrome.storage.sync.set({markedTabs: updatedTabs}, function() {
            loadMarkedTabs();
        });
    });
}

// Function to update the view all button
function updateViewAllButton() {
    chrome.storage.sync.get(['markedTabs'], function(result) {
        const markedTabs = result.markedTabs || [];
        const viewAllButton = document.getElementById('viewAllTabs');
        
        if (markedTabs.length > 0) {
            // Update the button text with the correct string
            viewAllButton.innerHTML = i18n.getString('viewAllTabs') + " (" + markedTabs.length + ")";
            viewAllButton.style.display = 'block';
        } else {
            // Hide the button if there are no marked tabs
            viewAllButton.style.display = 'none';
        }
    });
}

// Add settings link to the popup
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
