/* global api */
class encn_Youdao {
    constructor() {
        this.options = null;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '有道英汉简明';
        if (locale.indexOf('TW') != -1) return '有道英漢簡明';
        return 'Youdao Concise EN->CN Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        //let deflection = await api.deinflect(word);
        let results = await Promise.all([this.findYoudao(word)]);
        return [].concat(...results).filter(x => x);
    }

    async findYoudao(word) {
        if (!word) return [];

        let base = 'http://dict.youdao.com/w/';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
            return getYoudao(doc);
        } catch (err) {
            return [];
        }

        function getYoudao(doc) {
            let notes = [];

            function T(node) {
                if (!node)
                    return '';
                else
                    return node.innerText.trim();
            }
            //get Youdao EC data: check data availability
            let defNodes = doc.querySelectorAll('#phrsListTab .trans-container ul li');
            if (!defNodes || !defNodes.length) return notes;

            //get headword and phonetic
            let expression = T(doc.querySelector('#phrsListTab .wordbook-js .keyword')); //headword
            let reading = '';
            let readings = doc.querySelectorAll('#phrsListTab .wordbook-js .pronounce');
            if (readings) {
                let reading_uk = T(readings[0]);
                let reading_us = T(readings[1]);
                reading = (reading_uk || reading_us) ? `${reading_uk} ${reading_us}` : '';
            }

            let audios = [];
            audios[0] = `http://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
            audios[1] = `http://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;

            let definition = '<ul class="ec">';
            for (const defNode of defNodes)
                definition += `<li class="ec"><span class="ec_chn">${T(defNode)}</span></li>`;
            definition += '</ul>';
            let css = `
                <style>
                    ul.ec, li.ec {list-style: square inside; margin:0; padding:0;}
                </style>`;
            notes.push({
                css,
                expression,
                reading,
                definitions: [definition],
                audios
            });
            return notes;
        }
    }
}