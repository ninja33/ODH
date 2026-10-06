class FrontendAPI{
    async sendtoServiceworker(request){
        request.target='serviceworker';
        try {
            return await chrome.runtime.sendMessage(request);
        } catch (_e) {
            return null
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