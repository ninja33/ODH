if (typeof Bing == 'undefined') {

    class Bing {
        constructor() {
            this.word = '';
            this.selector = '.lf_area ul';
            this.attr = 'outerHTML';
            this.base = 'https://cn.bing.com/dict/search?q='

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
            let ul = div.querySelector('.lf_area ul')
            ul.querySelector('.web').innerText = ul.querySelector('.web').innerText + ": "
            let li = ul.querySelectorAll('li');
            let content = '';
            if (li) {
                li.forEach(x=>{
                    content += x.innerText + '<br>';
                });
                return content;
            } else {
                return null;
            }
        }

        renderCSS() {
            let css = ``;
            return css;
        }
    }

    registerDict('encn-Bing', Bing);

}