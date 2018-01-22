class AnkiHelperFrontEnd {

    constructor() {

        this.point = {
        x: 0,
        y: 0,
        };
        this.noteinfo = {};
        this.popup = new Popup();
        this.timeout = null;

        window.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('mousedown', e => this.onMouseDown(e));
        window.addEventListener('message', e => this.onFrameMessage(e));
        document.addEventListener('selectionchange', e => this.userSelectionChanged(e));
        window.addEventListener('selectionend', e => this.onSelectionEnd(e));
    }

    onMouseMove(e) {
        this.point = {
        x: e.clientX,
        y: e.clientY,
        };
    }

    userSelectionChanged(e) {

        // wait 500 ms after the last selection change event
        if (this.timeout) {
        clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
                var selEndEvent = new CustomEvent("selectionend");
                window.dispatchEvent(selEndEvent);
            }, 500);
    }

    onSelectionEnd(e) {

        // reset selection timeout
        this.timeout = null;

        const selection = window.getSelection();
        this.word = (selection.toString() || '').trim();
        if (this.isInvalid()){
            return;
        };

        this.sendBGMessage('findTerm', {word: this.word}, defs => {
            if (defs == null)
                return;

            let sent = this.getSentence(this.word);
            this.noteinfo = {
                word:this.word,
                defs,
                sent,
            };
            const content = this.renderPopup(this.noteinfo);
            this.popup.showNextTo({
                x: this.point.x,
                y: this.point.y,
            }, content);
        });

    }

    onMouseDown(e) {
        this.popup.hide();
    }

    onFrameMessage(e) {
        this.sendBGMessage('addNote',{noteinfo:this.noteinfo}, result => {});
    }

    cutSentence(word, sentence) {
        var autocut = true;
        var sentenceNum = 3;

        if (autocut && sentenceNum > 0) {
            let puncts = sentence.match(/[\.\?!;]/g) || [];
            let arr = sentence.split(/[\.\?!;]/).filter(s => s.trim() !== '').map((s, index) => s.trim() + `${puncts[index] || ''} `);
            let index = arr.findIndex(s => s.indexOf(word) !== -1);
            let left = Math.ceil((sentenceNum - 1) / 2);
            let start = index - left;
            let end = index + ((sentenceNum - 1) - left);

            if (start < 0) {
                start = 0;
                end = sentenceNum - 1;
            } else if (end > (arr.length - 1)) {
                end = arr.length - 1;

                if ((end - (sentenceNum - 1)) < 0) {
                    start = 0;
                } else {
                    start = end - (sentenceNum - 1);
                }
            }

            return arr.slice(start, end + 1).join('').replace(word, '<b>' + word + '</b>');
        } else {
            return sentence.replace(word, '<b>' + word + '</b>');
        }
    }

    getSentence(word) {
        let wordContent = '';
        const upNum = 4;
        const selection = window.getSelection();

        if (selection.rangeCount < 1)
            return;

        var node = selection.getRangeAt(0).commonAncestorContainer;

        if (['INPUT', 'TEXTAREA'].indexOf(node.tagName) !== -1) {
            return;
        }

        node = this.getBlock(node, upNum);

        if (node !== document) {
            wordContent = node.innerText;
        }

        return this.cutSentence(word, wordContent);
    }

    getBlock(node, deep) {
        const blockTags = ['LI', 'P', 'DIV', 'BODY'];
        if (blockTags.indexOf(node.nodeName.toUpperCase()) !== -1 || deep === 0) {
            return node;
        } else {
            return this.getBlock(node.parentElement, deep - 1);
        }
    }

    renderPopup(noteinfo) {
        let {
            word,
            defs,
            sent
        } = noteinfo;

        let css = chrome.extension.getURL('fg/css/frame.css');
        let js = chrome.extension.getURL('fg/js/frame.js');
        let img = chrome.extension.getURL('fg/img/plus.png');

        var content = `\
        <html lang="zh-CN">\
            <head><meta charset="UTF-8"><title></title>\
                <link rel="stylesheet" href="${css}">\
            </head>\
            <body style="margin:3px;">\
            <div class="abkl-content">\
                <div class="abkl-sect abkl-word">${word}<span class="abkl-addnote"><img src="${img}"/></span></div>\
                <div class="abkl-sect abkl-defs">${defs}</div>\
                <div class="abkl-sect abkl-sent">${sent}</div>\
            </div>\
            <script src="${js}"></script>\
            </body>\
        </html>`;
        return content;
    }

    sendBGMessage(action, params, callback) {
        chrome.runtime.sendMessage({action, params}, callback);
    }

    isEmpty() {
        return (!this.word);
    }

    isShortandNum() {
        let numReg = /\d/;
        return (this.word.length < 3 || numReg.test(this.word))
    }

    isEnglish() {
        let enReg = /^[^\u4e00-\u9fa5]+$/i;
        return (enReg.test(this.word));
    }

    isInvalid() {
        return (this.isEmpty() || this.isShortandNum() || !this.isEnglish());
    }
        
}

window.abklfrondend = new AnkiHelperFrontEnd();