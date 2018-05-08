/* global api */
class sunset_encn_Youdao {
    constructor() {
        this.options = null;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1)
            return '(在线)有道英汉简明';
        if (locale.indexOf('TW') != -1)
            return '(在線)有道英漢簡明';
        return '(online)encn_Youdao';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        //let deflection = await api.deinflect(word);
        let results = await Promise.all([this.findEC(word)]);
        return [].concat(...results).filter(x => x);
    }

    async findEC(word) {
        let notes = [];

        if (!word) return notes;

        let base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec"]]}&xmlVersion=5.1&q=';
        let url = base + encodeURIComponent(word);
        let data = '';
        try {
            data = JSON.parse(await api.fetch(url));
        } catch (err) {
            return [];
        }

        if (!data || !data.ec) return notes;
        let expression = data.ec.word[0]['return-phrase'].l.i;
        let reading = data.ec.word[0].phone || data.ec.word[0].ukphone;
        //let reading = putSoundTag(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`);

        let extrainfo = '';
        let types = data.ec.exam_type || [];
        for (const type of types) {
            extrainfo += `<span class="examtype">${type}</span>`;
        }

        let audios = [];
        audios[0] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
        audios[1] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;

        let definition = '<ul class="ec">';
        const trs = data.ec.word ? data.ec.word[0].trs : [];
        for (const tr of trs)
            definition += `<li class="ec"><span class="ec_chn">${tr.tr[0].l.i[0]}</span></li>`;
        definition += '</ul>';
        let css = `
            <style>
                span.examtype {margin: 0 3px;padding: 0 3px;font-weight: normal;font-size: 0.8em;color: white;background-color: #5cb85c;border-radius: 3px;}
                ul.ec, li.ec {list-style: square inside; margin:0; padding:0;}
                span.ec_chn {}
            </style>`;
        notes.push({
            css,
            expression,
            reading,
            extrainfo,
            definitions: [definition],
            audios
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