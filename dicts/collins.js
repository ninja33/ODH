if (typeof Collins == 'undefined') {

    class Collins {
        constructor() {
            this.word = '';
            this.selector = '.content';
            this.attr = 'innerHTML';
            this.base = 'https://www.collinsdictionary.com/dictionary/english/'

        }

        resourceURL() {
            return this.base + encodeURIComponent(this.word);
        }

        findTerm(word) {
            this.word = word;
            let url = this.resourceURL();
            return this.onlineQuery(url);
        }

        onlineQuery(url) {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url,
                    type: "GET",
                    timeout: 5000,
                    error: (xhr, status, error) => {
                        reject(error);
                    },
                    success: (data, status) => {
                        let result = this.renderContent(data);
                        if (result) {
                            resolve(result);
                        } else {
                            reject(new Error('Not Found!'));
                        }
                    }
                });
            });
        }

        renderContent(data) {
            let div = document.createElement("div");
            div.innerHTML = data;
            let content = div.querySelector(this.selector);
            if (content) {
                let css = this.renderCSS();
                return css + content[this.attr];
            } else {
                return null;
            }
        }

        renderCSS() {
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
                }
                a {
                    color: #000;
                    text-decoration: none;
                }
            </style>`;

            return css;
        }
    }

    registerDict('enen-Collins', Collins);

}