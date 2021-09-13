/* global api */
class itcn_Dict {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '意汉词典';
        if (locale.indexOf('TW') != -1) return '意汉词典';
        return 'Local IT->CN Dictionary';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        //let deflection = api.deinflect(word);
        let results = await this.findITCNDict(word);
        return results;
    }

    async findITCNDict(word) {
        let notes = [];
        if (!word) return notes; // return empty notes

        let base = 'https://127.0.0.1:8000/';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let definitions = [doc.body.innerHTML];
        let css = this.renderCSS();
        notes.push({
            css,
            definitions,
        });
        return notes;
    }


    renderCSS() {
        let css = '<style>A:link{TEXT-DECORATION:none}A:visited{TEXT-DECORATION:none}A:active{TEXT-DECORATION:none}A:hover{TEXT-DECORATION:none}p.PRM{text-align:left;margin:0 0 0 0}p.SCD{text-align:left;margin:0 0 0 16px}p.TRZ{text-align:left;margin:0 0 0 24px}BIAOHAO{font-size:15px;font-weight:700;color:red}XUHAO{font-size:12px;font-weight:700;color:green}SHILI,MAOHAO{font-size:12px;font-weight:400;font-style:normal;color:green}SLTRZ{font-size:12px;font-weight:400;font-style:normal;color:teal}BOLANG{font-size:12px;font-weight:700;background-color:#FFC;color:red}SY{font-size:12px;font-weight:400;font-style:normal;color:black}IT{font-size:12px;font-weight:400;font-style:normal;color:darkblue}CN{font-size:12px;font-weight:400;font-style:normal;color:black}CNNO{font-size:0;font-weight:400;font-style:normal;color:white}ITCS{font-size:12px;font-weight:700;font-style:normal;color:darkblue}CNCS{font-size:12px;font-weight:400;font-style:normal;color:black}CNCSNO{font-size:0;font-weight:400;font-style:normal;color:white}ITTRZ{font-size:12px;font-weight:400;font-style:normal;color:teal}CNTRZ{font-size:11px;font-weight:400;font-style:normal;color:black}CNTRZNO{font-size:0;font-weight:400;font-style:normal;color:white}YANIT{font-size:12px;font-weight:700;font-style:italic;color:darkblue}YANCN{font-size:12px;font-weight:400;font-style:normal;color:black}YANCNNO{font-size:0;font-weight:400;font-style:normal;color:white}XSCT{font-size:15px;font-weight:700;font-style:normal;color:#0B0B3B}CIXING{text-transform:lowercase;font-size:12px;font-weight:700;font-style:italic;color:red}AUSIL{text-transform:lowercase;font-size:12px;font-weight:700;font-style:normal;color:green}PL{font-size:12px;font-weight:700;font-style:normal;color:green}HUOZ{font-size:12px;font-weight:700;font-style:normal;color:#424242}BW{font-size:12px;font-weight:700;font-style:normal;color:#0B0B3B}BWT{font-size:12px;font-weight:700;font-style:normal;color:#0B0B3B}LINGUA{font-size:13px;font-weight:700;color:#61210B}ABBREV{font-size:13px;font-weight:700;color:#61210B}DXX{font-size:12px;font-weight:700;color:#61210B}QITA{font-size:12px;font-weight:700;color:#61210B}</style>';
        return css;
    }
}