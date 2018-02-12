class Dictlib {
    constructor() {
        this.options = null;
        this.lastoptions = null;
        this.list = [];
        this.dicts = {};
    }

    setOptions(opts) {
        this.lastoptions = this.options;
        this.options = opts;
    }

    async loadDict() {
        let dictslist = this.options.dictLibrary;
        if (this.pathChanged(dictslist)) {
            this.list = ['encn_Youdao'];
            this.dicts = {};
            if (dictslist)
                await this.loadScript([dictslist].map(this.pathMapping));
            await this.loadScript(this.list.map(this.pathMapping));
        }
        let selected = this.options.dictSelected;
        selected = (selected in this.dicts) ? selected : chrome.i18n.getMessage('encn_Youdao');
        this.options.dictSelected = selected;
        this.options.dictNamelist = Object.keys(this.dicts);
        return this.options;
    }

    pathMapping(path) {
        path = 'local/' + path;
        path = (path.indexOf('.js') == -1) ? path + '.js' : path;
        return path;
    }

    pathChanged(remotelist) {
        return !this.lastoptions || (this.lastoptions.dictLibrary != remotelist);
    }

    async loadScript(path) {
        return new Promise((resolve, reject) => {
            loadjs(path, {
                success: () => resolve(),
                error: () => resolve(), // nothing happened
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