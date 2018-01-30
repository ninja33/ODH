# Online Dictionary Helper (with Anki app support)

Online Dictionary Helper is a chrome extension to show online dictionary content, which also supports flash-card making compatible with Anki  (with ankiconnect an Anki add-on installed).

What might set this extension apart is that the user can grab online dictionary content with his or her own script.

## Background

Reading is among the most important tasks for any dedicated language learner.  I have written an English-Chinese learning/card-marking chrome extension - [Anki Dict Helper](https://github.com/ninja33/anki-dict-helper) in 2016, which was inspired by [readlang.com](http://readlang.com/) and [Foosoft/yomichan](https://github.com/FooSoft/yomichan).
Here is how that extension works. Reading through a web page via Google Chrome or Firefox, the user can move the mouse cursor to any given word, press <kbd>shift</kbd> key. A pop-up window would subsquently show up with the word's En-Chinese dictionary definitions on display. It supports the making of an Anki flashcard note filling fields with **word**, **definition** and **context** (the sentence in its original web page context with the selected word included). In a word, it's a personalized  web vocabulary builder which also serves as a En-Ch dictionary.

![Anki Notes](https://raw.githubusercontent.com/ninja33/anki-online-dict-helper/master/images/anki_640x400.png)

## The idea

That extension is running perfectly for English-Mandarin language learners. However, as the user base grows, I've got lots of requests, asking whether it's possible to add other dictionaries/support for more languages, at least for latin-alphabet-based language similar to English which could serve as the source language.

Well, here goes the same reason as Foosoft/yomichan mentioned in his project [FAQ](https://github.com/FooSoft/yomichan#frequently-asked-questions) page.
First off, I, a pure mortal/coder, have no knowledge of any foreign languages other than English. Second, it's almost mission impossible for just one man to get all those dictionary files, converting them to usable formats and then incorporating them in the chrome extension.

Fortunately, we are at this great Internet age with increasing amounts of online resources. There are hundreds of thousands dictionaries online for searching. Therefore, any given user can just scrape the definition from online dictionary, leave word and sentence untouched, make it popup and make a note for Anki as usual.
Basically, here is the idea.

- Anki dict helper: popup window [word, **built-in definition**, sentence] --> Anki
- Anki online dict helper: popup window [word, **online definition**, sentence] --> Anki

The **online definition** part is run by customized javascript which could be written by you or your friend and hosted on Github.com.

## How to use

[[Chrome Web Store Link](https://chrome.google.com/webstore/detail/anki-online-dictionary-he/lppjdajkacanlmpbbcdkccjkdbpllajb?hl=en)]

1. Install the extension first from Chrome Web store. Setup Option and turn on the extension if you want. (Details could be found under the option page section)
2. (Optional) Setup the designated Anki deck, type and fields names to put your **word**, **definition**, **sentence**.
3. Open any given web page such as an English article (The extension has English dictionary only by its default setting).
4. Move mouse cursor to the word, double click to select or press <kbd>shift</kbd> to automatically select word in case it's a link.
5. A popup window will show up displaying the word definition.
6. (Optional) Press top/right green **(+)** icon to add Anki note.
7. (Optional) You need make sure that the Anki desktop version is opened and ankiconnect addon installed beforehand.

The extension has in it two dictionary samples for you to try out and experiment with.

1. English-Chinese dictionary: youdao.com (example for sentence captured as context)

![Youdao Dictionary](https://raw.githubusercontent.com/ninja33/anki-online-dict-helper/master/images/youdao_640x400.png)

2. English-English dictionary: collins.com (example for exact sample content from online dictionary)

![Collins Dictionary](https://raw.githubusercontent.com/ninja33/anki-online-dict-helper/master/images/collins_640x400.png)

As for dictionary collins.com, actually it is not built-in dictionary, it is here to show you how to load customized dictionary script.

## The Option Page

The extension option page is divided in three sections.

1. General Option: Turn on or turn off the extension if you want.
2. Anki Options: Setup Anki deck/type name, and which fields you are going to put **word**, **definiton**, **sentence**.

    *(Currently, the exntension can only output these three most important information. Web page url and audio can be added late.)*

3. Dictionary Options:

    - Script Repository: Input your own script location here.
    - Selected Dictionary: Here will display all available dictionaries (buildin and customized), and please select what current dictionary you want to use.

![Options Page](https://raw.githubusercontent.com/ninja33/anki-online-dict-helper/master/images/options.png)

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
    'https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn_Baicizhan.js',
    'https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn_Bing.js',
    'https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn_CNDict.js',
]);
```

You can find the dictionary script source code sample under [/dicts](https://github.com/ninja33/anki-online-dict-helper/tree/master/dicts) of this repository.

## Dont know programming ?

You can select exsiting dictionary script contributed by others (at the end of this README), or ask someone else who know javascript programming or raise an issue here if you really need help.

## Security issue

Because the extension will dynamically load your own customized script, so, you know what are you doing here.

1. You need explicitly input your script location in option page.
2. The only allowed script source domain is **rawgit.com** which means all code is public and can be tracked on Github.com

## Pull request & script repository

Welcome pull request if you want to enhance this extension, or put your own script here as central repository.

- the exntension source will go to [/src](https://github.com/ninja33/anki-online-dict-helper/tree/master/src)
- the online dictionary script will go to [/dicts](https://github.com/ninja33/anki-online-dict-helper/tree/master/dicts)

## Dictionary script list

Below is existing dictionaries script list. You may right click to copy the link and paste it in option page **Repository** field to load the script.

### Source Language: English

|Source|Target|Descrition|Repository|Type|Contributor|
|---|---|---|---|---|---|
|EN|CN|dict.youdao.com|Builtin|Builtin|ninja33|
|EN|CN|Dictionaries Bundle|[encn_List](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn_List.js)|List|ninja33|
|EN|CN|baicizhan.com|[encn_Baicizhan](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn_Baicizhan.js)|Dictionary|ninja33|
|EN|CN|cn.bing.com|[encn_Bing](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn_Bing.js)|Dictionary|ninja33|
|EN|CN|dict.cn|[encn_CNDict](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn_CNDict.js)|Dictionary|ninja33|
|EN|CN|dictionary.cambridge.org|[encn_Cambridge](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/encn_Cambridge.js)|Dictionary|ninja33|
|EN|EN|collinsdictionary.com|[enen_Collins](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/enen_Collins.js)|Dictionary|ninja33|
|EN|FR|collinsdictionary.com|[enfr_Collins](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/enfr_Collins.js)|Dictionary|ninja33|
|EN|FR|dictionary.cambridge.org|[enfr_Cambridge](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/enfr_Cambridge.js)|Dictionary|ninja33|

dictionary.cambridge.org

### Source Language: French

|Source|Target|Descrition|Repository|Type|Contributor|
|---|---|---|---|---|---|
|FR|CN|dict.youdao.com|[frcn_Youdao](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/frcn_Youdao.js)|Dictionary|ninja33|
|FR|EN|collinsdictionary.com|[frcn_Collins](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/fren_Collins.js)|Dictionary|ninja33|
|FR|EN|dictionary.cambridge.org|[fren_Cambridge](https://rawgit.com/ninja33/anki-online-dict-helper/master/dicts/fren_Cambridge.js)|Dictionary|ninja33|

More ...
