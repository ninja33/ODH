class Builtin {
    constructor() {
        this.collins = null;
        this.oxford = null;
    }

    async loadData() {
        this.collins = await Builtin.loadData('data/collins.json');
        this.oxford = await Builtin.loadData('data/oxford.json');
    }

    getCollins(term) {
        const dict = this.collins;
        let results = [];
        let indices = dict.indices[term] || [];
        results = results.concat(indices.map(index => {
            return dict.defs[index];
        }));
        return results.length ? JSON.stringify(results) : null;
    }

    getOxford(term) {
        const dict = this.oxford;
        let results = [];
        let indices = dict.indices[term] || [];
        results = results.concat(indices.map(index => {
            return dict.defs[index];
        }));
        return results.length ? JSON.stringify(results) : null;
    }

    static async loadData(path) {
        return new Promise((resolve, reject) => {
            let request = {
                url: path,
                type: 'GET',
                dataType: 'json',
                timeout: 5000,
                error: (xhr, status, error) => reject(error),
                success: (data, status) => resolve(data)
            };
            $.ajax(request);
        });
    }
    
}