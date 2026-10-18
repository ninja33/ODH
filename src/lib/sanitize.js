/* global DOMPurify */
const ODH_SANITIZE_CONFIG = {
    // WHY: the css field is a top-level <style> fragment, and the HTML parser puts
    // a top-level style element into <head> — outside the body DOMPurify returns —
    // so without this flag every dictionary stylesheet is dropped whole.
    FORCE_BODY: true,
    FORBID_ATTR: ['style', 'data-nindex', 'data-dindex', 'data-sound', 'data-odh-control'],
};

function odhSanitizeHtml(html) {
    if (typeof html !== 'string') {
        return '';
    }
    return DOMPurify.sanitize(html, ODH_SANITIZE_CONFIG);
}

function odhSanitizeAudioUrl(url) {
    return (typeof url === 'string' && /^https?:/i.test(url)) ? url : null;
}

function sanitizeNote(note) {
    if (!note || typeof note !== 'object') {
        return note;
    }

    note.css = odhSanitizeHtml(note.css);
    if (Array.isArray(note.definitions)) {
        note.definitions = note.definitions.map((definition) => odhSanitizeHtml(definition));
    } else if (typeof note.definitions === 'string' && note.definitions) {
        note.definitions = odhSanitizeHtml(note.definitions);
    }
    note.expression = odhSanitizeHtml(note.expression);
    note.reading = odhSanitizeHtml(note.reading);
    note.extrainfo = odhSanitizeHtml(note.extrainfo);
    if (Array.isArray(note.audios)) {
        note.audios = note.audios
            .map((url) => odhSanitizeAudioUrl(url))
            .filter((url) => url !== null);
    }

    return note;
}
