class Translator {
    constructor(opts) {
        this.options = opts;
        this.dictionary = null;
    }

    getTranslation(word) {
        return this.dictionary.findTerm(word);
    }

    setDictionary(dict) {
        this.dictionary = dict;
    }

}