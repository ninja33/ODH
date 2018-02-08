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

        if (!options.expression || !options.definition)
            return Promise.reject(null);

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

    async ankiInvoke(action, params = {}) {
        let request = {
            action,
            params
        };
        return new Promise((resolve, reject) => {
            $.ajax({
                url: "http://127.0.0.1:8765",
                type: 'POST',
                data: JSON.stringify(request),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: (data) => resolve(data),
                error: (xhr, status, err) => reject(null),
            });
        });
    }

    async addNote(note) {
        if (note)
            return await this.ankiInvoke('addNote', {note});
        else
            return Promise.reject(null);
    }

    async getDeckNames() {
        return await this.ankiInvoke('deckNames');
    }

    async getModelNames() {
        return await this.ankiInvoke('modelNames');
    }

    async getModelFieldNames(modelName) {
        return await this.ankiInvoke('modelFieldNames', {modelName});
    }

    async getVersion() {
        try {
            return await this.ankiInvoke('version');
        } catch (err){
            return null;
        }

    }
}