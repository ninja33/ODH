class Baicizhan {
    constructor() {
        this.word = '';
        this.base = 'http://mall.baicizhan.com/ws/search?w='

    }

    processData(data) {
        let wordInfo = JSON.parse(data)
        let defsContent = "\
            <style> .bcz-section {\
                border: 1px solid;\
                border-color: #e5e6e9 #dfe0e4 #d0d1d5;\
                border-radius: 3px;\
                padding: 5px; margin-top: 3px;}\
            </style>";

        if (wordInfo.mean_cn == undefined)
            return null

        defsContent += `<div class='bcz-section'>${wordInfo.mean_cn}</div>`;
        if (wordInfo.df != undefined)
            defsContent += `<div class='bcz-section'><img width="340px" src='${wordInfo.df}' /></div>`;
        if (wordInfo.st != undefined)
            defsContent += `<div class='bcz-section'>${wordInfo.st}</div>`;
        if (wordInfo.sttr != undefined)
            defsContent += `<div class='bcz-section'>${wordInfo.sttr}</div>`;
        if (wordInfo.img != undefined)
            defsContent += `<div class='bcz-section'><img width="340px" src='${wordInfo.img}' /></div>`;
        //if (wordInfo.tv != undefined)
        //    defsContent += `<div class='bcz-section'><video width="340px" controls><source src='${wordInfo.tv}' type="video/mp4"></video></div>`;
        return defsContent;
    }

    findTerm(word) {
        this.word = word;
        let url = this.base + this.word;
        return new Promise((resolve, reject) => {
            Baicizhan.loadData(url).then(data => {
                resolve(this.processData(data));
            }).catch(error => reject(error));
        });
    }

    static loadData(url) {
        return new Promise((resolve, reject) => {
            try {
                let xhr = new XMLHttpRequest();
                xhr.overrideMimeType("application/json");
                xhr.addEventListener('loadend', () => {
                    resolve(xhr.responseText);
                });
                xhr.open('GET', url);
                xhr.send();
            } catch (error) {
                reject(error);
            }
        });
    }
}