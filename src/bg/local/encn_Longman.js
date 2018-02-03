if (typeof encn_Collins == 'undefined') {

    class encn_Collins {
        constructor() {
            this.word = '';
            this.base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec",longman"]]}&xmlVersion=5.1&q='

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
                const collinsroot = data.collins.collins_entries[0]
                const expression = collinsroot.headword; //headword
                const reading = collinsroot.phonetic; // phonetic
                const audios = [] // uk and us audio
                audios[0] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
                audios[1] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;
                const definitions = [];
                const entries = collinsroot.entries ? collinsroot.entries.entry : [];
                for (const entry of entries) {
                    const transroot = entry.tran_entry[0]
                    const pos = transroot.pos_entry ? `<span class='pos'>${transroot.pos_entry.pos}</span>` : '';
                    let tran = transroot.tran ? `<span class='tran'>${transroot.tran}</span>` : '';
                    if (tran){
                        tran = tran.replace(/[\u4e00-\u9fa5]+/gi, '<span class="chn_tran">$&</span>');
                        let definition = `${pos}${tran}`;
                        // make exmaple sentence segement
                        definition += '<ul class="sents">';
                        let sents = transroot.exam_sents ? transroot.exam_sents.sent : [];
                        for (const sent of sents) {
                            definition += `<li class='sent'><span class='eng_sent'>${sent.eng_sent}</span><span class='chn_sent'>${sent.chn_sent}</span></li>`;
                        }
                        definition += '</ul>';
                        // add into difinition array
                        definitions.push(definition);
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
                    background-color: grey;
                    border-radius: 3px;
                }
                span.chn_tran{
                    color:#3F51B5;
                }
                ul.sents{
                    list-style: square inside;
                    margin: 5px 0;
                    padding: 0;
                }
                li.sent{
                    margin: 5px 0;
                    padding: 0;
                }
                span.eng_sent{
                    margin-right: 5px;
                    color: black;
                }
                span.chn_sent{
                    margin: 5px;
                    color: #3F51B5;
                }
            </style>`;
            return css;
        }
    }

    registerDict(chrome.i18n.getMessage('encn_Collins'), encn_Collins);

}