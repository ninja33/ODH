class AnkiHelperFrontEnd {

    constructor() {

        this.point = null;
        this.note = null;
        this.activateKey = 16;
        this.activateBtn = 2;
        this.enabled = true;
        this.popup = new Popup();
        this.timeout = null;

        window.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('mousedown', e => this.onMouseDown(e));
        window.addEventListener('keydown', e =>this.onKeyDown(e));
        window.addEventListener('message', e => this.onFrameMessage(e));
        document.addEventListener('selectionchange', e => this.userSelectionChanged(e));
        window.addEventListener('selectionend', e => this.onSelectionEnd(e));
    }

    onKeyDown(e) {
        if (this.enabled && this.point !== null && (e.keyCode === this.activateKey || e.charCode === this.activateKey)) {
            this.selectText(this.point);
        }
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
        if (this.isInvalid(this.word)) {
            return;
        };

        let request = {
            action: 'getTranslation',
            params: {
                word: this.word
            },
        };
        chrome.runtime.sendMessage(request, defs => {
            if (defs == null)
                return;

            let sent = this.getSentence(this.word);
            this.note = {
                word: this.word,
                defs,
                sent,
            };
            let content = this.renderPopup(this.note);
            this.popup.showNextTo({
                x: this.point.x,
                y: this.point.y,
            }, content);
        });

    }

    onMouseDown(e) {
        this.point = {
            x: e.clientX,
            y: e.clientY
        };
        if (this.enabled && (e.shiftKey || e.which === this.activateBtn)) {
            this.selectText(this.point);
        } else {
            this.popup.hide();
        }
    }

    onFrameMessage(e) {
        if (e.data == 'createNote') {
            let request = {
                action: 'createNote',
                params: {
                    note: this.note
                },
            };
            chrome.runtime.sendMessage(request, result => {});
        }
        return;
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

    renderPopup(note) {
        let {
            word,
            defs,
            sent
        } = note;

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
                <div class="abkl-sect abkl-word">${word}<span class="abkl-createnote"><img src="${img}"/></span></div>\
                <div class="abkl-sect abkl-defs">${defs}</div>\
                <div class="abkl-sect abkl-sent">${sent}</div>\
            </div>\
            <script src="${js}"></script>\
            </body>\
        </html>`;
        return content;
    }

    isEmpty() {
        return (!this.word);
    }

    isShortandNum(word) {
        let numReg = /\d/;
        return (word.length < 3 || numReg.test(word))
    }

    isEnglish(word) {
        let enReg = /^[^\u4e00-\u9fa5]+$/i;
        return (enReg.test(word));
    }

    isInvalid(word) {
        return (this.isEmpty(word) || this.isShortandNum(word) || !this.isEnglish(word));
    }

    selectText(point) {
        const range = document.caretRangeFromPoint(point.x, point.y);
        if (range !== null) {
            let textSource = new TextSourceRange(range);
            textSource.selectText();
        }

    }
}

window.abkl_frondend = new AnkiHelperFrontEnd();