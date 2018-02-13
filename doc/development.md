# 开发指南

## 创建你的专属脚本

如果您想要显示你个性化在线词典内容，您需要自行创建脚本，并将脚本上传到Github.com。而后在选项页(option page)中的**Repository**字段输入您的脚本位置。

**重要事项**：你不能直接引用Github.con作为脚本位置（因为这个[原因](https://github.com/rgrove/rawgit/blob/master/FAQ.md)），你需要修改域名为rawgit.com

例如：

1. 如果你的脚本本来是上传到 `https://**github**.com/your-name/repository/branch/filename.js`
2. 你需要把上述的地址切换成 `https://**rawgit**.com/your-name/repository/branch/filename.js`

### 框架和工作流程

原则上，这个插件会将你的浏览器划词当做输入，而后传递到你的脚本进行在线查询，得到返回的内容后会以弹出式窗体的形式展示。（可选）当你点击 **+** 号，它会在你的Anki上创建一个包含着**word（单词）**，**definition（定义）**，**sentence（句子）**这几个区域内容的卡片。

词典脚本包括了三个部分

1. 创建一个在线词典查询url，绝大多数的情况下，它都是`http(s)://example.online.dictionary.com/search?word={your-word}`
2. 通过发送上述链接进行查询，并且得到返回的内容。
3. 为了分清返回的内容和原本的内容，你需要使用 Elemenet/CSS selector（元素选择器） (`getEelement(s)byXXX or querySelector(All)`) 来获得你想要的定义内容

### 编写惯例

1. 首先，您需要将您所有的在线字典Scraping code代码封装在一个类中。为避免重复声明，您需要检测此类是否已经被声明过，然后在代码末尾加上它，这将以此处显示的名称注册此类（将在扩展选项页中显示）。

    **重要事项：**为了使用显示的名称区分不同的语言，最好使用源语言和目标语言的2位国家代码作为前缀，例如**encn-DictionaryName**则是以英语作为源语言而中文为翻译结果。

2. 然后，在你的词典类中，你需要起码定义至少一个命名为 `findTerm()` 的函数，这个函数将会接收你所划的词亦即**word**作为函数参数，并会返回一个预设对象。好了，就这么多。
下边是一个提供给您进行编写的模板。

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

3. 最后，如果您制作了多个脚本，并且想一次上传这些脚本，您可以创建一个像下边所示的词典脚本列表，并且在选项页(Option page)中输入列表位置。

```javascript
registerList([
    'https://rawgit.com/ninja33/ODH/master/dicts/encn_Baicizhan.js',
    'https://rawgit.com/ninja33/ODH/master/dicts/encn_Bing.js',
    'https://rawgit.com/ninja33/ODH/master/dicts/encn_CNDict.js',
]);
```

您可以在[这里](https://github.com/ninja33/ODH/tree/master/src/bg/local)找到一些词典脚本的示例源码

## 安全事项

因为这个插件会动态加载您的定制化脚本，您应该知道您正在做什么。

1. 您需要在选项页(Option page)中明确地输入您的脚本位置。
2. 您的脚本域名只能是**rawgit.com**，这意味着所有的代码都将公开并且由Github.com代为管理运行。
