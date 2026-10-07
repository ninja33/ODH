class Builtin {
    constructor() {
        this.dicts = {};
    }

    async loadData() {
        this.dicts['collins'] = await Builtin.loadData('/bg/data/collins.json');
    }

    findTerm(dictname, term) {
        const dict = this.dicts[dictname];
        // WHY: dict comes from a JSON dictionary file, so its prototype is not under our
        // control. A missing entry means the data never loaded; the caller turns that into
        // a classified failure instead of an exception.
        if (!dict) return null;
        return Object.prototype.hasOwnProperty.call(dict, term) ? JSON.stringify(dict[term]) : null;
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