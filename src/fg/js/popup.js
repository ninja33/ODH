/* global rangeFromPoint */

class Popup {
    constructor() {
        this.popup = null;
        this.offset = 5;
    }

    showAt(pos, content) {
        this.inject();

        this.popup.style.left = pos.x + 'px';
        this.popup.style.top = pos.y + 'px';
        this.popup.style.visibility = 'visible';

        this.setContent(content);
    }

    showNextTo(point, content) {

        this.inject();
        const elementRect = this.getRangeRect(point);
        const popupRect = this.popup.getBoundingClientRect();

        var posX = elementRect.left;
        if (posX + popupRect.width >= window.innerWidth) {
            posX = window.innerWidth - popupRect.width;
        }

        var posY = elementRect.bottom + this.offset;
        if (posY + popupRect.height >= window.innerHeight) {
            posY = elementRect.top - popupRect.height - this.offset;
        }

        posX = (posX < 0) ? 0 : posX;
        posY = (posY < 0) ? 0 : posY;

        this.showAt({ x: posX, y: posY }, content);
    }

    hide() {
        if (this.popup !== null) {
            this.popup.style.visibility = 'hidden';
        }
    }

    setContent(content) {
        if (this.popup === null) {
            return;
        }

        this.popup.contentWindow.scrollTo(0, 0);

        const doc = this.popup;
        doc.srcdoc = content;
    }

    getRangeRect(point) {
        return rangeFromPoint(point).getBoundingClientRect();
    }

    sendMessage(action, params, callback) {
        if (this.popup !== null) {
            this.popup.contentWindow.postMessage({ action, params }, '*');
        }
    }

    inject() {
        if (this.popup !== null) {
            return;
        }

        this.popup = document.createElement('iframe');
        this.popup.id = 'odh-popup';
        this.popup.addEventListener('mousedown', (e) => e.stopPropagation());
        this.popup.addEventListener('scroll', (e) => e.stopPropagation());

        let simpread = document.querySelector('.simpread-read-root');
        let root = simpread ? simpread : document.body;
        root.appendChild(this.popup);
    }
}