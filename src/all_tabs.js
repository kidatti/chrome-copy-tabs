let currentFolderId = CopyTabsView.ALL_FOLDERS;
let searchQuery = '';
let sortMode = 'newest';
let visibleTabs = [];
const selectedTabIds = new Set();
let managerReady = false;
let operationInProgress = false;
let loadVersion = 0;
let refreshTimer;
let toastTimer;
let lastDeletion = null;
let currentDeleteTabIds = [];
let modalReturnFocus = null;
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
    try { await initializeUI(); }
    catch (error) { console.error(error); showToast(text('operationFailed'), 'error'); }
});

function text(key, values = {}) {
    return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), i18n.getString(key));
}

function updateManagerTexts() {
    document.documentElement.lang = getUserLanguage();
    document.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = i18n.getString(element.dataset.i18n);
    });
    document.title = `CopyTabs · ${text('savedPages')}`;
    document.getElementById('add-folder-btn').textContent = text('addFolder');
    document.getElementById('tab-search').placeholder = text('searchPages');
    document.getElementById('settingsIcon').setAttribute('aria-label', text('settingsTitle'));
    document.querySelector('.rename-uncategorized-btn').setAttribute('aria-label', text('renameFolderTitle'));
    document.querySelectorAll('.modal-close').forEach(button => button.setAttribute('aria-label', text('closeDialog')));
    document.getElementById('folder-list').setAttribute('aria-label', text('folders'));
    initializeModalTexts();
}

async function initializeUI() {
    updateManagerTexts();
    initializeFolderManagement();
    initializeModals();
    document.getElementById('all-folders').addEventListener('click', () => selectFolder(CopyTabsView.ALL_FOLDERS));
    const uncategorized = document.querySelector('.folder-item[data-folder-id="null"]');
    uncategorized.addEventListener('click', () => selectFolder(null));
    uncategorized.addEventListener('dragover', function(e) {
        if (e.dataTransfer.types.includes('application/tab-id')) {
            e.preventDefault();
            this.classList.add('tab-drop-target');
        }
    });
    uncategorized.addEventListener('dragleave', handleFolderDragLeave);
    uncategorized.addEventListener('drop', handleFolderDrop);
    document.querySelector('.rename-uncategorized-btn').addEventListener('click', e => {
        e.stopPropagation();
        renameUncategorizedFolder();
    });
    document.getElementById('settingsIcon').addEventListener('click', () => chrome.runtime.openOptionsPage());
    document.getElementById('copy-pages').addEventListener('click', copyPages);
    document.getElementById('tab-search').addEventListener('input', function() {
        searchQuery = this.value;
        selectedTabIds.clear();
        if (searchQuery.trim() && sortMode === 'manual') setSortMode('newest');
        loadAllMarkedTabs();
    });
    document.getElementById('sort-select').addEventListener('change', function() {
        setSortMode(this.value);
        loadAllMarkedTabs();
    });
    document.getElementById('select-all').addEventListener('change', function() {
        visibleTabs.forEach(tab => this.checked ? selectedTabIds.add(String(tab.id)) : selectedTabIds.delete(String(tab.id)));
        document.querySelectorAll('.tab-checkbox').forEach(box => {
            box.checked = selectedTabIds.has(box.dataset.id);
            box.closest('.tab-item').classList.toggle('selected', box.checked);
        });
        updateSelectionState();
    });
    document.getElementById('bulk-move').addEventListener('click', () => moveSelectedTabs());
    document.getElementById('bulk-delete').addEventListener('click', showDeleteTabsModal);
    document.getElementById('delete-tabs-cancel').addEventListener('click', closeAllModals);
    document.getElementById('delete-tabs-confirm').addEventListener('click', () => {
        const ids = [...currentDeleteTabIds];
        closeAllModals();
        deleteTabs(ids);
    });
    await migrateFromMarkedTabs();
    await migrateToFolderSupport();
    await cleanupDuplicateDataKeys();
    await loadFolders();
    await loadUncategorizedName();
    managerReady = true;
    await loadAllMarkedTabs();
}

function setSortMode(mode) {
    sortMode = mode;
    document.getElementById('sort-select').value = mode;
}

// Refresh both the index and content when another extension window changes data.
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace !== 'sync' || !managerReady) return;
    if (changes.language) {
        i18n.setLanguage(changes.language.newValue || 'auto');
        updateManagerTexts();
    }
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
        try {
            await loadFolders();
            await loadUncategorizedName();
            await loadAllMarkedTabs();
        } catch (error) {
            showToast(text('operationFailed'), 'error');
            console.error(error);
        }
    }, 80);
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
        if (e.key === 'Tab') {
            const modal = document.querySelector('.modal.show');
            if (!modal) return;
            const controls = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')];
            const first = controls[0], last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
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
    modalReturnFocus = document.activeElement;
    document.getElementById('modal-overlay').classList.add('show');
    const modal = document.getElementById(modalId);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', modal.querySelector('h3').id);
    modal.classList.add('show');
    document.querySelector('.container').inert = true;
    document.querySelector('.app-header').inert = true;
    (modal.querySelector('input') || modal.querySelector('.modal-btn.cancel') || modal.querySelector('button'))?.focus();
}

function closeAllModals() {
    if (!document.getElementById('modal-overlay').classList.contains('show')) return;
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
    currentDeleteTabIds = [];
    document.querySelector('.container').inert = false;
    document.querySelector('.app-header').inert = false;
    if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
    modalReturnFocus = null;
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

    const result = await chrome.storage.sync.get(null);
    const folders = result.folders || [];
    const folderList = document.getElementById('folder-list');

    // Clear existing folders (except "未分類")
    const uncategorized = folderList.querySelector('[data-folder-id="null"]');
    folderList.innerHTML = '';
    folderList.appendChild(uncategorized);

    // Build and render tree structure
    const tree = buildFolderTree(folders);
    renderFolderTree(tree, folderList, 0, folders);
    document.querySelectorAll('.folder-item').forEach(item => item.classList.toggle('active', item.dataset.folderId === String(currentFolderId)));
    const destination = document.getElementById('bulk-folder-select');
    const previousValue = destination.value;
    populateFolderSelect(destination, folders.some(folder => folder.id === previousValue) ? previousValue : null, result);
    updateFolderCounts(result);
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

    const toggleSpan = document.createElement(hasChildren ? 'button' : 'span');
    if (hasChildren) {
        toggleSpan.type = 'button';
        toggleSpan.setAttribute('aria-label', folder.name);
        toggleSpan.setAttribute('aria-expanded', String(!folder.collapsed));
    }
    toggleSpan.className = toggleClass;
    toggleSpan.setAttribute('data-folder-id', folder.id);
    folderLeft.appendChild(toggleSpan);

    const folderNameDiv = document.createElement('button');
    folderNameDiv.type = 'button';
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
        addBtn.title = i18n.getString('addSubfolder');
        addBtn.setAttribute('aria-label', addBtn.title);
        const addImg = document.createElement('img');
        addImg.src = 'images/add.svg';
        addImg.alt = 'Add';
        addBtn.appendChild(addImg);
        actionsDiv.appendChild(addBtn);
    }

    const renameBtn = document.createElement('button');
    renameBtn.className = 'folder-btn rename-folder-btn';
    renameBtn.setAttribute('data-folder-id', folder.id);
    renameBtn.setAttribute('aria-label', text('renameFolderTitle'));
    const renameImg = document.createElement('img');
    renameImg.src = 'images/edit.svg';
    renameImg.alt = 'Edit';
    renameBtn.appendChild(renameImg);
    actionsDiv.appendChild(renameBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'folder-btn delete-folder-btn';
    deleteBtn.setAttribute('data-folder-id', folder.id);
    deleteBtn.setAttribute('aria-label', text('deleteFolderTitle'));
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
                toggleSpan.setAttribute('aria-expanded', String(!folder.collapsed));
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
    selectedTabIds.clear();
    if (folderId === CopyTabsView.ALL_FOLDERS && sortMode === 'manual') setSortMode('newest');
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
    } else {
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
async function updateFolderCounts(suppliedStorage) {
    const storage = suppliedStorage || await chrome.storage.sync.get(null);
    const tabs = [...new Set(storage.dataKeys || [])].map(key => storage[key]).filter(tab => tab && tab.url && tab.id !== undefined);
    const counts = {};
    tabs.forEach(tab => {
        const folder = tab.folderId || 'null';
        counts[folder] = (counts[folder] || 0) + 1;
    });
    document.querySelectorAll('.folder-item').forEach(item => {
        const count = item.querySelector('.folder-count');
        if (count) count.textContent = item.dataset.folderId === CopyTabsView.ALL_FOLDERS ? tabs.length : (counts[item.dataset.folderId] || 0);
    });
}

function viewOptions() {
    return { folderId: currentFolderId, query: searchQuery, sort: sortMode };
}

function canReorderTabs() {
    return currentFolderId !== CopyTabsView.ALL_FOLDERS && sortMode === 'manual' && !searchQuery.trim();
}

async function loadAllMarkedTabs() {
    const version = ++loadVersion;
    try {
        const storage = await chrome.storage.sync.get(null);
        if (version !== loadVersion) return;
        const folders = storage.folders || [];
        if (currentFolderId !== null && currentFolderId !== CopyTabsView.ALL_FOLDERS && !folders.some(f => f.id === currentFolderId)) {
            currentFolderId = CopyTabsView.ALL_FOLDERS;
            selectedTabIds.clear();
            setSortMode('newest');
        }
        const allTabs = [...new Set(storage.dataKeys || [])].map(key => storage[key]).filter(tab => tab && tab.url && tab.id !== undefined);
        visibleTabs = CopyTabsView.visibleTabs(allTabs, viewOptions());
        const visibleIds = new Set(visibleTabs.map(tab => String(tab.id)));
        [...selectedTabIds].forEach(id => { if (!visibleIds.has(id)) selectedTabIds.delete(id); });
        const folderName = currentFolderId === CopyTabsView.ALL_FOLDERS ? text('savedPages')
            : currentFolderId === null ? (storage.uncategorizedName || text('uncategorized'))
            : folders.find(f => f.id === currentFolderId).name;
        document.getElementById('view-title').textContent = folderName;
        document.getElementById('result-count').textContent = text('pageCount', { count: visibleTabs.length });
        document.querySelectorAll('.folder-item').forEach(item => {
            const active = item.dataset.folderId === String(currentFolderId);
            item.classList.toggle('active', active);
            const trigger = item.matches('button') ? item : item.querySelector('.folder-name');
            if (trigger) {
                if (active) trigger.setAttribute('aria-current', 'page');
                else trigger.removeAttribute('aria-current');
            }
        });
        const manualOption = document.querySelector('#sort-select option[value="manual"]');
        manualOption.disabled = currentFolderId === CopyTabsView.ALL_FOLDERS || !!searchQuery.trim();
        document.getElementById('view-hint').textContent = text(canReorderTabs() ? 'manualSortHint'
            : currentFolderId === CopyTabsView.ALL_FOLDERS ? 'allPagesHint' : 'folderDropHint');
        const tabList = document.getElementById('tab-list');
        tabList.replaceChildren();
        if (!visibleTabs.length) {
            const empty = document.createElement('div');
            empty.className = 'no-tabs';
            empty.textContent = text(searchQuery.trim() ? 'noSearchResults' : allTabs.length ? 'noTabsInFolder' : 'emptySavedPages');
            tabList.appendChild(empty);
        }
        visibleTabs.forEach(tab => tabList.appendChild(createTabElement(tab, storage)));
        updateFolderCounts(storage);
        updateSelectionState();
    } catch (error) {
        if (version === loadVersion) showToast(text('operationFailed'), 'error');
        console.error(error);
    }
}

function createTabElement(tab, storage) {
    const row = document.createElement('div');
    row.className = 'tab-item' + (selectedTabIds.has(String(tab.id)) ? ' selected' : '');
    row.dataset.tabId = String(tab.id);
    // Dragging to folders remains available in all sort modes.
    row.draggable = true;
    const selection = document.createElement('label');
    selection.className = 'tab-checkbox-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tab-checkbox';
    checkbox.dataset.id = String(tab.id);
    checkbox.checked = selectedTabIds.has(String(tab.id));
    checkbox.setAttribute('aria-label', text('selectPage', { title: tab.title || tab.url }));
    selection.appendChild(checkbox);
    checkbox.addEventListener('change', () => {
        checkbox.checked ? selectedTabIds.add(String(tab.id)) : selectedTabIds.delete(String(tab.id));
        row.classList.toggle('selected', checkbox.checked);
        updateSelectionState();
    });
    const info = document.createElement('a');
    info.className = 'tab-info';
    const safe = isSafePageUrl(tab.url);
    info.href = safe ? tab.url : '#';
    info.addEventListener('click', e => {
        e.preventDefault();
        if (safe) chrome.tabs.create({ url: tab.url });
        else showToast(text('operationFailed'), 'error');
    });
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title || tab.url;
    const url = document.createElement('div');
    url.className = 'tab-url';
    url.textContent = tab.url;
    const meta = document.createElement('div');
    meta.className = 'tab-meta';
    const folder = document.createElement('span');
    folder.className = 'tab-folder';
    folder.textContent = (storage.folders || []).find(f => f.id === tab.folderId)?.name || storage.uncategorizedName || text('uncategorized');
    const date = document.createElement('time');
    date.className = 'timestamp';
    if (Number.isFinite(Date.parse(tab.timestamp))) {
        date.dateTime = tab.timestamp;
        date.textContent = new Date(tab.timestamp).toLocaleString(getUserLanguage());
    }
    meta.append(folder, date);
    if (tab.locked) {
        const locked = document.createElement('span');
        locked.textContent = text('protectedPage');
        meta.appendChild(locked);
    }
    info.append(title, url, meta);
    const controls = document.createElement('div');
    controls.className = 'tab-controls';
    const destination = document.createElement('select');
    destination.className = 'folder-select';
    destination.setAttribute('aria-label', text('moveDestination'));
    populateFolderSelect(destination, tab.folderId, storage);
    destination.addEventListener('change', () => moveTabToFolder(tab.id, destination.value === 'null' ? null : destination.value));
    controls.appendChild(destination);
    controls.appendChild(tabAction('copy-icon', 'copy', text('copyButton'), () => copySingleTab(tab.title, tab.url)));
    const lock = tabAction('lock-icon' + (tab.locked ? ' locked' : ''), tab.locked ? 'lock' : 'unlock', text(tab.locked ? 'unprotectPage' : 'protectPage'), () => toggleLock(tab.id));
    lock.setAttribute('aria-pressed', String(!!tab.locked));
    controls.appendChild(lock);
    controls.appendChild(tabAction('edit-icon', 'edit', text('editTab'), () => editTab(tab.id)));
    const remove = tabAction('delete-icon', 'delete', text('deleteButton'), () => deleteTab(tab.id));
    remove.hidden = !!tab.locked;
    controls.appendChild(remove);
    row.append(selection, info, controls);
    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('drop', handleDrop);
    row.addEventListener('dragend', handleDragEnd);
    row.addEventListener('dragleave', handleDragLeave);
    return row;
}

function isSafePageUrl(url) {
    try { return ['http:', 'https:', 'file:', 'chrome:', 'chrome-extension:', 'about:'].includes(new URL(url).protocol); }
    catch { return false; }
}

function tabAction(className, image, label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab-action ' + className;
    button.setAttribute('aria-label', label);
    button.title = label;
    const icon = document.createElement('img');
    icon.src = `images/${image}.svg`;
    icon.alt = '';
    button.appendChild(icon);
    button.addEventListener('click', e => { e.stopPropagation(); action(); });
    return button;
}

function updateSelectionState() {
    const count = visibleTabs.filter(tab => selectedTabIds.has(String(tab.id))).length;
    const all = document.getElementById('select-all');
    all.checked = visibleTabs.length > 0 && count === visibleTabs.length;
    all.indeterminate = count > 0 && count < visibleTabs.length;
    all.disabled = !visibleTabs.length || operationInProgress;
    document.getElementById('selection-count').textContent = text('selectedCount', { count });
    document.getElementById('copy-pages').textContent = text(count ? 'copySelected' : 'copyDisplayed', { count: count || visibleTabs.length });
    document.getElementById('copy-pages').disabled = !visibleTabs.length || operationInProgress;
    document.getElementById('bulk-toolbar').hidden = !count;
    document.getElementById('bulk-move').disabled = operationInProgress;
    document.getElementById('bulk-delete').disabled = operationInProgress || !visibleTabs.some(tab => selectedTabIds.has(String(tab.id)) && !tab.locked);
}

async function runManagerOperation(operation) {
    if (operationInProgress) return;
    operationInProgress = true;
    updateSelectionState();
    try { await operation(); }
    catch (error) { console.error(error); showToast(text('operationFailed'), 'error'); }
    finally { operationInProgress = false; await loadAllMarkedTabs(); }
}

async function showDeleteTabsModal() {
    try {
        const storage = await chrome.storage.sync.get(null);
        const ids = visibleTabs.filter(tab => selectedTabIds.has(String(tab.id))).map(tab => String(tab.id));
        const plan = CopyTabsView.deletePlan(storage, ids);
        if (!Object.keys(plan.removed).length) return showToast(text('onlyLockedSelected'), 'error');
        currentDeleteTabIds = Object.values(plan.removed).map(tab => String(tab.id));
        document.getElementById('delete-tabs-message').textContent = text('confirmDeletePages', { count: currentDeleteTabIds.length });
        showModal('delete-tabs-modal');
    } catch (error) { console.error(error); showToast(text('operationFailed'), 'error'); }
}

async function deleteTab(tabId) {
    return deleteTabs([String(tabId)]);
}

async function deleteTabs(ids) {
    return runManagerOperation(async () => {
        const storage = await chrome.storage.sync.get(null);
        const plan = CopyTabsView.deletePlan(storage, ids);
        const keys = Object.keys(plan.removed);
        if (!keys.length) return showToast(text('onlyLockedSelected'), 'error');
        // Remove the index first so a failed write never leaves dangling indexed tabs.
        await chrome.storage.sync.set({ dataKeys: plan.dataKeys });
        lastDeletion = { removed: plan.removed, expiresAt: Date.now() + 10000 };
        try { await chrome.storage.sync.remove(keys); }
        catch (error) { console.error('Could not remove unindexed records', error); }
        ids.forEach(id => selectedTabIds.delete(String(id)));
        showToast(text('deletedCount', { count: keys.length }), 'success', 10000);
    });
}

async function undoDeleteTabs() {
    if (!lastDeletion || lastDeletion.expiresAt <= Date.now()) return showToast(text('undoExpired'), 'error');
    const deletion = lastDeletion;
    return runManagerOperation(async () => {
        const storage = await chrome.storage.sync.get(null);
        const updates = CopyTabsView.restoreUpdates(storage, deletion.removed);
        await chrome.storage.sync.set(updates);
        if (lastDeletion === deletion) lastDeletion = null;
        showToast(text('restoredPages'));
    });
}

async function moveSelectedTabs() {
    const value = document.getElementById('bulk-folder-select').value;
    const ids = visibleTabs.filter(tab => selectedTabIds.has(String(tab.id))).map(tab => String(tab.id));
    return moveTabs(ids, value === 'null' ? null : value);
}

async function moveTabs(ids, folderId) {
    return runManagerOperation(async () => {
        const storage = await chrome.storage.sync.get(null);
        const updates = CopyTabsView.moveUpdates(storage, ids, folderId);
        const count = Object.keys(updates).filter(key => (storage[key].folderId || null) !== folderId).length;
        if (Object.keys(updates).length) await chrome.storage.sync.set(updates);
        selectedTabIds.clear();
        showToast(text('movedCount', { count }));
    });
}

// Populate folder select dropdown (with tree hierarchy)
async function populateFolderSelect(selectElement, currentFolderId, suppliedStorage) {
    const result = suppliedStorage || await chrome.storage.sync.get(['folders', 'uncategorizedName']);
    const folders = result.folders || [];
    const uncategorizedName = result.uncategorizedName || i18n.getString('uncategorized');

    // Clear existing options except the first one (未分類)
    const uncategorized = document.createElement('option');
    uncategorized.value = 'null';
    uncategorized.textContent = uncategorizedName;
    selectElement.replaceChildren(uncategorized);

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
    return moveTabs([String(tabId)], folderId);
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
    return runManagerOperation(async () => {
        const storage = await chrome.storage.sync.get(null);
        const key = (storage.dataKeys || []).find(key => storage[key] && String(storage[key].id) === String(tabId));
        if (key) await chrome.storage.sync.set({ [key]: { ...storage[key], locked: !storage[key].locked } });
    });
}

async function copyText(content) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        return;
    }
    const previousFocus = document.activeElement;
    const textarea = document.getElementById('copy-textarea');
    textarea.value = content;
    textarea.select();
    const copied = document.execCommand('copy');
    previousFocus?.focus();
    if (!copied) throw new Error('Clipboard copy failed');
}

async function copyPages() {
    // Snapshot the scope before awaiting storage so changing filters cannot change the copy target.
    const options = viewOptions();
    const selected = new Set(selectedTabIds);
    const format = document.getElementById('copy-format').value;
    try {
        const storage = await chrome.storage.sync.get(null);
        const tabs = [...new Set(storage.dataKeys || [])].map(key => storage[key]).filter(tab => tab && tab.url && tab.id !== undefined);
        let targets = CopyTabsView.visibleTabs(tabs, options);
        if (selected.size) targets = targets.filter(tab => selected.has(String(tab.id)));
        if (!targets.length) return;
        await copyText(CopyTabsView.formatTabs(targets, format));
        showToast(text('copiedCount', { count: targets.length }));
    } catch (error) { console.error(error); showToast(text('copyFailed'), 'error'); }
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
    const id = currentEditTabId;
    const newTitle = document.getElementById('edit-tab-title-input').value.trim();
    const newUrl = document.getElementById('edit-tab-url-input').value.trim();
    if (!id || !newTitle || !newUrl) return;
    if (!isSafePageUrl(newUrl)) return showToast(text('operationFailed'), 'error');
    return runManagerOperation(async () => {
        const storage = await chrome.storage.sync.get(null);
        const key = (storage.dataKeys || []).find(key => storage[key] && String(storage[key].id) === String(id));
        if (!key) return closeAllModals();
        await chrome.storage.sync.set({ [key]: { ...storage[key], title: newTitle, url: newUrl } });
        closeAllModals();
    });
}

// Keep Undo available for ten seconds, even if another action shows a message.
function showToast(message, type = 'success', duration = 2000) {
    const toast = document.getElementById('toast');
    clearTimeout(toastTimer);
    toast.replaceChildren();
    const label = document.createElement('span');
    label.textContent = message;
    toast.appendChild(label);
    toast.className = `toast ${type} show`;
    const remaining = lastDeletion ? lastDeletion.expiresAt - Date.now() : 0;
    if (remaining > 0) {
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.textContent = text('undo');
        undo.addEventListener('click', undoDeleteTabs);
        toast.appendChild(undo);
        duration = Math.max(duration, remaining);
    }
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

async function copySingleTab(title, url) {
    try {
        await copyText(CopyTabsView.formatTabs([{ title, url }], 'title'));
        showToast(text('copiedCount', { count: 1 }));
    } catch (error) { console.error(error); showToast(text('copyFailed'), 'error'); }
}

// Drag and drop event handlers
function handleDragStart(e) {
    if (e.target.closest('button, input, select, label')) {
        e.preventDefault();
        return;
    }
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/tab-id', this.getAttribute('data-tab-id'));
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    if (canReorderTabs() && draggedElement && this !== draggedElement) {
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

    if (canReorderTabs() && draggedElement && draggedElement !== this) {
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
    if (!canReorderTabs()) return;
    const options = viewOptions();
    return runManagerOperation(async () => {
        const storage = await chrome.storage.sync.get(null);
        const keys = storage.dataKeys || [];
        const tabs = CopyTabsView.visibleTabs(keys.map(key => storage[key]).filter(Boolean), options);
        const from = tabs.findIndex(tab => String(tab.id) === String(draggedId));
        const to = tabs.findIndex(tab => String(tab.id) === String(targetId));
        if (from < 0 || to < 0 || from === to) return;
        const [dragged] = tabs.splice(from, 1);
        tabs.splice(to, 0, dragged);
        const updates = {};
        tabs.forEach((tab, order) => {
            const key = keys.find(key => storage[key] && String(storage[key].id) === String(tab.id));
            updates[key] = { ...storage[key], order };
        });
        await chrome.storage.sync.set(updates);
    });
}
