class Ankiconnect {
    constructor() {
        this.options = null;
    }

    setOptions(options) {
        this.options = options;
    }

    createNote(note) {
        let options = this.options;
        let ankinote = {
            deckName: options.deckname,
            modelName: options.typename,
            fields: {},
            tags: ['anki-helper']
        };

        if (!options.expression || !options.definitions)
            return;

        ankinote.fields[options.expression] = note.word;
        if (!options.sentence) {
            ankinote.fields[options.definitions] = note.defs;
        } else if (options.sentence == options.definitions) {
            note.defs += `<hr>${note.sent}`;
            ankinote.fields[options.definitions] = note.defs;
        } else {
            ankinote.fields[options.definitions] = note.defs;
            ankinote.fields[options.sentence] = note.sent;
        }

        let request = {
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