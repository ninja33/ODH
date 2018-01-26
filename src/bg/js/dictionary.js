class Dictlib {
    constructor(opts) {
        this.options = opts;
        this.default = ['localdicts/youdao.js', 'localdicts/cndict.js'];
        this.list = [];
        this.dicts = {};
    }

    setOptions(opts) {
        this.options = opts;
    }

    async loadDict() {
        let remotelist = this.options.dictLibrary;
        this.list = this.default;
        this.dicts = {};
        if (remotelist) 
            await this.loadRemote(remotelist);
        await this.loadRemote(this.list);
        let current = this.options.dictSelected;
        current = (current in this.dicts) ? current : 'encn-Default';
        return {
            'dictlist': this.dicts,
            'selected': current
        }
    }

    async loadRemote(path) {
        return new Promise((resolve, reject) => {
            loadjs(path, {
                success: () => resolve(),
                error: () => reject(),
            });
        });
    }

    setDictList(list) {
        this.list = this.list.concat(list);
    }

    addDictionary(key, dict) {
        try {
            this.dicts[key] = dict;
        } catch (error) {
            console.log(error);
        }
    }
}

function registerDictList(list) {
    abkl_backend.dictlib.setDictList(list);
}

function registerDict(name, dict) {
    abkl_backend.dictlib.addDictionary(name, dict);
}