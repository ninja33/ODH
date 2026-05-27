/* global api */
class rucn_Qianyi {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '千亿词霸俄汉词典';
        if (locale.indexOf('TW') != -1) return '千亿词霸俄汉词典';
        return 'Qianyi RU->CN Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        return await this.findQianyi(word);
    }

    async findQianyi(word) {
        let notes = [];
        if (!word) return notes;

        function T(node) {
            if (!node) return '';
            return node.innerText ? node.innerText.trim() : '';
        }

        let base = 'https://w.qianyix.com/index.php?q=';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        // ===== 原型词提示（只显示一次）=====
        let rootHintHtml = '';
        let hintEl = doc.querySelector('.result-tip');
        if (hintEl) {
            rootHintHtml = '<div class="qy-root-hint">' + hintEl.innerHTML + '</div>';
        }

        let entries = doc.querySelectorAll('.baseword .view') || [];
        for (const entry of entries) {
            let definition = '';
            let expression = '';
            let audios = [];

            let keywordEl = entry.querySelector('.keyword');
            if (!keywordEl || !keywordEl.dataset.guid) continue;

            expression = T(keywordEl);

            // 音频
            let audio = entry.querySelector('.speaker');
            if (audio && audio.dataset.url) {
                audios[0] = audio.dataset.url;
            }

            // 从父面板 ID 取序号（base0 → 0, base1 → 1 ...）
            let parentId = entry.parentNode.id || '';
            let seq = parentId.replace('base', '');

            // ---- 1. 原型词提示 ----
            if (rootHintHtml) {
                definition += rootHintHtml;
                rootHintHtml = ''; // 只显示一次
            }

            // ---- 2. 基本释义 ----
            let expEl = entry.querySelector('.exp');
            if (expEl) {
                definition += '<div class="qy-section-title">📖 基本释义</div>';
                definition += '<ul class="qy-exp">';
                let defblocks = expEl.innerHTML.split('<br>');
                for (const defblock of defblocks) {
                    let trimmed = defblock.trim();
                    if (trimmed) {
                        definition += '<li class="qy-exp-item"><span class="qy-exp-chn">'
                            + trimmed + '</span></li>';
                    }
                }
                definition += '</ul>';
            }

            // ---- 3. 行业释义（包含词性信息如 [阴][中][阳]）----
            if (seq !== '') {
                let detailPanel = doc.querySelector('#detail' + seq);
                if (detailPanel) {
                    let industryItems = detailPanel.querySelectorAll(
                        '.subExpContainer .exp-item-sub');
                    if (industryItems.length > 0) {
                        definition += '<div class="qy-section-title">🏭 行业释义</div>';
                        definition += '<ul class="qy-industry">';
                        for (const item of industryItems) {
                            let industry = T(item.querySelector('.subTip'));
                            let subExpEl = item.querySelector('.subExp .exp');
                            let subExp = subExpEl ? subExpEl.innerText.trim() : '';
                            if (industry && subExp) {
                                definition += '<li class="qy-industry-item">'
                                    + '<span class="qy-industry-tag">' + industry + '</span> '
                                    + '<span class="qy-industry-text">' + subExp + '</span>'
                                    + '</li>';
                            }
                        }
                        definition += '</ul>';
                    }
                }
            }

            // ---- 4. 变位变格（名词6格 / 动词变位）★ 核心新增 ★ ----
            if (seq !== '') {
                let grmPanel = doc.querySelector('#grm' + seq);
                if (grmPanel) {
                    let grmDiv = grmPanel.querySelector('.grammardiv');
                    if (grmDiv) {
                        // 取出原始 HTML，去掉可能混入的 <script> 标签
                        let grmHtml = grmDiv.innerHTML;
                        grmHtml = grmHtml.replace(
                            /<script[^>]*>[\s\S]*?<\/script>/gi, '');

                        definition += '<div class="qy-section-title">📐 变位变格</div>';
                        definition += '<div class="qy-grammar">';
                        definition += grmHtml;
                        definition += '</div>';
                    }
                }
            }

            // ---- 5. 例句 ----
            if (seq !== '' && this.maxexample > 0) {
                let examps = doc.querySelectorAll('#example' + seq + ' .exp-item') || [];
                if (examps.length > 0) {
                    definition += '<div class="qy-section-title">📝 例句</div>';
                    definition += '<ul class="qy-sents">';
                    let count = 0;
                    for (const examp of examps) {
                        if (count >= this.maxexample) break;
                        let engExamp = T(examp.querySelector('.exam-a'));
                        let chnExamp = T(examp.querySelector('.exam-b'));
                        if (engExamp && chnExamp) {
                            definition += '<li class="qy-sent">'
                                + '<span class="qy-eng-sent">' + engExamp + '</span>'
                                + '<span class="qy-chn-sent">' + chnExamp + '</span>'
                                + '</li>';
                            count++;
                        }
                    }
                    definition += '</ul>';
                }
            }

            let css = this.renderCSS();
            notes.push({
                css,
                expression,
                definitions: [definition],
                audios
            });
        }
        return notes;
    }

    renderCSS() {
        let css = `
            <style>
                /* ---- 基本释义 ---- */
                ul.qy-exp, li.qy-exp-item {
                    list-style: square inside;
                    margin: 0;
                    margin-left: 2px;
                    padding: 0;
                }
                li.qy-exp-item {
                    margin-bottom: 2px;
                }
                span.qy-exp-chn {
                    color: #333;
                    line-height: 1.6;
                }

                /* ---- 分区标题 ---- */
                .qy-section-title {
                    font-weight: bold;
                    color: #0d47a1;
                    margin: 12px 0 5px 0;
                    padding-bottom: 3px;
                    border-bottom: 1px solid #e0e0e0;
                    font-size: 0.95em;
                }

                /* ---- 原型词提示 ---- */
                .qy-root-hint {
                    font-size: 0.85em;
                    color: #666;
                    background: #fff3e0;
                    padding: 4px 8px;
                    border-radius: 4px;
                    margin-bottom: 8px;
                    border-left: 3px solid #ff9800;
                }
                .qy-root-hint b { color: #e65100; }
                .qy-root-hint a { color: #0d47a1; text-decoration: none; }

                /* ---- 行业释义 ---- */
                ul.qy-industry {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                li.qy-industry-item {
                    margin-bottom: 4px;
                    padding: 3px 6px;
                    background: #f5f5f5;
                    border-radius: 3px;
                    font-size: 0.9em;
                    line-height: 1.5;
                }
                span.qy-industry-tag {
                    display: inline-block;
                    font-size: 0.8em;
                    color: white;
                    background: #0d47a1;
                    padding: 1px 6px;
                    border-radius: 3px;
                    margin-right: 6px;
                    min-width: 36px;
                    text-align: center;
                }
                span.qy-industry-text {
                    color: #333;
                }

                /* ---- 变位变格表格 ---- */
                .qy-grammar {
                    font-size: 0.95em;
                    max-height: 420px;
                    overflow-y: auto;
                    margin-top: 5px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    padding: 6px;
                    background: #fafafa;
                }
                .qy-grammar table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 5px 0;
                    font-size: 1em;
                }
                .qy-grammar table td,
                .qy-grammar table th {
                    border: 1px solid #ccc;
                    padding: 3px 6px;
                    text-align: left;
                }
                .qy-grammar table th {
                    background: #e3f2fd;
                    color: #0d47a1;
                    font-weight: bold;
                    white-space: nowrap;
                }
                .qy-grammar table td {
                    background: #fff;
                }
                .qy-grammar hr {
                    border: none;
                    border-top: 1px solid #e0e0e0;
                    margin: 8px 0;
                }
                .qy-grammar h2 {
                    font-size: 1em;
                    color: #c62828;
                    margin: 8px 0 4px 0;
                }
                .qy-grammar h3 {
                    font-size: 0.9em;
                    color: #0d47a1;
                    margin: 6px 0 3px 0;
                }
                .qy-grammar b {
                    color: #333;
                }

                /* ---- 例句 ---- */
                ul.qy-sents {
                    font-size: 0.9em;
                    list-style: square inside;
                    margin: 3px 0;
                    padding: 5px 8px;
                    background: rgba(13,71,161,0.06);
                    border-radius: 5px;
                }
                li.qy-sent {
                    margin: 3px 0;
                    padding: 0;
                    line-height: 1.5;
                }
                span.qy-eng-sent {
                    margin-right: 8px;
                    color: #333;
                }
                span.qy-chn-sent {
                    color: #0d47a1;
                    font-weight: bold;
                }
            </style>`;
        return css;
    }
}