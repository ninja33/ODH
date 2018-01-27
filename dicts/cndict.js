if (typeof CNDict == 'undefined') {

    class CNDict {
        constructor() {
            this.word = '';
            this.selector = '#exp';
            this.attr = 'outerHTML';
            this.base = 'http://apii.dict.cn/apis/dict_plugin.php?skin=default&pie=1&tj=huaci&btype=chrome&ver=1.0.2&pos=0';
        }

        resourceURL() {
            let word = encodeURIComponent(this.word);
            let key = '73968t727aac3ee8bai593473d960c8x';
            let md5_salt = `###${key}chromex###`;
            let saltmd5 = md5(rawurlencode(word + '0' + md5_salt));
            return this.base + `&t=${saltmd5}&q=${word}`;
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
            let content = div.querySelector(this.selector)
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
            </style>`;

            return css;
        }

    }

    registerDict('encn-CNDict', CNDict);

}