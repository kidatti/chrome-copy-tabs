const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { syncVersion } = require('./version.cjs');

try {
    const mode = process.argv[2] || 'build';
    if (!['build', 'dev'].includes(mode)) throw new Error('使い方: node scripts/build.cjs [build|dev] [出力先]');
    const root = path.resolve(__dirname, '..');
    const version = syncVersion(root);
    const dist = path.resolve(root, process.argv[3] || 'dist');
    const name = `copytabs-v${version}`;
    fs.mkdirSync(dist, { recursive: true });
    const staging = fs.mkdtempSync(path.join(dist, '.copytabs-build-'));
    try {
        if (mode === 'dev') {
            const output = path.join(dist, name);
            fs.cpSync(path.join(root, 'src'), path.join(staging, name), {
                recursive: true,
                filter: file => !/^(\.DS_Store|Thumbs\.db)$|\.(tmp|log)$/.test(path.basename(file))
            });
            // Only replace this version's generated output; retain other releases.
            fs.rmSync(output, { recursive: true, force: true });
            fs.renameSync(path.join(staging, name), output);
            console.log(`開発用ビルド: ${output}`);
        } else {
            const archive = path.join(staging, `${name}.zip`);
            const result = spawnSync('zip', ['-qr', archive, '.', '-x', '*.DS_Store', 'Thumbs.db', '*.tmp', '*.log'], { cwd: path.join(root, 'src'), stdio: 'inherit' });
            if (result.error) throw result.error;
            if (result.status !== 0) throw new Error('配布ZIPの作成に失敗しました。');
            const output = path.join(dist, `${name}.zip`);
            fs.renameSync(archive, output);
            console.log(`配布パッケージ: ${output}`);
        }
    } finally {
        fs.rmSync(staging, { recursive: true, force: true });
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
