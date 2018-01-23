class Ankiconnect {
    constructor(opts = {}) {
        this.options = opts;
    }

    createNote(noteinfo) {
        let opts = this.options;
        let note = {
            deckName: this.options.deck,
            modelName: this.options.type,
            fields: {
                [opts.word]: noteinfo.word,
                [opts.defs]: noteinfo.defs,
                [opts.sent]: noteinfo.sent,
            },
            tags: ['chrome']
        };

        //note.deckName = this.options.deck;
        //note.modelName = this.options.type;
        //note.fields[this.options.word] = noteinfo.word;
        //note.fields[this.options.defs] = noteinfo.defs;
        //note.fields[this.options.sent] = noteinfo.sent;

        var ankiNote = {
            action: 'addNote',
            params: {
                note
            }
        };

        return new Promise((resolve, reject) => {
            $.ajax({
                url: "http://127.0.0.1:8765",
                type: 'POST',
                data: JSON.stringify(ankiNote),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: (data)=>resolve(data),
                error: (xhr,status,err)=>reject(err),
            });
        });
    }
}