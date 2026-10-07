/* global odhUnwrap, odhWithTimeout, odhLog, ODH_DEFAULT_REQUEST_TIMEOUT_MS */
class OptionsAPI{
    async sendtoServiceworker(request){
        request.target='serviceworker';
        let result;
        try {
            result = await odhWithTimeout(chrome.runtime.sendMessage(request), request.action, ODH_DEFAULT_REQUEST_TIMEOUT_MS);
        } catch (error) {
            // A channel that closes before the worker replies is a failure, not a value.
            console.warn('Worker request failed:', odhLog(request.action, error, error && error.kind));
            return null;
        }
        try {
            return odhUnwrap(result);
        } catch (error) {
            // NOTE: the page-level contract stays "value or null", so a caller still does not
            // need try/catch; the classified reason is kept in the console.
            console.warn('Worker reported a failure:', odhLog(request.action, error, error && error.kind));
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
