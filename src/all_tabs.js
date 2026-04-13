let currentFolderId = null;
let currentRenameFolderId = null;
let currentDeleteFolderId = null;
let currentEditTabId = null;
let draggedElement = null;
let draggedFolderElement = null;
let addSubfolderParentId = null;

// Maximum folder depth (3 levels: root=0, child=1, grandchild=2)
const MAX_FOLDER_DEPTH = 2;

document.addEventListener("DOMContentLoaded", async function() {
    // Wait for i18n object to be loaded
    if (typeof i18n === 'undefined') {
        console.error('i18n object is not loaded');
        return;
    }

    // Load language setting first, then initialize UI
    const result = await chrome.storage.sync.get(['language']);
    if (result.language) {
        if (result.language !== 'auto') {
            i18n.setLanguage(result.language);
        } else {
            i18n.setLanguage('auto');
        }
    }

    // Initialize UI after language is loaded
    initializeUI();
});

function initializeUI() {
    // Set folder-related UI text
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
    const uncategorizedFolder = document.querySelector('[data-folder-id="null"]');
    uncategorizedFolder.addEventListener('click', function() {
        selectFolder(null);
    });

    // Add drag event listeners to uncategorized folder to prevent drops
    uncategorizedFolder.addEventListener('dragover', function(e) {
        e.preventDefault();
        // Don't show any drop indicators for uncategorized
    });
    uncategorizedFolder.addEventListener('dragleave', function(e) {
        // No-op
    });
    uncategorizedFolder.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // Don't allow dropping on uncategorized
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
}

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
            i18n.setLanguage('en');
        }

        // Update all UI text
        document.getElementById('add-folder-btn').textContent = i18n.getString('addFolder');
        document.getElementById('uncategorized-name').textContent = i18n.getString('uncategorized');
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
async function cleanupDuplicateDataKeys() {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    if (dataKeys.length === 0) return;

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

    markedTabs.forEach((tab, index) => {
        const keyName = `mark-${index + 1}`;
        dataKeys.push(keyName);
        storageData[keyName] = tab;
    });

    storageData.dataKeys = dataKeys;

    await chrome.storage.sync.set(storageData);
    console.log("Migration completed: converted markedTabs to dataKeys format");

    await chrome.storage.sync.remove(['markedTabs']);
    console.log("Removed old markedTabs data");
}

// Initialize modal texts
function initializeModalTexts() {
    // Add Folder Modal
    document.getElementById('add-folder-title').textContent = i18n.getString('addFolderTitle') || '新しいフォルダ';
    document.getElementById('folder-name-label').textContent = i18n.getString('folderLabel');
    document.getElementById('folder-name-input').placeholder = i18n.getString('folderNamePlaceholder') || 'フォルダ名を入力';
    document.getElementById('add-folder-cancel').textContent = i18n.getString('cancel') || 'キャンセル';
    document.getElementById('add-folder-confirm').textContent = i18n.getString('create') || '作成';

    // Rename Folder Modal
    document.getElementById('rename-folder-title').textContent = i18n.getString('renameFolderTitle') || 'フォルダ名変更';
    document.getElementById('rename-folder-label').textContent = i18n.getString('newFolderNameLabel') || '新しいフォルダ名:';
    document.getElementById('rename-folder-input').placeholder = i18n.getString('newFolderNamePlaceholder') || '新しいフォルダ名を入力';
    document.getElementById('rename-folder-cancel').textContent = i18n.getString('cancel') || 'キャンセル';
    document.getElementById('rename-folder-confirm').textContent = i18n.getString('change') || '変更';
    
    // Delete Folder Modal
    document.getElementById('delete-folder-title').textContent = i18n.getString('deleteFolderTitle') || 'フォルダ削除';
    document.getElementById('delete-folder-message').textContent = i18n.getString('deleteFolderMessage') || 'このフォルダを削除しますか？';
    document.getElementById('delete-folder-warning').textContent = i18n.getString('deleteFolderWarning') || 'フォルダ内のタブは未分類に移動されます。';
    document.getElementById('delete-folder-cancel').textContent = i18n.getString('cancel') || 'キャンセル';
    document.getElementById('delete-folder-confirm').textContent = i18n.getString('delete') || '削除';

    // Edit Tab Modal
    document.getElementById('edit-tab-title').textContent = i18n.getString('editTabModalTitle') || 'タブ編集';
    document.getElementById('tab-title-label').textContent = i18n.getString('editTabTitleLabel') || 'タイトル:';
    document.getElementById('tab-url-label').textContent = i18n.getString('editTabUrlLabel') || 'URL:';
    document.getElementById('edit-tab-title-input').placeholder = i18n.getString('enterTabTitle') || 'タイトルを入力';
    document.getElementById('edit-tab-url-input').placeholder = i18n.getString('enterTabUrl') || 'URLを入力';
    document.getElementById('edit-tab-cancel').textContent = i18n.getString('cancel') || 'キャンセル';
    document.getElementById('edit-tab-confirm').textContent = i18n.getString('saveButton') || '保存';
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
    addSubfolderParentId = null;
}

// Migrate data to include folder support
async function migrateToFolderSupport() {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    if (dataKeys.length === 0) return;

    const tabsData = await chrome.storage.sync.get(dataKeys);
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
        await chrome.storage.sync.set(updateData);
        console.log("Migration completed: added folderId to existing tabs");
    }
}

// Migrate folders to tree structure (add parentId, order, collapsed)
async function migrateToTreeStructure() {
    const result = await chrome.storage.sync.get(['folders']);
    const folders = result.folders || [];

    if (folders.length === 0) return;

    let hasUpdates = false;
    folders.forEach((folder, index) => {
        if (!folder.hasOwnProperty('parentId')) {
            folder.parentId = null;
            hasUpdates = true;
        }
        if (!folder.hasOwnProperty('order')) {
            folder.order = index;
            hasUpdates = true;
        }
        if (!folder.hasOwnProperty('collapsed')) {
            folder.collapsed = false;
            hasUpdates = true;
        }
    });

    if (hasUpdates) {
        await chrome.storage.sync.set({ folders: folders });
        console.log("Migration completed: added parentId, order, collapsed to folders");
    }
}

// Build folder tree from flat list
function buildFolderTree(folders, parentId = null) {
    return folders
        .filter(folder => folder.parentId === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(folder => ({
            ...folder,
            children: buildFolderTree(folders, folder.id)
        }));
}

// Get all descendant folder IDs (recursive)
function getAllDescendantIds(folders, parentId) {
    const descendants = [];
    const children = folders.filter(f => f.parentId === parentId);

    children.forEach(child => {
        descendants.push(child.id);
        descendants.push(...getAllDescendantIds(folders, child.id));
    });

    return descendants;
}

// Get folder depth (0 = root level)
function getFolderDepth(folders, folderId) {
    if (!folderId) return -1;

    const folder = folders.find(f => f.id === folderId);
    if (!folder) return -1;

    let depth = 0;
    let currentFolder = folder;

    while (currentFolder && currentFolder.parentId) {
        depth++;
        currentFolder = folders.find(f => f.id === currentFolder.parentId);
        if (depth > MAX_FOLDER_DEPTH) break; // Safety check
    }

    return depth;
}

// Check if moving a folder to a target would exceed max depth
function canMoveToParent(folders, folderId, newParentId) {
    // Can't move to itself
    if (folderId === newParentId) return false;

    // Check if newParentId is a descendant of folderId (would create cycle)
    const descendants = getAllDescendantIds(folders, folderId);
    if (descendants.includes(newParentId)) return false;

    // Check depth limit
    const newParentDepth = newParentId ? getFolderDepth(folders, newParentId) : -1;
    const folderSubtreeDepth = getMaxSubtreeDepth(folders, folderId);

    // New depth would be: parent depth + 1 + subtree depth
    if (newParentDepth + 1 + folderSubtreeDepth > MAX_FOLDER_DEPTH) return false;

    return true;
}

// Get maximum depth of subtree under a folder
function getMaxSubtreeDepth(folders, folderId) {
    const children = folders.filter(f => f.parentId === folderId);
    if (children.length === 0) return 0;

    let maxChildDepth = 0;
    children.forEach(child => {
        const childDepth = getMaxSubtreeDepth(folders, child.id) + 1;
        maxChildDepth = Math.max(maxChildDepth, childDepth);
    });

    return maxChildDepth;
}

// Load folders
async function loadFolders() {
    await migrateToTreeStructure();

    const result = await chrome.storage.sync.get(['folders']);
    const folders = result.folders || [];
    const folderList = document.getElementById('folder-list');

    // Clear existing folders (except "未分類")
    const uncategorized = folderList.querySelector('[data-folder-id="null"]');
    folderList.innerHTML = '';
    folderList.appendChild(uncategorized);

    // Build and render tree structure
    const tree = buildFolderTree(folders);
    renderFolderTree(tree, folderList, 0, folders);

    updateFolderCounts();
}

// Render folder tree recursively
function renderFolderTree(tree, container, level, allFolders) {
    tree.forEach(folder => {
        const folderElement = createFolderElement(folder, level, allFolders);
        container.appendChild(folderElement);

        // Render children if not collapsed
        if (folder.children && folder.children.length > 0 && !folder.collapsed) {
            renderFolderTree(folder.children, container, level + 1, allFolders);
        }
    });
}

// Create folder element
function createFolderElement(folder, level = 0, allFolders = []) {
    const folderElement = document.createElement('div');
    folderElement.className = 'folder-item';
    folderElement.setAttribute('data-folder-id', folder.id);
    folderElement.setAttribute('data-level', level);
    folderElement.setAttribute('draggable', 'true');

    const hasChildren = folder.children && folder.children.length > 0;
    const canAddChild = level < MAX_FOLDER_DEPTH;

    // Toggle icon for collapse/expand
    const toggleClass = hasChildren
        ? (folder.collapsed ? 'folder-toggle has-children' : 'folder-toggle has-children expanded')
        : 'folder-toggle';

    // Build folder element using DOM API for XSS safety
    const folderLeft = document.createElement('div');
    folderLeft.className = 'folder-left';

    const toggleSpan = document.createElement('span');
    toggleSpan.className = toggleClass;
    toggleSpan.setAttribute('data-folder-id', folder.id);
    folderLeft.appendChild(toggleSpan);

    const folderNameDiv = document.createElement('div');
    folderNameDiv.className = 'folder-name';
    folderNameDiv.textContent = folder.name;
    folderLeft.appendChild(folderNameDiv);

    const rightDiv = document.createElement('div');
    rightDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'folder-actions';

    if (canAddChild) {
        const addBtn = document.createElement('button');
        addBtn.className = 'folder-btn add-subfolder-btn';
        addBtn.setAttribute('data-folder-id', folder.id);
        addBtn.title = i18n.getString('addSubfolder') || 'Add Subfolder';
        const addImg = document.createElement('img');
        addImg.src = 'images/add.svg';
        addImg.alt = 'Add';
        addBtn.appendChild(addImg);
        actionsDiv.appendChild(addBtn);
    }

    const renameBtn = document.createElement('button');
    renameBtn.className = 'folder-btn rename-folder-btn';
    renameBtn.setAttribute('data-folder-id', folder.id);
    const renameImg = document.createElement('img');
    renameImg.src = 'images/edit.svg';
    renameImg.alt = 'Edit';
    renameBtn.appendChild(renameImg);
    actionsDiv.appendChild(renameBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'folder-btn delete-folder-btn';
    deleteBtn.setAttribute('data-folder-id', folder.id);
    const deleteImg = document.createElement('img');
    deleteImg.src = 'images/delete.svg';
    deleteImg.alt = 'Delete';
    deleteBtn.appendChild(deleteImg);
    actionsDiv.appendChild(deleteBtn);

    rightDiv.appendChild(actionsDiv);

    const countDiv = document.createElement('div');
    countDiv.className = 'folder-count';
    countDiv.textContent = '0';
    rightDiv.appendChild(countDiv);

    folderElement.appendChild(folderLeft);
    folderElement.appendChild(rightDiv);

    folderElement.addEventListener('click', function(e) {
        // Don't select if clicking on toggle
        if (e.target.classList.contains('folder-toggle')) return;
        selectFolder(folder.id);
    });

    // Add event listener for collapse/expand toggle
    if (hasChildren) {
        toggleSpan.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleFolderCollapse(folder.id);
        });
    }

    // Add event listeners for rename and delete buttons
    renameBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        renameFolderDialog(folder.id);
    });

    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteFolder(folder.id);
    });

    if (canAddChild) {
        const addSubfolderBtn = actionsDiv.querySelector('.add-subfolder-btn');
        addSubfolderBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            showAddSubfolderModal(folder.id);
        });
    }

    // Folder drag and drop events
    folderElement.addEventListener('dragstart', handleFolderDragStart);
    folderElement.addEventListener('dragover', handleFolderDragOver);
    folderElement.addEventListener('dragleave', handleFolderDragLeave);
    folderElement.addEventListener('drop', handleFolderDrop);
    folderElement.addEventListener('dragend', handleFolderDragEnd);

    return folderElement;
}

// Toggle folder collapse state
async function toggleFolderCollapse(folderId) {
    const result = await chrome.storage.sync.get(['folders']);
    const folders = result.folders || [];
    const folder = folders.find(f => f.id === folderId);

    if (folder) {
        folder.collapsed = !folder.collapsed;
        await chrome.storage.sync.set({ folders: folders });

        // Partial DOM update: toggle icon and show/hide children
        const folderElement = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
        if (folderElement) {
            const toggleSpan = folderElement.querySelector('.folder-toggle');
            if (toggleSpan) {
                toggleSpan.className = folder.collapsed
                    ? 'folder-toggle has-children'
                    : 'folder-toggle has-children expanded';
            }

            const level = parseInt(folderElement.getAttribute('data-level')) || 0;
            const descendantIds = getAllDescendantIds(folders, folderId);

            if (folder.collapsed) {
                // Remove all descendant folder elements from DOM
                descendantIds.forEach(id => {
                    const childEl = document.querySelector(`.folder-item[data-folder-id="${id}"]`);
                    if (childEl) childEl.remove();
                });
            } else {
                // Re-render child folders after this element
                const tree = buildFolderTree(folders, folderId);
                let insertAfter = folderElement;
                const renderChildren = (children, lvl) => {
                    children.forEach(child => {
                        const childElement = createFolderElement(child, lvl, folders);
                        insertAfter.parentNode.insertBefore(childElement, insertAfter.nextSibling);
                        insertAfter = childElement;
                        if (child.children && child.children.length > 0 && !child.collapsed) {
                            renderChildren(child.children, lvl + 1);
                        }
                    });
                };
                renderChildren(tree, level + 1);
            }
        }
        updateFolderCounts();
    }
}

// Show add subfolder modal
function showAddSubfolderModal(parentId) {
    addSubfolderParentId = parentId;
    showModal('add-folder-modal');
    setTimeout(() => {
        document.getElementById('folder-name-input').focus();
    }, 100);
}

// Folder drag and drop handlers
function handleFolderDragStart(e) {
    draggedFolderElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-folder-id'));

    // Hide the tab dragging element if any
    draggedElement = null;
}

function handleFolderDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Check if this is a tab being dragged onto a folder
    const isTabDrag = e.dataTransfer.types.includes('application/tab-id');

    if (isTabDrag) {
        // Tab-to-folder drop: highlight the entire folder
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('drag-over-above', 'drag-over-below', 'drag-over-inside', 'tab-drop-target');
        });
        this.classList.add('tab-drop-target');
        return false;
    }

    if (!draggedFolderElement || this === draggedFolderElement) return;

    // Prevent dropping on or around uncategorized folder
    const targetId = this.getAttribute('data-folder-id');
    if (targetId === 'null') return;

    // Remove all drop indicators
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('drag-over-above', 'drag-over-below', 'drag-over-inside');
    });

    // Determine drop position based on mouse position
    const rect = this.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    if (y < height * 0.25) {
        this.classList.add('drag-over-above');
    } else if (y > height * 0.75) {
        this.classList.add('drag-over-below');
    } else {
        this.classList.add('drag-over-inside');
    }

    return false;
}

function handleFolderDragLeave(e) {
    this.classList.remove('drag-over-above', 'drag-over-below', 'drag-over-inside', 'tab-drop-target');
}

function handleFolderDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is a tab being dropped onto a folder
    const tabId = e.dataTransfer.getData('application/tab-id');
    if (tabId) {
        this.classList.remove('tab-drop-target');
        const targetFolderId = this.getAttribute('data-folder-id');
        const folderId = targetFolderId === 'null' ? null : targetFolderId;
        moveTabToFolder(tabId, folderId);
        return false;
    }

    if (!draggedFolderElement || this === draggedFolderElement) return;

    const draggedId = draggedFolderElement.getAttribute('data-folder-id');
    const targetId = this.getAttribute('data-folder-id');

    // Prevent dropping on uncategorized folder
    if (targetId === 'null') {
        this.classList.remove('drag-over-above', 'drag-over-below', 'drag-over-inside');
        return;
    }

    // Determine drop position
    const rect = this.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    let position;
    if (y < height * 0.25) {
        position = 'above';
    } else if (y > height * 0.75) {
        position = 'below';
    } else {
        position = 'inside';
    }

    // Remove drop indicators
    this.classList.remove('drag-over-above', 'drag-over-below', 'drag-over-inside');

    // Perform the move
    moveFolder(draggedId, targetId, position);

    return false;
}

function handleFolderDragEnd(e) {
    this.classList.remove('dragging');

    // Remove all drop indicators
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('drag-over-above', 'drag-over-below', 'drag-over-inside', 'tab-drop-target');
    });

    draggedFolderElement = null;
}

// Move folder to new position
async function moveFolder(draggedId, targetId, position) {
    const result = await chrome.storage.sync.get(['folders']);
    const folders = result.folders || [];

    const draggedFolder = folders.find(f => f.id === draggedId);
    const targetFolder = folders.find(f => f.id === targetId);

    if (!draggedFolder || !targetFolder) return;

    let newParentId;
    let newOrder;

    if (position === 'inside') {
        newParentId = targetId;

        if (!canMoveToParent(folders, draggedId, newParentId)) {
            showToast(i18n.getString('cannotMoveFolder') || 'Cannot move folder here (depth limit or cycle)', 'error');
            return;
        }

        const children = folders.filter(f => f.parentId === newParentId);
        newOrder = children.length > 0 ? Math.max(...children.map(f => f.order || 0)) + 1 : 0;

        targetFolder.collapsed = false;
    } else {
        newParentId = targetFolder.parentId;

        if (!canMoveToParent(folders, draggedId, newParentId)) {
            showToast(i18n.getString('cannotMoveFolder') || 'Cannot move folder here (depth limit or cycle)', 'error');
            return;
        }

        const siblings = folders
            .filter(f => f.parentId === newParentId && f.id !== draggedId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const targetIndex = siblings.findIndex(f => f.id === targetId);

        if (position === 'above') {
            newOrder = targetIndex >= 0 ? targetIndex : 0;
        } else {
            newOrder = targetIndex >= 0 ? targetIndex + 1 : siblings.length;
        }

        siblings.forEach((sibling, index) => {
            if (index >= newOrder) {
                sibling.order = index + 1;
            } else {
                sibling.order = index;
            }
        });
    }

    draggedFolder.parentId = newParentId;
    draggedFolder.order = newOrder;

    const allSiblings = folders
        .filter(f => f.parentId === newParentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    allSiblings.forEach((sibling, index) => {
        sibling.order = index;
    });

    await chrome.storage.sync.set({ folders: folders });
    loadFolders();
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
    addSubfolderParentId = null; // Reset to create root folder
    showModal('add-folder-modal');
    setTimeout(() => {
        document.getElementById('folder-name-input').focus();
    }, 100);
}

// Confirm add folder
function confirmAddFolder() {
    const name = document.getElementById('folder-name-input').value.trim();
    if (!name) return;
    if (name.length > 50) {
        showToast(i18n.getString('folderNameTooLong') || 'Folder name must be 50 characters or less', 'error');
        return;
    }
    addFolder(name, addSubfolderParentId);
    addSubfolderParentId = null;
    closeAllModals();
}

// Add new folder
async function addFolder(name, parentId = null) {
    const result = await chrome.storage.sync.get(['folders']);
    const folders = result.folders || [];

    const siblings = folders.filter(f => f.parentId === parentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order || 0)) + 1 : 0;

    const newFolder = {
        id: Date.now().toString(),
        name: name,
        parentId: parentId,
        order: maxOrder,
        collapsed: false
    };

    folders.push(newFolder);

    await chrome.storage.sync.set({ folders: folders });
    loadFolders();
}

// Show rename folder modal
async function renameFolderDialog(folderId) {
    const result = await chrome.storage.sync.get(['folders']);
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
}

// Confirm rename folder
function confirmRenameFolder() {
    const newName = document.getElementById('rename-folder-input').value.trim();
    if (!newName || !currentRenameFolderId) return;
    if (newName.length > 50) {
        showToast(i18n.getString('folderNameTooLong') || 'Folder name must be 50 characters or less', 'error');
        return;
    }
    if (currentRenameFolderId === 'uncategorized') {
        renameUncategorized(newName);
    } else {
        renameFolder(currentRenameFolderId, newName);
    }
    closeAllModals();
}

// Rename uncategorized folder
async function renameUncategorized(newName) {
    await chrome.storage.sync.set({ uncategorizedName: newName });
    document.getElementById('uncategorized-name').textContent = newName;
    updateUncategorizedNameInUI(newName);
}

// Rename folder
async function renameFolder(folderId, newName) {
    const result = await chrome.storage.sync.get(['folders']);
    const folders = result.folders || [];
    const folderIndex = folders.findIndex(f => f.id === folderId);

    if (folderIndex !== -1) {
        folders[folderIndex].name = newName;
        await chrome.storage.sync.set({ folders: folders });
        loadFolders();
    }
}

// Rename uncategorized folder
async function renameUncategorizedFolder() {
    const result = await chrome.storage.sync.get(['uncategorizedName']);
    const currentName = result.uncategorizedName || i18n.getString('uncategorized');

    currentRenameFolderId = 'uncategorized';
    document.getElementById('rename-folder-input').value = currentName;
    showModal('rename-folder-modal');
    setTimeout(() => {
        const input = document.getElementById('rename-folder-input');
        input.focus();
        input.select();
    }, 100);
}

// Show delete folder modal
async function deleteFolder(folderId) {
    currentDeleteFolderId = folderId;

    const result = await chrome.storage.sync.get(['folders']);
    const folders = result.folders || [];
    const hasSubfolders = folders.some(f => f.parentId === folderId);

    const warningElement = document.getElementById('delete-folder-warning');
    if (hasSubfolders) {
        warningElement.textContent = i18n.getString('deleteFolderWithSubfoldersWarning') ||
            'All subfolders will also be deleted. Tabs in deleted folders will be moved to uncategorized.';
    } else {
        warningElement.textContent = i18n.getString('deleteFolderWarning') ||
            'Tabs in this folder will be moved to uncategorized.';
    }

    showModal('delete-folder-modal');
}

// Confirm delete folder
function confirmDeleteFolder() {
    if (currentDeleteFolderId) {
        performDeleteFolder(currentDeleteFolderId);
        closeAllModals();
    }
}

// Perform folder deletion (including subfolders)
async function performDeleteFolder(folderId) {
    const result = await chrome.storage.sync.get(['folders', 'dataKeys']);
    const folders = result.folders || [];
    const dataKeys = result.dataKeys || [];

    const descendantIds = getAllDescendantIds(folders, folderId);
    const allFolderIdsToDelete = [folderId, ...descendantIds];

    const updatedFolders = folders.filter(f => !allFolderIdsToDelete.includes(f.id));

    const updateData = { folders: updatedFolders };

    if (dataKeys.length > 0) {
        const tabsData = await chrome.storage.sync.get(dataKeys);

        dataKeys.forEach(key => {
            const tab = tabsData[key];
            if (tab && allFolderIdsToDelete.includes(tab.folderId)) {
                tab.folderId = null;
                updateData[key] = tab;
            }
        });
    }

    await chrome.storage.sync.set(updateData);
    loadFolders();
    allFolderIdsToDelete.forEach(id => updateAllFolderSelectsAfterDeletion(id));
    if (allFolderIdsToDelete.includes(currentFolderId)) {
        selectFolder(null);
    } else if (currentFolderId === null) {
        loadAllMarkedTabs();
    }
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
async function updateFolderCounts() {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    if (dataKeys.length === 0) {
        document.querySelectorAll('.folder-count').forEach(el => {
            el.textContent = '0';
        });
        return;
    }

    const tabsData = await chrome.storage.sync.get(dataKeys);
    const folderCounts = {};

    dataKeys.forEach(key => {
        const tab = tabsData[key];
        if (tab) {
            const folderId = tab.folderId || 'null';
            folderCounts[folderId] = (folderCounts[folderId] || 0) + 1;
        }
    });

    document.querySelectorAll('.folder-item').forEach(item => {
        const folderId = item.getAttribute('data-folder-id');
        const count = folderCounts[folderId] || 0;
        const countElement = item.querySelector('.folder-count');
        if (countElement) {
            countElement.textContent = count;
        }
    });
}

async function loadAllMarkedTabs() {
    const tabList = document.getElementById('tab-list');
    tabList.innerHTML = '';

    // Check for and migrate old format and folder support, then cleanup duplicates
    await migrateFromMarkedTabs();
    await migrateToFolderSupport();
    await cleanupDuplicateDataKeys();

    const result = await chrome.storage.sync.get(['dataKeys']);
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

        document.getElementById('open-options').addEventListener('click', function() {
            chrome.runtime.openOptionsPage();
        });
        updateFolderCounts();
        return;
    }

    // Get all tab data using the dataKeys
    const tabsData = await chrome.storage.sync.get(dataKeys);
    let allTabs = dataKeys.map(key => tabsData[key]).filter(tab => tab);

    // Filter tabs by current folder
    if (currentFolderId !== null) {
        allTabs = allTabs.filter(tab => tab.folderId === currentFolderId);
    } else {
        allTabs = allTabs.filter(tab => !tab.folderId || tab.folderId === null);
    }

    // Sort tabs by order (if exists) or timestamp
    allTabs.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : new Date(a.timestamp).getTime();
        const orderB = b.order !== undefined ? b.order : new Date(b.timestamp).getTime();
        return orderA - orderB;
    });

    if (allTabs.length === 0) {
        tabList.innerHTML = `<div class="no-tabs">${i18n.getString('noTabsInFolder')}</div>`;
        updateFolderCounts();
        return;
    }
                
    allTabs.forEach((tab, index) => {
        // Ensure locked property exists for backward compatibility
        if (tab.locked === undefined) {
            tab.locked = false;
        }

        // Ensure order property exists for drag and drop
        if (tab.order === undefined) {
            tab.order = index;
        }

        const tabElement = document.createElement('div');
        tabElement.className = 'tab-item';
        tabElement.setAttribute('draggable', 'true');
        tabElement.setAttribute('data-tab-id', String(tab.id));

        // Format the date
        const date = new Date(tab.timestamp);
        const formattedDate = date.toLocaleString();

        const uncategorizedName = i18n.getString('uncategorized') || 'Uncategorized';

        // Build tab element using DOM API for XSS safety
        const tabInfo = document.createElement('div');
        tabInfo.className = 'tab-info';
        tabInfo.setAttribute('data-url', tab.url);
        tabInfo.style.cursor = 'pointer';

        const tabTitleEl = document.createElement('div');
        tabTitleEl.className = 'tab-title';
        tabTitleEl.textContent = tab.title;

        const tabUrlEl = document.createElement('div');
        tabUrlEl.className = 'tab-url';
        tabUrlEl.textContent = tab.url;

        const timestampEl = document.createElement('div');
        timestampEl.className = 'timestamp';
        timestampEl.textContent = formattedDate;

        tabInfo.appendChild(tabTitleEl);
        tabInfo.appendChild(tabUrlEl);
        tabInfo.appendChild(timestampEl);

        const tabControls = document.createElement('div');
        tabControls.className = 'tab-controls';

        const folderSelect = document.createElement('select');
        folderSelect.className = 'folder-select';
        folderSelect.setAttribute('data-id', String(tab.id));
        const defaultOption = document.createElement('option');
        defaultOption.value = 'null';
        defaultOption.textContent = uncategorizedName;
        folderSelect.appendChild(defaultOption);

        const copyIcon = document.createElement('img');
        copyIcon.className = 'copy-icon';
        copyIcon.src = 'images/copy.svg';
        copyIcon.alt = 'Copy';
        copyIcon.title = i18n.getString('copyButton');
        copyIcon.setAttribute('data-id', String(tab.id));

        const lockIcon = document.createElement('img');
        lockIcon.className = 'lock-icon' + (tab.locked ? ' locked' : '');
        lockIcon.src = 'images/' + (tab.locked ? 'lock' : 'unlock') + '.svg';
        lockIcon.alt = tab.locked ? 'Locked' : 'Unlocked';
        lockIcon.setAttribute('data-id', String(tab.id));

        const editIcon = document.createElement('img');
        editIcon.className = 'edit-icon';
        editIcon.src = 'images/edit.svg';
        editIcon.alt = 'Edit';
        editIcon.title = i18n.getString('editTab');
        editIcon.setAttribute('data-id', String(tab.id));

        const deleteIcon = document.createElement('img');
        deleteIcon.className = 'delete-icon';
        deleteIcon.src = 'images/delete.svg';
        deleteIcon.alt = 'Delete';
        deleteIcon.title = i18n.getString('deleteButton');
        deleteIcon.setAttribute('data-id', String(tab.id));
        if (tab.locked) deleteIcon.style.display = 'none';

        tabControls.appendChild(folderSelect);
        tabControls.appendChild(copyIcon);
        tabControls.appendChild(lockIcon);
        tabControls.appendChild(editIcon);
        tabControls.appendChild(deleteIcon);

        tabElement.appendChild(tabInfo);
        tabElement.appendChild(tabControls);

        // Add click event to open the tab
        tabInfo.addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            chrome.tabs.create({ url: url });
        });

        // Add lock toggle functionality
        lockIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleLock(tab.id);
        });

        // Add edit icon functionality
        editIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            editTab(tab.id);
        });

        deleteIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteTab(tab.id);
        });

        // Add copy icon functionality
        copyIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            copySingleTab(tab.title, tab.url);
        });

        // Add folder select functionality
        populateFolderSelect(folderSelect, tab.folderId);
        folderSelect.addEventListener('change', function(e) {
            e.stopPropagation();
            moveTabToFolder(tab.id, this.value === 'null' ? null : this.value);
        });

        // Add drag and drop functionality
        tabElement.addEventListener('dragstart', handleDragStart);
        tabElement.addEventListener('dragover', handleDragOver);
        tabElement.addEventListener('drop', handleDrop);
        tabElement.addEventListener('dragend', handleDragEnd);
        tabElement.addEventListener('dragleave', handleDragLeave);

        tabList.appendChild(tabElement);
    });

    updateFolderCounts();
}

async function deleteTab(tabId) {
    // Find and remove the tab element from DOM first
    const tabElement = document.querySelector(`[data-id="${tabId}"]`).closest('.tab-item');

    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    // Find which key contains the tab with the given ID
    const tabsData = await chrome.storage.sync.get(dataKeys);
    const keyToRemove = dataKeys.find(key => tabsData[key] && String(tabsData[key].id) === String(tabId));

    if (!keyToRemove) {
        return;
    }

    // Create updated dataKeys array without the removed key
    const updatedDataKeys = dataKeys.filter(key => key !== keyToRemove);

    // Remove the tab data and update the dataKeys array
    await chrome.storage.sync.remove([keyToRemove]);
    await chrome.storage.sync.set({ dataKeys: updatedDataKeys });

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
}

// Populate folder select dropdown (with tree hierarchy)
async function populateFolderSelect(selectElement, currentFolderId) {
    const result = await chrome.storage.sync.get(['folders', 'uncategorizedName']);
    const folders = result.folders || [];
    const uncategorizedName = result.uncategorizedName || i18n.getString('uncategorized');

    // Clear existing options except the first one (未分類)
    selectElement.innerHTML = `<option value="null">${uncategorizedName}</option>`;

    // Build tree and add options with indentation
    const tree = buildFolderTree(folders);
    addFolderOptionsToSelectRecursive(selectElement, tree, 0);

    // Set current value
    selectElement.value = currentFolderId || 'null';
}

// Add folder options to select element recursively with indentation
function addFolderOptionsToSelectRecursive(selectElement, tree, level) {
    tree.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        // Add indentation prefix for hierarchy
        const indent = level > 0 ? '\u00A0\u00A0'.repeat(level) + '\u2514\u00A0' : '';
        option.textContent = indent + folder.name;
        selectElement.appendChild(option);

        // Add children recursively
        if (folder.children && folder.children.length > 0) {
            addFolderOptionsToSelectRecursive(selectElement, folder.children, level + 1);
        }
    });
}

// Move tab to folder
async function moveTabToFolder(tabId, folderId) {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    const tabsData = await chrome.storage.sync.get(dataKeys);
    const keyToUpdate = dataKeys.find(key => tabsData[key] && String(tabsData[key].id) === String(tabId));

    if (!keyToUpdate) {
        return;
    }

    const tab = tabsData[keyToUpdate];
    const oldFolderId = tab.folderId;
    tab.folderId = folderId;

    await chrome.storage.sync.set({ [keyToUpdate]: tab });

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
async function loadUncategorizedName() {
    const result = await chrome.storage.sync.get(['uncategorizedName']);
    const customName = result.uncategorizedName;
    if (customName) {
        document.getElementById('uncategorized-name').textContent = customName;
        updateUncategorizedNameInUI(customName);
    } else {
        const defaultName = i18n.getString('uncategorized');
        document.getElementById('uncategorized-name').textContent = defaultName;
        updateUncategorizedNameInUI(defaultName);
    }
}

async function toggleLock(tabId) {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    // Find which key contains the tab with the given ID
    const tabsData = await chrome.storage.sync.get(dataKeys);
    const keyToUpdate = dataKeys.find(key => tabsData[key] && String(tabsData[key].id) === String(tabId));

    if (!keyToUpdate) {
        return;
    }

    // Toggle the locked state
    const tab = tabsData[keyToUpdate];
    tab.locked = !tab.locked;

    // Update the storage and save the locked state properly
    await chrome.storage.sync.set({ [keyToUpdate]: tab });

    // Partial DOM update instead of full reload
    const tabElement = document.querySelector(`[data-tab-id="${String(tabId)}"]`);
    if (tabElement) {
        const lockIcon = tabElement.querySelector('.lock-icon');
        const deleteIcon = tabElement.querySelector('.delete-icon');
        if (lockIcon) {
            lockIcon.src = 'images/' + (tab.locked ? 'lock' : 'unlock') + '.svg';
            lockIcon.alt = tab.locked ? 'Locked' : 'Unlocked';
            lockIcon.className = 'lock-icon' + (tab.locked ? ' locked' : '');
        }
        if (deleteIcon) {
            deleteIcon.style.display = tab.locked ? 'none' : '';
        }
    }
}

// Get currently displayed tabs
async function getCurrentlyDisplayedTabs() {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    if (dataKeys.length === 0) {
        return [];
    }

    // Get all tab data using the dataKeys
    const tabsData = await chrome.storage.sync.get(dataKeys);
    let allTabs = dataKeys.map(key => tabsData[key]).filter(tab => tab);

    // Filter tabs by current folder
    if (currentFolderId !== null) {
        allTabs = allTabs.filter(tab => tab.folderId === currentFolderId);
    } else {
        allTabs = allTabs.filter(tab => !tab.folderId || tab.folderId === null);
    }

    // Sort tabs by timestamp (newest first)
    allTabs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return allTabs;
}

// Copy URLs only
async function copyURLsOnly() {
    const tabs = await getCurrentlyDisplayedTabs();
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
}

// Copy titles and URLs
async function copyTitlesAndURLs() {
    const tabs = await getCurrentlyDisplayedTabs();
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
}

// Edit tab
async function editTab(tabId) {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    const tabsData = await chrome.storage.sync.get(dataKeys);
    const keyToEdit = dataKeys.find(key => tabsData[key] && String(tabsData[key].id) === String(tabId));

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
}

// Confirm edit tab
async function confirmEditTab() {
    if (!currentEditTabId) {
        return;
    }

    const newTitle = document.getElementById('edit-tab-title-input').value.trim();
    const newUrl = document.getElementById('edit-tab-url-input').value.trim();

    if (!newTitle || !newUrl) {
        return;
    }

    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    const tabsData = await chrome.storage.sync.get(dataKeys);
    const keyToUpdate = dataKeys.find(key => tabsData[key] && String(tabsData[key].id) === String(currentEditTabId));

    if (!keyToUpdate) {
        return;
    }

    const tab = tabsData[keyToUpdate];
    tab.title = newTitle;
    tab.url = newUrl;

    await chrome.storage.sync.set({ [keyToUpdate]: tab });
    closeAllModals();

    // Partial DOM update instead of full reload
    const tabElement = document.querySelector(`[data-tab-id="${String(currentEditTabId)}"]`);
    if (tabElement) {
        const titleEl = tabElement.querySelector('.tab-title');
        const urlEl = tabElement.querySelector('.tab-url');
        const tabInfo = tabElement.querySelector('.tab-info');
        if (titleEl) titleEl.textContent = newTitle;
        if (urlEl) urlEl.textContent = newUrl;
        if (tabInfo) tabInfo.setAttribute('data-url', newUrl);
    }
}

// Show toast notification
function showToast(message, type = 'success', duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;

    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Hide toast after duration
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Copy single tab title and URL
function copySingleTab(title, url) {
    const content = `${title}\n${url}`;
    const textarea = document.getElementById('copy-textarea');
    textarea.value = content;
    textarea.select();
    document.execCommand('copy');

    // Show toast notification
    showToast(i18n.getString('copied') || 'Copied!', 'success');
}

// Drag and drop event handlers
function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    e.dataTransfer.setData('application/tab-id', this.getAttribute('data-tab-id'));
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }

    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (draggedElement !== this) {
        // Get the dragged tab ID and the target tab ID
        const draggedId = draggedElement.getAttribute('data-tab-id');
        const targetId = this.getAttribute('data-tab-id');

        // Reorder tabs in storage
        reorderTabs(draggedId, targetId);
    }

    this.classList.remove('drag-over');

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');

    // Remove drag-over class from all items
    document.querySelectorAll('.tab-item').forEach(item => {
        item.classList.remove('drag-over');
    });

    // Remove tab-drop-target from folder items
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('tab-drop-target');
    });

    draggedElement = null;
}

// Reorder tabs in storage
async function reorderTabs(draggedId, targetId) {
    const result = await chrome.storage.sync.get(['dataKeys']);
    const dataKeys = result.dataKeys || [];

    const tabsData = await chrome.storage.sync.get(dataKeys);
    // Get all tabs for the current folder
    let allTabs = dataKeys.map(key => ({ key, ...tabsData[key] })).filter(tab => tab.id);

    // Filter tabs by current folder
    if (currentFolderId !== null) {
        allTabs = allTabs.filter(tab => tab.folderId === currentFolderId);
    } else {
        allTabs = allTabs.filter(tab => !tab.folderId || tab.folderId === null);
    }

    // Sort by current order or timestamp
    allTabs.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : new Date(a.timestamp).getTime();
        const orderB = b.order !== undefined ? b.order : new Date(b.timestamp).getTime();
        return orderA - orderB;
    });

    // Find the positions of dragged and target tabs
    const draggedIndex = allTabs.findIndex(tab => String(tab.id) === String(draggedId));
    const targetIndex = allTabs.findIndex(tab => String(tab.id) === String(targetId));

    if (draggedIndex === -1 || targetIndex === -1) {
        return;
    }

    // Move the dragged tab to the target position
    const [draggedTab] = allTabs.splice(draggedIndex, 1);
    allTabs.splice(targetIndex, 0, draggedTab);

    // Update order for all tabs in the current folder
    const updateData = {};
    allTabs.forEach((tab, index) => {
        tab.order = index;
        updateData[tab.key] = {
            id: tab.id,
            title: tab.title,
            url: tab.url,
            timestamp: tab.timestamp,
            locked: tab.locked,
            folderId: tab.folderId,
            order: tab.order,
            html: tab.html
        };
    });

    // Save the updated order
    await chrome.storage.sync.set(updateData);

    // DOM move instead of full reload
    const tabList = document.getElementById('tab-list');
    const draggedEl = tabList.querySelector(`[data-tab-id="${String(draggedId)}"]`);
    const targetEl = tabList.querySelector(`[data-tab-id="${String(targetId)}"]`);
    if (draggedEl && targetEl) {
        if (draggedIndex < targetIndex) {
            // Moving down: insert after target
            targetEl.parentNode.insertBefore(draggedEl, targetEl.nextSibling);
        } else {
            // Moving up: insert before target
            targetEl.parentNode.insertBefore(draggedEl, targetEl);
        }
    }
}
