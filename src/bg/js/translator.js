class Translator {
    constructor(opts) {
        this.options = null;
        this.oldoptions = null;
        this.word = null;
        this.base = 'https://rawgit.com';
        this.dictionaries = {
            'encn-Youdao': Youdao,
            'encn-Baicizhan': Baicizhan,
            'encn-CNDict': CNDict,
        };

        this.setOptions(opts);
        this.loadDictionary();
    }

    setOptions(opts) {
        this.options = opts;
    }

    updateOptions(opts) {
        this.options = opts;
        loadDictionary();
    }

    loadDictionary() {
        const opts = this.options;
        if (opts.userdefined && opts.repo != '' && opts.dlib != '') {
            let dictURL = `${this.case}/${opts.repo}/${opts.dlib}`;
            loadjs(dictURL, {
                success: () => {
                    this.dictionary = new this.dictionaries[opts.currentdict];
                },
                error: () => {
                    this.dictionary = new this.dictionaries[opts.currentdict];
                },
            });
        } else {
            this.dictionary = new this.dictionaries[opts.currentdict];
        }
    }

    getTranslation(word) {
        this.word = word;
        return this.dictionary.findTerm(word);
    }
}