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

function loadAllMarkedTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';
    
    chrome.storage.sync.get(['markedTabs'], function(result) {
        const markedTabs = result.markedTabs || [];
        
        if (markedTabs.length === 0) {
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
        
        // Sort tabs by timestamp (newest first)
        markedTabs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        markedTabs.forEach(tab => {
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
}

function deleteTab(tabId) {
    chrome.storage.sync.get(['markedTabs'], function(result) {
        const markedTabs = result.markedTabs || [];
        const updatedTabs = markedTabs.filter(tab => tab.id !== tabId);
        
        chrome.storage.sync.set({markedTabs: updatedTabs}, function() {
            loadAllMarkedTabs();
        });
    });
}
