/* global api */
class enfr_Collins {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '柯林斯英法词典';
        if (locale.indexOf('TW') != -1) return '柯林斯英法词典';
        return 'Collins EN->FR Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        return await this.findCollins(word);
    }

    async findCollins(word) {
        if (!word) return null;

        let base = 'https://www.collinsdictionary.com/dictionary/english-french/';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return null;
        }

        let content = doc.querySelector('.content') || '';
        if (!content) return null;
        let css = this.renderCSS();
        return css + content.innerHTML;
    }

    renderCSS() {
        let css = `
            <style>
                .copyright{
                    display:none;
                }
                .orth {
                    font-size: 100%;
                    font-weight: bold;
                }
                .quote {
                    font-style: normal;
                    color: #1683be;
                }
                .colloc {
                    font-style: italic;
                    font-weight: normal;
                }
                .sense {
                    /*border: 1px solid;*/
                    /*border-color: #e5e6e9 #dfe0e4 #d0d1d5;*/
                    border-radius: 3px;
                    padding: 5px;
                    margin: 5px 0;
                    background-color: #f6f6f6;
                }
                .sense .re {
                    font-size: 100%;
                    margin-left: 0;
                }
                a {
                    color: #000;
                    text-decoration: none;
                }
                * {
                    word-wrap: break-word;
                    box-sizing: border-box;
                }
            </style>`;

        return css;
    }
}