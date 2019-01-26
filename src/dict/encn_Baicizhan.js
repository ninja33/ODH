/* global api */
class encn_Baicizhan {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '百词斩图文词典';
        if (locale.indexOf('TW') != -1) return '百詞斬圖文词典';
        return 'Baicizhan EN->CN Dictionary';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        let list = [];
        let word_stem = await api.deinflect(word);
        if (word.toLowerCase() != word) {
            let lowercase = word.toLowerCase();
            let lowercase_stem = await api.deinflect(lowercase);
            list = [word_stem, word, lowercase_stem, lowercase];
        } else {
            list = [word_stem, word];
        }
        let promises = list.map((item) => this.findBaicizhan(item));
        let results = await Promise.all(promises);
        return [].concat(...results).filter(x => x);
    }

    async findBaicizhan(word) {
        let notes = [];

        if (!word) return notes;
        let base = 'http://mall.baicizhan.com/ws/search?w=';
        let url = base + encodeURIComponent(word);
        let note = '';
        try {
            note = JSON.parse(await api.fetch(url));
        } catch (err) {
            return [];
        }

        if (!note.mean_cn) return notes;
        let definitions = [];
        let audios = [];
        let expression = note.word || ''; //headword
        let reading = note.accent || ''; // phonetic
        audios[0] = `http://baicizhan.qiniucdn.com/word_audios/${expression}.mp3`;
        let definition = '<ul class="bcz">';
        let defs = note.mean_cn.split('\n');
        for (const def of defs) {
            definition += `<li class="bcz"><span class="bcz_chn">${def}</span></li>`;
        }
        definition += '</ul>';
        definition += note.df ? `<div class='bcz'><img src='${note.df}' /></div>` : '';
        definition += note.st && note.sttr ? `<ul class='sents'><li class='sent'><span class='eng_sent'>${note.st}</span><span class='chn_sent'>${note.sttr}</span></li></ul>` : '';
        definition += note.img ? `<div class='bcz'><img src='${note.img}' /></div>` : '';
        //definition += `<div class='bcz'><video width="340px" controls><source src='${note.tv}' type="video/mp4"></video></div>`;
        definition && definitions.push(definition);
        let css = `
                <style>
                    ul.bcz, li.bcz{list-style: square inside;margin:0;margin-left: 2px;padding:0}
                    .bcz img {border: 1px dotted #ccc;margin: 3px 0;padding: 2px;width: 350px;border-radius: 5px;}
                    span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                    span.tran {margin:0; padding:0;}
                    span.eng_tran {margin-right:3px; padding:0;}
                    span.chn_tran {color:#0d47a1;}
                    ul.sents {font-size:0.8em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                    li.sent  {margin:0; padding:0;}
                    span.eng_sent {margin-right:5px;}
                    span.chn_sent {color:#0d47a1;}
                </style>`;
        notes.push({
            css,
            expression,
            reading,
            definitions,
            audios,
        });
        return notes;
    }
}