class OptionsAPI{
    async sendtoServiceworker(request){
        request.target='serviceworker';
        try {
            return await chrome.runtime.sendMessage(request);
        } catch (_e) {
            return null
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
