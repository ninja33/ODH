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

        ankinote.fields[options.expression] = note.expression;
        if (!options.sentence) {
            ankinote.fields[options.definition] = note.definition;
        } else if (options.sentence == options.definition) {
            note.definition += `<hr>${note.sentence}`;
            ankinote.fields[options.definition] = note.definition;
        } else {
            ankinote.fields[options.definition] = note.definition;
            ankinote.fields[options.sentence] = note.sentence;
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