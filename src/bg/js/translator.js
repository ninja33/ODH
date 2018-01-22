class Translator {
    constructor(opts) {
        this.word = "";
        this.defs = {};
        this.setOptions(opts);
        this.loadDictionary();
    }

    setOptions(opts){
        this.options = opts;
    }

    loadDictionary(){
        if (this.options.uddt == true) {
            let dictURL = `https://rawgit.com/${this.options.user}/${this.options.repo}/${this.options.tags}/${this.options.dlib}`;
            loadjs(dictURL, {
                success: ()=> {this.dictionary = new UserDict()},
                error: ()=> {this.dictionary = new CommonDict()},
            });
        } else {
            this.dictionary = new CommonDict();
        }
    }
    
    getTranslation(word) {
        this.word = word;
        return this.dictionary.findTerm(word);
    }
}