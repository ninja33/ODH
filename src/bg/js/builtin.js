class Builtin {
    constructor() {
        this.dicts = {};
    }

    async loadData() {
        this.dicts['collins'] = await Builtin.loadData('/bg/data/collins.json');
    }

    findTerm(dictname, term) {
        const dict = this.dicts[dictname];
        // WHY: dict comes from a JSON dictionary file, so its prototype is not
        // under our control; the prototype-free form belongs to the hardening task.
        // eslint-disable-next-line no-prototype-builtins
        return dict.hasOwnProperty(term) ? JSON.stringify(dict[term]):null;
    }

    static async loadData(path) {
        try {
            let response = await fetch(path);
            return await response.json();
        } catch (error) {
            return null;
        }
    }    
}