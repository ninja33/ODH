/* global api */
class builtin_encn_Collins {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '柯林斯英汉双解(内置)';
        if (locale.indexOf('TW') != -1) return '柯林斯英漢雙解(內置)';
        return 'Collins EN->CN Dictionary((builtin))';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        let list = [];
        let word_stem = await api.deinflect(word) || [];
        if (word.toLowerCase() != word) {
            let lowercase = word.toLowerCase();
            let lowercase_stem = await api.deinflect(lowercase) || [];
            list = [word, word_stem, lowercase, lowercase_stem];
        } else {
            list = [word, word_stem];
        }
        let promises = list.map((item) => this.findCollins(item));
        let results = await Promise.all(promises);
        return [].concat(...results).filter(x => x);
    }

    async findCollins(word) {
        const maxexample = this.maxexample;
        let notes = [];

        if (!word) return notes;
        let result = {};
        try {
            result = JSON.parse(await api.getBuiltin('collins', word));
        } catch (err) {
            return [];
        }

        //get Collins Data
        if (!result) return notes;
        let expression = word;
        let reading = '';
        if (result.readings && result.readings.length > 0) {
            reading = `/${result.readings[0]}/`;
            //let lable = ['UK','US'];
            //for (const [idx,rd] of result.readings.entries()){
            //    if (idx > 1) break;
            //    reading = reading + `${lable[idx]}[${rd}]`;
            //}
        }
        let extrainfo = result.star;
        let defs = result.defs;

        extrainfo = extrainfo ? `<span class="star">${extrainfo}</span>` : '';
        let audios = [];
        audios[0] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
        audios[1] = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;

        let definitions = [];
        for (const def of defs) {
            let definition = '';
            let pos = def.pos_en;
            let chn_tran = def.def_cn;
            let eng_tran = def.def_en;
            pos = pos ? `<span class="pos">${pos}</span>` : '';
            chn_tran = chn_tran ? `<span class="chn_tran">${chn_tran}</span>` : '';
            eng_tran = eng_tran ? `<span class="eng_tran">${eng_tran.replace(RegExp(expression, 'gi'),`<b>${expression}</b>`)}</span>` : '';
            definition = `${pos}<span class="tran">${eng_tran}${chn_tran}</span>`;

            // make exmaple sentence segement
            if (def.ext && def.ext.length > 0 && maxexample > 0) {
                definition += '<ul class="sents">';
                for (const [idx, ex] of def.ext.entries()) {
                    if (idx > maxexample - 1) break; // to control only n example sentences defined in option.
                    let chn_sent = ex.ext_cn;
                    let eng_sent = ex.ext_en.replace(RegExp(expression, 'gi'),`<b>${expression}</b>`);
                    definition += `<li class='sent'><span class='eng_sent'>${eng_sent}</span><span class='chn_sent'>${chn_sent}</span></li>`;
                }
                definition += '</ul>';
            }

            definitions.push(definition);
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
                ul.sents {font-size:0.8em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent  {margin:0; padding:0;}
                span.eng_sent {margin-right:5px;}
                span.chn_sent {color:#0d47a1;}
            </style>`;
        return css;
    }
}