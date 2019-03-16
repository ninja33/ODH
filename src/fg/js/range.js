function rangeFromPoint(point) {
    if (!document.caretRangeFromPoint) {
        document.caretRangeFromPoint = (x, y) => {
            const position = document.caretPositionFromPoint(x,y);
            if (position && position.offsetNode && position.offsetNode.nodeType === Node.TEXT_NODE) {
                const range = document.createRange();
                range.setStart(position.offsetNode, position.offset);
                range.setEnd(position.offsetNode, position.offset);
                return range;
            }
            return null;
        };
    }

    return document.caretRangeFromPoint(point.x, point.y);
}

class TextSourceRange {
    constructor(range) {
        this.rng = range;
    }

    text() {
        return this.rng.toString();
    }

    setWordRange() {
        let backwardcount = 1;
        let forwardcount = 1;
        if (this.rng.startContainer.data) {
            this.setStartOffset(backwardcount);
            this.setEndOffset(forwardcount);
        }
        return null;
    }

    isAlpha(char) {
        return /[\u002D|\u0041-\u005A|\u0061-\u007A|\u00A0-\u024F]/.test(char);
    }

    getStartPos(backwardcount) {
        let clone = this.rng.cloneRange();
        let pos = this.rng.startOffset;
        let count = 0;
        let rangeText = '';

        while (pos >= 1) {
            clone.setStart(this.rng.startContainer, --pos);
            rangeText = clone.toString();
            count += this.isAlpha(rangeText.charAt(0)) ? 0 : 1;
            if (count == backwardcount) {
                break;
            }
        }
        return pos;
    }

    getEndPos(forwardcount) {
        let clone = this.rng.cloneRange();
        let pos = this.rng.endOffset;
        let count = 0;
        let rangeText = '';

        while (pos < this.rng.endContainer.data.length) {
            clone.setEnd(this.rng.endContainer, ++pos);
            rangeText = clone.toString();
            count += this.isAlpha(rangeText.charAt(rangeText.length - 1)) ? 0 : 1;
            if (count == forwardcount) {
                break;
            }
        }
        return pos;
    }

    setStartOffset(backwardcount) {
        let startPos = this.getStartPos(backwardcount);
        if (startPos != 0)
            startPos++;
        this.rng.setStart(this.rng.startContainer, startPos);

    }

    setEndOffset(forwardcount) {
        let endPos = this.getEndPos(forwardcount);
        if (endPos != this.rng.endContainer.data.length)
            endPos--;
        this.rng.setEnd(this.rng.endContainer, endPos);
    }

    selectText() {
        this.setWordRange();
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.rng);
    }

    deselect() {
        const selection = window.getSelection();
        selection.removeAllRanges();
    }
}