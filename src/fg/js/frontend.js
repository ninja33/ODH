/* global Popup, rangeFromPoint, TextSourceRange, selectedText, isEmpty, getSentence, isConnected, addNote, getTranslation, playAudio, isValidElement*/
class ODHFront {

    constructor() {
        this.options = null;
        this.point = null;
        this.notes = null;
        this.sentence = null;
        this.audio = {};
        this.enabled = true;
        this.mouseselection = true;
        this.activateKey = 16; // shift 16, ctl 17, alt 18
        this.exitKey = 27; // esc 27
        this.maxContext = 1; //max context sentence #
        this.services = 'none';
        this.popup = new Popup();
        this.timeout = null;
        this.mousemoved = false;

        window.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('mousedown', e => this.onMouseDown(e));
        window.addEventListener('dblclick', e => this.onDoubleClick(e));
        window.addEventListener('keydown', e => this.onKeyDown(e));

        chrome.runtime.onMessage.addListener(this.onBgMessage.bind(this));
        window.addEventListener('message', e => this.onFrameMessage(e));
        document.addEventListener('selectionchange', e => this.userSelectionChanged(e));
        //window.addEventListener('selectionend', e => this.onSelectionEnd(e));
    }

    onKeyDown(e) {
        if (!this.activateKey)
            return;

        if (!isValidElement())
            return;

        if (this.enabled && this.point !== null && (e.keyCode === this.activateKey || e.charCode === this.activateKey)) {
            const range = rangeFromPoint(this.point);
            if (range == null) return;
            let textSource = new TextSourceRange(range);
            textSource.selectText();
            this.mousemoved = false;
            this.onSelectionEnd(e);
        }

        if (e.keyCode === this.exitKey || e.charCode === this.exitKey)
            this.popup.hide();
    }

    onDoubleClick(e) {
        if (!this.mouseselection)
            return;

        if (!isValidElement())
            return;

        if (this.timeout)
            clearTimeout(this.timeout);
        this.mousemoved = false;
        this.onSelectionEnd(e);
    }

    onMouseDown(e) {
        this.popup.hide();
    }

    onMouseMove(e) {
        this.mousemoved = true;
        this.point = {
            x: e.clientX,
            y: e.clientY,
        };
    }

    userSelectionChanged(e) {

        if (!this.enabled || !this.mousemoved || !this.mouseselection) return;

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        // wait 500 ms after the last selection change event
        this.timeout = setTimeout(() => {
            this.onSelectionEnd(e);
            //var selEndEvent = new CustomEvent('selectionend');
            //window.dispatchEvent(selEndEvent);
        }, 500);
    }

    async onSelectionEnd(e) {

        if (!this.enabled)
            return;

        if (!isValidElement())
            return;

        // reset selection timeout
        this.timeout = null;
        const expression = selectedText();
        if (isEmpty(expression)) return;

        let result = await getTranslation(expression);
        if (result == null || result.length == 0) return;
        this.notes = this.buildNote(result);
        this.popup.showNextTo({ x: this.point.x, y: this.point.y, }, await this.renderPopup(this.notes));

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

    api_setFrontendOptions(params) {
        let { options, callback } = params;
        this.options = options;
        this.enabled = options.enabled;
        this.mouseselection = options.mouseselection;
        this.activateKey = Number(this.options.hotkey);
        this.maxContext = Number(this.options.maxcontext);
        this.services = options.services;
        callback();
    }

    onFrameMessage(e) {
        const { action, params } = e.data;
        const method = this['api_' + action];
        if (typeof(method) === 'function') {
            method.call(this, params);
        }
    }

    async api_addNote(params) {
        let { nindex, dindex, context } = params;

        let notedef = Object.assign({}, this.notes[nindex]);
        notedef.definition = this.notes[nindex].css + this.notes[nindex].definitions[dindex];
        notedef.definitions = this.notes[nindex].css + this.notes[nindex].definitions.join('<hr>');
        notedef.sentence = context;
        notedef.url = window.location.href;
        let response = await addNote(notedef);
        this.popup.sendMessage('setActionState', { response, params });
    }

    async api_playAudio(params) {
        let { nindex, dindex } = params;
        let url = this.notes[nindex].audios[dindex];
        let response = await playAudio(url);
    }

    api_playSound(params) {
        let url = params.sound;

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

    async renderPopup(notes) {
        let content = '';
        let services = this.options ? this.options.services : '';
        let image = '';
        let imageclass = '';
        if (services != 'none') {
            image = (services == 'ankiconnect') ? 'plus.png' : 'cloud.png';
            imageclass = await isConnected() ? 'class="odh-addnote"' : 'class="odh-addnote-disabled"';
        }

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
                let button = (services == 'none' || services == '') ? '' : `<img ${imageclass} data-nindex="${nindex}" data-dindex="${dindex}" src="${chrome.runtime.getURL('fg/img/'+ image)}" />`;
                content += `<div class="odh-definition">${button}${definition}</div>`;
            }
            content += '</div>';
        }
        //content += `<textarea id="odh-context" class="odh-sentence">${this.sentence}</textarea>`;
        content += '<div id="odh-container" class="odh-sentence"></div>';
        return this.popupHeader() + content + this.popupFooter();
    }

    popupHeader() {
        let root = chrome.runtime.getURL('/');
        return `
        <html lang="en">
            <head><meta charset="UTF-8"><title></title>
                <link rel="stylesheet" href="${root+'fg/css/frame.css'}">
                <link rel="stylesheet" href="${root+'fg/css/spell.css'}">
            </head>
            <body style="margin:0px;">
            <div class="odh-notes">`;
    }

    popupFooter() {
        let root = chrome.runtime.getURL('/');
        let services = this.options ? this.options.services : '';
        let image = (services == 'ankiconnect') ? 'plus.png' : 'cloud.png';
        let button = chrome.runtime.getURL('fg/img/' + image);
        let monolingual = this.options ? (this.options.monolingual == '1' ? 1 : 0) : 0;

        return `
            </div>
            <div class="icons hidden"">
                <img id="plus" src="${button}"/>
                <img id="load" src="${root+'fg/img/load.gif'}"/>
                <img id="good" src="${root+'fg/img/good.png'}"/>
                <img id="fail" src="${root+'fg/img/fail.png'}"/>
                <img id="play" src="${root+'fg/img/play.png'}"/>
                <div id="context">${this.sentence}</div>
                <div id="monolingual">${monolingual}</div>
                </div>
            <script src="${root+'fg/js/spell.js'}"></script>
            <script src="${root+'fg/js/frame.js'}"></script>
            </body>
        </html>`;
    }
}

window.odhfront = new ODHFront();