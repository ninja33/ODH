/* global api */
class frcn_Youdao {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '有道法汉词典';
        if (locale.indexOf('TW') != -1) return '有道法汉词典';
        return 'Youdao FR->CN Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        return await this.findYoudao(word);
    }

    async findYoudao(word) {
        if (!word) return null;

        let base = 'https://dict.youdao.com/fsearch?client=deskdict&keyfrom=chrome.extension&pos=-1&doctype=xml&xmlVersion=3.2&dogVersion=1.0&vendor=unknown&appVer=3.1.17.4208&le=fr&q=';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/xml');
        } catch (err) {
            return null;
        }

        let xmlroot = doc.getElementsByTagName('yodaodict')[0];
        let trans = xmlroot.getElementsByTagName('translation');
        let definition = '';
        if (!trans[0] || !trans[0].childNodes[0])
            return null;

        for (let i = 0; i < trans.length; i++) {
            definition += trans[i].getElementsByTagName('content')[0].childNodes[0].nodeValue + '<br>';
        }
        return definition;
    }
}