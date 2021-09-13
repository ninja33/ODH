/* global api */
class rucn_Qianyi {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '千亿词霸俄汉词典';
        if (locale.indexOf('TW') != -1) return '千亿词霸俄汉词典';
        return 'Qianyi RU->CN Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        return await this.findQianyi(word);
    }

    async findQianyi(word) {
        let notes = [];
        if (!word) return notes; // return empty notes

        function T(node) {
            if (!node)
                return '';
            else
                return node.innerText.trim();
        }

        let base = 'https://w.qianyix.com/index.php?q=';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let entries = doc.querySelectorAll('.baseword .view') || [];
        for (const entry of entries) {
            let definition = '';
            let expression = '';
            let audios = [];
            if (!entry.querySelector('.keyword').dataset.guid) continue;

            expression = T(entry.querySelector('.keyword'));
            audios = [];
            let audio = entry.querySelector('.speaker');
            audios[0] = audio ? audio.dataset.url : '';

            // make definition segement
            definition = '<ul class="exp">';
            let defblocks = entry.querySelector('.exp').innerHTML.split('<br>');
            for (const defblock of defblocks) {
                definition += `<li class="exp"><span class="exp_chn">${defblock}</span></li>`;
            }
            definition += '</ul>';

            // make exmaple segement
            let seq = entry.parentNode.id.slice(-1);
            let examps = doc.querySelectorAll(`#example${seq} .exp-item`) || [];
            if (examps.length > 0 && this.maxexample > 0) {
                definition += '<ul class="sents">';
                for (const [index, examp] of examps.entries()) {
                    if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                    let eng_examp = T(examp.querySelector('.exam-a'));
                    let chn_examp = T(examp.querySelector('.exam-b'));
                    definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                }
                definition += '</ul>';
            }

            let css = this.renderCSS();
            notes.push({
                css,
                expression,
                definitions: [definition],
                audios
            });
        }
        return notes;
    }

    renderCSS() {
        let css = `
            <style>
                ul.exp, li.exp {list-style: square inside; margin:0; margin-left: 2px; padding:0;}
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