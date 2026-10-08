const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function readVersion(root = projectRoot) {
    const version = fs.readFileSync(path.join(root, '.version'), 'utf8').trim();
    const parts = version.split('.');
    if (parts.length > 4 || !parts.every(part => /^(0|[1-9]\d*)$/.test(part) && Number(part) <= 65535) || parts.every(part => Number(part) === 0)) {
        throw new Error('.version は Chrome のバージョン形式（0〜65535の整数を1〜4個、ピリオドで区切る）で記述してください。先頭の余分な0と全て0のバージョンは使えません。');
    }
    return version;
}

function syncVersion(root = projectRoot) {
    const version = readVersion(root);
    const manifestPath = path.join(root, 'src', 'manifest.json');
    const source = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(source);
    if (manifest.version !== version) {
        manifest.version = version;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }
    return version;
}

if (require.main === module) {
    try {
        const command = process.argv[2] || 'sync';
        if (!['sync', 'show', 'check'].includes(command)) throw new Error('使い方: node scripts/version.cjs [sync|show|check]');
        const version = command === 'sync' ? syncVersion() : readVersion();
        if (command === 'check') {
            const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src', 'manifest.json'), 'utf8'));
            if (manifest.version !== version) throw new Error('バージョンが一致しません。make sync-version を実行してください。');
        }
        console.log(version);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = { readVersion, syncVersion };
