if (typeof encn_Cambridge == 'undefined') {

    class encn_Cambridge {
        constructor() {
            this.word = '';
            this.selector = '.entry>.entry-body';
            this.attr = 'innerHTML';
            this.base = 'https://dictionary.cambridge.org/search/english-chinese-simplified/direct/?q='

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

        removeTags(elem, list) {
            for (const name of list) {
                let tags = elem.querySelectorAll(name);
                for (const div of tags) {
                    div.outerHTML = "";
                };
            }
        }

        removelinks(elem) {
            let tags = elem.querySelectorAll('a');
            for (const div of tags) {
                div.outerHTML = div.innerText;
            };
            
            tags = elem.querySelectorAll('h2');
            for (const div of tags) {
                div.outerHTML = `<div class='head2'>${div.innerHTML}</div>`;
            };

            tags = elem.querySelectorAll('h3');
            for (const div of tags) {
                div.outerHTML = `<div class='head3'>${div.innerHTML}</div>`;
            };
        }

        renderContent(data) {
            let div = document.createElement("div");
            div.innerHTML = data;

            let content = div.querySelector(this.selector);
            this.removeTags(content, ['.extraexamps']);
            this.removelinks(content);

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
            .entry-body__el{
                margin-bottom:10px;
            }
            .head2{
                font-size: 1.2em;
                font-weight:bold;
            }
            .pos-header{
                border-bottom: 1px solid;
            }
            .head3 {
                display:none;
            }
            .posgram {
                font-size: 0.8em;
                background-color: #959595;
                color: white;
                padding: 2px 5px;
                border-radius: 3px;
            }
            .epp-xref::after {
                content: ")";
            }
            .epp-xref::before {
                content: "(";
            }
            .def-block, .phrase-block {
                border: 1px solid;
                border-color: #e5e6e9 #dfe0e4 #d0d1d5;
                border-radius: 3px;
                padding: 5px;
                margin: 8px 0;
                /*background-color: #fbfbfb;*/
            }
            .phrase-block .def-block{
                border: initial;
                padding: initial;
            }
            p.def-head {
                margin: auto;
            }
            .phrase-head {
                vertical-align: middle;
                color: #1683ea;
                font-weight: bold;
            }
            .trans {
                color: #5079bb;
            }
            </style>`;

            return css;
        }
    }

    registerDict(chrome.i18n.getMessage('encn_Cambridge'), encn_Cambridge);

}