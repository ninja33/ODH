class encn_Collins {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1)
            return '柯林斯双解英汉词典';
        if (locale.indexOf('TW') != -1)
            return '柯林斯雙解英漢詞典';
        return 'encn_Collins';
    }


    setOptions(options){
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        //let deflection = api.deinflect(word);
        let results = await Promise.all([this.findCollins(word), this.findEC(word)]);
        return [].concat(...results);
    }

    async findCollins(word) {
        let notes = [];

        if (!word) return notes;
        let base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec","collins"]]}&xmlVersion=5.1&q='
        let url = base + encodeURIComponent(word);
        let data = '';
        try{
            data = JSON.parse(await api.fetch(url));
        } catch (err) {
            return [];
        }

        if (!data.collins) return notes;
        for (const collins_entry of data.collins.collins_entries) {
            let definitions = [];
            let audios = [];

            let expression = collins_entry.headword; //headword
            let reading = collins_entry.phonetic || ''; // phonetic

            let extra_star = "";
            let extra_cet = "";
            let cets = collins_entry.basic_entries.basic_entry[0].cet || '';
            if (cets) {
                for (const cet of cets.split(' ')) {
                    extra_cet += `<span class="cet">${cet}</span>`
                }
            }

            let star = collins_entry.star || '';
            extra_star = star ? `<span class="star">${'\u2605'.repeat(Number(star))}</span>` : '';
            let extrainfo = extra_star + extra_cet;

            audios[0] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
            audios[1] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;

            if (!collins_entry.entries) continue;
            for (const entry of collins_entry.entries.entry) {
                for (const tran_entry of entry.tran_entry) {
                    let definition = '';
                    const pos = tran_entry.pos_entry ? `<span class='pos'>${tran_entry.pos_entry.pos}</span>` : '';
                    if (!tran_entry.tran) continue;
                    let chn_tran = tran_entry.tran.match(/([\u4e00-\u9fa5]|;|( ?\()|(\) ?))+/gi).join(' ').trim();
                    let eng_tran = tran_entry.tran.replace(/([\u4e00-\u9fa5]|;|( ?\()|(\) ?))+/gi, '').trim();
                    chn_tran = chn_tran ? `<span class="chn_tran">${chn_tran}</span>` : '';
                    eng_tran = eng_tran ? `<span class="eng_tran">${eng_tran}</span>` : '';
                    definition += `${pos}<span clas="tran">${eng_tran}${chn_tran}</span>`;
                    // make exmaple sentence segement
                    let sents = tran_entry.exam_sents ? tran_entry.exam_sents.sent : [];
                    if (sents.length > 0 && this.maxexample > 0) {
                        definition += '<ul class="sents">';
                        for (const [index, sent] of sents.entries()) {
                            if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                            definition += `<li class='sent'><span class='eng_sent'>${sent.eng_sent}</span><span class='chn_sent'>${sent.chn_sent}</span></li>`;
                        }
                        definition += '</ul>';
                    }
                    definitions.push(definition);
                }
            }

            let css = this.renderCSS();
            notes.push({
                css,
                expression,
                reading,
                extrainfo,
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
        let data = '';
        try{
            data = JSON.parse(await api.fetch(url));
        } catch (err) {
            return [];
        }

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
                span.star {color: #FFBB00;}
                span.cet  {margin: 0 3px;padding: 0 3px;font-weight: normal;font-size: 0.8em;color: white;background-color: #5cb85c;border-radius: 3px;}
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