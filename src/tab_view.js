// Shared view rules keep displayed rows, bulk operations and copied output aligned.
const CopyTabsView = (() => {
    const ALL_FOLDERS = '__all__';
    const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
    const timestamp = tab => Date.parse(tab.timestamp) || 0;

    function visibleTabs(tabs, { folderId = ALL_FOLDERS, query = '', sort = 'newest' } = {}) {
        const words = normalize(query).trim().split(/\s+/).filter(Boolean);
        return tabs.filter(tab => tab && (
            folderId === ALL_FOLDERS || (tab.folderId || null) === folderId
        ) && words.every(word => normalize(`${tab.title || ''} ${tab.url || ''}`).includes(word)))
            .sort((a, b) => {
                if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
                if (sort === 'oldest') return timestamp(a) - timestamp(b);
                if (sort === 'manual') {
                    const aOrdered = Number.isFinite(a.order), bOrdered = Number.isFinite(b.order);
                    if (aOrdered && bOrdered) return a.order - b.order;
                    if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
                    return timestamp(a) - timestamp(b);
                }
                return timestamp(b) - timestamp(a);
            });
    }

    function formatTabs(tabs, format = 'url') {
        return tabs.map(tab => {
            if (format === 'title') return `${tab.title || ''}\n${tab.url}`;
            if (format === 'markdown') {
                const title = String(tab.title || tab.url).replace(/[\r\n]+/g, ' ').replace(/[\\[\]]/g, '\\$&');
                const url = String(tab.url).replace(/[\s()<>]/g, ch => ch === '(' ? '%28' : ch === ')' ? '%29' : encodeURIComponent(ch));
                return `[${title}](${url})`;
            }
            return tab.url;
        }).join(format === 'title' ? '\n\n' : '\n');
    }

    function deletePlan(storage, ids) {
        const selected = new Set(ids.map(String));
        const keys = [...new Set(storage.dataKeys || [])];
        const removed = {}, locked = [];
        keys.forEach(key => {
            const tab = storage[key];
            if (!tab || !selected.has(String(tab.id))) return;
            if (tab.locked) locked.push(tab);
            else removed[key] = tab;
        });
        return { removed, locked, dataKeys: keys.filter(key => !Object.hasOwn(removed, key)) };
    }

    function moveUpdates(storage, ids, folderId) {
        if (folderId !== null && !(storage.folders || []).some(folder => folder.id === folderId)) {
            throw new Error('Destination folder no longer exists');
        }
        const selected = new Set(ids.map(String));
        const keys = [...new Set(storage.dataKeys || [])];
        const moving = keys.filter(key => storage[key] && selected.has(String(storage[key].id)) && (storage[key].folderId || null) !== folderId);
        if (!moving.length) return {};
        const destination = keys.map(key => storage[key]).filter(tab => tab && (tab.folderId || null) === folderId);
        let order = destination.reduce((max, tab, index) => Math.max(max, Number.isFinite(tab.order) ? tab.order : index), -1);
        const updates = {};
        keys.forEach(key => {
            const tab = storage[key];
            if (tab && (tab.folderId || null) === folderId && !Number.isFinite(tab.order)) {
                updates[key] = { ...tab, order: ++order };
            }
        });
        moving.forEach(key => {
            const tab = storage[key];
            updates[key] = { ...tab, folderId, order: ++order };
        });
        return updates;
    }

    // Another save may reuse a deleted mark-N key before Undo is pressed.
    function restoreUpdates(storage, removed) {
        const keys = [...new Set(storage.dataKeys || [])];
        const ids = new Set(keys.filter(key => storage[key]).map(key => String(storage[key].id)));
        const updates = {};
        Object.entries(removed).forEach(([originalKey, tab]) => {
            if (ids.has(String(tab.id))) return;
            let key = originalKey, suffix = 1;
            while ((Object.hasOwn(storage, key) && String(storage[key]?.id) !== String(tab.id)) || Object.hasOwn(updates, key)) {
                key = `${originalKey}-restored-${suffix++}`;
            }
            const folderExists = (storage.folders || []).some(folder => folder.id === tab.folderId);
            updates[key] = { ...tab, folderId: folderExists ? tab.folderId : null };
            keys.push(key);
            ids.add(String(tab.id));
        });
        return { ...updates, dataKeys: keys };
    }

    return { ALL_FOLDERS, visibleTabs, formatTabs, deletePlan, moveUpdates, restoreUpdates };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CopyTabsView;
