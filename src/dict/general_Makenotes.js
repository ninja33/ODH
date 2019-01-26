/* global api */
class general_Makenotes {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
        this.makenotes_lable = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) { this.makenotes_lable = '输入并添加笔记'; return '笔记摘录脚本'; }
        if (locale.indexOf('TW') != -1) { this.makenotes_lable = '輸入並添加筆記'; return '筆記摘錄腳本'; }
        this.makenotes_lable = 'Input and add notes here.';
        return 'Make Notes';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        //let deflection = api.deinflect(word);
        let results = await Promise.all([this.makeNotes(word)]);
        return [].concat(...results).filter(x => x);
    }

    async makeNotes(word) {
        if (!word) return [];
        let notes = [];
        let css = `
            <style>
                .odh-expression {
                    font-size: 1em!important;
                    font-weight: normal!important;
                }
            </style>`;
        notes.push({ css, definitions: [this.makenotes_lable] });
        return notes;
    }
}