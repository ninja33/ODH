/* global api, hash */
class encn_Oxford {
    constructor(options) {
        this.token = '';
        this.gtk = '';
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '牛津英汉双解';
        if (locale.indexOf('TW') != -1) return '牛津英汉双解';
        return 'Oxford EN->CN Dictionary';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async getToken() {
        let homeurl = 'https://fanyi.baidu.com/';
        let homepage = await api.fetch(homeurl);
        let tmatch = /token: ['"](.+?)['"]/gi.exec(homepage);
        if (!tmatch || tmatch.length < 2) return null;
        let gmatch = /window.gtk = ['"](.+?)['"]/gi.exec(homepage);
        if (!gmatch || gmatch.length < 2) return null;
        return {
            'token': tmatch[1],
            'gtk': gmatch[1]
        };
    }

    async findTerm(word) {
        this.word = word;
        let deflection = await api.deinflect(word) || [];
        let promises = [word, deflection].map(x => this.findOxford(x));
        let results = await Promise.all(promises);
        return [].concat(...results).filter(x => x);
    }

    async findOxford(word) {
        // helper function
        function buildDefinitionBlock(exp, pos, defs) {
            if (!defs || !Array.isArray(defs) || defs.length < 0) return '';
            let definition = '';
            let sentence = '';
            let sentnum = 0;
            for (const def of defs) {
                if (def.text) definition += `<span class='tran'><span class='eng_tran'>${def.text}</span></span>`;
                if (def.tag == 'id' || def.tag == 'pv')
                    definition += def.enText ? `<div class="idmphrase">${def.enText}</div>` : '';
                //if (def.tag == 'xrs')
                //    definition += `<span class='tran'><span class='eng_tran'>${def.data[0].data[0].text}</span></span>`;
                if (def.tag == 'd' || def.tag == 'ud')
                    definition += pos + `<span class='tran'><span class='eng_tran'>${def.enText}</span><span class='chn_tran'>${def.chText}</span></span>`;
                if (def.tag == 'x' && sentnum < maxexample) {
                    sentnum += 1;
                    let enText = def.enText.replace(RegExp(exp, 'gi'), `<b>${exp}</b>`);
                    sentence += `<li class='sent'><span class='eng_sent'>${enText}</span><span class='chn_sent'>${def.chText}</span></li>`;
                }
            }
            definition += sentence ? `<ul class="sents">${sentence}</ul>` : '';
            return definition;
        }
        const maxexample = this.maxexample;
        let notes = [];
        if (!word) return notes;
        let base = 'https://fanyi.baidu.com/v2transapi?from=en&to=zh&simple_means_flag=3';

        if (!this.token || !this.gtk) {
            let common = await this.getToken();
            if (!common) return [];
            this.token = common.token;
            this.gtk = common.gtk;
        }

        let sign = hash(word, this.gtk);
        if (!sign) return;

        let dicturl = base + `&query=${word}&sign=${sign}&token=${this.token}`;
        let data = '';
        try {
            data = JSON.parse(await api.fetch(dicturl));
            let oxford = getOxford(data);
            let bdsimple = oxford.length ? [] : getBDSimple(data); //Combine Youdao Concise English-Chinese Dictionary to the end.
            let bstrans = oxford.length || bdsimple.length ? [] : getBDTrans(data); //Combine Youdao Translation (if any) to the end.
            return [].concat(oxford, bdsimple, bstrans);

        } catch (err) {
            return [];
        }

        function getBDTrans(data) {
            try {
                if (data.dict_result && data.dict_result.length != 0) return [];
                if (!data.trans_result || data.trans_result.data.length < 1) return [];
                let css = '<style>.odh-expression {font-size: 1em!important;font-weight: normal!important;}</style>';
                let expression = data.trans_result.data[0].src;
                let definition = data.trans_result.data[0].dst;
                return [{ css, expression, definitions: [definition] }];
            } catch (error) {
                return [];
            }
        }

        function getBDSimple(data) {
            try {
                let simple = data.dict_result.simple_means;
                let expression = simple.word_name;
                if (!expression) return [];

                let symbols = simple.symbols[0];
                let reading_uk = symbols.ph_en || '';
                let reading_us = symbols.ph_am || '';
                let reading = reading_uk && reading_us ? `uk[${reading_uk}] us[${reading_us}]` : '';

                let audios = [];
                audios[0] = `https://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(expression)}&spd=3&source=web`;
                audios[1] = `https://fanyi.baidu.com/gettts?lan=en&text=${encodeURIComponent(expression)}&spd=3&source=web`;

                if (!symbols.parts || symbols.parts.length < 1) return [];
                let definition = '<ul class="ec">';
                for (const def of symbols.parts)
                    if (def.means && def.means.length > 0) {
                        let pos = def.part || def.part_name || '';
                        pos = pos ? `<span class="pos simple">${pos}</span>` : '';
                        definition += `<li class="ec">${pos}<span class="ec_chn">${def.means.join()}</span></li>`;
                    }
                definition += '</ul>';
                let css = `<style>
                ul.ec, li.ec {margin:0; padding:0;}
                span.simple {background-color: #999!important}
                span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                </style>`;
                notes.push({ css, expression, reading, definitions: [definition], audios });
                return notes;
            } catch (error) {
                return [];
            }
        }

        function getOxford(data) {
            try {
                let simple = data.dict_result.simple_means;
                let expression = simple.word_name;
                if (!expression) return [];

                let symbols = simple.symbols[0];
                let reading_uk = symbols.ph_en || '';
                let reading_us = symbols.ph_am || '';
                let reading = reading_uk && reading_us ? `uk[${reading_uk}] us[${reading_us}]` : '';

                let audios = [];
                audios[0] = `https://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(expression)}&spd=3&source=web`;
                audios[1] = `https://fanyi.baidu.com/gettts?lan=en&text=${encodeURIComponent(expression)}&spd=3&source=web`;

                let entries = data.dict_result.oxford.entry[0].data;
                if (!entries) return [];

                let definitions = [];
                for (const entry of entries) {
                    if (entry.tag == 'p-g' || entry.tag == 'h-g') {
                        let pos = '';
                        for (const group of entry.data) {
                            let definition = '';
                            if (group.tag == 'p') {
                                pos = `<span class='pos'>${group.p_text}</span>`;
                            }
                            if (group.tag == 'd') {
                                definition += pos + `<span class='tran'><span class='eng_tran'>${group.enText}</span><span class='chn_tran'>${group.chText}</span></span>`;
                                definitions.push(definition);
                            }

                            if (group.tag == 'n-g') {
                                definition += buildDefinitionBlock(expression, pos, group.data);
                                definitions.push(definition);
                            }


                            //if (group.tag == 'xrs') {
                            //    definition += buildDefinitionBlock(pos, group.data[0].data);
                            //    definitions.push(definition);
                            //}

                            if (group.tag == 'sd-g' || group.tag == 'ids-g' || group.tag == 'pvs-g') {
                                for (const item of group.data) {
                                    if (item.tag == 'sd') definition = `<div class="dis"><span class="eng_dis">${item.enText}</span><span class="chn_dis">${item.chText}</span></div>` + definition;
                                    let defs = [];
                                    if (item.tag == 'n-g' || item.tag == 'id-g' || item.tag == 'pv-g') defs = item.data;
                                    if (item.tag == 'vrs' || item.tag == 'xrs') defs = item.data[0].data;
                                    definition += buildDefinitionBlock(expression, pos, defs);
                                }
                                definitions.push(definition);
                            }
                        }
                    }
                }
                let css = encn_Oxford.renderCSS();
                notes.push({ css, expression, reading, definitions, audios });
                return notes;
            } catch (error) {
                return [];
            }

        }

    }

    static renderCSS() {
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