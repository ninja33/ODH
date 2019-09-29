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

        let jbjs = doc.querySelector('.jbjs') || ''; // basic explaination
        //let xxjsContent = doc.querySelector('.res_c_center') || '';
        if (jbjs) {
            this.removeTags(jbjs,'.zib-title'); 
            this.removeTags(jbjs,'.h2_entry'); 
            this.removeTags(jbjs,'.am-default.contentslot');
            return jbjs.innerHTML;
        } else {
            return [];
        }
    }
}
