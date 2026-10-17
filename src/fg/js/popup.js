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

        // WHY: the sandboxed popup frame has an opaque origin, so calling methods on
        // its contentWindow is blocked. The scroll reset is best-effort and must never
        // prevent the srcdoc assignment below.
        try {
            this.popup.contentWindow.scrollTo(0, 0);
        } catch {
            // Cross-origin window: scroll reset unavailable, rendering continues.
        }

        const doc = this.popup;
        doc.srcdoc = content;
    }

    getRangeRect(point) {
        return rangeFromPoint(point).getBoundingClientRect();
    }

    sendMessage(action, params) {
        if (this.popup !== null) {
            this.popup.contentWindow.postMessage({ action, params }, '*');
        }
    }

    inject() {
        // WHY: a hostile page can remove or replace our iframe element. With only a
        // null check the stale reference survives, and every later lookup renders
        // into a detached element — the popup silently disappears until reload.
        // Re-inject when the element is no longer in the document.
        if (this.popup !== null && this.popup.isConnected) {
            return;
        }

        this.popup = document.createElement('iframe');
        this.popup.id = 'odh-popup';
        // WHY: sandbox without allow-same-origin gives the frame an opaque origin, so the
        // host page cannot read or tamper with the popup document (M06 route B).
        // allow-modals keeps spell.js's prompt() usable. Flags are read when the srcdoc
        // document loads, so the attribute must be set before setContent assigns srcdoc.
        this.popup.setAttribute('sandbox', 'allow-scripts allow-modals');
        this.popup.addEventListener('mousedown', (e) => e.stopPropagation());
        this.popup.addEventListener('scroll', (e) => e.stopPropagation());

        let simpread = document.querySelector('.simpread-read-root');
        let root = simpread ? simpread : document.body;
        root.appendChild(this.popup);
    }
}