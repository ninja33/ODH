class Deinflector {
    constructor() {
        this.path = 'data/wordforms.json';
        this.wordforms = null;
    }

    async loadData() {
        this.wordforms = await Deinflector.loadData(this.path);
    }

    deinflect(term) {
        return this.wordforms[term] ? this.wordforms[term] : null;
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
