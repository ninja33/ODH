/* global api */
class builtin_encn_Oxford {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '牛津英汉双解(内置)';
        if (locale.indexOf('TW') != -1) return '牛津英漢雙解(內置)';
        return 'Oxford EN->CN Dictionary(builtin)';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        let list = [];
        let word_stem = await api.deinflect(word);
        if (word.toLowerCase() != word) {
            let lowercase = word.toLowerCase();
            let lowercase_stem = await api.deinflect(lowercase);
            list = [word, word_stem, lowercase, lowercase_stem];
        } else {
            list = [word, word_stem];
        }
        let promises = list.map((item) => this.findOxford(item));
        let results = await Promise.all(promises);
        return [].concat(...results).filter(x => x);
    }

    async findOxford(word) {
        let notes = [];

        if (!word) return notes;
        let results = [];
        try {
            results = JSON.parse(await api.getBuiltin('oxford', word));
        } catch (err) {
            return [];
        }

        //get Oxford Data
        if (!results || results.length < 0) return notes;
        for (const result of results) {
            let [expression, reading, extrainfo, defs] = result;
            extrainfo = extrainfo ? `<span class="star">${extrainfo}</span>` : '';
            let audios = [];
            audios[0] = `http://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
            audios[1] = `http://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;

            let definitions = [];
            for (const def of defs) {
                let definition = '';
                let pos = def.substring(0, def.indexOf('.') + 1).trim();
                let chn_tran = def.substring(def.indexOf('.') + 1, def.indexOf('<br>')).trim();
                // 'phrase.'.length = 7 which means the longest position length is 7
                if (pos.length > 7) {
                    pos = '';
                    chn_tran = def.substring(0, def.indexOf('<br>')).trim();
                }
                let eng_tran = def.substring(def.indexOf('<br>') + 4, def.length).trim();
                pos = pos ? `<span class="pos">${pos}</span>` : '';
                chn_tran = chn_tran ? `<span class="chn_tran">${chn_tran}</span>` : '';
                eng_tran = eng_tran ? `<span class="eng_tran">${eng_tran}</span>` : '';
                definition = `${pos}<span class="tran">${eng_tran}${chn_tran}</span>`;
                definitions.push(definition);
            }

            let css = this.renderCSS();
            notes.push({
                css,
                expression,
                reading,
                extrainfo,
                definitions,
                audios
            });
        }

        return notes;
    }

    renderCSS() {
        let css = `
            <style>
                span.star {color: #FFBB00;}
                span.cet  {margin: 0 3px;padding: 0 3px;font-weight: normal;font-size: 0.8em;color: white;background-color: #5cb85c;border-radius: 3px;}
                span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                span.tran {margin:0; padding:0;}
                span.eng_tran {margin-right:3px; padding:0;}
                span.chn_tran {color:#0d47a1;}
                ul.sents {font-size:0.8em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent  {margin:0; padding:0;}
                span.eng_sent {margin-right:5px;}
                span.chn_sent {color:#0d47a1;}
            </style>`;
        return css;
    }
}