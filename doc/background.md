# Background

Reading is among the most important tasks for any dedicated language learner. I have written an English-Chinese learning/card-marking chrome extension - [Anki Dict Helper](https://github.com/ninja33/anki-dict-helper) in 2016, which was inspired by [readlang.com](https://readlang.com/) and [Foosoft/yomichan](https://github.com/FooSoft/yomichan).
Here is how that extension works. Reading through a web page via Google Chrome or Firefox, the user can move the mouse cursor to any given word, press <kbd>shift</kbd> key. A pop-up window would subsequently show up with the word's En-Chinese dictionary definitions on display. It supports the making of an Anki flashcard note filling fields with **word**, **definition** and **context** (the sentence in its original web page context with the selected word included). In a word, it's a personalized  web vocabulary builder which also serves as a En-Ch dictionary.

## The idea

That first extension works perfectly for English-Mandarin language learners. However, as the userbase grows, I've got lots of requests, asking whether it's possible to add other dictionaries/support for more languages, at least for Latin-alphabet-based language similar to English which could serve as the source language.

Well, here goes the same reason as Foosoft/yomichan mentioned in his project [FAQ](https://github.com/FooSoft/yomichan#frequently-asked-questions) page.
First off, I, a pure mortal/coder, have no knowledge of any foreign languages other than English. Second, it's almost mission impossible for just one man to get all those dictionary files, converting them to usable formats and then incorporating them in the chrome extension.

Fortunately, we are at this great Internet age with increasing amounts of online resources. There are hundreds and thousands of dictionaries online for searching. Therefore, any given user can just scrape the definition from online dictionary, leave word and sentence untouched, make it popup and make a note for Anki as usual.
Basically, here is the idea.

- Anki Dict Helper: popup window [word, **built-in definition**, sentence] --> Anki
- Anki Online Dict Helper: popup window [word, **online definition**, sentence] --> Anki

The **online definition** part is run by customized javascript which could be written by you or your friend and hosted on Github.com. That will hugely extend the ability of this extension to meet your specified requirement.

If you are a Javascript programmer and are interested in enhancing this tool, please check [development guide](development.md).
