class encn_Longman {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1)
            return '朗文英汉双解词典';
        if (locale.indexOf('TW') != -1)
            return '朗文英漢雙解詞典';
        return 'encn_Longman';
    }


    setOptions(options){
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        let deflection = await api.deinflect(word);
        let results = await Promise.all([this.findLongman(word), this.findLongman(deflection), this.findEC(word)]);
        return [].concat(...results).filter(x => x);
    }

    async findLongman(word) {
        let notes = [];
        if (!word) return notes;

        function T(node) {
            if (!node)
                return '';
            else if (Array.isArray(node))
                return node.join('');
            else
                return node;
        }

        let base = 'http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec","longman"]]}&xmlVersion=5.1&q='
        let url = base + encodeURIComponent(word);
        let data = '';
        try{
            data = JSON.parse(await api.fetch(url));
        } catch (err) {
            return [];
        }

        if (!data.longman) return notes;
        for (const entry of data.longman.wordList) {
            let definitions = [];

            let header = entry.Entry.Head[0];
            //let tailer = entry.Entry.Tail;

            let expression = T(header.HWD); //headword
            let reading = header.PronCodes ? header.PronCodes[0].PRON.join('/') : ''; // phonetic

            let audios = T(header.VIDEOCAL) ? [T(header.VIDEOCAL)] : [];

            let extrainfo = T(header.GRAM) ? `<span class='head_gram'>${T(header.GRAM)}</span>` : '';
            let freqs = header.FREQ || [];
            for (const freq of freqs) {
                extrainfo += `<span class="head_freq">${freq}</span>`;
            }

            let pos = T(header.POS) ? `<span class='pos'>${T(header.POS)}</span>` : '';

            let PhrHead = entry.Entry.PhrVbEntry ? entry.Entry.PhrVbEntry[0].Head[0] : '';
            expression = PhrHead ? T(PhrHead.PHRVBHWD) : expression;
            pos = PhrHead ? `<span class='pos'>${T(PhrHead.POS)}</span>` : pos;

            let senses = entry.Entry.Sense || (PhrHead ? entry.Entry.PhrVbEntry[0].Sense : '');
            for (const sense of senses) {
                let signpost = T(sense.SIGNPOST);
                let signtran = T(sense.SIGNTRAN);
                let sign = signpost && signtran ? `<div class="sign"><span class="eng_sign">${signpost}</span><span class="chn_sign">${signtran}</span></div>` : '';

                let subsenses = sense.Subsense || [sense];
                for (const subsense of subsenses) {
                    let chn_tran = subsense.TRAN ? `<span class='chn_tran'>${T(subsense.TRAN)}</span>` : '';
                    let eng_tran = subsense.DEF ? `<span class='eng_tran'>${T(subsense.DEF).replace(RegExp(expression, 'gi'),`<b>${expression}</b>`)}</span>` : '';
                    if (!chn_tran || !eng_tran) continue;
                    let definition = '';
                    definition += `${sign}${pos}<span class="tran">${eng_tran}${chn_tran}</span>`;
                    // make exmaple sentence segement
                    let eng_examples = subsense.EXAMPLE || [];
                    let chn_examples = subsense.EXAMPLETRAN || [];
                    if (eng_examples.length > 0 && chn_examples.length > 0 && this.maxexample > 0) {
                        definition += '<ul class="sents">';
                        for (const [index, example] of eng_examples.entries()) {
                            if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                            definition += `<li class='sent'><span class='eng_sent'>${eng_examples[index].replace(RegExp(expression, 'gi'),`<b>${expression}</b>`)}</span><span class='chn_sent'>${chn_examples[index]}</span></li>`;
                        }
                        definition += '</ul>';
                    }
                    // make grammar extra section
                    let grams = subsense.GramExa || [];
                    for (const gram of grams) {
                        let eng_gram_form = T(gram.PROPFORM) ? `<span class="eng_gram_form">${T(gram.PROPFORM)}</span>` : '';
                        let eng_gram_prep = T(gram.PROPFORMPREP) ? `<span class="eng_gram_prep">${T(gram.PROPFORMPREP)}</span>` : '';
                        let chn_gram_tran = T(gram.COLLOTRAN) ? `<span class="chn_gram_tran">${T(gram.COLLOTRAN)}</span>` : '';
                        if (!eng_gram_form && !eng_gram_prep) continue;
                        let eng_gram_gloss = T(gram.GLOSS) ? `<span class="eng_gram_gloss">${T(gram.GLOSS)}</span>` : '';
                        definition += `<span class="gram_extra">${eng_gram_form}${eng_gram_prep}${eng_gram_gloss}${chn_gram_tran}</span>`;
                        let eng_gram_examp = T(gram.EXAMPLE) ? `<span class="eng_gram_examp">${T(gram.EXAMPLE).replace(RegExp(expression, 'gi'),`<b>${expression}</b>`)}</span>` : '';
                        let chn_gram_examp = T(gram.EXAMPLETRAN) ? `<span class="chn_gram_examp">${T(gram.EXAMPLETRAN)}</span>` : '';
                        if (eng_gram_examp && chn_gram_examp && this.maxexample > 0)
                            definition += `<ul class="gram_examps"><li class="gram_examp">${eng_gram_examp}${chn_gram_examp}</li></ul>`;
                    }
                    definition && definitions.push(definition);
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
                span.head_gram{font-size: 0.8em;font-weight: bold;background-color: green;color: white;border-radius: 3px;margin: 0 3px;padding : 2px 3px;}
                span.head_freq{font-size: 0.8em;font-weight: bold;border: 1px solid red;border-radius:3px;color: red;margin: 0 3px;padding: 1px 2px;}
                span.pos{text-transform: lowercase;font-size: 0.9em;margin-right: 5px;padding: 2px 4px;color: white;background-color: #0d47a1;border-radius: 3px;}
                div.sign{font-weight: 0.9em;font-weight: bold;margin-bottom:3px;padding:0;}
                span.eng_sign{margin-right: 3px;}
                span.chn_sign{margin: 0;padding: 0;}
                span.tran,
                span.gram_extra{margin: 0;padding: 0;}
                span.eng_tran,
                span.eng_gram_form,
                span.eng_gram_prep,
                span.eng_gram_gloss{margin-right: 3px;padding: 0;}
                span.eng_gram_form,
                span.eng_gram_prep{font-weight: bold;display: block;}
                span.eng_gram_prep::before {content: "[+";}
                span.eng_gram_prep::after  {content: "]";}
                span.eng_gram_gloss::before{content: "(=";}
                span.eng_gram_gloss::after {content: ")";}
                span.eng_gram_gloss{font-style: italic;}
                span.chn_tran,
                span.chn_gram_tran{color: #0d47a1;}
                ul.sents,
                ul.gram_examps{font-size: 0.9em;list-style: square inside;margin: 3px 0;padding: 5px;background: rgba(13,71,161,0.1);border-radius: 3px;}
                li.sent,
                li.gram_examp{margin: 0;padding: 0;}
                span.eng_sent,
                span.eng_gram_examp{margin-right: 5px;color: black;}
                span.chn_sent,
                span.chn_gram_examp{color:#0d47a1;}
            </style>`;
        return css;
    }
}