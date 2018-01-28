# Online Dictionary Helper (with anki support) 

It's a chrome extension to show online dictionary content. It also can help make note in anki desktop (with ankiconnect installed).

The  most important is that it supports your own script to grab online dictionary content.

# Background

Reading (a lot) is the most important aspect for serious language learners. Inspired by [readlang.com](http://readlang.com/) and [Foosoft/yomichan](https://github.com/FooSoft/yomichan), I built up a English-Chinese learning chrome extension - [Anki Dict Helper](https://github.com/ninja33/anki-dict-helper) in 2016. When users are reading web page online, they can move mouse cursor to the unkown word, press <kbd>shift</kbd> key, and then a pop up windows with that word definition will be displayed. It also can help make an anki note filling fields with **word**, **definition** and **context** (the surrounding sentence of selected word).

![Anki Notes](https://raw.githubusercontent.com/ninja33/anki-online-dict-helper/master/images/anki_640x400.png)

# The idea

That extension is running perfectly for English-Chinese language learners. Meanwhile, I also got a lots of requests, asking add other dictionaries and support for other languages, at least for latin alphabet based language which is similar as English as source language.

Well, same reason as Foosoft/yomichan mentioned in his project [FAQ](https://github.com/FooSoft/yomichan#frequently-asked-questions) page. First off, I have no knowledge of foreign languages other than English. Second, there is no way to get all those dictionaries, convert format and then build it in chrome extension.

But (there is always a 'but' in the end), we are at Internet age right now. There are hundreds of thousands dictionaries online for searching. So, you can just scrape the definition from online dictionary, leave word and sentence untouched, make it popup and make a note for anki as usual. Basically, below is the idea.

- anki dict helper: popup window [word, **builtin defintion**, sentence] --> anki 
- anki online dict helper: popup window [word, **online defintion**, sentence] --> anki 

The **online definition** part is driven by customized javascript which could be written by you or your friend, and hosted on Github.com

# How to use

[Chrome Web Store Link](https://chrome.google.com/webstore/detail/anki-online-dictionary-he/lppjdajkacanlmpbbcdkccjkdbpllajb?hl=en)

1. Install the extesion first from Chrome Web store. Setup Option and turn on the extension if you want. (detail in below option page section)
2. (Optional) Setup anki deck, type and fields names to put your **word**, **definition**, **sentence**.
3. Open some web pages which have English artical (by default option which has English dictionary only).
4. Move mouse cursor to the word, double click to select or press <kbd>shift</kbd> to automatically select word in case it's a link.
5. A popup window displayed to show the word definition.
6. (Optional) Press top/right green **(+)** icon to add anki note. 
7. (Optional) You need make sure anki desktop was open and ankiconnect addon was installed.

The extension shipped in with two dictionaries as sample,  You can play with these 2 dicntionaries and see if it's what you want.

1. English-Chinese dictionary: youdao.com (example for sentence captured as context)

![Youdao Dictionary](https://raw.githubusercontent.com/ninja33/anki-online-dict-helper/master/images/youdao_640x400.png)

2. English-English dictionary: collins.com (example for exact sample content from online dictionary)

![Collins Dictionary](https://raw.githubusercontent.com/ninja33/anki-online-dict-helper/master/images/collins_640x400.png)

As for dictionary collins.com, actually it is not built-in dictionary, it is here to show you how to load customized dictionary script.

# The Option Page

The extension option page is devided in three section.

1. General Option: Turn on or turn off the extension if you want.
2. Anki Options: Setup Anki deck/type name, and which fields you are going to put **word**, **definiton**, **sentence**. 
*(Currently, the exntension can only output these three most important information. Web page url and audio can be added late.)*
3. Dictionary Options:
    - Script Repository: Input your own script location here.
    - Selected Dictionary: Here will display all available dictionaries (buildin and customized), and please select what current dictionary you want to use.

![Options Page](https://raw.githubusercontent.com/ninja33/anki-online-dict-helper/master/images/options.png)

# Start your own script

If you want to display your own online dictionary content, you need build the script by yourself, and upload the scipt to Github.com and iput script location in `Repository`.

**Important:** You can not directly refer Github.com as srcipt location (becasue of [this](https://github.com/rgrove/rawgit/blob/master/FAQ.md) reason), you need change the domian name to rawgit.com

For example:
1. If you script was uploaded to https://**github**.com/your-name/repository/branch/filename.js
2. You need change above address to https://**rawgit**.com/your-name/repository/branch/filename.js


## Framework & Workflow

Bacially, the extension will accept your browser word selection as input, pass it to your own dictionary script for online query, then get returned content and show it in broswer popup window. (optional)When you click **(+)** button, it will add a note for you in anki with **word**, **definition**, **sentence** in those fields defined in option page.

The dictionary script contains three parts:

1. Build an online dictionary query url. In most cases, it's like http(s)://example.online.dictionary.com/search?word={your-word}
2. Perform online query by sending above url, and get the web page content.
3. To clear up the content and return. You may need use Elemenet/CSS selector (`getEelement(s)byXXX or querySelector(All)`) to get the definition part you want.

## Coding convention

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
    'https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/baicizhan.js',
    'https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/cnbing.js',
    'https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/cndict.js',
]);
```

You can find the dictionary script source code sample under [/dicts](https://github.com/ninja33/anki-online-dict-helper/tree/master/dicts) of this repository.

# Too Complicated?

Unfortunately, it's not RTG(Ready To Go) package for beginner. The extension already built up a framework to accept your broswer selection, display popup, create anki note, config the option page, but the dictionary part is up to you. Ask someone who know javascript programming if you really need help.

# Security issue

Because the extension will dynamically load your own customized script, so, you know what are you doing here.
1. You need explicitly input your script location in option page.
2. The only allowed script source domain is rawgit.com which means all code is public and can be tracked on Github.com

# Pull request & script repository

Welcome pull request if you want to enhancement this extension, or put your own script here as central repository.

- the exntension source will go to /src
- the online dictionary script will go to /dicts

# Dictionary script list

Below is existing dictionaries script list. You may right click to copy the link and paste it in option page **Repository** field to load the script.

|Dictionary Name|Descrition|Repository|Type|
|---|---|---|---|
|encn-Default|dict.youdao.com Online Dictionary|Builtin|Builtin|
|encn-List|encn Dictionary Bundle|[encn-List](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn-list.js)|List|
|encn-Baicizhan|baicizhan.com Online Dictionary|[encn-Baicizhan](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/baicizhan.js)|Dictionary|
|encn-Bing|cn.bing.com Online Dictionary|[encn-Bing](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/cnbing.js)|Dictionary|
|encn-CNDict|dict.cn Online Dictionary|[encn-CNDict](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/cndict.js)|Dictionary|
|enen-Collins|collins.com Online Dictinary|[enen-Collins](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/collins.js)|Dictionary|

