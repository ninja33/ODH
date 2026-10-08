/* global odhSendMessage, odhLog, TO_WORKER */
class FrontendAPI{
    // The page-level contract stays "value or null", so UI callers still need no try/catch;
    // the classified reason is kept in the console.
    async sendtoServiceworker(request){
        try {
            return await odhSendMessage(TO_WORKER, request);
        } catch (error) {
            console.warn('Worker request failed:', odhLog(request.action, error, error && error.kind));
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