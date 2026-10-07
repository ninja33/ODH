const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Loads classic (non-module) scripts and returns one expression evaluated in the realm.
// `requires` mirrors what the real HTML page or importScripts call loads first, so a file
// that depends on a shared classic script (e.g. lib/envelope.js) gets it in the same realm
// instead of each test re-implementing it.
function loadClassic(file, className, globals = {}, context = null, requires = []) {
    const projectDir = path.resolve(__dirname, '../..');
    // VM loads trusted repository code for tests; it is not a security sandbox.
    // Passing a context lets a test share one realm when the code under test
    // compares object identity, which does not survive the VM boundary.
    if (context) Object.assign(context, globals);
    const realm = context || vm.createContext({ ...globals });
    for (const required of requires) {
        const requiredSource = fs.readFileSync(path.join(projectDir, required), 'utf8');
        new vm.Script(requiredSource, { filename: required }).runInContext(realm);
    }
    const source = fs.readFileSync(path.join(projectDir, file), 'utf8');
    new vm.Script(source, { filename: file }).runInContext(realm);
    return vm.runInContext(className, realm);
}

module.exports = { loadClassic };
