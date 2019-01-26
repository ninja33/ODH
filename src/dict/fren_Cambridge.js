/* global api */
class fren_Cambridge {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '剑桥法英词典';
        if (locale.indexOf('TW') != -1) return '剑桥法英词典';
        return 'Cambridge FR->EN Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        return await this.findCambridge(word);
    }

    async findCambridge(word) {
        let notes = [];
        if (!word) return notes; // return empty notes

        function T(node) {
            if (!node)
                return '';
            else
                return node.innerText.trim();
        }

        let base = 'https://dictionary.cambridge.org/search/french-english/direct/?q=';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let entries = doc.querySelectorAll('.cdo-dblclick-area .entry-body__el') || [];
        for (const entry of entries) {
            let definitions = [];
            let audios = [];

            let expression = T(entry.querySelector('.di-title'));
            let reading = T(entry.querySelector('.pron-info .ipa'));
            let pos = T(entry.querySelector('.posgram'));
            pos = pos ? `<span class='pos'>${pos}</span>` : '';

            let defblocks = entry.querySelectorAll('.def-block') || [];
            // make definition segement
            for (const defblock of defblocks) {
                let indicator = T(defblock.querySelector('.def-head .indicator'));
                let eng_tran = T(defblock.querySelector('.def-head .def'));
                let chn_tran = T(defblock.querySelector('.def-body .trans'));
                if (!eng_tran || !chn_tran) continue;
                let definition = '';
                eng_tran = `<span class='eng_tran'>${indicator} ${eng_tran}</span>`;
                chn_tran = `<span class='chn_tran'>${chn_tran}</span>`;
                let tran = `<span class='tran'>${eng_tran}${chn_tran}</span>`;
                definition += `${pos}${tran}`;

                // make exmaple segement
                let examps = defblock.querySelectorAll('.def-body .examp') || [];
                if (examps.length > 0 && this.maxexample > 0) {
                    definition += '<ul class="sents">';
                    for (const [index, examp] of examps.entries()) {
                        if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                        let eng_examp = T(examp.querySelector('.eg'));
                        let chn_examp = T(examp.querySelector('.trans'));
                        definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                    }
                    definition += '</ul>';
                }
                definitions.push(definition);
            }
            if (definitions.length > 0) {
                let css = this.renderCSS();
                notes.push({
                    css,
                    expression,
                    reading,
                    definitions,
                    audios
                });
            }
        }
        return notes;
    }

    renderCSS() {
        let css = `
            <style>
                div.phrasehead{margin: 2px 0;font-weight: bold;}
                span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                span.tran {margin:0; padding:0;}
                span.eng_tran {margin-right:3px; padding:0;}
                span.chn_tran {font-weight:bold; color:#0d47a1;}
                ul.sents {font-size:0.9em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent  {margin:0; padding:0;}
                span.eng_sent {margin-right:5px;}
                span.chn_sent {color:#0d47a1;}
            </style>`;
        return css;
    }
}