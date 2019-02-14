/* global api, hash */
class encn_Oxford_Baidu {
    constructor(options) {
        this.token = '';
        this.gtk = '';
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

    async getToken() {
        let homeurl = 'https://fanyi.baidu.com/'
        let homepage = await api.fetch(homeurl);
        let tmatch = /token: '(.+?)'/gi.exec(homepage);
        if (!tmatch || tmatch.length < 2) return null;
        let gmatch = /window.gtk = '(.+?)'/gi.exec(homepage);
        if (!gmatch || gmatch.length < 2) return null;
        return {
            'token': tmatch[1],
            'gtk': gmatch[1]
        };
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

        let base = 'https://fanyi.baidu.com/v2transapi?from=en&to=zh&simple_means_flag=3';

        if (!this.token || !this.gtk) {
            let common = await this.getToken();
            if (!common) return [];
            this.token = common.token;
            this.gtk = common.gtk;
        }

        //let sign = this.generateSign(word);
        word = encodeURIComponent(word);
        let sign = hash(word, this.gtk)
        if (!sign) return;

        let dicturl = base + `&query=${word}&sign=${sign}&token=${this.token}`;
        let data = '';
        try {
            data = JSON.parse(await api.fetch(dicturl));
        } catch (err) {
            return [];
        }

        if (!data.dict_result.oxford.entry[0]) return [];
        let simple = data.dict_result.simple_means;
        let expression = T(simple.word_name);
        if (!expression) return [];

        let symbols = simple.symbols[0];
        let reading_uk = symbols.ph_en || '';
        let reading_us = symbols.ph_am || '';
        let reading = reading_uk && reading_us ? `UK${reading_uk} US${reading_us}` : '';

        let audios = [];
        audios[0] = `http://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(expression)}&spd=3&source=web`;
        audios[1] = `http://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(expression)}&spd=3&source=web`;

        let entries = data.dict_result.oxford.entry[0].data;
        if (!entries) return [];

        let definitions = [];
        for (const entry of entries) {
            if (entry.tag == 'p-g') {
                let pos = ''
                for (const group of entry.data) {
                    if (group.tag != 'p' && group.tag != 'sd-g' && group.tag != 'ids-g'&& group.tag != 'pvs-g') continue;
                    if (group.tag == 'p') pos = group.p_text ? `<span class='pos'>${group.p_text}</span>` : ''
                    if (group.tag == 'sd-g') {
                        let definition = '';
                        for (const item of group.data) {
                            if (item.tag != 'sd' && item.tag != 'n-g') continue;
                            let dis = ''
                            if (item.tag == 'sd') {
                                let eng_dis = item.enText;
                                let chn_dis = item.chText;
                                dis = (chn_dis && eng_dis) ? `<div class="dis"><span class="eng_dis">${eng_dis}</span><span class="chn_dis">${chn_dis}</span></div>` : '';
                            }
                            if (item.tag == 'n-g') {
                                let enterext = false; //not enter example block at first.
                                for (const def of item.data) {
                                    if (def.tag != 'd' && def.tag != 'x') continue;
                                    if (def.tag == 'd') {
                                        let eng_tran = `<span class='eng_tran'>${def.enText}</span>`;
                                        let chn_tran = `<span class='chn_tran'>${def.chText}</span>`;
                                        definition += `${dis}${pos}<span class='tran'>${eng_tran}${chn_tran}</span>`;
                                    }
                                    if (def.tag == 'x') {
                                        if (!enterext) {
                                            definition += '<ul class="sents">';
                                            enterext = true;
                                        }
                                        let eng_examp = def.enText;
                                        let chn_examp = def.chText;
                                        definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                                    }
                                }
                                definition += '</ul>';
                            }
                        }
                        definitions.push(definition);
                    }
                    if (group.tag == 'ids-g' || group.tag == 'pvs-g') {
                        let definition = '';
                        for (const item of group.data) {
                            if (item.tag != 'id-g' && item.tag != 'pv-g' && item.tag != 'vrs') continue;
                            let defs = [];
                            if (item.tag == 'id-g' || item.tag == 'pv-g') defs = item.data;
                            if (item.tag == 'vrs') defs = item.data[0].data;
                            let enterext = false; //not enter example block at first.
                            for (const def of defs) {
                                if (def.tag != 'id' && def.tag != 'pv' && def.tag != 'd'&& def.tag != 'x') continue;
                                if (def.tag == 'id' || def.tag == 'pv') {
                                    definition += def.enText ? `<div class="idmphrase">${def.enText}</div>` : '';
                                }
                                if (def.tag == 'd') {
                                    let eng_tran = `<span class='eng_tran'>${def.enText}</span>`;
                                    let chn_tran = `<span class='chn_tran'>${def.chText}</span>`;
                                    definition += `<span class='tran'>${eng_tran}${chn_tran}</span>`;
                                }
                                if (def.tag == 'x') {
                                    if (!enterext) {
                                        definition += '<ul class="sents">';
                                        enterext = true;
                                    }
                                    let eng_examp = def.enText;
                                    let chn_examp = def.chText;
                                    definition += `<li class='sent'><span class='eng_sent'>${eng_examp}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                                }
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
                    definitions,
                    audios
                });
            }
        }
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