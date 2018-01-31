# Development Guide

## Start your own script

If you want to display your own online dictionary content, you need build the script by yourself, and upload the scipt to Github.com and iput script location in **Repository** field of option page.

**Important:** You can not directly refer Github.com as srcipt location (becasue of [this](https://github.com/rgrove/rawgit/blob/master/FAQ.md) reason), you need change the domian name to rawgit.com

For example:

1. If you script was uploaded to `https://**github**.com/your-name/repository/branch/filename.js`
2. You need change above address to `https://**rawgit**.com/your-name/repository/branch/filename.js`

### Framework & Workflow

Bacially, the extension will accept your browser word selection as input, pass it to your own dictionary script for online query, then get returned content and show it in broswer popup window. (optional)When you click **(+)** button, it will add a note for you in anki with **word**, **definition**, **sentence** in those fields defined in option page.

The dictionary script contains three parts:

1. Build an online dictionary query url. In most cases, it's like `http(s)://example.online.dictionary.com/search?word={your-word}`
2. Perform online query by sending above url, and get the web page content.
3. To clear up the content and return. You may need use Elemenet/CSS selector (`getEelement(s)byXXX or querySelector(All)`) to get the definition part you want.

### Coding convention

1. First of all, you need wrap all of your online dictionary scraping code in a Class. To avoid duplicated declaration, you need detect if this Class was declared or not, and then register this Class with a display name (will be displayed in extension option page) at the end of code.

    **Important:** To distinguish different language by displayname, you'd better use 2 digit country code for both source and target language as prefix, like **encn-DictionryName** for dictionary taking English as source and Chinese as target.

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

3. Finally, if you have multiple scripts and want to load at same time, you can create a dictionary script list file as below, and input this list location in Option page.

```javascript
registerList([
    'https://rawgit.com/ninja33/ODH/master/dicts/encn_Baicizhan.js',
    'https://rawgit.com/ninja33/ODH/master/dicts/encn_Bing.js',
    'https://rawgit.com/ninja33/ODH/master/dicts/encn_CNDict.js',
]);
```

You can find the dictionary script source code sample under [/dicts](https://github.com/ninja33/ODH/master/dicts) of this repository.

## Security issue

Because the extension will dynamically load your own customized script, so, you know what are you doing here.

1. You need explicitly input your script location in option page.
2. The only allowed script source domain is **rawgit.com** which means all code is public and can be tracked on Github.com