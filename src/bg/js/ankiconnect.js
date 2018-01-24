class Ankiconnect {
    constructor(opts = {}) {
        this.options = opts;
    }

    createNote(note) {
        let opts = this.options;
        let ankinote = {
            deckName: opts.deckname,
            modelName: opts.typename,
            fields: {
                [opts.expression]: note.word,
                [opts.definitions]: note.defs,
                [opts.sentence]: note.sent,
            },
            tags: ['anki-helper']
        };

        var request = {
            action: 'addNote',
            params: {
                note: ankinote,
            }
        };

        return new Promise((resolve, reject) => {
            $.ajax({
                url: "http://127.0.0.1:8765",
                type: 'POST',
                data: JSON.stringify(request),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: (data) => resolve(data),
                error: (xhr, status, err) => reject(err),
            });
        });
    }
}