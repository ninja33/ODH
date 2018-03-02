class escn_Eudict {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1)
            return '西语助手';
        if (locale.indexOf('TW') != -1)
            return '西语助手';
        return 'escn_Eudict';
    }

    setOptions(options){
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        return await this.findEudict(word);
    }

    removeTags(elem, name) {
        let tags = elem.querySelectorAll(name);
        tags.forEach(x => {
            x.outerHTML = "";
        });
    }
    
    async findEudict(word) {
        if (!word) return null;

        let base = 'http://www.esdict.cn/dicts/prefix/';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = JSON.parse(await api.fetch(url));
            if (data.length == 0) return null;
            let value = data[0].value;
            let recordid = data[0].recordid;
            let url2 = `http://www.esdict.cn/dicts/es/${value}?recordid=${recordid}`
            data = await api.fetch(url2);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, "text/html");
        } catch (err) {
            return null;
        }

        let content = doc.querySelector('#ExpFCChild') || '';
        if (!content) return null;
        this.removeTags(content, '#word-thumbnail-image');
        let css = this.renderCSS();
        return css + content.innerHTML;
    }

    renderCSS() {
        let css = `
            <style>
            .cara {color: #1C6FB8;font-weight: bold;}
            .eg {color: #238E68;}
            #phrase I {color: #009933;font-weight: bold;}
            </style>`;

        return css;
    }
}