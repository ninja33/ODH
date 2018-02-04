class Formhelper {
    constructor() {
        this.path = "data/wordforms.json";
        this.wordforms = null;
    }

    async loadData() {
        this.wordforms = await Formhelper.loadData(this.path);
    }

    deinflect(term) {
        return this.wordforms[term]?this.wordforms[term]:null;
    }

    static async loadData(path) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: path,
                type: "GET",
                dataType: "json",
                timeout: 5000,
                error: (xhr, status, error) => {
                    reject(error);
                },
                success: (data, status) => {
                    if (data) {
                        resolve(data);
                    } else {
                        reject(new Error('Not Found!'));
                    }
                }
            });
        });
    }

}

window.formhelper = new Formhelper();
formhelper.loadData();
