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
        if (this.options.cust == true) {
            let dictURL = `https://rawgit.com/${this.options.user}/${this.options.repo}/${this.options.tags}/${this.options.dlib}`;
            loadjs(dictURL, {
                success: ()=> {this.dictionary = new Custdict()},
                error: ()=> {this.dictionary = new Defaultdict()},
            });
        } else {
            this.dictionary = new Defaultdict();
        }
    }
    
    getTranslation(word) {
        this.word = word;
        return this.dictionary.findTerm(word);
    }
}