class Translator {
    constructor() {
        this.dictionary = null;
}

    getTranslation(word) {
        return this.dictionary.findTerm(word);
    }

    setDictionary(dict) {
        this.dictionary = dict;
    }

}