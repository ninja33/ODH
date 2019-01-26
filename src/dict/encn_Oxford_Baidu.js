/* global api */
class encn_Oxford_Baidu {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '牛津英汉双解(baidu)';
        if (locale.indexOf('TW') != -1) return '牛津英汉双解(baidu)';
        return 'Oxford EN->CN Dictionary(baidu)';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        let deflection = await api.deinflect(word);
        //let results = await Promise.all([this.findOxford(word), this.findOxford(deflection), this.findEC(word)]);
        let results = await Promise.all([this.findOxford(word)]);
        return [].concat(...results).filter(x => x);
    }

    async findOxford(word) {
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

        let base = 'http://fanyi.baidu.com/v2transapi?from=en&to=zh&simple_means_flag=3';
        word = encodeURIComponent(word);
        let sign = this.generateSign(word);
        if (!sign) return;

        let token = 'f1b766ca9eacac98a582a177e487aa60';
        let url = base + `&query=${word}&sign=${sign}&token=${token}`;

        let data = '';
        try {
            data = JSON.parse(await api.fetch(url));
        } catch (err) {
            return [];
        }

        if (!data.dict_result) return [];
        let simple = data.dict_result.simple_means;
        let expression = T(simple.word_name);
        if (!expression) return [];
        let reading_uk = T(title.querySelectorAll('.phonetic-transcription')[0]) || '';
        let reading_us = T(title.querySelectorAll('.phonetic-transcription')[1]) || '';
        let reading = reading_uk && reading_us ? `UK${reading_uk} US${reading_us}` : '';

        let audios = [];
        audios[0] = `http://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(expression)}&spd=3&source=web`;
        audios[1] = `http://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(expression)}&spd=3&source=web`;

        let entries = doc.querySelectorAll('.oxford-entry .entry-pg');
        if (!entries) return [];

        for (const entry of entries) {
            let definitions = [];
            let pos = T(entry.querySelector('.pg-p'));
            pos = pos ? `<span class='pos'>${pos}</span>` : '';
            // process definitions;
            let segements = entry.querySelectorAll('.entry-sdg') || [];
            if (!segements) continue;
            for (const segement of segements) {
                let definition = '';
                let dis = T(segement.querySelector('.sdg-sd'));
                if (!dis) continue;
                let eng_dis = dis.match(/([\u4e00-\u9fa5]|；|、|（|）|，)+/gi).join(' ').trim();
                let chn_dis = dis.replace(/([\u4e00-\u9fa5]|；|、|（|）|，)+/gi, '').trim();
                dis = (chn_dis && eng_dis) ? `<div class="dis"><span class="eng_dis">${eng_dis}</span><span class="chn_dis">${chn_dis}</span></div>` : '';

                let trans = T(segement.querySelector('.entry-d'));
                let eng_trans = trans.match(/([\u4e00-\u9fa5]|；|、|（|）|，)+/gi).join(' ').trim();
                let chn_trans = trans.replace(/([\u4e00-\u9fa5]|；|、|（|）|，)+/gi, '').trim();
                if (!eng_tran || !chn_tran) continue;
                eng_tran = `<span class='eng_tran'>${eng_tran}</span>`;
                chn_tran = `<span class='chn_tran'>${chn_tran}</span>`;
                definition += `${dis}${pos}<span class='tran'>${eng_tran}${chn_tran}</span>`;

                let examps = segement.querySelectorAll('.entry-x') || [];
                if (examps.length > 0 && this.maxexample > 0) {
                    definition += '<ul class="sents">';
                    for (const [index, examp] of examps.entries()) {
                        if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                        let eng_examp = T(examp.querySelector('.entry-x-en'));
                        let chn_examp = T(examp.querySelector('.entry-x-zh'));
                        definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                    }
                    definition += '</ul>';
                }
                definition && definitions.push(definition);
            }

            //process idiom
            let idmsents = entry.querySelectorAll('.idg');
            if (!idmsents) continue;
            for (const idmsent of idmsents) {
                let definition = '';
                let idmphrase = T(idmsent.querySelector('.idg-id'));
                idmphrase = idmphrase ? `<div class="idmphrase">${idmphrase}</div>` : '';

                let trans = T(idmsent.querySelector('.entry-d'));
                let eng_trans = trans.match(/([\u4e00-\u9fa5]|；|、|（|）|，)+/gi).join(' ').trim();
                let chn_trans = trans.replace(/([\u4e00-\u9fa5]|；|、|（|）|，)+/gi, '').trim();
                if (!eng_tran || !chn_tran) continue;
                eng_tran = `<span class='eng_tran'>${eng_tran}</span>`;
                chn_tran = `<span class='chn_tran'>${chn_tran}</span>`;
                definition += `${idmphrase}<span class='tran'>${eng_tran}${chn_tran}</span>`;

                let examps = idmsent.querySelectorAll('.entry-x') || [];
                if (examps.length > 0 && this.maxexample > 0) {
                    definition += '<ul class="sents">';
                    for (const [index, examp] of examps.entries()) {
                        if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                        let eng_examp = T(examp.querySelector('.entry-x-en'));
                        let chn_examp = T(examp.querySelector('.entry-x-zh'));
                        definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                    }
                    definition += '</ul>';
                }
                if (definition)
                    definitions.push(definition);
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

    generateSign(r) {
        var i = null;

        function n(r, o) {
            for (var t = 0; t < o.length - 2; t += 3) {
                var a = o.charAt(t + 2);
                a = a >= "a" ? a.charCodeAt(0) - 87 : Number(a),
                    a = "+" === o.charAt(t + 1) ? r >>> a : r << a,
                    r = "+" === o.charAt(t) ? r + a & 4294967295 : r ^ a
            }
            return r
        }

        if (!/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(r)) {
            var t = r.length;
            t > 30 && (r = "" + r.substr(0, 10) + r.substr(Math.floor(t / 2) - 5, 10) + r.substr(-10, 10))
        } else
            return null;

        let m = 320305,
            p = 320305,
            s = 131321201,
            S = [],
            c = 0;
        for (let v = 0; v < r.length; v++) {
            let A = r.charCodeAt(v);
            128 > A ? S[c++] = A : (2048 > A ? S[c++] = A >> 6 | 192 : (55296 === (64512 & A) && v + 1 < r.length && 56320 === (64512 & r.charCodeAt(v + 1)) ? (A = 65536 + ((1023 & A) << 10) + (1023 & r.charCodeAt(++v)),
                        S[c++] = A >> 18 | 240,
                        S[c++] = A >> 12 & 63 | 128) : S[c++] = A >> 12 | 224,
                    S[c++] = A >> 6 & 63 | 128),
                S[c++] = 63 & A | 128)
        }
        let F = "+-a^+6",
            D = "+-3^+b+-f"
        for (let b = 0; b < S.length; b++) {
            p += S[b];
            p = n(p, F);
        }
        p = n(p, D);
        p ^= s;
        if (0 > p)
            p = (2147483647 & p) + 2147483648;
        p %= 1e6;
        return p.toString() + "." + (p ^ m);
    }
}