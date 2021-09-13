/* global api */
class escn_Eudict {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '欧路西语助手';
        if (locale.indexOf('TW') != -1) return '欧路西语助手';
        return 'Eudict ES->CN Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        if (!word) return null;

        let base = 'https://www.esdict.cn/dicts/prefix/';
        let url = base + encodeURIComponent(word);
        try {
            let terms = JSON.parse(await api.fetch(url));
            if (terms.length == 0) return null;
            terms = terms.filter(term => term.value && term.recordid && term.recordtype != 'CG');
            terms = terms.slice(0, 2); //max 2 results;
            let queries = terms.map(term => this.findEudict(`https://www.esdict.cn/dicts/es/${term.value}?recordid=${term.recordid}`));
            let results = await Promise.all(queries);
            return [].concat(...results).filter(x => x);
        } catch (err) {
            return null;
        }
    }

    removeTags(elem, name) {
        let tags = elem.querySelectorAll(name);
        tags.forEach(x => {
            x.outerHTML = '';
        });
    }

    async findEudict(url) {
        let notes = [];

        function T(node) {
            if (!node)
                return '';
            else
                return node.innerText.trim();
        }

        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let headsection = doc.querySelector('#dict-body>#exp-head');
        if (!headsection) return null;
        let expression = T(headsection.querySelector('.word'));
        if (!expression) return null;
        let reading = T(headsection.querySelector('.Phonitic'));

        let extrainfo = '';
        let cets = headsection.querySelectorAll('.tag');
        for (const cet of cets) {
            extrainfo += `<span class="cet">${T(cet)}</span>`;
        }

        let audios = [];
        try {
            audios[0] = 'https://api.frdic.com/api/v2/speech/speakweb?' + headsection.querySelector('.voice-js').dataset.rel;
        } catch (err) {
            audios = [];
        }

        let content = doc.querySelector('#ExpFCChild') || '';
        if (!content) return [];
        this.removeTags(content, 'script');
        this.removeTags(content, '#word-thumbnail-image');
        this.removeTags(content, '[style]');
        this.removeTags(content.parentNode, '#ExpFCChild>br');
        let anchor = content.querySelector('a');
        if (anchor) {
            let link = 'https://www.esdict.cn' + anchor.getAttribute('href');
            anchor.setAttribute('href', link);
            anchor.setAttribute('target', '_blank');
        }
        content.innerHTML = content.innerHTML.replace(/<p class="exp">(.+?)<\/p>/gi, '<span class="exp">$1</span>');
        content.innerHTML = content.innerHTML.replace(/<span class="exp"><br>/gi, '<span class="exp">');
        content.innerHTML = content.innerHTML.replace(/<span class="eg"><br>/gi, '<span class="eg">');

        let css = this.renderCSS();
        notes.push({
            css,
            expression,
            reading,
            extrainfo,
            definitions: [content.innerHTML],
            audios
        });
        return notes;
    }

    renderCSS() {
        let css = `
            <style>
            span.eg,
            span.exp,
            span.cara
            {display:block;}
            .cara {color: #1C6FB8;font-weight: bold;}
            .eg {color: #238E68;}
            #phrase I {color: #009933;font-weight: bold;}
            span.cet  {margin: 0 3px;padding: 0 3px;font-weight: normal;font-size: 0.8em;color: white;background-color: #5cb85c;border-radius: 3px;}
            </style>`;

        return css;
    }
}