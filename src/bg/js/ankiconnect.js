class Ankiconnect {
    constructor(opts = {}) {
        this.options    = opts;
    }
    
    addNote(noteinfo) {
        let note = {
            fields: {},
            tags: ['chrome']
        };
    
        note.deckName  = this.options.deck;
        note.modelName = this.options.type;
        note.fields[this.options.word] = noteinfo.word;
        note.fields[this.options.defs] = noteinfo.defs;
        note.fields[this.options.sent] = noteinfo.sent;
    
        var ankiNote = {
            action: 'addNote',
            params: {
                note
            }
        };

        return new Promise((resolve, reject) => {
            try {
                let xhr = new XMLHttpRequest();
                xhr.overrideMimeType("application/json");
                xhr.addEventListener('loadend', () => {
                    resolve(xhr.responseText);
                });
                xhr.open('POST', 'http://127.0.0.1:8765');
                xhr.send(JSON.stringify(ankiNote));
            } catch (error) {
                reject(error);
            }
        });
    }
}
