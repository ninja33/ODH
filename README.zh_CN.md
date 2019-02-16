# 在线词典助手 (含Anki制卡功能)

在线词典助手是一个Chrome插件。用于浏览网页时查询在线词典，并将查询内容显示在单词旁的小弹窗里。该工具同时支持Anki制卡功能(需在Anki上安装**ankiconnect**插件).

有关制作该工具的缘由细节，详情可见[背景](doc/background.zh_CN.md)介绍。

![Anki Notes](https://raw.githubusercontent.com/ninja33/ODH/master/doc/img/anki_001_640x400.png)

本词典助手支持加载脚本，以扩展插件功能抓取更多的网页词典(插件以开发者模式运行)。有关开发细节，详情可见 [开发指南](doc/development.zh_CN.md)

## 使用说明

- [Chrome插件下载链接](https://chrome.google.com/webstore/detail/anki-online-dictionary-he/lppjdajkacanlmpbbcdkccjkdbpllajb?hl=en)

- [Firefox扩展下载链接](https://addons.mozilla.org/en-US/firefox/addon/online-dictionary-helper/)

1. 从Chrome商店或者Firefox扩展页下载安装插件后，从选项页激活插件。
2. 打开任意想要取词翻译的网页，将鼠标放在单词上，拖动选择或者双击选择该单词。
3. 如果单词本身是一个链接不宜点击，可按**取词热键**(在选项中设定)自动选取单词。
4. 根据选项中所选词典，一个含释义的弹窗将会显示在上述选中单词的旁边。
5. (可选操作) 在Ankiconnect已经安装，并且Anki已经打开的情况下，可在选项页设定Anki牌组名称、模板名称，以及用于放置 **单词字段**、**音标字段**、**额外字段**、**释义字段**、**原句字段**的字段名称。
6. (可选操作) 在上述弹窗中，点击每个释义右上角的绿色**(+)**图标，可进行Anki制卡。

## 详细选项设定

本插件的选项主要分为三个部分：

1. 通用选项:
    - 启用关闭：用于开启和关闭插件。
    - 取词热键：用于设定自动选取单词的热键，有四个选项。off:关闭热键、shift键、ctrl键和alt键。
    - 最大原句数量：用于设定从文章上下文中摘取的最大原句数量。
    - 最大例句数量：用于设定词典中例句的显示数量(需该词典脚本支持)。
2. Anki选项:
    当Anki和Ankiconnect插件都已安装并打开时，插件会从Anki中获取你的牌组模板列表，并显示如下选项。
    - 牌组名称：牌组名称的下拉列表，用于选择制卡所需**牌组名称**名称。
    - 模板名称：模板名称的下拉列表，用于选择制卡所需**模板名称**名称。
    - 单词字段名称：上述模板所含的字段列表，用于选择放置**单词字段**的字段名称。
    - 音标字段名称：上述模板所含的字段列表，用于选择放置**音标字段**的字段名称。
    - 额外字段名称：上述模板所含的字段列表，用于选择放置**额外字段**的字段名称。
    - 释义字段名称：上述模板所含的字段列表，用于选择放置**释义字段**的字段名称。
    - 原句字段名称：上述模板所含的字段列表，用于选择放置**原句字段**的字段名称。
    - 当前Anki状态：显示当前Anki连接状态和Ankiconnect版本号。

3. 词典选项:

    - 脚本地址: 在此处可输入脚本地址，并点击**加载脚本**按钮加载。加载后可在下方词典列表中选择新加载词典。
    - 当前词典: 显示所有插件内置和外部加载的词典名称，用于选择当前划词翻译所用词典。

![Options Page](https://raw.githubusercontent.com/ninja33/ODH/master/doc/img/option_general_640x400.png)

## 使用其他脚本

1. 你可以选择预制的脚本，详见[[脚本清单](doc/scriptlist.md)]。
2. 也可以自行开发并加载，详见[[开发指南](doc/development.md)]。
3. 如有任何问题和想法，你也可以提交[[issue](https://github.com/ninja33/ODH/issues)]。

## Pull request

如果你想提交词典脚本或者改进插件本身，欢迎PR。

- 插件代码 [[/src](https://github.com/ninja33/ODH/tree/master/src)]。
- 脚本代码 [[/src/dict](https://github.com/ninja33/ODH/tree/master/src/dict)]。