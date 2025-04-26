document.addEventListener("DOMContentLoaded", function() {
    // Wait for i18n object to be loaded
    if (typeof i18n === 'undefined') {
        console.error('i18n object is not loaded');
        return;
    }
    
    // Set page title
    document.title = i18n.getString('pageTitle');
    document.getElementById('page-title').textContent = i18n.getString('pageTitle');
    
    // Load marked tabs
    loadAllMarkedTabs();
});

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

function loadAllMarkedTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';
    
    // Check for and migrate old format if needed
    migrateFromMarkedTabs().then(() => {
        chrome.storage.sync.get(['dataKeys'], function(result) {
            const dataKeys = result.dataKeys || [];
            
            if (dataKeys.length === 0) {
                tabList.innerHTML = `
                    <div class="no-tabs">
                        ${i18n.getString('noMarkedTabs')}
                        <div style="margin-top: 20px;">
                            <button id="open-options" style="padding: 10px 20px; background-color: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                ${i18n.getString('settingsTitle')}
                            </button>
                        </div>
                    </div>
                `;
                
                // Add event listener to open options page
                document.getElementById('open-options').addEventListener('click', function() {
                    chrome.runtime.openOptionsPage();
                });
                return;
            }
            
            // Get all tab data using the dataKeys
            chrome.storage.sync.get(dataKeys, function(tabsData) {
                const allTabs = dataKeys.map(key => tabsData[key]);
                
                // Sort tabs by timestamp (newest first)
                allTabs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                allTabs.forEach(tab => {
                    const tabElement = document.createElement('div');
                    tabElement.className = 'tab-item';
                    
                    // Format the date
                    const date = new Date(tab.timestamp);
                    const formattedDate = date.toLocaleString();
                    
                    tabElement.innerHTML = `
                        <div class="tab-info" data-url="${tab.url}">
                            <div class="tab-title">${tab.title}</div>
                            <div class="tab-url">${tab.url}</div>
                            <div class="tab-date">${i18n.getString('markDateTime')}: ${formattedDate}</div>
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
                    loadAllMarkedTabs();
                });
            });
        });
    });
}
