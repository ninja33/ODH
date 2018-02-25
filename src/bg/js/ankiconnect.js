class Ankiconnect {
    constructor() {}

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
                error: (xhr, status, err) => resolve(null),
            });
        });
    }

    async addNote(note) {
        if (note)
            return await this.ankiInvoke('addNote', { note });
        else
            return Promise.resolve(null);
    }

    async getDeckNames() {
        return await this.ankiInvoke('deckNames');
    }

    async getModelNames() {
        return await this.ankiInvoke('modelNames');
    }

    async getModelFieldNames(modelName) {
        return await this.ankiInvoke('modelFieldNames', { modelName });
    }

    async getVersion() {
        return await this.ankiInvoke('version');
    }
}