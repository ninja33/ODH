class Custdict {
    constructor() {
        this.word = '';
        this.base = 'https://www.collinsdictionary.com/dictionary/english/'

    }

    renderCSS(){
        let css = `
        <style> 
            .type-example,
            .copyright,
            .inflected_forms,
            .form {
                display:none;
            }
            .def {
                border: 1px solid;
                border-color: #e5e6e9 #dfe0e4 #d0d1d5;
                border-radius: 3px;
                padding: 5px;
                margin-top: 3px;
            }
            .sense {
                margin-bottom: 5px;
                padding-bottom: 2px;
        </style>`;
        return css
    }
    processData(data) {
        let div = document.createElement("div");
        div.innerHTML = data;
        return this.renderCSS() + div.querySelector(".content").innerHTML;
    }

    findTerm(word) {
        this.word = word;
        let url = this.base + this.word;
        return new Promise((resolve, reject) => {
            Collins.loadData(url).then(data => {
                resolve(this.processData(data));
            }).catch(error => reject(error));
        });
    }

    static loadData(url) {
        return new Promise((resolve, reject) => {
            try {
                let xhr = new XMLHttpRequest();
                xhr.addEventListener('loadend', () => {
                    resolve(xhr.responseText);
                });
                xhr.open('GET', 'url');
                xhr.send();
            } catch (error) {
                reject(error);
            }
        });
    }
}