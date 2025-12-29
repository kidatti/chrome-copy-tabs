let currentFolderId = null;
let currentRenameFolderId = null;
let currentDeleteFolderId = null;
let currentEditTabId = null;

document.addEventListener("DOMContentLoaded", function() {
    // Wait for i18n object to be loaded
    if (typeof i18n === 'undefined') {
        console.error('i18n object is not loaded');
        return;
    }

    // Set page title (removed page-title element display)

    // Set folder-related UI text
    document.getElementById('folders-title').textContent = i18n.getString('folders');
    document.getElementById('add-folder-btn').textContent = i18n.getString('addFolder');
    document.getElementById('uncategorized-name').textContent = i18n.getString('uncategorized');

    // Set copy button texts
    document.getElementById('copy-urls-btn').textContent = i18n.getString('copyUrls');
    document.getElementById('copy-titles-urls-btn').textContent = i18n.getString('copyTitlesUrls');

    // Set modal UI text
    initializeModalTexts();
    
    // Initialize folder management
    initializeFolderManagement();
    
    // Initialize modal functionality
    initializeModals();
    
    // Add click event for uncategorized folder
    document.querySelector('[data-folder-id="null"]').addEventListener('click', function() {
        selectFolder(null);
    });
    
    // Add click event for uncategorized folder rename button
    document.querySelector('.rename-uncategorized-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        renameUncategorizedFolder();
    });
    
    // Add click event for settings icon
    document.getElementById('settingsIcon').addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });

    // Add click events for copy buttons
    document.getElementById('copy-urls-btn').addEventListener('click', copyURLsOnly);
    document.getElementById('copy-titles-urls-btn').addEventListener('click', copyTitlesAndURLs);

    // Load folders and tabs
    loadFolders();
    loadUncategorizedName();
    loadAllMarkedTabs();
});

// Listen for storage changes to update language and folders
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync' && changes.language) {
        console.log('All_tabs: Language setting changed to:', changes.language.newValue);
        
        // Set the new language
        if (changes.language.newValue) {
            if (changes.language.newValue !== 'auto') {
                i18n.setLanguage(changes.language.newValue);
            } else {
                i18n.setLanguage('auto');
            }
        } else {
            i18n.setLanguage('auto');
        }
        
        // Update folder-related UI text
        document.getElementById('folders-title').textContent = i18n.getString('folders');
        document.getElementById('add-folder-btn').textContent = i18n.getString('addFolder');

        // Update copy button texts
        document.getElementById('copy-urls-btn').textContent = i18n.getString('copyUrls');
        document.getElementById('copy-titles-urls-btn').textContent = i18n.getString('copyTitlesUrls');

        // Update modal UI text
        initializeModalTexts();
        
        // Reload uncategorized name
        loadUncategorizedName();
        
        // Reload tabs to update any displayed text
        loadAllMarkedTabs();
    }
    
    // Listen for folder changes and update all folder selects
    if (namespace === 'sync' && changes.folders) {
        updateAllFolderSelects();
    }
});

// Function to clean up duplicate dataKeys
function cleanupDuplicateDataKeys() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['dataKeys'], function(result) {
            const dataKeys = result.dataKeys || [];
            
            if (dataKeys.length === 0) {
                resolve();
                return;
            }
            
            // Remove duplicates from dataKeys
            const uniqueDataKeys = [...new Set(dataKeys)];
            
            if (uniqueDataKeys.length !== dataKeys.length) {
                console.log(`Found duplicate dataKeys. Cleaning up: ${dataKeys.length} -> ${uniqueDataKeys.length}`);
                
                chrome.storage.sync.set({ dataKeys: uniqueDataKeys }, function() {
                    console.log("DataKeys cleaned up successfully");
                    resolve();
                });
            } else {
                resolve();
            }
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

// Initialize modal texts
function initializeModalTexts() {
    // Add Folder Modal
    document.getElementById('add-folder-title').textContent = i18n.getString('addFolder');
    document.getElementById('folder-name-label').textContent = i18n.getString('folderLabel');
    document.getElementById('folder-name-input').placeholder = i18n.getString('enterFolderName');
    document.getElementById('add-folder-cancel').textContent = i18n.getString('cancel') || 'キャンセル';
    document.getElementById('add-folder-confirm').textContent = i18n.getString('create') || '作成';
    
    // Rename Folder Modal
    document.getElementById('rename-folder-title').textContent = i18n.getString('renameFolderTitle') || 'フォルダ名変更';
    document.getElementById('rename-folder-label').textContent = i18n.getString('newFolderNameLabel') || '新しいフォルダ名:';
    document.getElementById('rename-folder-input').placeholder = i18n.getString('enterNewFolderName');
    document.getElementById('rename-folder-cancel').textContent = i18n.getString('cancel') || 'キャンセル';
    document.getElementById('rename-folder-confirm').textContent = i18n.getString('change') || '変更';
    
    // Delete Folder Modal
    document.getElementById('delete-folder-title').textContent = i18n.getString('deleteFolderTitle') || 'フォルダ削除';
    document.getElementById('delete-folder-message').textContent = i18n.getString('deleteFolderMessage') || 'このフォルダを削除しますか？';
    document.getElementById('delete-folder-warning').textContent = i18n.getString('deleteFolderWarning') || 'フォルダ内のタブは未分類に移動されます。';
    document.getElementById('delete-folder-cancel').textContent = i18n.getString('cancel') || 'キャンセル';
    document.getElementById('delete-folder-confirm').textContent = i18n.getString('delete') || '削除';

    // Edit Tab Modal
    document.getElementById('edit-tab-title').textContent = i18n.getString('editTabTitle') || 'タブ編集';
    document.getElementById('tab-title-label').textContent = i18n.getString('tabTitleLabel') || 'タイトル:';
    document.getElementById('tab-url-label').textContent = i18n.getString('tabUrlLabel') || 'URL:';
    document.getElementById('edit-tab-cancel').textContent = i18n.getString('cancel') || 'キャンセル';
    document.getElementById('edit-tab-confirm').textContent = i18n.getString('save') || '保存';
}

// Initialize folder management
function initializeFolderManagement() {
    document.getElementById('add-folder-btn').addEventListener('click', showAddFolderModal);
}

// Initialize modal functionality
function initializeModals() {
    const overlay = document.getElementById('modal-overlay');
    
    // Close modal when clicking overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeAllModals();
        }
    });
    
    // Close modal buttons
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Cancel buttons
    document.getElementById('add-folder-cancel').addEventListener('click', closeAllModals);
    document.getElementById('rename-folder-cancel').addEventListener('click', closeAllModals);
    document.getElementById('delete-folder-cancel').addEventListener('click', closeAllModals);
    document.getElementById('edit-tab-cancel').addEventListener('click', closeAllModals);

    // Confirm buttons
    document.getElementById('add-folder-confirm').addEventListener('click', confirmAddFolder);
    document.getElementById('rename-folder-confirm').addEventListener('click', confirmRenameFolder);
    document.getElementById('delete-folder-confirm').addEventListener('click', confirmDeleteFolder);
    document.getElementById('edit-tab-confirm').addEventListener('click', confirmEditTab);
    
    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // Enter key to confirm in input modals
    document.getElementById('folder-name-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmAddFolder();
        }
    });
    
    document.getElementById('rename-folder-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmRenameFolder();
        }
    });

    document.getElementById('edit-tab-title-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmEditTab();
        }
    });

    document.getElementById('edit-tab-url-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmEditTab();
        }
    });
}

// Modal control functions
function showModal(modalId) {
    document.getElementById('modal-overlay').classList.add('show');
    document.getElementById(modalId).classList.add('show');
}

function closeAllModals() {
    document.getElementById('modal-overlay').classList.remove('show');
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
    
    // Clear input fields
    document.getElementById('folder-name-input').value = '';
    document.getElementById('rename-folder-input').value = '';
    document.getElementById('edit-tab-title-input').value = '';
    document.getElementById('edit-tab-url-input').value = '';

    // Reset any stored data
    currentRenameFolderId = null;
    currentDeleteFolderId = null;
    currentEditTabId = null;
}

// Migrate data to include folder support
function migrateToFolderSupport() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['dataKeys'], function(result) {
            const dataKeys = result.dataKeys || [];
            
            if (dataKeys.length === 0) {
                resolve();
                return;
            }

            chrome.storage.sync.get(dataKeys, function(tabsData) {
                const updateData = {};
                let hasUpdates = false;

                dataKeys.forEach(key => {
                    const tab = tabsData[key];
                    if (tab && !tab.hasOwnProperty('folderId')) {
                        tab.folderId = null;
                        updateData[key] = tab;
                        hasUpdates = true;
                    }
                });

                if (hasUpdates) {
                    chrome.storage.sync.set(updateData, function() {
                        console.log("Migration completed: added folderId to existing tabs");
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        });
    });
}

// Load folders
function loadFolders() {
    chrome.storage.sync.get(['folders'], function(result) {
        const folders = result.folders || [];
        const folderList = document.getElementById('folder-list');
        
        // Clear existing folders (except "未分類")
        const uncategorized = folderList.querySelector('[data-folder-id="null"]');
        folderList.innerHTML = '';
        folderList.appendChild(uncategorized);
        
        // Add folders
        folders.forEach(folder => {
            const folderElement = createFolderElement(folder);
            folderList.appendChild(folderElement);
        });
        
        updateFolderCounts();
    });
}

// Create folder element
function createFolderElement(folder) {
    const folderElement = document.createElement('div');
    folderElement.className = 'folder-item';
    folderElement.setAttribute('data-folder-id', folder.id);
    
    folderElement.innerHTML = `
        <div class="folder-name">${folder.name}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div class="folder-actions">
                <button class="folder-btn rename-folder-btn" data-folder-id="${folder.id}">
                    <img src="images/edit.svg" alt="Edit">
                </button>
                <button class="folder-btn delete-folder-btn" data-folder-id="${folder.id}">
                    <img src="images/delete.svg" alt="Delete">
                </button>
            </div>
            <div class="folder-count">0</div>
        </div>
    `;
    
    folderElement.addEventListener('click', function() {
        selectFolder(folder.id);
    });
    
    // Add event listeners for rename and delete buttons
    const renameBtn = folderElement.querySelector('.rename-folder-btn');
    const deleteBtn = folderElement.querySelector('.delete-folder-btn');
    
    renameBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        renameFolderDialog(folder.id);
    });
    
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteFolder(folder.id);
    });
    
    return folderElement;
}

// Select folder
function selectFolder(folderId) {
    currentFolderId = folderId;
    
    // Update active state
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-folder-id="${folderId}"]`).classList.add('active');
    
    // Reload tabs for selected folder
    loadAllMarkedTabs();
}

// Show add folder modal
function showAddFolderModal() {
    showModal('add-folder-modal');
    setTimeout(() => {
        document.getElementById('folder-name-input').focus();
    }, 100);
}

// Confirm add folder
function confirmAddFolder() {
    const name = document.getElementById('folder-name-input').value.trim();
    if (name) {
        addFolder(name);
        closeAllModals();
    }
}

// Add new folder
function addFolder(name) {
    chrome.storage.sync.get(['folders'], function(result) {
        const folders = result.folders || [];
        const newFolder = {
            id: Date.now().toString(),
            name: name
        };
        
        folders.push(newFolder);
        
        chrome.storage.sync.set({ folders: folders }, function() {
            loadFolders();
        });
    });
}

// Show rename folder modal
function renameFolderDialog(folderId) {
    chrome.storage.sync.get(['folders'], function(result) {
        const folders = result.folders || [];
        const folder = folders.find(f => f.id === folderId);
        
        if (folder) {
            currentRenameFolderId = folderId;
            document.getElementById('rename-folder-input').value = folder.name;
            showModal('rename-folder-modal');
            setTimeout(() => {
                const input = document.getElementById('rename-folder-input');
                input.focus();
                input.select();
            }, 100);
        }
    });
}

// Confirm rename folder
function confirmRenameFolder() {
    const newName = document.getElementById('rename-folder-input').value.trim();
    if (newName && currentRenameFolderId) {
        if (currentRenameFolderId === 'uncategorized') {
            renameUncategorized(newName);
        } else {
            renameFolder(currentRenameFolderId, newName);
        }
        closeAllModals();
    }
}

// Rename uncategorized folder
function renameUncategorized(newName) {
    chrome.storage.sync.set({ uncategorizedName: newName }, function() {
        // Update UI immediately
        document.getElementById('uncategorized-name').textContent = newName;
        updateUncategorizedNameInUI(newName);
    });
}

// Rename folder
function renameFolder(folderId, newName) {
    chrome.storage.sync.get(['folders'], function(result) {
        const folders = result.folders || [];
        const folderIndex = folders.findIndex(f => f.id === folderId);
        
        if (folderIndex !== -1) {
            folders[folderIndex].name = newName;
            
            chrome.storage.sync.set({ folders: folders }, function() {
                loadFolders();
            });
        }
    });
}

// Rename uncategorized folder
function renameUncategorizedFolder() {
    chrome.storage.sync.get(['uncategorizedName'], function(result) {
        const currentName = result.uncategorizedName || i18n.getString('uncategorized');
        
        currentRenameFolderId = 'uncategorized';
        document.getElementById('rename-folder-input').value = currentName;
        showModal('rename-folder-modal');
        setTimeout(() => {
            const input = document.getElementById('rename-folder-input');
            input.focus();
            input.select();
        }, 100);
    });
}

// Show delete folder modal
function deleteFolder(folderId) {
    currentDeleteFolderId = folderId;
    showModal('delete-folder-modal');
}

// Confirm delete folder
function confirmDeleteFolder() {
    if (currentDeleteFolderId) {
        performDeleteFolder(currentDeleteFolderId);
        closeAllModals();
    }
}

// Perform folder deletion
function performDeleteFolder(folderId) {
    chrome.storage.sync.get(['folders', 'dataKeys'], function(result) {
        const folders = result.folders || [];
        const dataKeys = result.dataKeys || [];
        
        // Remove folder from folders list
        const updatedFolders = folders.filter(f => f.id !== folderId);
        
        // Move tabs in this folder to uncategorized
        if (dataKeys.length > 0) {
            chrome.storage.sync.get(dataKeys, function(tabsData) {
                const updateData = { folders: updatedFolders };
                
                dataKeys.forEach(key => {
                    const tab = tabsData[key];
                    if (tab && tab.folderId === folderId) {
                        tab.folderId = null;
                        updateData[key] = tab;
                    }
                });
                
                chrome.storage.sync.set(updateData, function() {
                    loadFolders();
                    updateAllFolderSelectsAfterDeletion(folderId);
                    if (currentFolderId === folderId) {
                        selectFolder(null);
                    } else {
                        // If currently viewing uncategorized folder and tabs were moved to it, reload
                        if (currentFolderId === null) {
                            loadAllMarkedTabs();
                        }
                    }
                });
            });
        } else {
            chrome.storage.sync.set({ folders: updatedFolders }, function() {
                loadFolders();
                updateAllFolderSelectsAfterDeletion(folderId);
                if (currentFolderId === folderId) {
                    selectFolder(null);
                }
            });
        }
    });
}

// Update all folder select dropdowns
function updateAllFolderSelects() {
    const folderSelects = document.querySelectorAll('.folder-select');
    folderSelects.forEach(select => {
        const currentValue = select.value;
        populateFolderSelect(select, currentValue);
    });
}

// Update all folder select dropdowns after folder deletion
function updateAllFolderSelectsAfterDeletion(deletedFolderId) {
    const folderSelects = document.querySelectorAll('.folder-select');
    folderSelects.forEach(select => {
        const currentValue = select.value;
        // If the current value is the deleted folder, set to null (uncategorized)
        const newValue = currentValue === deletedFolderId ? null : currentValue;
        populateFolderSelect(select, newValue);
    });
}

// Update folder counts
function updateFolderCounts() {
    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];
        
        if (dataKeys.length === 0) {
            // Set all counts to 0
            document.querySelectorAll('.folder-count').forEach(el => {
                el.textContent = '0';
            });
            return;
        }
        
        chrome.storage.sync.get(dataKeys, function(tabsData) {
            const folderCounts = {};
            
            dataKeys.forEach(key => {
                const tab = tabsData[key];
                if (tab) {
                    const folderId = tab.folderId || 'null';
                    folderCounts[folderId] = (folderCounts[folderId] || 0) + 1;
                }
            });
            
            // Update counts in UI
            document.querySelectorAll('.folder-item').forEach(item => {
                const folderId = item.getAttribute('data-folder-id');
                const count = folderCounts[folderId] || 0;
                const countElement = item.querySelector('.folder-count');
                if (countElement) {
                    countElement.textContent = count;
                }
            });
        });
    });
}

function loadAllMarkedTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';
    
    // Check for and migrate old format and folder support, then cleanup duplicates
    migrateFromMarkedTabs().then(() => {
        return migrateToFolderSupport();
    }).then(() => {
        return cleanupDuplicateDataKeys();
    }).then(() => {
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
                updateFolderCounts();
                return;
            }
            
            // Get all tab data using the dataKeys
            chrome.storage.sync.get(dataKeys, function(tabsData) {
                let allTabs = dataKeys.map(key => tabsData[key]).filter(tab => tab);
                
                // Filter tabs by current folder
                if (currentFolderId !== null) {
                    allTabs = allTabs.filter(tab => tab.folderId === currentFolderId);
                } else {
                    allTabs = allTabs.filter(tab => !tab.folderId || tab.folderId === null);
                }
                
                // Sort tabs by timestamp (newest first)
                allTabs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                if (allTabs.length === 0) {
                    tabList.innerHTML = `<div class="no-tabs">${i18n.getString('noTabsInFolder')}</div>`;
                    updateFolderCounts();
                    return;
                }
                
                allTabs.forEach(tab => {
                    // Ensure locked property exists for backward compatibility
                    if (tab.locked === undefined) {
                        tab.locked = false;
                    }
                    
                    const tabElement = document.createElement('div');
                    tabElement.className = 'tab-item';
                    
                    // Format the date
                    const date = new Date(tab.timestamp);
                    const formattedDate = date.toLocaleString();
                    
                    tabElement.innerHTML = `
                        <div class="tab-info" data-url="${tab.url}">
                            <div class="tab-title">${tab.title}</div>
                            <div class="tab-url">${tab.url}</div>
                            <div class="timestamp">${formattedDate}</div>
                        </div>
                        <div class="tab-controls">
                            <select class="folder-select" data-id="${tab.id}">
                                <option value="null">未分類</option>
                            </select>
                            <img class="lock-icon ${tab.locked ? 'locked' : ''}"
                                 src="images/${tab.locked ? 'lock' : 'unlock'}.svg"
                                 alt="${tab.locked ? 'Locked' : 'Unlocked'}"
                                 data-id="${tab.id}">
                            <img class="edit-icon"
                                 src="images/edit.svg"
                                 alt="Edit"
                                 title="${i18n.getString('editTab')}"
                                 data-id="${tab.id}">
                            <img class="delete-icon"
                                 src="images/delete.svg"
                                 alt="Delete"
                                 title="${i18n.getString('deleteButton')}"
                                 data-id="${tab.id}"
                                 ${tab.locked ? 'style="display: none;"' : ''}>
                        </div>
                    `;
                    
                    // Add click event to open the tab
                    const tabInfo = tabElement.querySelector('.tab-info');
                    tabInfo.addEventListener('click', function() {
                        const url = this.getAttribute('data-url');
                        chrome.tabs.create({ url: url });
                    });
                    
                    // Add cursor pointer style to tab info
                    tabInfo.style.cursor = 'pointer';
                    
                    // Add lock toggle functionality
                    const lockIcon = tabElement.querySelector('.lock-icon');
                    lockIcon.addEventListener('click', function(e) {
                        e.stopPropagation();
                        toggleLock(tab.id);
                    });
                    
                    // Add edit icon functionality
                    const editIcon = tabElement.querySelector('.edit-icon');
                    editIcon.addEventListener('click', function(e) {
                        e.stopPropagation();
                        editTab(tab.id);
                    });

                    const deleteIcon = tabElement.querySelector('.delete-icon');
                    if (deleteIcon) {
                        deleteIcon.addEventListener('click', function(e) {
                            e.stopPropagation();
                            deleteTab(tab.id);
                        });
                    }

                    // Add folder select functionality
                    const folderSelect = tabElement.querySelector('.folder-select');
                    populateFolderSelect(folderSelect, tab.folderId);
                    folderSelect.addEventListener('change', function(e) {
                        e.stopPropagation();
                        moveTabToFolder(tab.id, this.value === 'null' ? null : this.value);
                    });
                    
                    tabList.appendChild(tabElement);
                });
                
                updateFolderCounts();
            });
        });
    });
}

function deleteTab(tabId) {
    // Find and remove the tab element from DOM first
    const tabElement = document.querySelector(`[data-id="${tabId}"]`).closest('.tab-item');
    
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
                    // Remove the tab element from DOM instead of reloading
                    if (tabElement) {
                        tabElement.remove();
                    }
                    
                    // Update folder counts without full reload
                    updateFolderCounts();
                    
                    // Check if tab list is empty and show no tabs message
                    const tabList = document.getElementById('tab-list');
                    if (tabList.children.length === 0) {
                        tabList.innerHTML = `<div class="no-tabs">${i18n.getString('noTabsInFolder')}</div>`;
                    }
                });
            });
        });
    });
}

// Populate folder select dropdown
function populateFolderSelect(selectElement, currentFolderId) {
    chrome.storage.sync.get(['folders', 'uncategorizedName'], function(result) {
        const folders = result.folders || [];
        const uncategorizedName = result.uncategorizedName || i18n.getString('uncategorized');
        
        // Clear existing options except the first one (未分類)
        selectElement.innerHTML = `<option value="null">${uncategorizedName}</option>`;
        
        // Add folder options
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            selectElement.appendChild(option);
        });
        
        // Set current value
        selectElement.value = currentFolderId || 'null';
    });
}

// Move tab to folder
function moveTabToFolder(tabId, folderId) {
    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];
        
        chrome.storage.sync.get(dataKeys, function(tabsData) {
            const keyToUpdate = dataKeys.find(key => tabsData[key] && tabsData[key].id == tabId);
            
            if (!keyToUpdate) {
                return;
            }
            
            const tab = tabsData[keyToUpdate];
            const oldFolderId = tab.folderId;
            tab.folderId = folderId;
            
            chrome.storage.sync.set({ [keyToUpdate]: tab }, function() {
                // Update folder counts
                updateFolderCounts();
                
                // If the tab is moved out of the current folder, remove it from the view
                const shouldRemoveFromView = (
                    (currentFolderId === oldFolderId && currentFolderId !== folderId) ||
                    (currentFolderId === null && oldFolderId === null && folderId !== null) ||
                    (currentFolderId !== null && oldFolderId === null && currentFolderId !== folderId)
                );
                
                if (shouldRemoveFromView) {
                    // Find and remove the tab element from DOM
                    const tabElement = document.querySelector(`[data-id="${tabId}"]`).closest('.tab-item');
                    if (tabElement) {
                        tabElement.remove();
                    }
                    
                    // Check if tab list is empty and show no tabs message
                    const tabList = document.getElementById('tab-list');
                    if (tabList.children.length === 0) {
                        tabList.innerHTML = `<div class="no-tabs">${i18n.getString('noTabsInFolder')}</div>`;
                    }
                }
            });
        });
    });
}

// Update uncategorized name in UI
function updateUncategorizedNameInUI(newName) {
    // Update in all folder selects
    document.querySelectorAll('.folder-select option[value="null"]').forEach(option => {
        option.textContent = newName;
    });
    
    // Update in any other places where uncategorized is displayed
    const uncategorizedElements = document.querySelectorAll('.uncategorized-display');
    uncategorizedElements.forEach(element => {
        element.textContent = newName;
    });
}

// Load uncategorized name from storage
function loadUncategorizedName() {
    chrome.storage.sync.get(['uncategorizedName'], function(result) {
        const customName = result.uncategorizedName;
        if (customName) {
            document.getElementById('uncategorized-name').textContent = customName;
            updateUncategorizedNameInUI(customName);
        } else {
            const defaultName = i18n.getString('uncategorized');
            document.getElementById('uncategorized-name').textContent = defaultName;
            updateUncategorizedNameInUI(defaultName);
        }
    });
}

function toggleLock(tabId) {
    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];

        // Find which key contains the tab with the given ID
        chrome.storage.sync.get(dataKeys, function(tabsData) {
            const keyToUpdate = dataKeys.find(key => tabsData[key] && tabsData[key].id == tabId);

            if (!keyToUpdate) {
                return;
            }

            // Toggle the locked state
            const tab = tabsData[keyToUpdate];
            tab.locked = !tab.locked;

            // Update the storage and save the locked state properly
            chrome.storage.sync.set({ [keyToUpdate]: tab }, function() {
                if (chrome.runtime.lastError) {
                    console.error("Error saving lock state:", chrome.runtime.lastError);
                    return;
                }
                loadAllMarkedTabs();
            });
        });
    });
}

// Get currently displayed tabs
function getCurrentlyDisplayedTabs() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['dataKeys'], function(result) {
            const dataKeys = result.dataKeys || [];

            if (dataKeys.length === 0) {
                resolve([]);
                return;
            }

            // Get all tab data using the dataKeys
            chrome.storage.sync.get(dataKeys, function(tabsData) {
                let allTabs = dataKeys.map(key => tabsData[key]).filter(tab => tab);

                // Filter tabs by current folder
                if (currentFolderId !== null) {
                    allTabs = allTabs.filter(tab => tab.folderId === currentFolderId);
                } else {
                    allTabs = allTabs.filter(tab => !tab.folderId || tab.folderId === null);
                }

                // Sort tabs by timestamp (newest first)
                allTabs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                resolve(allTabs);
            });
        });
    });
}

// Copy URLs only
function copyURLsOnly() {
    getCurrentlyDisplayedTabs().then(tabs => {
        if (tabs.length === 0) {
            return;
        }

        const urls = tabs.map(tab => tab.url).join('\n');
        const textarea = document.getElementById('copy-textarea');
        textarea.value = urls;
        textarea.select();
        document.execCommand('copy');

        // Show feedback
        const btn = document.getElementById('copy-urls-btn');
        const originalText = btn.textContent;
        btn.textContent = i18n.getString('copied') || 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

// Copy titles and URLs
function copyTitlesAndURLs() {
    getCurrentlyDisplayedTabs().then(tabs => {
        if (tabs.length === 0) {
            return;
        }

        const content = tabs.map(tab => `${tab.title}\n${tab.url}`).join('\n\n');
        const textarea = document.getElementById('copy-textarea');
        textarea.value = content;
        textarea.select();
        document.execCommand('copy');

        // Show feedback
        const btn = document.getElementById('copy-titles-urls-btn');
        const originalText = btn.textContent;
        btn.textContent = i18n.getString('copied') || 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

// Edit tab
function editTab(tabId) {
    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];

        chrome.storage.sync.get(dataKeys, function(tabsData) {
            const keyToEdit = dataKeys.find(key => tabsData[key] && tabsData[key].id == tabId);

            if (!keyToEdit) {
                return;
            }

            const tab = tabsData[keyToEdit];
            currentEditTabId = tabId;

            // Populate the modal with current values
            document.getElementById('edit-tab-title-input').value = tab.title;
            document.getElementById('edit-tab-url-input').value = tab.url;

            // Show the modal
            showModal('edit-tab-modal');
            setTimeout(() => {
                document.getElementById('edit-tab-title-input').focus();
            }, 100);
        });
    });
}

// Confirm edit tab
function confirmEditTab() {
    if (!currentEditTabId) {
        return;
    }

    const newTitle = document.getElementById('edit-tab-title-input').value.trim();
    const newUrl = document.getElementById('edit-tab-url-input').value.trim();

    if (!newTitle || !newUrl) {
        return;
    }

    chrome.storage.sync.get(['dataKeys'], function(result) {
        const dataKeys = result.dataKeys || [];

        chrome.storage.sync.get(dataKeys, function(tabsData) {
            const keyToUpdate = dataKeys.find(key => tabsData[key] && tabsData[key].id == currentEditTabId);

            if (!keyToUpdate) {
                return;
            }

            const tab = tabsData[keyToUpdate];
            tab.title = newTitle;
            tab.url = newUrl;

            chrome.storage.sync.set({ [keyToUpdate]: tab }, function() {
                if (chrome.runtime.lastError) {
                    console.error("Error saving tab:", chrome.runtime.lastError);
                    return;
                }

                closeAllModals();
                loadAllMarkedTabs();
            });
        });
    });
}
