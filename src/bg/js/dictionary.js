class Dictlib {
    constructor() {
        this.options = null;
        this.lastoptions = null;
        this.default = ['local/youdao.js'];
        this.list = [];
        this.dicts = {};
    }

    setOptions(opts) {
        this.lastoptions = this.options;
        this.options = opts;
    }

    async loadDict() {
        let remotelist = this.options.dictLibrary;
        if (this.pathChanged(remotelist)){
            this.list = this.default;
            this.dicts = {};
            if (remotelist) 
                await this.loadRemote(remotelist);
            await this.loadRemote(this.list);
        }
        let selected = this.options.dictSelected;
        selected = (selected in this.dicts) ? selected : 'encn-Default';
        return {
            'dictlist': this.dicts,
            'selected': selected
        }
    }

    pathChanged(remotelist){
        return !this.lastoptions || (this.lastoptions.dictLibrary != remotelist);
    }

    async loadRemote(path) {
        return new Promise((resolve, reject) => {
            loadjs(path, {
                success: () => resolve(),
                error: () => reject(),
            });
        });
    }

    setList(list) {
        this.list = this.list.concat(list);
    }

    setDict(key, dict) {
        try {
            this.dicts[key] = dict;
        } catch (error) {
            console.log(error);
        }
    }
}

function registerList(list) {
    aodhback.dictlib.setList(list);
}

function registerDict(name, dict) {
    aodhback.dictlib.setDict(name, dict);
}