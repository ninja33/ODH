if (typeof encn_Cambridge == 'undefined') {

    class encn_Cambridge {
        constructor(options) {
            this.options = options;
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

            if (word) {
                let url = this.resourceURL(word);
                let data = await this.onlineQuery(url);
                let regexp = /(<div class="cdo-dblclick-area">(.|[\r\n])+)<div class="definition-src">/gi;
                let match = regexp.exec(data);
                if (!match)
                    return [];

                let doc = document.createElement("div");
                doc.innerHTML = match[1];

                let entries = doc.querySelectorAll('.entry-body__el');
                if (entries) {
                    for (const entry of entries) {
                        let definitions = [];
                        let audios = [];

                        let expression = entry.querySelector('.headword')
                        expression = expression ? expression.innerText.trim() : ''; //headword
                        let reading = '';
                        let readings = entry.querySelectorAll('.pron-info .ipa')
                        if (readings) {
                            let reading_uk = readings[0] ? readings[0].innerText.trim() : '';
                            let reading_us = readings[1] ? readings[1].innerText.trim() : '';
                            reading = (reading_uk || reading_us) ? `UK[${reading_uk}] US[${reading_us}] ` : '';
                        }
                        let pos = entry.querySelector('.posgram')
                        pos = pos ? `<span class='pos'>${pos.innerText.trim()}</span>` : '';
                        audios[0] = entry.querySelector('.pron-info>.us .audio_play_button')
                        audios[0] = audios[0] ? audios[0].getAttribute('data-src-mp3') : '';
                        audios[1] = entry.querySelector('.pron-info>.uk .audio_play_button');
                        audios[1] = audios[1] ? audios[1].getAttribute('data-src-mp3') : '';

                        let defblocks = entry.querySelectorAll('.def-block');
                        if (defblocks) {
                            for (const defblock of defblocks) {
                                let tran = defblock.querySelector('.def-head .def').innerText.trim();
                                let chn_tran = defblock.querySelector('.def-body .trans').innerText.trim();
                                if (tran) {
                                    let definition = '';
                                    chn_tran = chn_tran ? `<span class='chn_tran'>${chn_tran}</span>` : '';
                                    tran = `<span class='tran'>${tran}${chn_tran}</span>`;
                                    definition += `${pos}${tran}`;
                                    // make exmaple sentence segement
                                    let examps = defblock.querySelectorAll('.def-body .examp');
                                    if (examps.length > 0) {
                                        definition += '<ul class="sents">';
                                        for (const [index, examp] of examps.entries()) {
                                            if (index > 1) break; // to control only 2 example sentence.
                                            let eng_examp = examp.querySelector('.eg');
                                            eng_examp = eng_examp ? eng_examp.innerText.trim() : '';
                                            let chn_examp = examp.querySelector('.trans');
                                            chn_examp = chn_examp ? chn_examp.innerText.trim() : '';
                                            definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                                        }
                                        definition += '</ul>';
                                    }
                                    // add into difinition array
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
                }
            }
            return notes;
        }

        async findEC(word) {
            let notes = [];
            if (word) {
                let base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec"]]}&xmlVersion=5.1&q='
                let url = base + encodeURIComponent(word);
                let data = await this.onlineQuery(url);

                if (data.ec) {
                    let definition = '<ul class="ec">';
                    const trs = data.ec.word ? data.ec.word[0].trs : [];
                    for (const tr of trs)
                        definition += `<li class="ec"><span class="ec_chn">${tr.tr[0].l.i[0]}</span></li>`;
                    definition += '</ul>';
                    let css = `
                    <style>
                        ul.ec, li.ec{
                            list-style: square inside;
                            margin:0;
                            padding:0
                        }
                        span.ec_chn{
                            margin-left: -10px;
                        }
                    </style>`;
                    notes.push({
                        css,
                        expression: data.ec.word[0]['return-phrase'].l.i,
                        reading: data.ec.word[0].phone || data.ec.word[0].ukphone,
                        definitions: [definition],
                        audios: [],
                    });
                }
            }
            return notes;
        }

        renderCSS() {
            let css = `
            <style>
                span.pos{
                    font-size: 0.85em;
                    margin-right: 5px;
                    padding: 0 3px;
                    color: white;
                    background-color: #0d47a1;
                    border-radius: 3px;
                }
                span.chn_tran{
                    margin-left: 5px;
                    color:#0d47a1;
                }
                ul.sents{
                    list-style: square inside;
                    margin: 3px 0;
                    padding: 5px;
                    background: rgba(13,71,161,0.1);;
                    border-radius: 5px;
                }
                li.sent{
                    margin: 0;
                    padding: 0;
                }
                span.eng_sent{
                    margin-right: 5px;
                    margin-left: -10px;
                    color: black;
                }
                span.chn_sent{
                    margin: 5px;
                    color:#0d47a1;
                }
            </style>`;
            return css;
        }
    }

    registerDict(chrome.i18n.getMessage('encn_Cambridge'), encn_Cambridge);

}