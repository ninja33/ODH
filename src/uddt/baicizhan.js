if (typeof Baicizhan == 'undefined') {

    class Baicizhan {
        constructor() {
            this.word = '';
            this.base = 'http://mall.baicizhan.com/ws/search?w='

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
            let wordInfo = JSON.parse(data);
            if (wordInfo.mean_cn == undefined)
                return null;

            let content = `<div class='bcz'>${wordInfo.mean_cn}</div>`;
            content += wordInfo.df ? `<div class='bcz'><img width="260px" src='${wordInfo.df}' /></div>` : '';
            content += wordInfo.st ? `<div class='bcz'>${wordInfo.st}</div>` : '';
            content += wordInfo.sttr ? `<div class='bcz'>${wordInfo.sttr}</div>` : '';
            content += wordInfo.img ? `<div class='bcz'><img width="260px" src='${wordInfo.img}' /></div>` : '';
            //content += `<div class='bcz'><video width="340px" controls><source src='${wordInfo.tv}' type="video/mp4"></video></div>`;
            let css = this.renderCSS();
            return css + content;
        }

        renderCSS() {
            let css = `
                <style>
                .bcz {
                    border: 1px solid;
                    border-color: #e5e6e9 #dfe0e4 #d0d1d5;
                    border-radius: 3px;
                    padding: 5px; margin-top: 3px;}
                </style>`;

            return css;
        }
    }

    registerDict('encn-Baicizhan', Baicizhan);

}