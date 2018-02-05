if (typeof encn_Collins == 'undefined') {

    class encn_Collins {
        constructor(options) {
            this.options = options;
            this.word = '';
            this.base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec","collins"]]}&xmlVersion=5.1&q='
        }

        resourceURL(word) {
            return this.base + encodeURIComponent(word);
        }

        async findTerm(word) {
            this.word = word;
            //let deflection = formhelper.deinflect(word);
            let results = await Promise.all([this.findCollins(word), this.findEC(word)]);
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

        async findCollins(word) {
            let notes = [];

            if (word) {
                let url = this.resourceURL(word);
                let data = await this.onlineQuery(url);

                if (data.collins) {
                    for (const collins_entry of data.collins.collins_entries) {
                        let definitions = [];
                        let audios = [];

                        let expression = collins_entry.headword; //headword
                        let reading = collins_entry.phonetic || ''; // phonetic
                        audios[0] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
                        audios[1] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;

                        for (const entry of collins_entry.entries.entry) {
                            let definition = '';
                            for (const tran_entry of entry.tran_entry) {
                                const pos = tran_entry.pos_entry ? `<span class='pos'>${tran_entry.pos_entry.pos}</span>` : '';
                                let tran = tran_entry.tran ? `<span class='tran'>${tran_entry.tran}</span>` : '';
                                if (tran) {
                                    tran = tran.replace(/([\u4e00-\u9fa5]|( ?\()|(\) ?))+/gi, '<span class="chn_tran">$&</span>');
                                    definition += `${pos}${tran}`;
                                    // make exmaple sentence segement
                                    let sents = tran_entry.exam_sents ? tran_entry.exam_sents.sent : [];
                                    if (sents.length > 0) {
                                        definition += '<ul class="sents">';
                                        for (const [index, sent] of sents.entries()) {
                                            if (index > 1) break; // to control only 2 example sentence.
                                            definition += `<li class='sent'><span class='eng_sent'>${sent.eng_sent}</span><span class='chn_sent'>${sent.chn_sent}</span></li>`;
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
                let url = this.resourceURL(word);
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

    registerDict(chrome.i18n.getMessage('encn_Collins'), encn_Collins);

}