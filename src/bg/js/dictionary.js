class Dictionary {
    constructor(opts) {
        this.options = opts;
        this.currentdict = opts.currentdict
        this.dictlist = null;
        this.dictionaries = {
            'encn-Default': new Youdao(),
        };
    }

    loadLibrary() {
        let repo = this.options.repository;
        if (repo) {
            loadjs(repo, () => {
                if (this.dictlist)
                    loadjs(this.dictlist, () => {});
            });
        }
        if (this.dictionaries[this.currentdict] == undefined) {
            this.setCurrentDictName('encn-Default');
        }
    }

    loadRemoteLib(repo) {
        return new Promise((resolve, reject) => {
            loadjs(repo, {
                success: resolve(this.dictlist),
                error: reject(),
            });
        });
    };

    setDictList(list) {
        this.dictlist = list;
    }

    addDictionaries(key, dict) {
        this.dictionaries[key] = dict;
    }

    setCurrentDictName(name) {
        this.currentdict = name;
    }

    getCurrentDict() {
        return this.dictionaries[this.currentdict];
    }
}