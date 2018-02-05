if (typeof encn_Oxford == 'undefined') {

    class encn_Oxford {
        constructor(options) {
            this.options = options;
            this.word = '';
            this.base = 'https://cn.bing.com/dict/search?q='

        }

        resourceURL(word) {
            return this.base + encodeURIComponent(word);
        }

        async findTerm(word) {
            this.word = word;
            let deflection = formhelper.deinflect(word);
            let results = await Promise.all([this.findOxford(word), this.findOxford(deflection), this.findEC(word)]);
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

        async findOxford(word) {
            let notes = [];

            if (word) {
                let url = this.resourceURL(word);
                let data = await this.onlineQuery(url);
                let regexp = /(<div class="qdef">(.|[\r\n])+)<div class="se_div">/gi;
                let match = regexp.exec(data);
                if (!match)
                    return [];

                let doc = document.createElement("div");
                doc.innerHTML = match[1];


                let expression = doc.querySelector('#headword');
                expression = expression ? expression.innerText.trim() : ''; //headword
                let reading_us = doc.querySelector('.hd_prUS');
                reading_us = reading_us ? reading_us.innerText.trim().match(/\[.+\]/gi) : ''; // phonetic US
                let reading_uk = doc.querySelector('.hd_pr');
                reading_uk = reading_uk ? reading_uk.innerText.trim().match(/\[.+\]/gi) : ''; // phonetic UK
                let reading = `UK${reading_uk} US${reading_us}`;

                let audios = [];
                let audioslinks = doc.querySelectorAll('.hd_tf a');
                if (audioslinks)
                    for (const [index, audiolink] of audioslinks.entries()) {
                        audios[index] = audiolink.getAttribute('onmouseover').match(/(?<=this,').+?(?=')/gi) || '';
                    }
                

                let entries = doc.querySelectorAll('#authid .each_seg');
                if (entries) {
                    for (const entry of entries) {
                        let definitions = [];
                        let pos = entry.querySelector('.pos') ? `<span class='pos'>${entry.querySelector('.pos').innerText.trim()}</span>` : '';
                        let defblocks = entry.querySelectorAll('.se_lis');
                        if (defblocks) {
                            for (const defblock of defblocks) {
                                let tran = defblock.querySelector('.val');
                                let chn_tran = defblock.querySelector('.bil');
                                if (tran) {
                                    let definition = '';
                                    chn_tran = chn_tran ? `<span class='chn_tran'>${chn_tran.innerText.trim()}</span>` : '';
                                    tran = `<span class='tran'>${tran.innerText.trim()}${chn_tran}</span>`;
                                    definition += `${pos}${tran}`;
                                    // make exmaple sentence segement
                                    if (defblock.nextSibling && defblock.nextSibling.className == 'li_exs'){
                                        let examps = defblock.nextSibling.querySelectorAll('.li_ex');
                                        if (examps.length > 0) {
                                            definition += '<ul class="sents">';
                                            for (const [index, examp] of examps.entries()) {
                                                if (index > 1) break; // to control only 2 example sentence.
                                                let eng_examp = examp.querySelector('.val_ex');
                                                eng_examp = eng_examp ? eng_examp.innerText.trim() : '';
                                                let chn_examp = examp.querySelector('.bil_ex');
                                                chn_examp = chn_examp ? chn_examp.innerText.trim() : '';
                                                definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                                            }
                                            definition += '</ul>';
                                        }
                                    }
                                    // add into difinition array
                                    definitions.push(definition);
                                }
                            }
                        }
                        //process idiom
                        let idmsents = entry.querySelectorAll('.idm_s');
                        if (idmsents) {
                            for (const idmsent of idmsents) {
                                let idmphrase = `<div class="idmphrase">${idmsent.innerText.trim()}</div>`;
                                if (idmsent.nextSibling && idmsent.nextSibling.className == 'li_ids_co'){
                                    let idmblock = idmsent.nextSibling;
                                    let tran = idmblock.querySelector('.val');
                                    let chn_tran = idmblock.querySelector('.bil');
                                    if (tran) {
                                        let definition = '';
                                        chn_tran = chn_tran ? `<span class='chn_tran'>${chn_tran.innerText.trim()}</span>` : '';
                                        tran = `<span class='tran'>${tran.innerText.trim()}${chn_tran}</span>`;
                                        definition += `${idmphrase}${tran}`;
                                        // make exmaple sentence segement
                                        let eng_examp = idmblock.querySelector('.val_ex');
                                        let chn_examp = idmblock.querySelector('.bil_ex');
                                        if (eng_examp && chn_examp){
                                            eng_examp = eng_examp ? eng_examp.innerText.trim() : '';
                                            chn_examp = chn_examp ? chn_examp.innerText.trim() : '';
                                            definition += '<ul class="sents">';
                                            definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                                            definition += '</ul>';
                                        }
                                        // add into difinition array
                                        definitions.push(definition);
                                    }
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
                div.idmphrase{
                    font-weight: bold;
                    margin: 0;
                    padding: 0;
                }
            </style>`;
            return css;
        }
    }

    registerDict(chrome.i18n.getMessage('encn_Oxford'), encn_Oxford);

}