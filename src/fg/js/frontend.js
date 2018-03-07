/* global Popup, TextSourceRange, selectedText, isInvalid, getSentence*/
class ODHFront {

    constructor() {
        this.options = null;
        this.point = null;
        this.notes = null;
        this.sentence = null;
        this.audio = {};
        this.enabled = true;
        this.activateKey = 16; // shift 16, ctl 17, alt 18
        this.maxContext = 1; //max context sentence #
        this.popup = new Popup();
        this.lastword = null;
        this.content = null;
        this.timeout = null;
        this.keypressed = null;
        this.mousemoved = null;
        this.dblclicked = null;

        window.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('mousedown', e => this.onMouseDown(e));
        window.addEventListener('dblclick', e => this.onDoubleClick(e));

        window.addEventListener('keydown', e => this.onKeyDown(e));
        window.addEventListener('keyup', e => this.onKeyUp(e));

        chrome.runtime.onMessage.addListener(this.onBgMessage.bind(this));
        window.addEventListener('message', e => this.onFrameMessage(e));
        document.addEventListener('selectionchange', e => this.userSelectionChanged(e));
        window.addEventListener('selectionend', e => this.onSelectionEnd(e));
    }

    onKeyDown(e) {
        if (!this.activateKey)
            return;

        if (this.enabled && this.point !== null && (e.keyCode === this.activateKey || e.charCode === this.activateKey) && this.mousemoved) {
            const range = document.caretRangeFromPoint(this.point.x, this.point.y);
            if (range == null) return;
            let textSource = new TextSourceRange(range);
            textSource.selectText();
            if (this.timeout)
                clearTimeout(this.timeout);
            this.keypressed = true;
            this.mousemoved = false;
            this.onSelectionEnd(e);
        }
    }

    onKeyUp(e) {
        if (e.keyCode === this.activateKey || e.charCode === this.activateKey)
            this.keypressed = false;
    }

    onDoubleClick(e) {
        if (!this.enabled) return;
        if (this.timeout)
            clearTimeout(this.timeout);
        this.dblclicked = true;
        this.onSelectionEnd(e);
    }

    onMouseDown(e) {
        this.dbclicked = false;
        this.popup.hide();
    }

    onMouseMove(e) {
        this.mousemoved = true;
        this.point = { x: e.clientX, y: e.clientY, };
    }

    userSelectionChanged(e) {

        if (!this.enabled || this.keypressed || this.dblclicked) return;

        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        
        // wait 500 ms after the last selection change event
        this.timeout = setTimeout(() => {
            var selEndEvent = new CustomEvent('selectionend');
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
        }

        if (expression == this.lastword && this.content){
            this.popup.showNextTo({ x: this.point.x, y: this.point.y, }, this.content);
            return;
        } else {
            this.lastword = expression;
        }

        let request = {
            action: 'getTranslation',
            params: { expression },
        };
        chrome.runtime.sendMessage(request, result => {
            if (result == null || result.length == 0)
                return;

            this.notes = this.buildNote(result);

            this.content = this.renderPopup(this.notes);
            this.popup.showNextTo({ x: this.point.x, y: this.point.y, }, this.content);
        });

    }

    onBgMessage(request, sender, callback) {
        const { action, params } = request;
        const method = this['api_' + action];

        if (typeof(method) === 'function') {
            params.callback = callback;
            method.call(this, params);
        }

        callback();
    }

    api_setOptions(params) {
        let { options, callback } = params;
        this.options = options;
        this.enabled = options.enabled;
        this.activateKey = Number(this.options.hotkey);
        this.maxContext = Number(this.options.maxcontext);
        callback();
    }

    onFrameMessage(e) {
        const { action, params } = e.data;
        const method = this['api_' + action];
        if (typeof(method) === 'function') {
            method.call(this, params);
        }
    }

    api_addNote(params) {
        let { nindex, dindex } = params;

        let notedef = Object.assign({}, this.notes[nindex]);
        notedef.definition = this.notes[nindex].css + this.notes[nindex].definitions[dindex];
        notedef.definitions = this.notes[nindex].css + this.notes[nindex].definitions.join('<hr>');
        notedef.url = window.location.href;
        let request = {
            action: 'addNote',
            params: { notedef },
        };
        chrome.runtime.sendMessage(request, (success) => {
            let result = { success, params, };
            this.popup.sendMessage('setActionState', result);
        });
    }

    api_playAudio(params) {
        let { nindex, dindex } = params;
        let url = this.notes[nindex].audios[dindex];

        for (let key in this.audio) {
            this.audio[key].pause();
        }

        const audio = this.audio[url] || new Audio(url);
        audio.currentTime = 0;
        audio.play();

        this.audio[url] = audio;
    }

    buildNote(result) {
        //get 1 sentence around the expression.
        const expression = selectedText();
        const sentence = getSentence(this.maxContext);
        this.sentence = sentence;
        let tmpl = {
            css: '',
            expression,
            reading: '',
            extrainfo: '',
            definitions: '',
            sentence,
            url: '',
            audios: [],
        };

        //if 'result' is array with notes.
        if (Array.isArray(result)) {
            for (const item of result) {
                for (const key in tmpl) {
                    item[key] = item[key] ? item[key] : tmpl[key];
                }
            }
            return result;
        } else { // if 'result' is simple string, then return standard template.
            tmpl['definitions'] = [].concat(result);
            return [tmpl];
        }

    }

    renderPopup(notes) {
        let content = '';
        for (const [nindex, note] of notes.entries()) {
            content += note.css + '<div class="odh-note">';
            let audiosegment = '';
            if (note.audios) {
                for (const [dindex, audio] of note.audios.entries()) {
                    if (audio)
                        audiosegment += `<img class="odh-playaudio" data-nindex="${nindex}" data-dindex="${dindex}" src="${chrome.runtime.getURL('fg/img/play.png')}"/>`;
                }
            }
            content += `
                <div class="odh-headsection">
                    <span class="odh-audios">${audiosegment}</span>
                    <span class="odh-expression">${note.expression}</span>
                    <span class="odh-reading">${note.reading}</span>
                    <span class="odh-extra">${note.extrainfo}</span>
                </div>`;
            for (const [dindex, definition] of note.definitions.entries()) {
                content += `
                    <div class="odh-definition">
                        <img class="odh-addnote" data-nindex="${nindex}" data-dindex="${dindex}" src="${chrome.runtime.getURL('fg/img/plus.png')}" />
                        ${definition}
                    </div>`;
            }
            content += '</div>';
        }
        content += `<div class="odh-sentence">${this.sentence}</div>`;
        return this.popupHeader() + content + this.popupFooter();
    }

    popupHeader() {
        return `
        <html lang="en">
            <head><meta charset="UTF-8"><title></title>
                <link rel="stylesheet" href="${chrome.runtime.getURL('fg/css/frame.css')}">
            </head>
            <body style="margin:0px;">
            <div class="odh-notes">`;
    }

    popupFooter() {
        return `
            </div>
            <div class="icons hidden"">
                <img id="plus" src="${chrome.runtime.getURL('fg/img/plus.png')}"/>
                <img id="load" src="${chrome.runtime.getURL('fg/img/load.gif')}"/>
                <img id="good" src="${chrome.runtime.getURL('fg/img/good.png')}"/>
                <img id="fail" src="${chrome.runtime.getURL('fg/img/fail.png')}"/>
            </div>
            <script src="${chrome.runtime.getURL('fg/js/frame.js')}"></script>
            </body>
        </html>`;
    }
}

window.odhfront = new ODHFront();