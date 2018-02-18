class Formhelper {
    constructor() {
        this.path = "data/wordforms.json";
        this.wordforms = null;
    }

    async loadData() {
        try {
            this.wordforms = JSON.parse(await onlineQuery(this.path));
        } catch (err) {
            this.wordforms = null;
        }
    }

    deinflect(term) {
        return this.wordforms[term] ? this.wordforms[term] : null;
    }

}

window.formhelper = new Formhelper();
formhelper.loadData();