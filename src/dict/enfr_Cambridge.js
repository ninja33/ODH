/* global api */
class enfr_Cambridge {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '剑桥英法词典';
        if (locale.indexOf('TW') != -1) return '剑桥英法词典';
        return 'Cambridge EN->FR Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        return await this.findCambridge(word);
    }

    removeTags(elem, name) {
        let tags = elem.querySelectorAll(name);
        tags.forEach(x => {
            x.outerHTML = '';
        });
    }

    removelinks(elem) {
        let tags = elem.querySelectorAll('a');
        tags.forEach(x => {
            x.outerHTML = x.innerText;
        });

        tags = elem.querySelectorAll('h2');
        tags.forEach(x => {
            x.outerHTML = `<div class='head2'>${x.innerHTML}</div>`;
        });

        tags = elem.querySelectorAll('h3');
        tags.forEach(x => {
            x.outerHTML = `<div class='head3'>${x.innerHTML}</div>`;
        });
    }

    async findCambridge(word) {
        if (!word) return null;

        let base = 'https://dictionary.cambridge.org/search/english-french/direct/?q=';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return null;
        }

        let contents = doc.querySelectorAll('.cdo-dblclick-area .entry-body__el') || [];
        if (contents.length == 0) return null;

        let definition = '';
        for (const content of contents) {
            this.removeTags(content, '.extraexamps');
            this.removelinks(content);
            definition += content.innerHTML;
        }
        let css = this.renderCSS();
        return definition ? css + definition : null;
    }

    renderCSS() {
        let css = `
            <style>
            .entry-body__el{margin-bottom:10px;}
            .head2{font-size: 1.2em;font-weight:bold;}
            .pos-header{border-bottom: 1px solid;}
            .head3 {display:none;}
            .posgram {font-size: 0.8em;background-color: #959595;color: white;padding: 2px 5px;border-radius: 3px;}
            .epp-xref::after {content: ")";}
            .epp-xref::before {content: "(";}
            .def-block, .phrase-block {
                /*border: 1px solid;*/
                /*border-color: #e5e6e9 #dfe0e4 #d0d1d5;*/
                border-radius: 3px;
                padding: 5px;
                margin: 5px 0;
                background-color: #f6f6f6;
            }
            .phrase-block .def-block{border: initial;padding: initial;}
            p.def-head {margin: auto;}
            .phrase-head {vertical-align: middle;color: #1683ea;font-weight: bold;}
            .trans {color: #5079bb;}
            </style>`;

        return css;
    }
}