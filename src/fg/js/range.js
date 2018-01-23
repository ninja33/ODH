class TextSourceRange {
    constructor(range) {
        this.rng = range;
        this.forwardcount = 1;
        this.backwardcount = 2;
    }

    text() {
        return this.rng.toString();
    }

    setWordsOffset(forwardcount, backwardcount) {
        if (this.rng.startContainer.data) {
            this.setStartOffset(forwardcount);
            this.setEndOffset(backwardcount);
        }
        return null;
    }

    isAlpha(char) {
        return /[\u0030-\u024F]/.test(char);
    }

    getStartPos(range, backwardcount) {
        let clone = range.cloneRange();
        let pos = range.startOffset;
        let count = 0;
        let rangeText = '';

        while (pos >= 1) {
            clone.setStart(range.startContainer, pos--);
            rangeText = clone.toString();
            count += this.isAlpha(rangeText.charAt(0)) ? 0 : 1;
            if (count == backwardcount) {
                break;
            }
        }
        return pos;
    }

    getEndPos(range, forwardcount) {
        let clone = range.cloneRange();
        let pos = range.endOffset;
        let count = 0;
        let rangeText = '';

        while (pos < range.endContainer.data.length) {
            clone.setEnd(range.endContainer, pos++);
            rangeText = clone.toString();
            count += this.isAlpha(rangeText.charAt(rangeText.length - 1)) ? 0 : 1;
            if (count == forwardcount) {
                break
            }
        }
        return pos;
    }

    setStartOffset(wordcount) {
        let startPos = this.getStartPos(this.rng, wordcount);
        this.rng.setStart(this.rng.startContainer, startPos == 0 ? 0 : startPos + 1);
    }

    setEndOffset(wordcount) {
        let endPos = this.getEndPos(this.rng, wordcount);
        this.rng.setEnd(this.rng.endContainer, endPos == this.rng.endContainer.data.length ? endPos : endPos - 1);
    }

    selectText() {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.rng);
    }

    deselect() {
        const selection = window.getSelection();
        selection.removeAllRanges();
    }
}