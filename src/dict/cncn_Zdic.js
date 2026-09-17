/* global api */
class cncn_Zdic {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '汉典汉语词典';
        if (locale.indexOf('TW') != -1) return '汉典汉语词典';
        return 'Zdic Chinese Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = Number(options.maxexample);
    }

    async findTerm(word) {
        this.word = word;
        return await this.findZdic(word);
    }

    T(node) {
        return node ? node.innerText.trim() : '';
    }

    async findZdic(word) {
        if (!word) return [];

        let doc;
        try {
            let url = `https://www.zdic.net/hans/${encodeURIComponent(word)}`;
            let data = await api.fetch(url);
            if (!data) return [];
            doc = new DOMParser().parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        // 新版汉典不再有 .jbjs 容器，改为抓 .jbjs-reading（读音）和 .jbjs-item（义项）
        let reading = this.T(doc.querySelector('.jbjs-reading__char')) || word;
        let py = this.T(doc.querySelector('.jbjs-reading__py'));
        let zy = this.T(doc.querySelector('.jbjs-reading__zy'));
        reading = py ? `${reading} ${py}` : reading;
        reading = zy ? `${reading} ${zy}` : reading;

        let definitions = [];
        for (const item of doc.querySelectorAll('.jbjs-item')) {
            let def = this.T(item.querySelector('.jbjs-item__def'));
            if (!def) continue;

            let html = `<span class="chn_tran">${def}</span>`;

            let egs = item.querySelectorAll('.jbjs-item__eg');
            if (egs.length && this.maxexample > 0) {
                html += '<ul class="sents">';
                for (const [idx, eg] of [...egs].entries()) {
                    if (idx > this.maxexample - 1) break;
                    html += `<li class="sent">${this.T(eg)}</li>`;
                }
                html += '</ul>';
            }
            definitions.push(html);
        }

        // 古义（文言文常用）：gy-sense__def，每条单独成行，便于制卡
        let gySense = doc.querySelector('.gy-sense');
        if (gySense) {
            for (const def of gySense.querySelectorAll('.gy-sense__def')) {
                let text = this.T(def);
                if (text) definitions.push(`<span class="gy_tran">${text}</span>`);
            }
        }

        if (!definitions.length) return [];

        return [{
            css: this.renderCSS(),
            expression: word,
            reading,
            extrainfo: '',
            definitions,
            audios: []
        }];
    }

    renderCSS() {
        return `
            <style>
                span.chn_tran {font-weight:bold; color:#0d47a1;}
                span.gy_tran  {color:#845247;}
                ul.sents  {font-size:0.85em; list-style:none; margin:3px 0; padding:5px; background:rgba(13,71,161,0.06); border-radius:5px;}
                li.sent   {margin:0; padding:0; color:#555;}
            </style>`;
    }
}
