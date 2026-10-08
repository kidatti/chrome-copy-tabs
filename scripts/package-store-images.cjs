const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readVersion } = require('./version.cjs');

try {
    const root = path.resolve(__dirname, '..');
    const version = readVersion(root);
    const imagesRoot = path.join(root, 'store', `v${version}`);
    const dist = path.join(root, 'dist');
    const guides = {
        ja: `# CopyTabs v${version} — 日本語の掲載画像

01〜04を日本語のスクリーンショット欄に順に登録してください。
説明画像は1280×800、小型プロモーション画像は440×280、大型は1400×560です。
プロモーション画像は言語別に登録できないため、日本語版・英語版のどちらかを選びます。
小型画像はブランド名のみのため、両版で同じ画像です。

画像仕様: https://developer.chrome.com/docs/webstore/images
`,
        en: `# CopyTabs v${version} — English listing images

Upload screenshots 01–04 to the English screenshot section in that order.
Screenshots: 1280×800. Small promotional image: 440×280. Marquee: 1400×560.
Promotional images are not locale-specific; choose either the English or Japanese version.
The small image contains only the brand name and is identical in both sets.

Image specifications: https://developer.chrome.com/docs/webstore/images
`
    };
    const files = {};
    for (const language of ['ja', 'en']) {
        files[language] = [
            [`01-organize-${language}.png`, 1280, 800], [`02-select-copy-${language}.png`, 1280, 800],
            [`03-popup-${language}.png`, 1280, 800], [`04-dark-mode-${language}.png`, 1280, 800],
            ['promo-small-440x280.png', 440, 280], ['promo-marquee-1400x560.png', 1400, 560]
        ].map(([name, width, height]) => {
            const file = path.join(imagesRoot, language, name);
            const png = fs.readFileSync(file);
            if (png.toString('hex', 0, 8) !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height || png[24] !== 8 || png[25] !== 2) {
                throw new Error(`掲載画像のサイズまたはPNG形式が不正です: ${file}`);
            }
            return file;
        });
    }
    fs.mkdirSync(dist, { recursive: true });
    const staging = fs.mkdtempSync(path.join(dist, '.copytabs-images-'));
    const zip = (args, cwd) => {
        const result = spawnSync('zip', args, { cwd, stdio: 'inherit' });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error('掲載画像ZIPの作成に失敗しました。');
    };
    try {
        for (const language of ['ja', 'en']) {
            const directory = path.join(staging, language);
            fs.mkdirSync(directory);
            const guide = path.join(directory, 'README.md');
            fs.writeFileSync(guide, guides[language]);
            const name = `copytabs-v${version}-store-images-${language}.zip`;
            zip(['-qj', path.join(staging, name), ...files[language], guide]);
            fs.renameSync(path.join(staging, name), path.join(dist, name));
            console.log(`掲載画像ZIP: ${path.join(dist, name)}`);
        }
        const combined = `copytabs-v${version}-store-images.zip`;
        zip(['-q', path.join(staging, combined), ...Object.values(files).flat().map(file => path.relative(imagesRoot, file))], imagesRoot);
        zip(['-qj', path.join(staging, combined), path.join(root, 'store', 'README.md')]);
        fs.renameSync(path.join(staging, combined), path.join(dist, combined));
        console.log(`両言語のZIP: ${path.join(dist, combined)}`);
    } finally {
        fs.rmSync(staging, { recursive: true, force: true });
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
