if (typeof encn_YoudaoCollins == 'undefined') {

    class encn_YoudaoCollins {
        constructor() {
            this.word = '';
            this.selector = '.content';
            this.attr = 'innerHTML';
            this.base = 'http://dict.youdao.com/w/'

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

            let defNodes = doc.querySelectorAll('#collinsResult .ol li');
            if (defNodes.length != 0) {
                let expression = doc.querySelector('#collinsResult .title').innerText.trim();
                let audiourl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}`;
                let reading = doc.querySelector('#collinsResult .phonetic').innerText.trim();
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
                    definitions,
                    audiourl
                }
                return note;
            } else {
                let trans = doc.querySelector('.trans-container');
                if (trans) {
                    return `<style>ul, ol, li {list-style: none;margin:0;padding:0} </style>` + trans.innerHTML;
                } else {
                    return null;
                }
            }
        }

        renderCSS() {
            let css = `
            <style>
                span.additional {
                    text-transform: lowercase;
                    background-color: #efefef;
                    color: black;
                    padding: 0 3px;
                    border-radius: 3px;
                    font-size: 0.9em;
                }
                b {
                    color: #638c0b;
                }
                div.collinsMajorTrans p,
                div.examples p{
                    display:inline;
                }
                div.collinsMajorTrans{
                    padding: 3px;
                    margin-bottom: 3px;
                }
                div.exampleLists {
                    background-color: #eff5f8;
                    border-radius: 3px;
                    padding: 3px;
                }
                div.examples{
                    display: inline;
                }
            </style>`;
            return css;
        }
    }

    registerDict('encn_YoudaoCollins', encn_YoudaoCollins);

}