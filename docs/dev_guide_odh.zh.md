# ODH 开发指南

[English](dev_guide_odh.md) | 中文

本文面向**改这个扩展本身**的开发者：怎样把源码跑起来、跑哪些检查、目录怎么排、怎么提交。

架构、消息链、沙盒机制三块内容在 [README](../README.zh.md) 里，本文不重复。

## 1. 环境要求

| 项 | 要求 |
| --- | --- |
| Node | 24.x（见 `.nvmrc`，精确到 24.21.0） |
| npm | 11.x（见 `package.json` 的 `engines` 与 `packageManager`） |
| Chrome | ≥ 116（见 `src/manifest.json` 的 `minimum_chrome_version`） |

没有构建步骤。扩展就是 `src/` 里的 HTML、CSS、JavaScript 与资源文件，浏览器直接加载它们。

`package.json` 里的开发依赖（ESLint、jsdom、globals）只服务于检查与测试，不进扩展运行时。

## 2. 把扩展跑起来

1. 打开 `chrome://extensions`
2. 打开右上角的**开发者模式**
3. 点**加载已解压的扩展程序**，选择本仓库的 `src/` 目录

**实测限制**：较新的 Chrome（实测 157）会忽略命令行的 `--load-extension` 参数。命令行加载无效，必须手动走上面三步。要用干净 profile 调试，可以加 `--user-data-dir=<临时目录>` 启动 Chrome，然后手动加载。

改完 `src/` 里的文件后，在 `chrome://extensions` 的扩展卡片上点**重新加载**。

## 3. 本地词典数据

内置词典的数据文件不在仓库内。**缺它们不影响扩展加载，也不影响外部词典脚本开发**——只是内置词典查不到词，选中的词典会回落到第一个可用脚本。

外部词典脚本（走 `api.fetch` 抓在线词典的那些）完全不依赖本地数据，clone 下来就能用。

数据格式见[内置词典数据格式](dev_guide_dict.zh.md)。

## 4. 检查与测试

在仓库根执行：

```bash
npm ci
npm run lint
npm run test:contracts
npm run test:unit
```

| 命令 | 覆盖 |
| --- | --- |
| `npm run lint` | ESLint 全库，`--max-warnings=0`。错误与警告都返回非零 |
| `npm run test:contracts` | 公共 JSON 可解析、manifest 入口/资源/加载顺序、`src/lib` 的 jQuery 文件名回潮守卫、三语言 `data-i18n` 键覆盖 |
| `npm run test:unit` | 数据加载后的 Builtin/Deinflector、存储确认、词典配置发送、设置页事件分支、信封与传输期限、Anki 请求、消息边界、结果清洗、CSS 过滤 |

单文件检查：

```bash
./node_modules/.bin/eslint <file> --max-warnings=0
node --check <file>
```

测试只读 `tests/fixtures/` 下的自造小数据，不访问真实数据目录、配置、Anki 或网络。

## 5. 目录结构

```text
src/
├── manifest.json          Manifest V3 声明
├── _locales/              en / zh_CN / zh_TW 三份文案
├── bg/
│   ├── js/                service worker、offscreen、设置页逻辑
│   ├── sandbox/           manifest sandbox 页（运行词典脚本）
│   ├── data/              本地词典数据（不在 Git 跟踪范围）
│   ├── options.html       选项页
│   ├── popup.html         action popup
│   └── guide.html         内置使用说明
├── fg/
│   ├── js/                内容脚本与网页内弹窗
│   ├── css/               同上的样式
│   ├── img/               弹窗图标
│   └── font/              弹窗字体
├── dict/                  词典脚本
├── lib/                   第三方库（DOMPurify）与内部共享模块
└── img/                   扩展图标
tests/
├── contracts/             契约测试
├── unit/                  单元测试
└── fixtures/              测试用的自造数据
docs/                      公开文档（中英成对）
```

## 6. 在浏览器里验证

| 改动范围 | 要验证什么 |
| --- | --- |
| 内容脚本（`src/fg/`） | 任意网页划词 → 弹窗出现 → 释义正确 → 制卡按钮行为正常 |
| 设置页（`src/bg/options.html`、`popup.html`） | 三个标签切换正常，控件显示当前配置值，改动后保存成功 |
| sandbox 与词典脚本（`src/bg/sandbox/`、`src/dict/`） | 选项页加载脚本成功，划词查到词 |
| service worker（`src/bg/js/serviceworker.js`） | 扩展重启后首次划词能出结果；空闲一段时间后再划词仍能出结果 |
| Anki 相关 | 连接状态正确、制卡写入正确字段 |

无关改动不要重跑全部链路。纯文档与纯规范整理不需要浏览器验证。

## 7. 提交 PR

- 只改 `src/` 与 `tests/`。`docs/` 的文档改动单独提交
- 提交信息用 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)：`feat` / `fix` / `refactor` / `test` / `docs` / `chore`，描述用简短英文
- 一次提交只做一件事
- 新增或重排静态内容脚本时，同步 `src/manifest.json` 的 `content_scripts.js` 数组顺序
- 新增词典脚本时，同步 `eslint.config.mjs` 的 `classicExports` 登记（否则 lint 会报未使用变量）
- 面向用户的界面文案走 i18n：三份 `messages.json` 同步加 key，页面用 `data-i18n`，JS 用 `chrome.i18n.getMessage()`

## 8. 代码约定要点

完整约定见仓库内的规则文件；给外部贡献者的核心几条：

- **4 空格缩进，单引号，语句结尾加分号**
- 经典脚本，不用 `import` / `export`（service worker 用 `importScripts()`，词典脚本走动态 `eval` 加载）
- 不用 jQuery 或任何框架，原生 DOM API。`src/lib/purify-3.4.11.min.js` 是唯一第三方库，只用它的 `sanitize()`
- 跨脚本引用的全局符号写在文件顶部 `/* global A, B */` 注释里
- service worker 没有 `window`、`document`、`Audio`、`DOMParser`——需要 DOM 的代码放 offscreen 或内容脚本
- 注释用英文，解释「为什么」而不是「是什么」

## 9. 已知限制

- **没有构建流程**：浏览器直接加载 `src/`，没有 bundle、没有转译。用新语法前先确认 Chrome 116 支持
- **Firefox 未验证**：当前代码依赖 `chrome.offscreen` 与 `chrome.runtime.getContexts`，这两个 API 在 Firefox 上没有对应实现
- **拆分的字典分片文件无代码引用**：源码当前只读 `bg/data/` 下的词条数据与词形还原表两个文件
- **`api.fetch` 的 6 秒上限不可配置**
- 扩展没有声明 `host_permissions`，跨域请求按普通 cross-origin 处理
