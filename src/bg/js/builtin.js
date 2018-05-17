class Builtin {
    constructor() {
        this.dicts = {};
    }

    async loadData() {
        this.dicts['collins'] = await Builtin.loadData('data/collins.json');
        this.dicts['oxford'] = await Builtin.loadData('data/oxford.json');
    }

    findTerm(dictname, term) {
        const dict = this.dicts[dictname];
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