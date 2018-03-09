/* global api */
class encn_Oxford {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1)
            return '牛津英汉双解词典';
        if (locale.indexOf('TW') != -1)
            return '牛津英漢雙解詞典';
        return 'encn_Oxford';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        let deflection = await api.deinflect(word);
        let results = await Promise.all([this.findOxford(word), this.findOxford(deflection), this.findEC(word)]);
        return [].concat(...results).filter(x => x);
    }

    async findOxford(word) {
        let notes = [];
        if (!word) return notes;

        function T(node) {
            if (!node)
                return '';
            else
                return node.innerText.trim();
        }

        let base = 'https://cn.bing.com/dict/search?q=';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html').querySelector('.qdef');
        } catch (err) {
            return [];
        }


        let expression = T(doc.querySelector('#headword'));
        let reading_us = T(doc.querySelector('.hd_prUS')).match(/\[.+\]/gi)[0] || ''; // phonetic US
        let reading_uk = T(doc.querySelector('.hd_pr')).match(/\[.+\]/gi)[0] || ''; // phonetic UK
        let reading = reading_us && reading_uk ? `UK${reading_uk} US${reading_us}` : '';

        let audios = [];
        let audioslinks = doc.querySelectorAll('.hd_tf a');
        if (audioslinks)
            for (const [index, audiolink] of audioslinks.entries()) {
                audios[index] = audiolink.getAttribute('onmouseover').match(/https:.+?mp3/gi)[0] || '';
            }


        let entries = doc.querySelectorAll('#authid .each_seg');
        if (!entries) return notes;

        for (const entry of entries) {
            let definitions = [];
            let pos = T(entry.querySelector('.pos'));
            pos = pos ? `<span class='pos'>${pos}</span>` : '';
            // process definitions;
            let segements = entry.querySelector('.de_seg').childNodes || [];
            if (!segements) continue;
            let definition = '';
            let dis = '';
            for (const segement of segements) {
                if (segement.classList && segement.classList.contains('dis')) {
                    let eng_dis = T(segement.querySelector('.val_dis'));
                    let chn_dis = T(segement.querySelector('.bil_dis'));
                    dis = (chn_dis && eng_dis) ? `<div class="dis"><span class="eng_dis">${eng_dis}</span><span class="chn_dis">${chn_dis}</span></div>` : '';
                }
                if (segement.classList && segement.classList.contains('se_lis')) {
                    let eng_tran = T(segement.querySelector('.val'));
                    let chn_tran = T(segement.querySelector('.bil'));
                    if (!eng_tran || !chn_tran) continue;
                    if (definition) {
                        definitions.push(definition);
                        definition = '';
                    }
                    let grammar = T(segement.querySelector('.gra'));
                    grammar = grammar ? `<span class="grammar">${grammar}</span>` : '';
                    let informal = T(segement.querySelector('.infor'));
                    informal = informal ? `<span class="informal">${informal}</span>` : '';
                    let complement = T(segement.querySelector('.comple'));
                    complement = complement ? `<span class="complement">${complement}</span>` : '';
                    eng_tran = `<span class='eng_tran'>${eng_tran.replace(RegExp(expression, 'gi'),`<b>${expression}</b>`)}</span>`;
                    chn_tran = `<span class='chn_tran'>${chn_tran}</span>`;
                    definition += `${dis}${pos}${grammar}${complement}${informal}<span class='tran'>${eng_tran}${chn_tran}</span>`;
                }
                if (segement.classList && segement.classList.contains('li_exs')) {
                    let examps = segement.querySelectorAll('.li_ex') || [];
                    if (examps.length > 0 && this.maxexample > 0) {
                        definition += '<ul class="sents">';
                        for (const [index, examp] of examps.entries()) {
                            if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                            let eng_examp = T(examp.querySelector('.val_ex'));
                            let chn_examp = T(examp.querySelector('.bil_ex'));
                            definition += `<li class='sent'><span class='eng_sent'>${eng_examp.replace(RegExp(expression, 'gi'),`<b>${expression}</b>`)}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                        }
                        definition += '</ul>';
                    }
                }
            }
            if (definition)
                definitions.push(definition);

            //process idiom
            let idmsents = entry.querySelectorAll('.idm_s');
            if (!idmsents) continue;
            for (const idmsent of idmsents) {
                let idmphrase = `<div class="idmphrase">${T(idmsent)}</div>`;
                if (!idmsent.nextSibling || idmsent.nextSibling.className != 'li_ids_co') continue;
                let idmblock = idmsent.nextSibling;
                let eng_tran = T(idmblock.querySelector('.val'));
                let chn_tran = T(idmblock.querySelector('.bil'));
                if (!eng_tran || !chn_tran) continue;

                let definition = '';
                eng_tran = eng_tran ? `<span class='eng_tran'>${eng_tran}</span>` : '';
                chn_tran = chn_tran ? `<span class='chn_tran'>${chn_tran}</span>` : '';
                definition += `${idmphrase}<span class='tran'>${eng_tran}${chn_tran}</span>`;
                // make exmaple segement
                let eng_examp = T(idmblock.querySelector('.val_ex'));
                let chn_examp = T(idmblock.querySelector('.bil_ex'));
                if (eng_examp && chn_examp && this.maxexample > 0) {
                    definition += '<ul class="sents">';
                    definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                    definition += '</ul>';
                }
                // add into difinition array
                definition && definitions.push(definition);
            }
            let css = this.renderCSS();
            notes.push({
                css,
                expression,
                reading,
                definitions,
                audios
            });
        }
        return notes;
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
                div.dis {font-weight: bold;margin-bottom:3px;padding:0;}
                span.grammar,
                span.informal   {margin: 0 2px;color: #0d47a1;}
                span.complement {margin: 0 2px;font-weight: bold;}
                div.idmphrase {font-weight: bold;margin: 0;padding: 0;}
                span.eng_dis  {margin-right: 5px;}
                span.chn_dis  {margin: 0;padding: 0;}
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