/* global odhSendMessage, odhLog, TO_WORKER */
class OptionsAPI{
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
