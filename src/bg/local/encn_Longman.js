if (typeof encn_Longman == 'undefined') {

    class encn_Longman {
        constructor(options) {
            this.options = options;
            this.word = '';
            this.base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec","longman"]]}&xmlVersion=5.1&q='
        }

        resourceURL(word) {
            return this.base + encodeURIComponent(word);
        }

        async findTerm(word) {
            this.word = word;
            let deflection = formhelper.deinflect(word);
            let results = await Promise.all([this.findLongman(word), this.findLongman(deflection), this.findEC(word)]);
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

        async findLongman(word) {
            let notes = [];

            if (!word) return notes;
            let url = this.resourceURL(word);
            let data = await this.onlineQuery(url);

            if (!data.longman) return notes;
            for (const word of data.longman.wordList) {
                let definitions = [];
                let audios = [];

                let expression = word.Entry.Head[0].HWD ? word.Entry.Head[0].HWD[0] : ''; //headword
                let reading = word.Entry.Head[0].PronCodes ? word.Entry.Head[0].PronCodes[0].PRON[0] : ''; // phonetic
                audios[0] = word.Entry.Head[0].VIDEOCAL ? word.Entry.Head[0].VIDEOCAL[0] : [];
                let extra = word.Entry.Head[0].GRAM ? word.Entry.Head[0].GRAM[0] : '';
                let pos = word.Entry.Head[0].POS ? word.Entry.Head[0].POS[0] : '';
                pos = pos ? `<span class='pos'>${pos}</span>` : '';

                for (const sense of word.Entry.Sense) {
                    let chn_tran = sense.TRAN ? `<span class='chn_tran'>${sense.TRAN[0]}</span>` : '';
                    let eng_tran = sense.DEF ? `<span class='eng_tran'>${sense.DEF[0]}</span>` : '';
                    if (!chn_tran || !eng_tran) continue;
                    let definition = '';
                    definition += `${pos}<span class="tran">${eng_tran}${chn_tran}</span>`;
                    // make exmaple sentence segement
                    let eng_examples = sense.EXAMPLE ? sense.EXAMPLE : [];
                    let chn_examples = sense.EXAMPLETRAN ? sense.EXAMPLETRAN : []
                    if (eng_examples.length > 0 && chn_examples.length > 0) {
                        definition += '<ul class="sents">';
                        for (const [index, example] of eng_examples.entries()) {
                            if (index > 1) break; // to control only 2 example sentence.
                            definition += `<li class='sent'><span class='eng_sent'>${eng_examples[index]}</span><span class='chn_sent'>${chn_examples[index]}</span></li>`;
                        }
                        definition += '</ul>';
                    }
                    // add into difinition array
                    definitions.push(definition);
                }

                let css = this.renderCSS();
                notes.push({
                    css,
                    expression,
                    reading,
                    extra,
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
            let audios = [];
            let definition = '<ul class="ec">';
            const trs = data.ec.word ? data.ec.word[0].trs : [];
            for (const tr of trs)
                definition += `<li class="ec"><span class="ec_chn">${tr.tr[0].l.i[0]}</span></li>`;
            definition += '</ul>';
            let css = `
            <style>
                ul.ec, li.ec {list-style: square inside; margin:0; padding:0;}
                span.ec_chn {margin-left: -10px;}
            </style>`;
            notes.push({
                css,
                expression,
                reading,
                definitions: [definition],
                audios,
            });
            return notes;
        }


        renderCSS() {
            let css = `
            <style>
                span.pos{
                    text-transform: lowercase;
                    font-size: 0.9em;
                    margin-right: 5px;
                    padding: 2px 4px;
                    color: white;
                    background-color: #0d47a1;
                    border-radius: 3px;
                }
                span.tran{
                    margin: 0;
                    padding: 0;
                }
                span.eng_tran{
                    margin-right: 3px;
                    padding: 0;
                }
                span.chn_tran{
                    color:#0d47a1;
                }
                ul.sents{
                    font-size: 0.9em;
                    list-style: square inside;
                    margin: 3px 0;
                    padding: 5px;
                    background: rgba(13,71,161,0.1);
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
                    color:#0d47a1;
                }
            </style>`;
            return css;
        }
    }

    registerDict(chrome.i18n.getMessage('encn_Longman'), encn_Longman);

}