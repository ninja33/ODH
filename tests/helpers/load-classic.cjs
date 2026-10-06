const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClassic(file, className, globals = {}, context = null) {
    const projectDir = path.resolve(__dirname, '../..');
    const source = fs.readFileSync(path.join(projectDir, file), 'utf8');
    // VM loads trusted repository code for tests; it is not a security sandbox.
    // Passing a context lets a test share one realm when the code under test
    // compares object identity, which does not survive the VM boundary.
    if (context) Object.assign(context, globals);
    const realm = context || vm.createContext({ ...globals });
    new vm.Script(source, { filename: file }).runInContext(realm);
    return vm.runInContext(className, realm);
}

module.exports = { loadClassic };
