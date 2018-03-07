/* global api */
class cncn_Zdic {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1)
            return '汉典汉语词典';
        if (locale.indexOf('TW') != -1)
            return '汉典汉语词典';
        return 'cncn_Zdic';
    }


    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        //let deflection = api.deinflect(word);
        let results = await this.findZdic(word);
        return results;
    }

    removeTags(elem, name) {
        let tags = elem.querySelectorAll(name);
        tags.forEach(x => {
            x.outerHTML = '';
        });
    }

    async findZdic(word) {
        let notes = [];
        if (!word) return notes; // return empty notes

        let doc = '';
        try {
            let url = `http://www.zdic.net/search/?q=${encodeURIComponent(word)}&c=2`;
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let inlinestyle = doc.documentElement.innerHTML.match(/<style type="text\/css">\n<!--([\s\S]+?)-->\n<\/style>/);
        inlinestyle = inlinestyle?inlinestyle[1].replace('url(','url(http://www.zdic.net'):'';

        let signs = doc.documentElement.innerHTML.match(/\.zdct.+\n.+?display: none;/g)
        for (const sign of signs) {
            let signtag = sign.substring(0,sign.indexOf(' '));
            this.removeTags(doc.body,signtag);
        }
        doc.body.innerHTML = doc.body.innerHTML.replace(/(<img src=")(\/.+?>)/gi, '$1'+'http://www.zdic.net'+'$2')

        let ciContent = doc.querySelector('.cdnr') || '';
        if (ciContent) {
            let definitions = [ciContent.innerHTML];
            let css = `<style>${inlinestyle}${this.renderCSS('ciCSS')}</style>`;
            notes.push({css,definitions});
            return notes;
        }

        let ziContent = doc.querySelector('#tagContent') || '';
        if (ziContent) {
            let definitions = [];
            let tagContents = ziContent.querySelectorAll('.tagContent');
            for (const tagContent of tagContents) {
                definitions.push(tagContent.innerHTML);
            }
            let css = `<style>${inlinestyle}${this.renderCSS('ziCSS')}</style>`;
            notes.push({css,definitions});
            return notes;
        }
    }

    renderCSS(style) {
        let ciCss = `a,a:hover,input:focus,select:focus,textarea:focus{color:#369}.gc_fy,.gc_jy,.gc_lz,.gc_sy,.gc_yx,.gc_yy{clear:both;display:block}.cdnr .jiaru_s,.footer,ruby{text-align:center}blockquote,body,dd,div,dl,dt,fieldset,h1,h2,h3,h4,h5,img,label,li,ol,p,select,span,td,textarea,th,ul{font-family:Verdana,Geneva,Arial,Helvetica,sans-serif;font-size:14px;color:#333;line-height:25px;background:#fff}a{font-size:12px;text-decoration:none}.cdnr,input{font-size:14px}a:hover{text-decoration:underline}blockquote,dd,div,dl,dt,fieldset,form,h1,h2,h3,h4,h5,img,label,li,ol,p,span,td,th,ul{margin:0;padding:0;list-style:none;border:none}li{padding:5px 0}hr{border:1px solid #CCC}.cdnr{font-family:"Trebuchet MS",Verdana,Geneva,Arial,Helvetica,sans-serif;padding:5px}.cdnr h1,.cdnr h2{font-weight:700;margin-right:5px;padding:2px 0 2px 10px}.cdnr h1{color:#600;font-size:18px}.cdnr h2{color:#333;font-size:16px}.cdnr .dicpy{color:#903}.cdnr .diczy{color:#009}.cdnr td{padding:0;margin:0}.cdnr .info{color:#999;font-size:14px;margin-right:5px;padding-left:10px}.cdnr .mut_jies{padding:10px 20px 20px;font-size:14px;color:#444;line-height:22px}.cdnr .yf_all{background:url(/imgs/tbg_r.gif) right no-repeat;padding:3px 4px 4px}.cdnr .if_all{color:#fff;background:url(/imgs/tbg_l.gif) left no-repeat;padding:3px 4px 4px 6px}.cdnr .mut_lvs{color:#090;font-weight:bolder}.cdnr h3{padding-left:15px;color:#000;line-height:26px;font-size:14px;background:url(/imgs/dotline_h.gif) center bottom repeat-x}.cdnr .mut_ol{margin:10px 6px 10px 35px}.cdnr .mut_ol li{list-style-position:outside;list-style-type:decimal}.cdnr .mut_ol .ty{color:gray}.cdnr .mut_ol .ty a{color:#2b919f}.cdnr .mut_h3s{color:#090;font-weight:bolder;padding:10px 20px 0 15px}.cdnr .jiaru_s{margin:10px 0}.cdnr .more{margin:10px 10px 10px 15px;font-size:13px}.cdnr .mutti_pp{padding:10px}.cdnr .diczx1{color:#036}.cdnr .diczx2{color:#900}.cdnr .diczx3{color:#006}.cdnr .diczx4{color:#060}.cdnr p{border-bottom:1px dotted #999;line-height:25px}.footer .copyright{font-size:8px;color:#CCC}.gycd ul,ol{margin-bottom:10px;margin-top:0}.gc_uono{list-style:none;margin-left:1.5em}.gycd{font-size:100%;line-height:1.5;padding-bottom:5px}.gc_sy{margin-bottom:2pt;font-weight:700}.gc_yy{font-size:92%;color:#674f4f}.gc_fy,.gc_jy{font-size:85%;margin-top:2px;font-weight:700;color:#666}.gc_jfy_i{background-color:#633;border-radius:4px;color:#fff;font-size:100%;line-height:1;padding:2px;margin-right:5px}.pz{border-bottom:1px dashed #F1E9E7}.pz ruby{margin-left:20px}.pz ruby rbc{font-size:150%;line-height:30px;font-weight:700}.pz ruby rtc{font-size:80%;color:#8F6652;line-height:30px}ruby{display:inline-table;white-space:nowrap;text-indent:0;margin:0;vertical-align:-20%}ruby>rb,ruby>rbc{display:table-row-group;line-height:90%}ruby>rbc+rtc,ruby>rbc+rtc+rtc,ruby>rt{font-size:60%;line-height:40%;letter-spacing:0}ruby>rbc+rtc,ruby>rt{display:table-header-group}ruby>rbc+rtc+rtc{display:table-footer-group}rbc>rb,rtc>rt{display:table-cell;letter-spacing:0}rtc>rt[rbspan]{display:table-caption}rp{display:none}`;

        let ziCss = `a,a:hover,input:focus,select:focus,textarea:focus{color:#369}#con,#tags{WIDTH:100%}#con,#tags LI .ff{FONT-SIZE:14px}#tags LI,#tags LI A,.swxz{FLOAT:left}.hb,.swjs1,.swjs2{/*clear:both*/}body{overflow-x:hidden}blockquote,body,dd,div,dl,dt,fieldset,h1,h2,h3,h4,h5,img,label,li,ol,p,select,span,td,textarea,th,ul{font-family:Verdana,Geneva,Arial,Helvetica,sans-serif;font-size:14px;color:#333;line-height:25px;background:#fff}a{font-size:12px;text-decoration:none}.tagContent,input{font-size:14px}a:hover{text-decoration:underline}blockquote,dd,div,dl,dt,fieldset,form,h1,h2,h3,h4,h5,img,label,li,ol,p,span,td,th,ul{margin:0;padding:0;list-style:none;border:none}li{padding:5px 0}hr{border:1px solid #CCC}.tagContent{font-family:"Trebuchet MS",Verdana,Geneva,Arial,Helvetica,sans-serif;padding:5px;width:100%}.tagContent h1,.tagContent h2{margin-right:5px;padding:2px 0 2px 10px;font-weight:700}.tagContent h1{color:#600;font-size:18px}.tagContent h2{color:#333;font-size:16px}.tagContent td{padding:0;margin:0}.tagContent .diczx1{color:#036}.tagContent .diczx2{color:#900}.tagContent .diczx3{color:#006}.tagContent .diczx4{color:#845247}.tagContent .dicpy,.tagContent .diczy{font-size:14px;font-family:pinyin;color:#600}.tagContent .diczx6{font-weight:700;color:#48623C}.tagContent .diczx7{font-weight:700;color:#303E59}.tagContent p{line-height:25px}.footer{text-align:center}.footer .copyright{font-size:8px;color:#CCC}OL LI{MARGIN:8px}#con{MARGIN:0 auto}#tags{PADDING-RIGHT:0;PADDING-LEFT:0;PADDING-BOTTOM:0;MARGIN:0 10px 10px 0;PADDING-TOP:0;HEIGHT:23px}#tags LI A,.tagContent{PADDING-RIGHT:5px;PADDING-LEFT:5px;PADDING-BOTTOM:0;PADDING-TOP:0}#tags LI{MARGIN-RIGHT:1px;LIST-STYLE-TYPE:none;HEIGHT:23px}#tags LI A{COLOR:#999;LINE-HEIGHT:23px;HEIGHT:23px;TEXT-DECORATION:none}#tags LI.selectTag{BACKGROUND-POSITION:left top;MARGIN-BOTTOM:-2px;POSITION:relative;HEIGHT:23px}#tags LI.selectTag A{BACKGROUND-POSITION:right top;COLOR:#000;LINE-HEIGHT:23px;HEIGHT:23px}.tagContent{DISPLAY:none;COLOR:#474747}#tagContent DIV.selectTag{DISPLAY:block}.jbjs_ol{margin:10px 6px 10px 35px}.zui,.zuib{margin:0;padding:0;height:58px}.jbjs_ol li{list-style-position:outside;list-style-type:decimal;line-height:14px}.zui{display:none;width:100%}.zuib{background:url(/images/z_b.gif) no-repeat;width:58px}.hb{border-top:1px solid transparent!important;margin-top:-1px!important;visibility:hidden}.jieshi{font-weight:700}.swjs2{text-align:left}.sound{width:20px;height:20px;margin-left:.5em;display:inline-block;cursor:pointer;overflow:hidden;top:2px;position:relative;background:url(http://img.zdic.net/zdicpic/images/mp3ico.png) -20px 2px no-repeat}.sound:hover{text-decoration:none;background-position:0 2px}`;
        
        return style == 'ciCSS' ? ciCss : (style == 'ziCSS' ? ziCss : '');
    }
}