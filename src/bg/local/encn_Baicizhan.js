if (typeof encn_Baicizhan == 'undefined') {

    class encn_Baicizhan {
        constructor(options) {
            this.options = options;
            this.word = '';
            this.base = 'http://mall.baicizhan.com/ws/search?w='

        }

        resourceURL(word) {
            return this.base + encodeURIComponent(word);
        }

        async findTerm(word) {
            this.word = word;
            let deflection = formhelper.deinflect(word);
            deflection = deflection ? deflection : word;
            let results = await Promise.all([this.findBaicizhan(deflection), this.findEC(word)]);
            return [].concat(...results);
        }

        async onlineQuery(url) {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url,
                    type: "GET",
                    dataType: "json",
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

        async findBaicizhan(word) {
            let notes = [];

            if (!word) return notes;
            let url = this.resourceURL(word);
            let note = await this.onlineQuery(url);

            if (!note.mean_cn) return notes;
            let definitions = [];
            let audios = [];
            let expression = note.word || ''; //headword
            let reading = note.accent || ''; // phonetic
            audios[0] = `http://baicizhan.qiniucdn.com/word_audios/${expression}.mp3`;
            let definition = `<ul class="bcz">`;
            let defs = note.mean_cn.split('\n');
            for (const def of defs) {
                    definition += `<li class="bcz"><span class="bcz_chn">${def}</span></li>`;
            }
            definition += `</ul>`;
            definition += note.df ? `<div class='bcz'><img src='${note.df}' /></div>` : '';
            definition += note.st && note.sttr ? `<ul class='sents'><li class='sent'><span class='eng_sent'>${note.st}</span><span class='chn_sent'>${note.sttr}</span></li></ul>` : '';
            definition += note.img ? `<div class='bcz'><img src='${note.img}' /></div>` : '';
            //definition += `<div class='bcz'><video width="340px" controls><source src='${note.tv}' type="video/mp4"></video></div>`;
            definitions.push(definition);
            let css = this.renderCSS();
            notes.push({
                css,
                expression,
                reading,
                definitions,
                audios,
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
            let expression = data.ec.word[0]['return-phrase'].l.i || '';
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
                span.ec_chn {margin-left: -5px;}
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
                ul.bcz, li.bcz{
                    list-style: square inside;
                    margin:0;
                    margin-left: 2px;
                    padding:0
                }
                .bcz img {
                    border: 1px dotted #ccc;
                    margin: 3px 0;
                    padding: 2px;
                    width: 350px;
                    border-radius: 5px;
                }
                span.bcz_chn{
                    margin-left: -10px;
                }
                span.chn_tran{
                    margin-left: 5px;
                    color:#0d47a1;
                }
                ul.sents{
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
                    margin-left: -5px;
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

    registerDict(chrome.i18n.getMessage('encn_Baicizhan'), encn_Baicizhan);

}