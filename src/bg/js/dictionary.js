class Dictlib {
    constructor(opts) {
        this.options = opts;
        this.default = ['localdicts/youdao.js','localdicts/cndict.js'];
        this.list = [];
        this.dicts = {};
    }

    setOptions(opts){
        this.options = opts;
    }

    async loadDict(callback) {
        let remotelist = this.options.dictLibrary;
        this.list = this.default;
        if (remotelist) {
            await this.loadRemote(remotelist);
            await this.loadRemote(this.list);
            return new this.dicts['encn-Default'];
        }
    }

    async loadRemote(path){
        return new Promise((resolve,reject)=>{
            loadjs(path,{
                success:()=>resolve(),
                error:()=>reject(),
            });
        });
    }

    setDictList(list) {
        this.list = this.list.concat(list);
    }

    addDictionary(key, dict) {
        try{
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
