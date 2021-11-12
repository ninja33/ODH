/* global api */
class encn_LDOCE6MDX {
    constructor(options) {
        this.options = options;
        this.maxexample = 6;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '朗文英英词典(mdx)';
        if (locale.indexOf('TW') != -1) return '朗文英英词典(mdx)';
        return 'Longman English Dictionary(mdx)';
    }


    setOptions(options) {
        this.options = options;
        //this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        let list = [];
        let word_stem = await api.deinflect(word);
        if (word.toLowerCase() != word) {
            let lowercase = word.toLowerCase();
            let lowercase_stem = await api.deinflect(lowercase);
            list = [word, word_stem, lowercase, lowercase_stem];
        } else {
            list = [word, word_stem];
        }
        let promises = list.map((item) => this.findLDOCE6(item));
        let results = await Promise.all(promises);
        return [].concat(...results).filter(x => x);
    }

    async findLDOCE6(word) {
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

        let base = 'http://127.0.0.1:8000/';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let entries = doc.querySelectorAll('.entry');
        let allentries = [];
        if (!entries) return notes;
        for (const entry of entries) {
            allentries.push(entry);
            let phrvbentries = entry.querySelectorAll('.phrvbentry');
            allentries = allentries.concat(...phrvbentries);
        }
        for (const entry of allentries) {
            let definitions = [];

            let header = entry.querySelector('.entryhead');
            //let tailer = entry.querySelector('.tail');

            let expression = T(header.querySelector('.hwd')) || T(header.querySelector('.phrvbhwd')); //headword
            let reading = T(header.querySelector('.pron')); // phonetic

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

            let pos = T(header.querySelector('.pos')) ? `<span class='pos'>${T(header.querySelector('.pos'))}</span>` : '';

            let senses = entry.querySelectorAll('.sense');
            for (const sense of senses) {
                let signpost = T(sense.querySelector('.signpost')) || T(sense.querySelector('.lexunit'));
                let sign = signpost ? `<div class="sign"><span class="eng_sign">${signpost}</span></div>` : '';
                let subsenses = sense.querySelectorAll('.subsense');
                if (subsenses.length == 0)
                    subsenses = [sense];
                for (const subsense of subsenses) {
                    let subgram = T(subsense.querySelector('.gram'));
                    let eng_tran = T(subsense.querySelector('.def')) ? `<span class='eng_tran'>${subgram}${T(subsense.querySelector('.def'))}</span>` : '';
                    if (!eng_tran) continue;
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
                            definition += `<li class='sent'>${soundlink}<span class='eng_sent'>${T(example)}</span></li>`;
                        }
                        definition += '</ul>';
                    }
                    // make grammar extra section
                    let grams = subsense.querySelectorAll('.gramexa') || [];
                    let collos = subsense.querySelectorAll('.colloexa') || [];
                    let extras = [...grams, ...collos];
                    for (const extra of extras) {
                        let eng_gram = T(extra.querySelector('.propformprep'));
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

                        let gram_collo_examp = `<span class="eng_gram_examp">${T(examp)}</span>`;
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
                span.eng_gram_gloss{font-style: italic;}
                span.chn_tran,
                span.chn_gram_tran{color: #0d47a1;}
                ul.sents,
                ul.gram_examps{font-size: 0.8em;list-style: none;margin: 3px 0;padding: 5px;background: rgba(13,71,161,0.1);border-radius: 3px;}
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