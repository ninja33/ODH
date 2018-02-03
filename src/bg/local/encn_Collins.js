if (typeof encn_Collins == 'undefined') {

    class encn_Collins {
        constructor() {
            this.word = '';
            this.base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec",collins"]]}&xmlVersion=5.1&q='

        }

        resourceURL() {
            return this.base + encodeURIComponent(this.word);
        }

        findTerm(word) {
            this.word = word;
            let url = this.resourceURL();
            return this.onlineQuery(url);
        }

        onlineQuery(url) {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url,
                    type: "GET",
                    timeout: 5000,
                    error: (xhr, status, error) => {
                        reject(error);
                    },
                    success: (data, status) => {
                        let result = this.renderContent(data);
                        if (result) {
                            resolve(result);
                        } else {
                            reject(new Error('Not Found!'));
                        }
                    }
                });
            });
        }

        removeTags(elem, list) {
            for (const name of list) {
                let tags = elem.querySelectorAll(name);
                for (const div of tags) {
                    div.outerHTML = "";
                };
            }
        }

        removelinks(elem) {
            let tags = elem.querySelectorAll('a');
            for (const div of tags) {
                div.outerHTML = div.innerText;
            };
        }

        renderContent(data) {
            //let result = JSON.parse(data);

            if (data.collins) {
                let entries = [];
                let expression ='';
                let reading = '';
                let audios=[];
                let definitions = [];
                for (const collins_entry of data.collins.collins_entries) {
                    expression = collins_entry.headword; //headword
                    reading = collins_entry.phonetic; // phonetic
                    audios[0] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
                    audios[1] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;
                    for (const entry of collins_entry.entries.entry) {
                        let definition = '';
                        for (const tran_entry of entry.tran_entry){
                            const pos = tran_entry.pos_entry ? `<span class='pos'>${tran_entry.pos_entry.pos}</span>` : '';
                            let tran = tran_entry.tran ? `<span class='tran'>${tran_entry.tran}</span>` : '';
                            if (tran) {
                                tran = tran.replace(/[\u4e00-\u9fa5]+/gi, '<span class="chn_tran">$&</span>');
                                definition += `${pos}${tran}`;
                                // make exmaple sentence segement
                                let sents = tran_entry.exam_sents ? tran_entry.exam_sents.sent : [];
                                if (sents.length > 0){
                                    definition += '<ul class="sents">';
                                    for (const sent of sents) {
                                        definition += `<li class='sent'><span class='eng_sent'>${sent.eng_sent}</span><span class='chn_sent'>${sent.chn_sent}</span></li>`;
                                    }
                                    definition += '</ul>';
                                }
                            // add into difinition array
                            definitions.push(definition);
                            }
                        }
                    }
                }
                let css = this.renderCSS();
                let note = {
                    css,
                    expression,
                    reading,
                    definitions,
                    audios
                }
                return note;
            } else if (data.ec) {
                let note = '<ul>';
                const trs = data.ec.word ? data.ec.word[0].trs : [];
                for (const tr of trs)
                    note += `<li>${tr.tr[0].l.i[0]}</li>`;
                note += '</ul>';
                return `<style>ul, li {list-style: square inside;margin:0;padding:0} </style>` + note;
            } else {
                return null;
            }

        }

        renderCSS() {
            let css = `
            <style>
                span.pos{
                    margin-right: 5px;
                    padding: 0 3px;
                    text-transform: lowercase;
                    color: white;
                    background-color: #0d47a1;
                    border-radius: 3px;
                }
                span.chn_tran{
                    color:#0d47a1;
                    word-break: keep-all;
                }
                ul.sents{
                    list-style: square inside;
                    margin: 3px 0;
                    padding: 5px;
                    background: #0d47a11a;
                    border-radius: 5px;
                }
                li.sent{
                    margin: 0;
                    padding: 0;
                }
                span.eng_sent{
                    margin-right: 5px;
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