const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClassic(file, className, globals = {}) {
    const projectDir = path.resolve(__dirname, '../..');
    const source = fs.readFileSync(path.join(projectDir, file), 'utf8');
    // VM loads trusted repository code for tests; it is not a security sandbox.
    const context = vm.createContext({ ...globals });
    new vm.Script(source, { filename: file }).runInContext(context);
    return vm.runInContext(className, context);
}

module.exports = { loadClassic };
