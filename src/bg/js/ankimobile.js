class Ankimobile {
    constructor() {
        this.options = {};
        this.noteinfo = {};
    }

    addNote(options, noteinfo) {
        for(let key in options) {
            options[key] = encodeURI(options[key]);
        }

        for(let key in noteinfo) {
            noteinfo[key] = encodeURI(noteinfo[key]);
        }
        let ankiNote = `anki://x-callback-url/addnote?profile=${encodeURI('User 1')}&deck=${options.deck}&type=${options.type}&fld${options.word}=${noteinfo.word}&fld${options.defs}=${noteinfo.defs}&fld${options.sent}=${noteinfo.sent}&tags=ankimobiledupes=1`;

        window.open(ankiNote, '_blank');
    }
}
