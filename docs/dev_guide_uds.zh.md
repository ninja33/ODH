# 词典脚本开发指南

[English](dev_guide_uds.md) | 中文

本文面向**外部词典脚本**开发者：你想让扩展从某个在线词典取回释义，或者你有一份自己的内置词典数据，希望它能在弹窗里显示出来。

ODH 的词典能力全部由脚本提供——内置词典也是脚本，只是它读本地数据而不是发网络请求。所以学会写一个脚本，两种用法都掌握。

## 1. 脚本是什么

一个词典脚本就是一个 **class**。扩展取回脚本文本后，在 sandbox 里执行 `eval('(' + 文本 + ')')` 得到一个构造函数，用 `new` 实例化，再以这个 class 的名字注册。

```javascript
/* global api */
class encn_MyDict {
    async findTerm(word) {
        return [];
    }
}
```

三条硬约束：

- 文件内容必须是**一个表达式**，其值是一个 class。不要写 `export`、`import`，不要写顶层语句。
- 类名即注册 ID，见第 3 节。
- 脚本运行在 sandbox 里，**拿不到任何 `chrome.*` API**，只能通过 `api` 对象请求能力，见第 5 节。

## 2. 最小可用脚本

```javascript
/* global api */
class encn_MyDict {
    async findTerm(word) {
        let url = `https://example.com/api?word=${encodeURIComponent(word)}`;
        let text = await api.fetch(url);
        if (!text) return [];

        let notes = [];
        let definitions = [];
        try {
            let data = JSON.parse(text);
            definitions.push(data.definition || '');
        } catch (e) {
            // 解析失败：返回空，不要把异常抛给用户
            return [];
        }
        if (definitions.length === 0) return [];

        notes.push({
            css: '<style>.mydict { color: #0d47a1; }</style>',
            expression: word,
            definitions
        });
        return notes;
    }
}
```

把它存成 `encn_MyDict.js`，在选项页「脚本选项 → 自选脚本」填它的地址，点「加载脚本」，然后在词典下拉里选中它。

## 3. 命名与注册

**类名是持久化 ID。** 用户选择的词典以 `dictSelected` 存在 `storage.local` 里，存的就是类名。改名会让已保存的选择失效。

命名沿用 `<源语言><目标语言>_<词典名>`，语言用两位代码：`encn_Collins`（英→中）、`frcn_Youdao`（法→中）、`enen_UrbanDict`（英→英）。

**文件名与类名不必一致**，仓库里就有两处：

| 文件 | 类名 |
| --- | --- |
| `encn_Oxford_bing.js` | `encn_Oxford` |
| `enen_LDOCE6MDX.js` | `encn_LDOCE6MDX` |

这是历史包袱，不是推荐做法。但要注意：**同名的类会互相覆盖**——上面两个文件若同时加载，后加载的会顶掉先加载的实例。

## 4. 脚本地址怎么解析

在选项页填的脚本名，按字符串规则解析成 URL，不是严格的 URL 解析：

| 你填的 | 实际请求 |
| --- | --- |
| `encn_MyDict` | `chrome-extension://<扩展 id>/dict/encn_MyDict.js` |
| `lib://encn_Collins` | `https://raw.githubusercontent.com/ninja33/ODH/master/src/dict/encn_Collins.js` |
| `https://你的域名/脚本.js` | 原样使用 |
| 不含 `.js` 的任何形式 | 末尾自动补 `.js` |

- 走 `/dict/` 的只对**扩展自带的脚本**有意义——你写的脚本不在扩展包里，用不到这条。
- `lib://` 是**应急用法**：仓库里改了脚本、但 Web Store 新版还没批准生效时，用它直接指向 GitHub 上 `master` 分支的最新脚本抢先恢复。日常开发不要依赖它。
- 你自己的脚本用完整的 `https://` 地址。

## 5. 沙盒 API

脚本运行在 manifest 声明的 sandbox 页面里，是独立的 opaque origin，不能直接调用扩展 API。所有对外能力收在一个全局 `api` 对象上，目前提供下面这些方法：

| 方法 | 返回 |
| --- | --- |
| `api.fetch(url)` | 响应文本，或 `null` |
| `api.deinflect(word)` | 词形还原结果，或 `null` |
| `api.getBuiltin(dict, word)` | 内置词典条目的 JSON 字符串，或 `null` |
| `api.locale()` | Chrome 界面语言，如 `zh_CN`、`en` |

这些方法都返回 Promise，**都不会 reject**。失败时由封装层折成 `null`，分类过的失败原因只写进 console，脚本拿不到。

### `api.fetch(url)`

请求由扩展的 service worker 代发，**你不需要处理 CORS**，也不需要自己加请求头。

限制：

- **6 秒上限**。超时返回 `null`，原请求不会被取消。
- 只允许 `http`、`https`，以及扩展自己的 `chrome-extension:` 资源。
- 拒绝 link-local 地址（`169.254.x.x`）与云厂商 metadata 端点——实例凭据永远不是词典来源。
- 不支持 IPv6。

`null` 意味着「没取到」，可能是网络失败、HTTP 错误、超时或被拒绝。**你的脚本应当把它当普通失败处理并返回 `[]`**，不要抛错。

### `api.deinflect(word)`

英文词形还原。返回映射值或 `null`。

**值的形态以实际数据为准。** 真实数据里是**字符串**（`"biennials"` → `"biennial"`），仓库的测试 fixture 里是**数组**。写脚本时要两种都容忍：

```javascript
let stem = await api.deinflect(word);
let forms = [].concat(stem || []);
```

### `api.getBuiltin(dict, word)`

读取内置词典数据，返回 JSON 字符串（你需要自己 `JSON.parse`）或 `null`。数据格式见 [内置词典数据格式](dev_guide_dict.zh.md)。

`dict` 是内置词典的数据标识，取值取决于扩展注册了哪几本内置词典。

### `api.locale()`

返回 Chrome 界面语言。用来做 `displayName()` 的多语言：

```javascript
async displayName() {
    let locale = await api.locale();
    if (locale.indexOf('CN') != -1) return '我的词典';
    if (locale.indexOf('TW') != -1) return '我的詞典';
    return 'My Dictionary';
}
```

## 6. 必须实现的成员

### `findTerm(expression)`

唯一必需的方法，接收用户划选的词，返回 Promise。

**返回值必须是 note 数组。** 这是硬要求，不是建议——见第 8 节。

查不到就返回 `[]`：

```javascript
async findTerm(word) {
    if (!word) return [];
    // ...
    return notes;
}
```

返回一个字符串也可以，它会被包装成单条释义。但数组形式能控制的更多，推荐数组。

## 7. 可选的成员

### `displayName()`

返回下拉框里显示的名字，可以是 async（因为常要用 `api.locale()`）。不实现则用类名。

### `setOptions(options)`

接收一份配置副本，**其中的敏感字段已按黑名单剔除**（Anki 凭据一类）——词典不需要知道它们。这份黑名单由扩展维护，可能会增加条目；**不要假定你收到的字段集合是固定或完整的**，只依赖下表中你真正需要的字段。

常用字段：

| 字段 | 含义 |
| --- | --- |
| `maxexample` | 例句数量上限，字符串 `'0'`–`'2'` |
| `maxcontext` | 页面原句提取条数，字符串 `'1'`–`'3'` |
| `monolingual` | `'0'` 双语、`'1'` 单语 |
| `preferredaudio` | 偏好音频序号 `'0'` 或 `'1'` |
| `dictSelected` | 当前选中的词典类名 |

注意值多为**字符串**，比较前先 `Number()`。返回值不被等待，不要在这里做异步初始化。

## 8. note 结构与制卡

每条 note 是这样一个对象：

```javascript
{
    css: '<style>...</style>',
    expression: word,
    reading: '/ˈwɜːd/',
    extrainfo: '★★★☆☆',
    definitions: ['第一条释义', '第二条释义'],
    audios: ['https://.../uk.mp3', 'https://.../us.mp3'],
    sentence: '',
    url: ''
}
```

### 哪些字段真正重要

- **`definitions` 必须是数组**。渲染会遍历它（`.entries()`），制卡会对它调 `.join('<hr>')`。缺失时 `buildNote()` 会补一个**空字符串**，而清洗层对字符串是**原样保留**（`sanitizeNote` 只对数组逐条清洗、对非空字符串做一次清洗，不做类型转换）——于是串到渲染层时仍是字符串，`.entries()` 会抛 `TypeError`，**弹窗直接报错**。所以「缺字段有默认值」这句话对 `definitions` 不成立，请始终返回数组。
- **`audios` 可选**，缺失时补 `[]`，空数组是安全的。它是**按音源顺序排**的（英音、美音），不是与释义一一对应。弹窗头部为每个非空项渲染一个发音按钮，点击第 i 个播 `audios[i]`；制卡取哪一路由选项页的「音频偏好」决定，越界回落第 0 个。
- `css`、`reading`、`extrainfo`、`url` 缺失时补空串，安全。
- `expression` 与 `sentence` 由扩展侧提供，不是你填的：`expression` 取当前选中文本；`sentence` 先由页面上下文填入弹窗的可编辑区，用户点制卡时提交的是**他编辑后的内容**。

### 制卡时发生什么

用户点绿色 **+**：

1. 扩展取 `css + definitions[选中那条]` 作为「单一释义」字段
2. 取 `css + definitions.join('<hr>')` 作为「全部释义」字段
3. `sentence`、`url` 用扩展侧的值覆盖
4. 按选项页的字段映射写进 Anki

**你的 `css` 会跟着释义一起进卡片**，所以样式要写成卡片里也能看的样子，不要依赖弹窗独有的布局。

### 查不到 vs 出错

- **查不到**：返回 `[]`。走成功路径，用户看到没有弹窗，不写日志。
- **出错**：`throw`。走失败路径，标 `handler-error`，console 留一条分类日志。

对用户来说两者都不弹窗，区别只在诊断。所以**不要用抛错表达「没查到」**——那会让真正的故障淹没在正常空结果里。

## 9. 清洗与安全

你的输出在进入页面前会被清洗。这不是建议，是既定行为：

- `css`、`definitions`（数组与字符串两种形态）、`expression`、`reading`、`extrainfo` 过 DOMPurify，禁 `style` 属性与四个 `data-*`（`data-nindex`、`data-dindex`、`data-sound`、`data-odh-control`）。
- `audios` 只保留 `http(s)` URL，其余丢弃。
- `sentence` **不清洗**——它是用户自己的内容。

清洗层接受字符串形态的 `definitions`，但**渲染层只接受数组**。别把「清洗没报错」当成「格式正确」。

你的 `<style>` 进入弹窗时还会再过一层 CSSOM 过滤：

- 整条丢弃：选择器含 `html`、`body`、`:root`、`*`、任何 `#id`、含 `odh-` / `spell-` / `icon-`
- at-rule 全禁（`@media`、`@import` 等）
- 其余属性放行

所以**用类选择器**（`.mydict-pos`），不要用 `#id`，不要碰 `body`。

## 10. 调试

- 脚本的 `console.log` 出现在 **sandbox 的 console** 里，不是页面 console。在 `chrome://extensions` 找到本扩展，点 `bg/sandbox/sandbox.html` 那一行的「检查视图」。
- **改脚本内容后，光点「加载脚本」不会重新取文本。** 扩展只在 `sysscripts` / `udfscripts` 这两个字符串**发生变化**时才重新加载脚本；URL 没变它就认为配置没变，直接跳过。要让它重新拉取，任选一种：
  - 在输入框里改动一下 URL 再改回来（制造差异），或
  - 在扩展页点一次「重新加载」刷新整个扩展。
- 加载失败按脚本逐个记录，不影响其他脚本。选中的脚本加载失败会回落到第一个可用词典，console 里有一行 `console.info` 说明切换到了哪个。

## 11. 在选项页加载

1. 打开扩展的选项页，切到**脚本选项**标签
2. 在「自选脚本」的输入框填脚本地址（完整 `https://` 或 `lib://` 名）
3. 点**加载脚本**
4. 回到「通用选项」，在「词典名称」下拉里选中你的词典

## 12. 参考实现

`src/dict/` 下有一批可用脚本，覆盖多种语言组合。建议从简单的开始读：

- `general_Makenotes.js`——38 行，不做网络请求，展示最小结构
- `encn_Youdao.js`——走 `api.fetch` 抓取并解析 HTML
- `builtin_encn_Collins.js`——走 `api.getBuiltin` 读本地数据，同时演示 `displayName()`、`setOptions()`、音频与 CSS

## 13. 已知限制

- 脚本**无法设置请求头**（包括 `Referer`），部分词典站点会因此拒绝。这类站点目前无解。
- 没有脚本级的权限声明：脚本能 `fetch` 任何允许协议的地址，扩展不会为它做域名白名单。请只加载你信任的脚本。
- `api.fetch` 的 6 秒上限不可配置。
