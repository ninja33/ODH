# 内置词典数据格式

[English](dev_guide_dict.md) | 中文

本文说明内置词典使用的两类数据文件，以及怎样用它们自测。

**先理解一件事**：内置词典不是特殊物种，它同样是[词典脚本](dev_guide_uds.zh.md)。区别只在取数据的方式——内置词典用 `api.getBuiltin(dict, word)` 读本地数据，外部词典用 `api.fetch(url)` 发网络请求。其余契约完全相同：同一个 `findTerm()`、同样的 note 结构、同样的清洗。

## 1. 两类数据

| 数据 | 用途 | 谁在读 |
| --- | --- | --- |
| 词条数据 `bg/data/<dictionary>.json` | 释义查询 | 内置词典脚本的 `findTerm()` → `api.getBuiltin()` |
| 词形还原表 `bg/data/<wordforms>.json` | 词形变化还原 | `api.deinflect()` |

数据文件不在 Git 跟踪范围内，也不随源码分发。**缺它们不影响扩展加载，也不影响外部词典脚本开发**——只是内置词典查不到词。

## 2. 词条数据的顶层结构

以词条为键的对象：

```json
{
    "wug": {
        "star": "★★★☆☆",
        "readings": ["wʌɡ"],
        "defs": [ ... ]
    }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `star` | 字符串 | 星级，形如 `"★★★☆☆"`。**空串表示无星级**。注意 fixture 里这一项是数字，见第 6 节 |
| `readings` | 字符串数组 | 音标。可能为空数组 |
| `defs` | 数组 | 释义，见下一节。**可能为空数组** |

空数组在真实数据里确实会出现。**脚本必须容忍空数组**，不要假设每个词条都有内容。

## 3. `defs[]` 元素结构

```json
{
    "pos_cn": "名词",
    "pos_en": "N-COUNT",
    "def_cn": "一种仅用于自动化测试的虚构物体。",
    "def_en": "An imaginary object used only in automated tests.",
    "ext": [
        { "ext_cn": "这项测试包含一个虚构物体。", "ext_en": "This test contains one wug." }
    ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `pos_cn` | 字符串 | 中文词性。**真实数据有，fixture 里没有**，见第 6 节 |
| `pos_en` | 字符串 | 英文词性 |
| `def_cn` | 字符串 | 中文释义 |
| `def_en` | 字符串 | 英文释义 |
| `ext` | 数组 | 例句，见下一节 |

**真实数据的这些字段都存在，没有一条缺字段。但字符串值可能是空串。**

常见的情况是某个字段有值、另一个为空（例如英文词性有、中文词性没有）。所以判据是**值是否为空**，不是**字段是否存在**：

```javascript
// 对
let pos = def.pos_cn ? `<span class="pos">${def.pos_cn}</span>` : '';

// 错——字段存在但可能是 ""
if (def.pos_cn !== undefined) { ... }
```

## 4. `ext[]` 元素结构

| 字段 | 类型 |
| --- | --- |
| `ext_en` | 字符串 |
| `ext_cn` | 字符串 |

两者都可能是空串。

## 5. 词形还原表结构

以词形为键、原形为值：

```json
{
    "biennials": "biennial"
}
```

**值可能是字符串，也可能是数组。** 真实数据里全部是字符串；仓库的测试 fixture 里用的是数组（`"wugged": ["wug"]`）。写脚本时按值类型分支，两种都容忍：

```javascript
let stem = await api.deinflect(word);
let forms = [].concat(stem || []);
```

## 6. 完整样例

仓库里有两份可直接打开的结构样例：

- [`tests/fixtures/collins.json`](../tests/fixtures/collins.json)——849 B，两条自造词条
- [`tests/fixtures/wordforms.json`](../tests/fixtures/wordforms.json)——109 B，四条映射

**它们是测试 fixture，不是发行数据。** 词是真词，释义是自造的。用来看清结构足够，别拿去当词典用。

**fixture 与真实数据有三处差异**，照抄 fixture 会写出不兼容的代码：

| 项 | fixture | 真实数据 |
| --- | --- | --- |
| `star` | 数字（`1`、`0`） | 字符串（`"★★★☆☆"`，无星级是空串 `""`） |
| `pos_cn` | **不存在** | 存在，可能是空串 |
| `wordforms` 的值 | 数组（`["wug"]`） | 字符串（`"biennial"`） |

所以脚本应对 `star` 与 `wordforms` 的值**按类型分支**，并**不要假设 `pos_cn` 一定存在**。

## 7. 内部词典也是脚本

`src/dict/builtin_encn_Collins.js` 是最完整的参考：

- `findTerm()` 先调 `api.deinflect()` 拿词形，再对每个候选调 `api.getBuiltin()`
- 拿到 JSON 字符串后自己 `JSON.parse`
- 组装 note，`css` 里给星级、词性、例句配色
- `displayName()` 用 `api.locale()` 输出三语言名

## 8. 怎么自测

三个层次，由轻到重：

1. **纯数据校验**：用 Node 直接读 JSON，检查结构与字段类型

   ```bash
   node -e 'const d=require("<你的数据文件>.json"); console.log(Object.keys(d))'
   ```

   若手上没有真实数据，可先用第 6 节的两份 fixture 顶替，把路径换成它们。

2. **脚本逻辑**：在 Node 里用 fixture 喂给你的解析函数，不依赖浏览器

3. **端到端**：扩展加载后在 sandbox 的 console 里直接调

   ```javascript
   await api.getBuiltin('<dictionary>', '<word>')
   ```

   把 `<dictionary>` 换成你要查的数据标识、`<word>` 换成词条。sandbox console 的打开方式见[词典脚本开发指南第 10 节](dev_guide_uds.zh.md)。

## 9. 新增一本内置词典

这属于**代码改动**，不是配置：

1. 在 `src/bg/js/builtin.js` 的 `loadData()` 里登记一个新的数据槽位
2. 新增 `src/dict/builtin_<name>.js`，走 `api.getBuiltin('<name>', word)`
3. 数据文件放进 `bg/data/`（不在 Git 跟踪范围内，需要另行分发）
4. 若要默认激活，加进 `src/bg/js/utils.js` 的默认 `sysscripts` 与 `src/bg/js/options.js` 的固定脚本列表

第 1 步登记槽位与第 2 步新增脚本是同一件事的两半。`getBuiltin(dict, word)` 的 `dict` 参数是正常的选择入参——登记几个槽位就有几个可选值，不固定为某一个。
