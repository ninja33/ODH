# Development Guide

[[简体中文版](development.zh_CN.md)]

## Start your own script

If you want to display your own online dictionary content, you need build the script by yourself.
Because of security issue, the script can only be loaded within Chrome extension naming space. So, currently you can only run your own script in development mode. Or you can send PR to me, and I will include it in next release.

### Framework & Workflow

Bacially, the extension will accept your browser word selection as input, pass it to your own dictionary script for online query, then get returned content and show it in broswer popup window.

The dictionary script contains three parts:

1. Build an online dictionary query url. In most cases, it's like `http(s)://example.online.dictionary.com/search?word={your-word}`
2. Perform online query by sending above url, and get the web page content.
3. To clear up the content and return. You may need use Elemenet/CSS selector (`getEelement(s)byXXX or querySelector(All)`) to get the definition part you want.

### Coding convention

1. First of all, you need wrap all of your online dictionary scraping code in a Class. To avoid duplicated declaration, you need detect if this Class was declared or not, and then register this Class with a display name (will be displayed in extension option page) at the end of code.

    **Important:** To distinguish different language by displayname, you'd better use 2 digit country code for both source and target language as prefix, like **encn_DictionryName** for dictionary taking English as source and Chinese as target.

2. Second, in your dictionary Class, you need define at least one function named `findTerm()` , which accept **word** as function parameter, return a Promise object. That's all.

Below is script template to start your own coding.

```javascript
if (typeof YouClassName == 'undefined') {
    Class YouClassName{
        constructor() {
            // Your code starting here ...
        }

        findTerm(word) {
            return new Promise((resolve, reject){
            // Your code starting here ...
            // resolve(content);
            // reject(error);
            });
        }
    }
    registerDict('Your Dicionary Display Name', YouClassName);
}
```

You can find the dictionary script source code sample under [/src/bg/local](https://github.com/ninja33/ODH/tree/master/src/bg/local) of this repository.
