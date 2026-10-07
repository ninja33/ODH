/* global odhUnwrap */
class FrontendAPI{
    async sendtoServiceworker(request){
        request.target='serviceworker';
        let result;
        try {
            result = await chrome.runtime.sendMessage(request);
        } catch (error) {
            // A channel that closes before the worker replies is a failure, not a value.
            console.warn('Worker request failed:', request.action, error && error.message);
            return null;
        }
        try {
            return odhUnwrap(result);
        } catch (error) {
            // NOTE: the page-level contract stays "value or null", so a caller still does not
            // need try/catch; the classified reason is kept in the console.
            console.warn('Worker reported a failure:', request.action, error && error.kind, error && error.message);
            return null;
        }
    }

    async isConnected(){
        return await this.sendtoServiceworker({action:'getVersion', params:{}});
    }

    async getTranslation(expression){
        return await this.sendtoServiceworker({action:'getTranslation', params:{expression}});
    }

    async addNote(notedef){
        return await this.sendtoServiceworker({action:'addNote',params:{notedef}});
    }

    async playAudio(url){
        return await this.sendtoServiceworker({action:'playAudio',params:{url}});
    }
}