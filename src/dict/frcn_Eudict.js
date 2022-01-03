/* global api */
class frcn_Eudict {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
        this.popup = null;
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '欧路法语助手';
        if (locale.indexOf('TW') != -1) return '欧路法语助手';
        return 'Eudict FR->CN Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        if (!word) return null;

        async function getURL(str) {
            return new Promise((resolve, reject) => {
                function msg_handler(e) {
                    document.body.removeChild(popup);
                    window.removeEventListener('message', msg_handler);
                    resolve(e.data);
                }
                try {
                    window.addEventListener('message', msg_handler);
                    var popup = document.createElement('iframe');
                    popup.id = 'eudict-popup';

                    let eval_var = str.match(/new Array\(\),(.+>?);function/)[1] || '';
                    let inject = `if(${eval_var}.indexOf("window.open")!=-1){url=eval(${eval_var}.slice(12,${eval_var}.length-9))};if(${eval_var}.indexOf("window.location=")!=-1){url=eval(${eval_var}.slice(16))};window.parent.postMessage(url,"*");</script><script>`;
                    str = str.replace('</script><script>', inject);
                    str = str.replace(RegExp(eval_var + '="(.*?)";', 'g'), eval_var + '=\`$1\`;');
                    str = str.replace('\x10', '\n');

                    popup.srcdoc = str;
                    document.body.appendChild(popup);
                } catch (err) {
                    if (popup) {
                        document.body.removeChild(popup);
                        window.removeEventListener('message', msg_handler);
                    }
                    reject(err.toString ? err.toString() : 'Error Happened.');
                }
            });
        }

        let base = 'https://www.frdic.com/dicts/prefix/';
        let url = base + encodeURIComponent(word);
        try {
            let respons = await api.fetch(url);
            if (respons.indexOf('<html><body><script>') != -1) {
                respons = respons.replace('`', '\\\`').replace('\n', '\x10');
                let newurl = 'https://www.frdic.com' + await getURL(respons);
                respons = await api.fetch(newurl);
            }
            let terms = JSON.parse(respons);
            if (terms.length == 0) return null;
            terms = terms.filter(term => term.value && term.recordid && term.recordtype != 'CG');
            terms = terms.slice(0, 2); //max 2 results;
            let queries = terms.map(term => this.findEudict(`https://www.frdic.com/dicts/fr/${term.value}?recordid=${term.recordid}`));
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

        let content = doc.querySelector('#ExpFCChild') || doc.querySelector('#ExpSPECChild') || '';
        if (!content) return [];

        this.removeTags(content, 'script');
        this.removeTags(content, '#word-thumbnail-image');
        this.removeTags(content, '[style]');
        this.removeTags(content.parentNode, '#ExpFCChild>br');
        this.removeTags(content.parentNode, '#ExpSPECChild>br');
        let anchors = content.querySelectorAll('a');
        for (const anchor of anchors) {
            let link = 'https://www.frdic.com' + anchor.getAttribute('href');
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