class Deinflector {
    constructor() {
        this.path = '/bg/data/wordforms.json';
        this.wordforms = null;
    }

    async loadData() {
        this.wordforms = await Deinflector.loadData(this.path);
    }

    deinflect(term) {
        return this.wordforms[term] ? this.wordforms[term] : null;
    }

    static async loadData(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }
            return await response.json();
        } catch (_e) {
            return null;
        }
    }
}
