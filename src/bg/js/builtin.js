class Builtin {
    constructor() {
        this.dicts = {};
    }

    async loadData() {
        let parts = [1,2,3,4,5,6,7,8,9];
        let promises = parts.map(x=>Builtin.loadData(`data/part${x}.json`));
        this.dicts['collins'] = await Promise.all(promises);

        //this.dicts['collins'] = await Builtin.loadData('data/collins.json');
    }

    findTerm(dictname, term) {
        const dict = this.dicts[dictname];
        for (const def of dict)
            if (def.hasOwnProperty(term)) 
                return JSON.stringify(def[term]);
        
        return null;
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