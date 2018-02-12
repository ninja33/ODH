if (typeof enfr_Collins == 'undefined') {

    class enfr_Collins {
        constructor() {
            this.word = '';
            this.selector = '.content';
            this.attr = 'innerHTML';
            this.base = 'https://www.collinsdictionary.com/dictionary/english-french/'

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
                .copyright{
                    display:none;
                }
                .orth {
                    font-size: 100%;
                    font-weight: bold;
                }
                .quote {
                    font-style: normal;
                    color: #1683be;
                }
                .colloc {
                    font-style: italic;
                    font-weight: normal;
                }
                .sense {
                    border: 1px solid;
                    border-color: #e5e6e9 #dfe0e4 #d0d1d5;
                    border-radius: 3px;
                    padding: 5px;
                    margin-top: 3px;
                }
                .sense .re {
                    font-size: 100%;
                    margin-left: 0;
                }
                a {
                    color: #000;
                    text-decoration: none;
                }
                * {
                    word-wrap: break-word;
                    box-sizing: border-box;
                }
            </style>`;

            return css;
        }
    }

    registerDict('enfr_Collins', enfr_Collins);

}