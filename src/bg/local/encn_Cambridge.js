if (typeof encn_Cambridge == 'undefined') {

    class encn_Cambridge {
        constructor(options) {
            this.options = options;
            this.maxexample = options.maxexample;
            this.word = '';
            this.base = 'https://dictionary.cambridge.org/search/english-chinese-simplified/direct/?q='

        }

        resourceURL(word) {
            return this.base + encodeURIComponent(word);
        }

        async findTerm(word) {
            this.word = word;
            //let deflection = formhelper.deinflect(word);
            let results = await Promise.all([this.findCambridge(word), this.findEC(word)]);
            return [].concat(...results);
        }

        async onlineQuery(url) {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url,
                    type: "GET",
                    timeout: 5000,
                    error: (xhr, status, error) => {
                        reject(error);
                    },
                    success: (data, status) => {
                        if (data) {
                            resolve(data);
                        } else {
                            reject(new Error('Not Found!'));
                        }
                    }
                });
            });
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

            let url = this.resourceURL(word);
            let data = await this.onlineQuery(url);
            let parser = new DOMParser(),
            doc = parser.parseFromString(data, "text/html");

            let entries = doc.querySelectorAll('.cdo-dblclick-area .entry-body__el') || [];
            for (const entry of entries) {
                let definitions = [];
                let audios = [];

                let expression = T(entry.querySelector('.headword'));
                let reading = '';
                let readings = entry.querySelectorAll('.pron-info .ipa')
                if (readings) {
                    let reading_uk = T(readings[0]);
                    let reading_us = T(readings[1]);
                    reading = (reading_uk || reading_us) ? `UK[${reading_uk}] US[${reading_us}] ` : '';
                }
                let pos = T(entry.querySelector('.posgram'));
                pos = pos ? `<span class='pos'>${pos}</span>` : '';
                audios[0] = entry.querySelector('.pron-info>.us .audio_play_button');
                audios[0] = audios[0] ? audios[0].getAttribute('data-src-mp3') : '';
                audios[1] = entry.querySelector('.pron-info>.uk .audio_play_button');
                audios[1] = audios[1] ? audios[1].getAttribute('data-src-mp3') : '';

                let sensbodys = entry.querySelectorAll('.sense-body') || [];
                for (const sensbody of sensbodys) {
                    let sensblocks = sensbody.childNodes || [];
                    for (const sensblock of sensblocks) {
                        let phrasehead = '';
                        let defblocks = [];
                        if (sensblock.classList && sensblock.classList.contains('phrase-block')) {
                            phrasehead = T(sensblock.querySelector('.phrase-title'));
                            phrasehead = phrasehead ? `<div class="phrasehead">${phrasehead}</div>` : '';
                            defblocks = sensblock.querySelectorAll('.def-block') || [];
                        };
                        if (sensblock.classList && sensblock.classList.contains('def-block')) {
                            defblocks = [sensblock];
                        };
                        if (defblocks.length <= 0) continue;

                        // make definition segement
                        for (const defblock of defblocks) {
                            let eng_tran = T(defblock.querySelector('.def-head .def'));
                            let chn_tran = T(defblock.querySelector('.def-body .trans'));
                            if (!eng_tran || !chn_tran) continue;
                            let definition = '';
                            eng_tran = `<span class='eng_tran'>${eng_tran}</span>`;
                            chn_tran = `<span class='chn_tran'>${chn_tran}</span>`;
                            let tran = `<span class='tran'>${eng_tran}${chn_tran}</span>`;
                            definition += phrasehead ? `${phrasehead}${tran}` : `${pos}${tran}`;

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
                    }
                }
                let css = this.renderCSS();
                notes.push({
                    css,
                    expression,
                    reading,
                    definitions,
                    audios
                });
            }
            return notes;
        }

        async findEC(word) {
            let notes = [];

            if (!word) return notes;

            let base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec"]]}&xmlVersion=5.1&q='
            let url = base + encodeURIComponent(word);
            let data = await this.onlineQuery(url);

            if (!data.ec) return notes;
            let expression = data.ec.word[0]['return-phrase'].l.i;
            let reading = data.ec.word[0].phone || data.ec.word[0].ukphone;

            let extrainfo = '';
            let types = data.ec.exam_type || [];
            for (const type of types) {
                extrainfo += `<span class="examtype">${type}</span>`
            }

            let definition = '<ul class="ec">';
            const trs = data.ec.word ? data.ec.word[0].trs : [];
            for (const tr of trs)
                definition += `<li class="ec"><span class="ec_chn">${tr.tr[0].l.i[0]}</span></li>`;
            definition += '</ul>';
            let css = `
            <style>
                span.examtype {margin: 0 3px;padding: 0 3px;font-weight: normal;font-size: 0.8em;color: white;background-color: #5cb85c;border-radius: 3px;}
                ul.ec, li.ec {list-style: square inside; margin:0; padding:0;}
                span.ec_chn {margin-left: -5px;}
            </style>`;
            notes.push({
                css,
                expression,
                reading,
                extrainfo,
                definitions: [definition],
            });
            return notes;
        }

        renderCSS() {
            let css = `
            <style>
                div.phrasehead{margin: 2px 0;font-weight: bold;}
                span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                span.tran {margin:0; padding:0;}
                span.eng_tran {margin-right:3px; padding:0;}
                span.chn_tran {color:#0d47a1;}
                ul.sents {font-size:0.9em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent  {margin:0; padding:0;}
                span.eng_sent {margin-right:5px;}
                span.chn_sent {color:#0d47a1;}
            </style>`;
            return css;
        }
    }

    registerDict(chrome.i18n.getMessage('encn_Cambridge'), encn_Cambridge);

}