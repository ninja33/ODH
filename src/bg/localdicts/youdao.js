if (typeof Youdao == 'undefined') {

    class Youdao {
        constructor() {
            this.word = '';
            this.selector = '';
            this.attr = '';
            this.base = 'http://dict.youdao.com/fsearch?client=deskdict&keyfrom=chrome.extension&pos=-1&doctype=xml&xmlVersion=3.2&dogVersion=1.0&vendor=unknown&appVer=3.1.17.4208&le=eng&q=';
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
                    type: 'GET',
                    dataType: 'xml',
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
            let xmlroot = data.getElementsByTagName("yodaodict")[0];
            let trans = xmlroot.getElementsByTagName("translation");
            let transarr = Array.from(trans);
            let content = "";
            if (!trans[0] || !trans[0].childNodes[0])
                return null;

            for (let i = 0; i < trans.length; i++) {
                content += trans[i].getElementsByTagName("content")[0].childNodes[0].nodeValue + "<br>";
            }
            let css = this.renderCSS();
            return css + content;
        }

        renderCSS() {
            let css = `
            <style> 
            </style>`;

            return css;
        }

    }

    registerDict('encn-Default', Youdao);

}