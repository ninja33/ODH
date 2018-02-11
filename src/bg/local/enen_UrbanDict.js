if (typeof enen_UrbanDict == 'undefined') {

    class enen_UrbanDict {
        constructor(options) {
            this.options = options;
            this.maxexample = options.maxexample;
            this.word = '';
            this.base = 'https://www.urbandictionary.com/define.php?term='

        }

        resourceURL(word) {
            return this.base + encodeURIComponent(word);
        }

        async findTerm(word) {
            this.word = word;
            //let deflection = formhelper.deinflect(word);
            let results = await Promise.all([this.findUrbanDict(word), this.findEC(word)]);
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

        async findUrbanDict(word) {
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


            // make definition segement
            let definitions = [];
            let defblocks = doc.querySelectorAll('.def-panel') || [];
            for (const defblock of defblocks) {
                let eng_tran = T(defblock.querySelector('.meaning'));
                if (!eng_tran) continue;
                let definition = '';
                eng_tran = `<span class='eng_tran'>${eng_tran}</span>`;
                let tran = `<span class='tran'>${eng_tran}</span>`;
                definition += `${tran}`;

                // make exmaple segement
                let exampsnode = defblock.querySelector('.example') || '';
                if (!exampsnode) continue;
                exampsnode.innerHTML = exampsnode.innerHTML.replace("<br>", "@")
                let examps = exampsnode.innerText.split("@");
                if (examps.length > 0 && this.maxexample > 0) {
                    definition += '<ul class="sents">';
                    for (const [index, examp] of examps.entries()) {
                        if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                        definition += examp ? `<li class='sent'><span class='eng_sent'>${examp}</span></li>` : '';
                    }
                    definition += '</ul>';
                }
                definitions.push(definition);
            }
            let css = this.renderCSS();
            notes.push({
                css,
                definitions,
            });
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
                span.ec_chn {}
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

    registerDict(chrome.i18n.getMessage('enen_UrbanDict'), enen_UrbanDict);

}