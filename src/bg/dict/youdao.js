class Youdao {
    constructor() {
        this.word = '';
        this.appSecret = 'xYLvWBzCupw3nTpUcBwG6dvjZZT2RGD6';
        this.appKey = '49557dccdded6747';
        this.salt = (new Date).getTime();
        this.from = 'en';
        this.to = 'zh-CHS';
        this.base = 'https://openapi.youdao.com/api?'

    }

    processData(resp) {
        let data = JSON.parse(resp);
        if (!data.basic) {
            return null;
        } else {
            var defs = "";
            for (let i = 0; i < data.basic.explains.length; i++) {
                defs += data.basic.explains[i] + '<br>';
            }
            return defs;
        }
    }

    buildAPIURL() {
        let sign = md5(this.appKey + this.word + this.salt + this.appSecret);
        let param = `q=${this.word}&appKey=${this.appKey}&salt=${this.salt}&from=${this.from}&to=${this.to}&sign=${sign}`;
        return (this.base + param);
    }

    findTerm(word) {
        this.word = word;
        let url = this.buildAPIURL();
        return new Promise((resolve, reject) => {
            Youdao.loadData(url).then(data => {
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