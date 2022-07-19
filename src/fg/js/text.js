HtmlTagsToReplace = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};

function replaceHtmlTag(tag) {
    return HtmlTagsToReplace[tag] || tag;
}

function escapeHtmlTag(string) {
    return string.replace(/[&<>]/g, replaceHtmlTag);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

String.prototype.replaceAll = function(search, replacement) {
    let target = this;
    search = escapeRegExp(search);
    return target.replace(new RegExp(search, 'g'), replacement);
};

String.prototype.searchAll = function(search) {
    let target = this;
    search = escapeRegExp(search);
    let regex = new RegExp(search, 'gi');
    let result = 0;
    let indices = [];
    while ((result = regex.exec(target)) && result != '') {
        indices.push(result.index);
    }
    return indices;
};

function isPDFJSPage() {
    return (document.querySelectorAll('div#viewer.pdfViewer').length > 0);
}

function isEmpty(word) {
    return (!word);
}

function isShortandNum(word) {
    let numReg = /\d/;
    return (word.length < 3 || numReg.test(word));
}

function isChinese(word) {
    let cnReg = /[\u4e00-\u9fa5]+/gi;
    return (cnReg.test(word));
}

function isInvalid(word) {
    if (isChinese(word)) return false;
    return (isChinese(word) && isEmpty(word) || isShortandNum(word));
}

function cutSentence(word, offset, sentence, sentenceNum) {

    if (sentenceNum > 0) {
        let arr = sentence.match(/((?![.!?;:。！？]['"’”]?\s).|\n)*[.!?;:。！？]['"’”]?(\s|.*$)/g);
        if (arr && arr.length > 1) {
            arr = arr.reduceRight((accumulation, current) => {
                if (current.search(/\.\w{0,3}\.\s$/g) != -1) {
                    accumulation[0] = current + accumulation[0];
                } else {
                    accumulation.unshift(current);
                }
                return accumulation;
            }, ['']);
            arr = arr.filter(x => x.length);
        } else {
            arr = [sentence];
        }

        let index = arr.findIndex(ele => { //try to exactly match to word based on offset.
            if (ele.indexOf(word) !== -1 && ele.searchAll(word).indexOf(offset) != -1)
                return true;
            else
                offset -= ele.length;
        });

        if (index == -1) // fallback if can not exactly find word.
            index = arr.findIndex(ele => ele.indexOf(word) !== -1);

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

        return arr.slice(start, end + 1).join('').replaceAll(word, word.replace(/[^\s]+/g,'<b>\$&</b>'));
    } else {
        return sentence.replace(word, word.replace(/[^\s]+/g,'<b>\$&</b>'));
    }
}

function getSelectionOffset(node) {
    var range = window.getSelection().getRangeAt(0);
    var clone = range.cloneRange();
    clone.selectNodeContents(node);
    clone.setEnd(range.startContainer, range.startOffset);
    let start = clone.toString().length;
    clone.setEnd(range.endContainer, range.endOffset);
    let end = clone.toString().length;
    return { start, end };

}

function getPDFNode(node) {

    let backwardindex = 0;
    do {
        node = node.parentNode;
    } while (node.name && node.nodeName.toUpperCase() != 'SPAN' && node.nodeName.toUpperCase() != 'DIV');
    let currentspan = node;

    let sentenceNodes = [currentspan];
    let previous = null;
    while ((previous = node.previousSibling)) {
        sentenceNodes.unshift(previous);
        backwardindex += 1;
        if (previous.textContent.search(/[.!?;:。！？]['"’”]?(\s|.*$)/g) != -1)
            break;
        else
            node = previous;
    }

    node = currentspan;
    let next = null;
    while ((next = node.nextSibling)) {
        sentenceNodes.push(next);
        if (node.nextSibling.textContent.search(/[.!?;:。！？]['"’”]?(\s|.*$)/g) != -1)
            break;
        else
            node = next;
    }

    let sentence = '';
    let offset = 0;
    sentenceNodes = sentenceNodes.filter(x => x.textContent != '' || x.textContent != '-');
    for (const node of sentenceNodes) {
        if (backwardindex == 0)
            offset = sentence.length + window.getSelection().getRangeAt(0).startOffset;
        backwardindex -= 1;
        let nodetext = node.textContent;
        if (nodetext == '-')
            sentence = sentence.slice(0, sentence.length-1);
        else
            sentence += (nodetext[nodetext.length - 1] == '-') ? nodetext.slice(0, nodetext.length - 1) : nodetext + ' ';
    }

    return { sentence, offset };
}

function getSentence(sentenceNum) {
    let sentence = '';
    let offset = 0;
    const upNum = 4;

    const selection = window.getSelection();
    let word = (selection.toString() || '').trim();

    if (selection.rangeCount < 1)
        return;

    let node = selection.getRangeAt(0).commonAncestorContainer;

    if (['INPUT', 'TEXTAREA'].indexOf(node.tagName) !== -1) {
        return;
    }

    if (isPDFJSPage()) {
        let pdfcontext = getPDFNode(node);
        sentence = escapeHtmlTag(pdfcontext.sentence);
        offset = pdfcontext.offset;
    } else {
        node = getWebNode(node, upNum);

        if (node !== document) {
            sentence = escapeHtmlTag(node.textContent);
            offset = getSelectionOffset(node).start;
        }
    }

    return cutSentence(word, offset, sentence, sentenceNum);
}

function getWebNode(node, deep) {
    const blockTags = ['LI', 'P', 'DIV', 'BODY'];
    const nodeName = node.nodeName.toUpperCase();
    if (blockTags.includes(nodeName) || deep === 0) {
        return node;
    } else {
        return getWebNode(node.parentElement, deep - 1);
    }
}

function selectedText() {
    const selection = window.getSelection();
    return (selection.toString() || '').trim();
}

function isValidElement() {
    // if (document.activeElement.getAttribute('contenteditable')) 
    //     return false;

    const invalidTags = ['INPUT', 'TEXTAREA'];
    const nodeName = document.activeElement.nodeName.toUpperCase();
    if (invalidTags.includes(nodeName)) {
        return false;
    } else {
        return true;
    }
}
