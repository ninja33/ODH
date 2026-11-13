# 背景

[English](background.md) | 中文

对任何认真的语言学习者来说，阅读都是最重要的任务之一。2016 年我写过一个英汉学习与制卡扩展 [Anki Dict Helper](https://github.com/ninja33/anki-dict-helper)，灵感来自 [readlang.com](https://readlang.com/) 和 [Foosoft/yomichan](https://github.com/FooSoft/yomichan)。

那个扩展的工作方式是这样：用 Chrome 或 Firefox 阅读网页时，把鼠标移到任意单词上，按下 <kbd>shift</kbd> 键，就会弹出一个小窗口显示该词的中文释义。它支持制作 Anki 卡片，把**单词**、**释义**和**原句**（该词所在网页上下文中的那句话）填进卡片字段。一句话概括，它是一个个性化的网页生词本，同时也是一本英汉词典。

## 想法

那个扩展对英汉学习者来说运行得很好。但随着用户群扩大，我收到大量请求，问能不能增加别的词典、支持更多语言——至少支持那些和英语一样用拉丁字母的源语言。

原因和 Foosoft/yomichan 在项目 [FAQ](https://github.com/FooSoft/yomichan#frequently-asked-questions) 页里说的一样。第一，我只是个普通人，除了英语不会任何外语。第二，靠自己一个人拿齐所有词典文件、转换成可用格式、再塞进扩展里，几乎是件不可能完成的任务。

幸运的是我们处在这个互联网资源不断增长的时代，网上有成千上万的词典可供查询。于是任何一个用户都可以直接从在线词典抓取释义，保持单词和原句不变，让它弹出来，并照常做一张 Anki 卡片。

基本思路就是这样：

- Anki Dict Helper：弹窗 [单词, **内置释义**, 原句] --> Anki
- Anki Online Dict Helper：弹窗 [单词, **在线释义**, 原句] --> Anki

**在线释义**这部分由自定义 JavaScript 完成，可以是你或你的朋友写的，托管在 GitHub 之类的平台上。这极大地扩展了本扩展的能力，以满足你的具体需求。

如果你是 JavaScript 程序员并且有兴趣改进这个工具，请看 [词典脚本开发指南](dev_guide_uds.zh.md)。
