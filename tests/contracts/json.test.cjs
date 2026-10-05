const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectDir = path.resolve(__dirname, '../..');
// Enumerate public JSON explicitly so local configuration and dictionaries stay private.
const publicJson = [
    'package.json',
    'package-lock.json',
    '.vscode/settings.json',
    '.vscode/extensions.json',
    'src/manifest.json',
    'src/_locales/en/messages.json',
    'src/_locales/zh_CN/messages.json',
    'src/_locales/zh_TW/messages.json',
    'tests/fixtures/collins.json',
    'tests/fixtures/wordforms.json'
];

for (const file of publicJson) {
    test(`${file} contains valid JSON`, () => {
        JSON.parse(fs.readFileSync(path.join(projectDir, file), 'utf8'));
    });
}
