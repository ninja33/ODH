class Translator {
    constructor() {
        this.word = "";
        this.defs = {};
        this.dictionary = new Cndict();
    }

    getTranslation(word) {
        this.word = word;
        return this.dictionary.findTerm(word);
    }
}