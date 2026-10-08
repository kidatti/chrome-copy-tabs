const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { syncVersion } = require('./version.cjs');
const { getData, installChromeFixture } = require('../store/sample-data.cjs');
const layout = require('../store/layout.cjs');
const copy = require('../store/copy.cjs');

async function generate() {
    const root = path.resolve(__dirname, '..');
    const version = syncVersion(root);
    const outputRoot = path.join(root, 'store', `v${version}`);
    const languages = process.argv.length > 2 ? [...new Set(process.argv.slice(2))] : ['ja', 'en'];
    if (!languages.every(language => ['ja', 'en'].includes(language))) throw new Error('使い方: node scripts/store-images.cjs [ja|en]');
    const captures = fs.mkdtempSync(path.join(os.tmpdir(), 'copytabs-store-'));
    const pages = new Map();
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
    const server = http.createServer((request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        if (pages.has(pathname)) {
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            return response.end(pages.get(pathname));
        }
        const base = pathname.startsWith('/extension/') ? path.join(root, 'src') : pathname.startsWith('/captures/') ? captures : null;
        const file = base && path.resolve(base, '.' + pathname.replace(/^\/(extension|captures)/, ''));
        if (!file || !file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            response.writeHead(404); return response.end();
        }
        response.setHeader('Content-Type', (mime[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
        response.end(fs.readFileSync(file));
    });
    let browser;
    try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
        const baseURL = `http://127.0.0.1:${server.address().port}`;
        for (const language of languages) {
            const output = path.join(outputRoot, language);
            const context = await browser.newContext({ viewport: { width: 1184, height: 620 }, colorScheme: 'light', locale: language === 'ja' ? 'ja-JP' : 'en-US', timezoneId: 'Asia/Tokyo', deviceScaleFactor: 2 });
            await context.addInitScript(installChromeFixture, { data: getData(language), manifest: JSON.parse(fs.readFileSync(path.join(root, 'src', 'manifest.json'))), baseURL });
            const app = await context.newPage();
            const errors = [];
            app.on('pageerror', error => errors.push(error.message));
            // Rendering never fetches sample URLs or any remote resources.
            await context.route('**/*', route => route.request().url().startsWith(baseURL) ? route.continue() : route.abort());
            await app.goto(baseURL + '/extension/all_tabs.html');
            await app.waitForFunction(() => managerReady && document.querySelectorAll('.tab-item').length === 3);
            await app.evaluate(() => document.fonts.ready);
            if (language === 'en') assert.equal(await app.locator('body').evaluate(el => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(el.innerText)), false, 'English UI contains no Japanese text');
            assert.equal(await app.locator('.app-header').evaluate(el => el.getBoundingClientRect().height), 36);
            // Ensure the entire last row is visible in the captured area.
            const lastRow = await app.locator('.tab-item').last().boundingBox();
            assert.ok(lastRow.y + lastRow.height <= 620, 'Manager rows must fit the screenshot');
            await app.screenshot({ path: path.join(captures, `${language}-organize.png`) });
            await app.locator('.folder-item[data-folder-id="research"] .folder-name').click();
            await app.waitForFunction(() => document.querySelectorAll('.tab-item').length === 2);
            await app.locator('[data-tab-id="1"] input[type=checkbox]').check();
            await app.locator('[data-tab-id="2"] input[type=checkbox]').check();
            await app.locator('#copy-format').selectOption('markdown');
            await app.locator('#bulk-toolbar').waitFor({ state: 'visible' });
            await app.locator('#tab-search').focus();
            await app.locator('#tab-search').evaluate(el => el.blur());
            await app.screenshot({ path: path.join(captures, `${language}-copy.png`) });
            await app.locator('#all-folders').click();
            await app.emulateMedia({ colorScheme: 'dark' });
            await app.waitForFunction(() => document.querySelectorAll('.tab-item').length === 3);
            await app.screenshot({ path: path.join(captures, `${language}-dark.png`) });
            await app.emulateMedia({ colorScheme: 'light' });
            await app.setViewportSize({ width: 400, height: 800 });
            await app.goto(baseURL + '/extension/popup.html');
            await app.waitForFunction(() => document.querySelectorAll('.tab-item').length === 3 && document.querySelector('#current-tab-title').textContent.length > 0);
            await app.waitForFunction(() => document.querySelector('#folder-select').value === 'research');
            await app.locator('#export-details summary').click();
            await app.evaluate(() => document.fonts.ready);
            if (language === 'en') assert.equal(await app.locator('body').evaluate(el => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(el.innerText)), false, 'English UI contains no Japanese text');
            const popupHeight = await app.locator('body').evaluate(el => Math.ceil(el.getBoundingClientRect().height));
            await app.setViewportSize({ width: 400, height: popupHeight });
            await app.locator('body').screenshot({ path: path.join(captures, `${language}-popup.png`) });
            assert.deepEqual(errors, [], 'Extension UI must render without script errors');
            await context.close();

            pages.set(`/${language}/01`, layout.screenshot({ ...copy[language].organize, source: `${language}-organize.png` }, language));
            pages.set(`/${language}/02`, layout.screenshot({ ...copy[language].select, source: `${language}-copy.png` }, language));
            pages.set(`/${language}/03`, layout.popup(popupHeight, 400, language));
            pages.set(`/${language}/04`, layout.screenshot({ ...copy[language].dark, source: `${language}-dark.png`, dark: true }, language));
            pages.set(`/${language}/small`, layout.promo(false, language));
            pages.set(`/${language}/marquee`, layout.promo(true, language));
            const compositions = [
                [`/${language}/01`, `01-organize-${language}.png`, 1280, 800], [`/${language}/02`, `02-select-copy-${language}.png`, 1280, 800],
                [`/${language}/03`, `03-popup-${language}.png`, 1280, 800], [`/${language}/04`, `04-dark-mode-${language}.png`, 1280, 800],
                [`/${language}/small`, 'promo-small-440x280.png', 440, 280], [`/${language}/marquee`, 'promo-marquee-1400x560.png', 1400, 560]
            ];
            fs.mkdirSync(output, { recursive: true });
            const composition = await browser.newPage({ deviceScaleFactor: 1 });
            for (const [url, name, width, height] of compositions) {
                await composition.setViewportSize({ width, height });
                await composition.goto(baseURL + url);
                await composition.evaluate(async () => {
                    await document.fonts.ready;
                    await Promise.all([...document.images].map(image => image.decode()));
                });
                assert.equal(await composition.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: no horizontal overflow`);
                if (language === 'en') assert.equal(await composition.locator('body').evaluate(el => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(el.innerText)), false, `${name}: English captions contain no Japanese text`);
                await composition.screenshot({ path: path.join(output, name) });
                const png = fs.readFileSync(path.join(output, name));
                assert.equal(png.readUInt32BE(16), width);
                assert.equal(png.readUInt32BE(20), height);
                assert.equal(png[25], 2, `${name}: 24-bit RGB PNG without alpha`);
                console.log(`${name}: ${width}×${height}, RGB PNG`);
            }
            await composition.close();
            console.log(`生成先: ${output}`);
        }
    } finally {
        if (browser) await browser.close();
        if (server.listening) await new Promise(resolve => server.close(resolve));
        fs.rmSync(captures, { recursive: true, force: true });
    }
}

generate().catch(error => { console.error(error); process.exitCode = 1; });
