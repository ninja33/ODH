if (typeof enen_Collins == 'undefined') {

    class enen_Collins {
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
        }

        renderContent(data) {
            let doc = document.createElement("div");
            doc.innerHTML = data;

            let expression = doc.querySelector('.Cob_Adv_Brit h2').innerText.trim();
            let reading = doc.querySelector('.Cob_Adv_Brit .pron').innerText.trim();

            let defNodes = doc.querySelectorAll('.Cob_Adv_Brit .content .hom');
            if (defNodes) {
                let definitions = [];
                for (const node of defNodes) {
                    //this.removelinks(node);
                    definitions.push(node.innerHTML);
                }
                let css = this.renderCSS();
                let note = {
                    css,
                    expression,
                    reading,
                    definitions
                }
                return note;
            } else {
                return null;
            }
        }

        renderCSS() {
            let css = `
            <style>
                a {
                    cursor: pointer;
                    color: inherit;
                    text-decoration: none;
                    border-bottom: dashed 1px rgba(0,0,0,.6);
                }
                .type-example::before {
                    content: '*';
                }
                .type-example{
                    color: #0b457a;
                }
            </style>`;
            return css;
        }
    }

    registerDict('enen_Collins', enen_Collins);

}