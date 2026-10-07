/* global odhRead */
class OptionsAPI{
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
        const reply = odhRead(result);
        if (reply.ok) return reply.value;
        // NOTE: the page-level contract stays "value or null", so a migrated caller does
        // not need try/catch; the classified reason is kept in the console.
        console.warn('Worker reported a failure:', request.action, reply.error.kind, reply.error.message);
        return null;
    }

    async getDeckNames(){
        return await this.sendtoServiceworker({action:'getDeckNames', params:{}});
    }
    
    async getModelNames(){
        return await this.sendtoServiceworker({action:'getModelNames', params:{}});
    }
    
    async getModelFieldNames(modelName){
        return await this.sendtoServiceworker({action:'getModelFieldNames',params:{modelName}});
    }
    
    async getVersion(){
        return await this.sendtoServiceworker({action:'getVersion',params:{}});
    }    

    async optionsChanged(options){
        return await this.sendtoServiceworker({action:'optionsChanged',params:{options}});
    }    
}
