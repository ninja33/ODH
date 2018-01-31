class AODHFront {

    constructor() {

        this.point = null;
        this.note = null;
        this.activateKey = 16; // shift 16, ctl 17, alt 18
        this.enabled = true;
        this.popup = new Popup();
        this.timeout = null;

        window.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('mousedown', e => this.onMouseDown(e));
        window.addEventListener('keydown', e => this.onKeyDown(e));

        chrome.runtime.onMessage.addListener(this.onBgMessage.bind(this));
        window.addEventListener('message', e => this.onFrameMessage(e));
        document.addEventListener('selectionchange', e => this.userSelectionChanged(e));
        window.addEventListener('selectionend', e => this.onSelectionEnd(e));
    }

    onKeyDown(e) {
        if (this.enabled && this.point !== null && (e.keyCode === this.activateKey || e.charCode === this.activateKey)) {
            const range = document.caretRangeFromPoint(this.point.x, this.point.y);
            if (range !== null) {
                let textSource = new TextSourceRange(range);
                textSource.selectText();
            }
        }
    }

    onMouseDown(e) {
        this.popup.hide();
    }

    onMouseMove(e) {
        this.point = {
            x: e.clientX,
            y: e.clientY,
        };
    }

    userSelectionChanged(e) {

        if (!this.enabled)
            return;

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

        if (!this.enabled)
            return;

        // reset selection timeout
        this.timeout = null;

        const expression = selectedText();
        if (isInvalid(expression)) {
            return;
        };

        let request = {
            action: 'getTranslation',
            params: {
                expression
            },
        };
        chrome.runtime.sendMessage(request, result => {
            if (result == null)
                return;

            this.note = this.buildNote(result);

            let content = this.renderPopup(this.note);
            this.popup.showNextTo({
                x: this.point.x,
                y: this.point.y,
            }, content);
        });

    }

    onBgMessage({
        action,
        params
    }, sender, callback) {
        const method = this['api_' + action];
        if (typeof (method) === 'function') {
            params.callback = callback;
            method.call(this, params);
        }

        callback();
    }

    api_setOptions(params) {
        let {
            options,
            callback
        } = params;

        this.enabled = options.enabled;
        callback();
    }

    onFrameMessage(e) {
        if (e.data == 'createNote') {
            let request = {
                action: 'createNote',
                params: {
                    note: this.note
                },
            };
            chrome.runtime.sendMessage(request, () => {});
        }
        return;
    }


    buildNote(result) {
        //get 1 sentence around the expression.
        const expression = selectedText();
        const sentence = getSentence(1);
        let tmpl = {
            css:'',
            expression,
            reading: '',
            sentence,
        };

        //if 'result' is object with 'definitions' property, then copy this object.
        if (result.hasOwnProperty('definitions')) {
            for (const key in tmpl) {
                if (!result.hasOwnProperty(key)) {
                    result[key] = tmpl[key];
                }
            }
            return result;
        } else { // if 'result' is simple string, then return standard template.
            tmpl['definitions'] = [].concat(result);
            return tmpl;
        }

    }

    renderPopup(note) {
        let img = chrome.extension.getURL('fg/img/plus.png');
        let content = note.css;
        content += `<div class="odh-headsection"><span class="odh-expression">${note.expression}</span><span class="odh-reading">${note.reading}</span></div>`;
        for (const [index, definition] of note.definitions.entries()) {
            content += `<div class="odh-definitions"><img class="odh-createnote" dataset-index=${index} src="${img}"/>${definition}</div>`;
        }
        content += `<div class="odh-sentence">${note.sentence}</div>`;
        return this.popupHeader()+content+this.popupFooter();
    }

    popupHeader() {
        let css = chrome.extension.getURL('fg/css/frame.css');
        return `
        <html lang="en">
            <head><meta charset="UTF-8"><title></title>
                <link rel="stylesheet" href="${css}">
            </head>
            <body style="margin:0px;">
            <div class="odh-content">
        `;
    }

    popupFooter() {
        let js = chrome.extension.getURL('fg/js/frame.js');
        return `
            </div>
            <script src="${js}"></script>
            </body>
        </html>`;
    }
}

window.aodhfront = new AODHFront();