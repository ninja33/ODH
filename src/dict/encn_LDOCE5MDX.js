/* global api */
class encn_LDOCE5MDX {
    constructor(options) {
        this.options = options;
        this.maxexample = 6;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1)
            return '朗文英汉5词典(MDX)';
        if (locale.indexOf('TW') != -1)
            return '朗文英英5词典(MDX)';
        return 'enen_LDOCE5(MDX)';
    }


    setOptions(options) {
        this.options = options;
        //this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        // let deflection = await api.deinflect(word);
        // let results = await Promise.all([this.findLDOCE5(word), this.findLDOCE5(deflection), this.findEC(word)]);
        let results = await Promise.all([this.findLDOCE5(word)]);
        return [].concat(...results).filter(x => x);
    }

    async findLDOCE5(word) {
        let notes = [];
        if (!word) return notes;

        function putSoundTag(url) {
            return `<img class="odh-playsound" data-sound="${url}" src=""/>`;
        }

        function T(node) {
            if (!node)
                return '';
            else
                return node.innerText.trim();
        }

        function THtml(node) {
            if (!node)
                return '';
            else
                return node.innerHTML.trim();
        }

        function TAllHtml(nodes) {
            if (!nodes)
                return '';
            let value = "";
            let i = 0;
            for(i = 0; i < nodes.length; ++i) {
              value += THtml(nodes[i]);
            }
            return value;
        }

        let base = 'https://127.0.0.1:8000/';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let entries = doc.querySelectorAll('.dictentry');
        if (!entries) return notes;
        let idx = 1;
        for (const entry of entries) {
            let definitions = [];

            let header = entry.querySelector('.Head');
            //let tailer = entry.querySelector('.tail');

            let expression = T(header.querySelector('.hwd')); //headword
            let reading = T(header.querySelector('.PronCodes > .pron')); // phonetic

            let audios = [];
            let audiolinks = header.querySelectorAll('a');
            for (const [index, audiolink] of audiolinks.entries()) {
                const href = audiolink.getAttribute('href');
                if (href.indexOf('sound://') != -1)
                    audios[index] = base + href.substring(8);
            }

            let extrainfo = T(header.querySelector('.gram'));
            extrainfo = extrainfo ? `<span class='head_gram'>${extrainfo}</span>` : '';
            let freqs = header.querySelectorAll('.freq') || [];
            for (const freq of freqs) {
                extrainfo += `<span class="head_freq">${T(freq)}</span>`;
            }
            let wfamily = doc.querySelectorAll('.LDOCE_word_family');
            if (wfamily.length > 0) {
              extrainfo += '<br/>' + wfamily[0].innerHTML;
            }

            let pos = T(header.querySelector('.lm5pp_POS')) ? `<span class='lm5pp_POS'>${T(header.querySelector('.lm5pp_POS'))}</span>` : '';

            //let PhrHead = entry.Entry.PhrVbEntry ? entry.Entry.PhrVbEntry[0].Head[0] : '';
            //expression = PhrHead ? T(PhrHead.PHRVBHWD) : expression;
            //pos = PhrHead ? `<span class='pos'>${T(PhrHead.POS)}</span>` : pos;
            //let senses = entry.Entry.Sense || (PhrHead ? entry.Entry.PhrVbEntry[0].Sense : '');
            let senses = entry.querySelectorAll('.Sense');
            for (const sense of senses) {
                let signpost = T(sense.querySelector('.signpost'));
                let mergesense = T(sense.querySelector('.merge_sense'));
                signpost = signpost ? signpost : mergesense;
                let sign = signpost ? `<div class="sign"><span class="eng_sign"><span class="sensenum">${idx++}.</span> ${signpost}</span></div>` : '';

                let subsenses = sense.querySelectorAll('.Subsense');
                if (subsenses.length == 0)
                    subsenses = [sense];
                for (const subsense of subsenses) {
                    let eng_tran = TAllHtml(subsense.querySelectorAll('.DEF')) ? `<span class='eng_tran'>${TAllHtml(subsense.querySelectorAll('.DEF'))}</span>` : '';
                    if (!eng_tran) continue;
                    var regex = /href="\/\w+"/gi;
                    eng_tran = eng_tran.replace(regex, ' ');
                    let definition = '';
                    definition += `${sign}${pos}<span class="tran">${eng_tran}</span>`;
                    // make exmaple sentence segement
                    let sense_examples = subsense.querySelectorAll('.sense>.example');
                    let subse_examples = subsense.querySelectorAll('.subsense>.example');
                    let examples = [...sense_examples, ...subse_examples];
                    if (examples.length > 0 && this.maxexample > 0) {
                        definition += '<ul class="sents">';
                        for (const [index, example] of examples.entries()) {
                            if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                            let soundlink = example.querySelector('a') || '';
                            if (soundlink && soundlink.getAttribute('href').indexOf('sound://') != -1)
                                soundlink = putSoundTag(base + soundlink.getAttribute('href').substring(8)); // 8 = 'sound://'.length
                            definition += `<li class='sent'>${soundlink}<span class='eng_sent'>${THtml(example)}</span></li>`;
                        }
                        definition += '</ul>';
                    }
                    // make grammar extra section
                    let grams = subsense.querySelectorAll('.gramexa') || [];
                    let collos = subsense.querySelectorAll('.colloexa') || [];
                    let extras = [...grams, ...collos];
                    for (const extra of extras) {
                        let eng_gramprep = T(extra.querySelector('.propformprep'));
                        let eng_gram = T(extra.querySelector('.propform'));
                        eng_gram = eng_gramprep + eng_gram;
                        let eng_collo = T(extra.querySelector('.collo'));
                        if (!eng_gram && !eng_collo) continue;
                        eng_gram = eng_gram ? `<span class="eng_gram_prep">${eng_gram}` : '';
                        eng_collo = eng_collo ? `<span class="eng_gram_form">${eng_collo}</span>` : '';
                        let eng_gloss = T(extra.querySelector('.gloss'));
                        eng_gloss = eng_gloss ? `<span class="eng_gram_gloss">${eng_gloss}</span>` : '';
                        definition += `<span class="gram_extra">${eng_gram}${eng_collo}${eng_gloss}</span>`;

                        let examp = extra.querySelector('.example') || '';
                        if (!examp) continue;
                        let soundlink = examp.querySelector('a') || '';
                        if (soundlink && soundlink.getAttribute('href').indexOf('sound://') != -1)
                            soundlink = putSoundTag(base + soundlink.getAttribute('href').substring(8)); // 8 = 'sound://'.length

                        let gram_collo_examp = `<span class="eng_gram_examp">${THtml(examp)}</span>`;
                        if (gram_collo_examp && this.maxexample > 0)
                            definition += `<ul class="gram_examps"><li class="gram_examp">${soundlink}${gram_collo_examp}</li></ul>`;
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

        let base = 'https://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&dicts={"count":99,"dicts":[["ec"]]}&xmlVersion=5.1&q=';
        let url = base + encodeURIComponent(word);
        let data = '';
        try {
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
            extrainfo += `<span class="examtype">${type}</span>`;
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
                .lm5pp_POS{background: #CC9933 !important; color: #fff !important; font-size: 15px; padding: 0 5px 2px 1px !important; border-radius: 6px;}
                span.cn_txt{color: OrangeRed !important;}
                /* span.sensenum{color: orangered;} */
                span.pos{text-transform: lowercase;font-size: 0.9em;margin-right: 5px;padding: 2px 4px;color: white;background-color: #0d47a1;border-radius: 3px;}
                div.sign{font-weight: 0.9em;font-weight: bold;margin-bottom:3px;padding:0;}
                span.eng_sign{margin-right: 3px; background:#99CCFF !important;}
                span.chn_sign{margin: 0;padding: 0;}
                span.tran,
                span.gram_extra{margin: 0;padding: 0;}
                span.eng_tran,
                span.eng_gram_form,
                span.eng_gram_prep,
                span.eng_gram_gloss{margin-right: 3px;padding: 0;}
                span.eng_gram_form,
                span.eng_gram_prep{font-weight: bold;display: block;}
                span.eng_gram_gloss{font-style: italic;}
                span.chn_tran,
                span.chn_gram_tran{color: #0d47a1;}
                ul.sents,
                ul.gram_examps{font-size: 0.9em;list-style: none;margin: 3px 0;padding: 5px;background: rgba(13,71,161,0.1);border-radius: 3px;}
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
