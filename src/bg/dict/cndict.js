class Cndict {
    constructor() {
        this.word = '';
    }

    make_md5_salt(key){
      return '###'+key+'chromex'+'###';
    }

    buildAPIURL() {
        let root_url = 'http://apii.dict.cn'
        let pie = '&pie=1'
        let tj = 'huaci'
        let dictcnBrowserType = 'chrome'
        let dictcnVersion = '1.0.2'
        let pos = 0

        let word = encodeURIComponent(this.word);
        let md5_salt = this.make_md5_salt('73968t727aac3ee8bai593473d960c8x');
        let saltmd5 = md5(rawurlencode(word+pos+md5_salt));

        let url = root_url+'/apis/dict_plugin.php?skin=default'+pie+'&tj='+tj+'&btype='+dictcnBrowserType+'&ver='+dictcnVersion+'&t='+saltmd5+'&pos='+pos+'&q='+word;

        return (url);
    }

    processData(data) {
        if (data == 'Authorization failed!')
            return null;
        let div = document.createElement("div");
        div.innerHTML = data;
        let def = div.querySelector("#exp").outerHTML
        return def;
    }

    findTerm(word) {
        this.word = word;
        let url = this.buildAPIURL();
        return new Promise((resolve, reject) => {
            Cndict.loadData(url).then(data => {
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