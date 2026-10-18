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
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        //let deflection = api.deinflect(word);
        let results = await this.findZdic(word);
        return results;
    }

    removeTags(elem, name) {
        let tags = elem.querySelectorAll(name);
        tags.forEach(x => {
            x.outerHTML = '';
        });
    }

    renderCSS() {
        return `<style>
        .xxjs-list {margin:0; padding-left:1.4em;}
        .xxjs-item {margin:4px 0;}
        .xxjs-item__def {line-height:1.6;}
        .xxjs-citation {margin:2px 0 2px .5em; padding-left:8px; border-left:2px solid #e0e0e0; color:#666; font-size:.9em;}
        .xxjs-citation__list {display:inline; margin:0; padding:0; list-style:none;}
        .xxjs-citation__item {display:inline; margin:0; padding:0;}
        .xxjs-citation__source {color:#999;}
        .xxjs-block-label {color:#999; font-size:.85em; margin-right:4px;}
        .xxjs-english {color:#555; font-size:.9em; margin:2px 0 2px .5em;}
        </style>`;
    }

    async findZdic(word) {
        let notes = [];
        if (!word) return notes; // return empty notes

        let doc = '';
        try {
            let url = `https://www.zdic.net/hans/${encodeURIComponent(word)}`;
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let content = doc.querySelector('.dict-section__body') || ''; // detailed explanation
        if (content) {
            let reading = '';
            let head = content.querySelector('.xxjs-reading-head');
            if (head) {
                let py = head.querySelector('.xxjs-reading__py');
                reading = py ? py.textContent.replace(/\s+/g, ' ').trim() : '';
            }

            this.removeTags(content, '.xxjs-reading-head, .ad-wrapper, .adsbygoogle, .feedback-link');
            return [{
                css: this.renderCSS(),
                reading,
                definitions: [content.innerHTML]
            }];
        } else {
            return [];
        }
    }
}
