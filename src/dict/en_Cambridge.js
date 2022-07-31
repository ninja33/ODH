/* global api */
class en_Cambridge {
  constructor(options) {
    this.options = options;
    this.maxexample = 2;
    this.word = "";
  }

  async displayName() {
    return "Cambridge EN Dictionary";
  }

  setOptions(options) {
    this.options = options;
    this.maxexample = options.maxexample;
  }

  async findTerm(word) {
    this.word = word;
    let promises = [this.findCambridge(word)];
    let results = await Promise.all(promises);
    return [].concat(...results).filter((x) => x);
  }

  isEmptyArray(arr) {
    return Array.isArray(arr) && arr.length === 0;
  }

  getTrimInnerText(node) {
    if (!node) return "";
    else return node.innerText.trim();
  }

  getPronunciation(nodes) {
    if (this.isEmptyArray(nodes)) return "";

    let pronunciation = "";

    const ukPronunciationDOM = nodes.querySelector(
      ".uk.dpron-i > .pron.dpron > .ipa"
    );
    const ukPronunciation = this.getTrimInnerText(ukPronunciationDOM);
    if (ukPronunciation) pronunciation += `UK[${ukPronunciation}]; `;

    const usPronunciationDOM = nodes.querySelector(
      ".us.dpron-i > .pron.dpron > .ipa"
    );
    const usPronunciation = this.getTrimInnerText(usPronunciationDOM);
    if (usPronunciation) pronunciation += `US[${usPronunciation}]; `;

    return pronunciation.trim();
  }

  getPosgram(node) {
    if (!node) return "";

    const posgram = this.getTrimInnerText(node);
    if (!posgram) return "";

    return `<span class='pos'>${posgram.trim()}</span>`;
  }

  getAudio(node) {
    if (!node) return "";

    return "https://dictionary.cambridge.org" + node.getAttribute("src");
  }

  getExamples(expression, node) {
    const examples = node.querySelectorAll(".def-body .examp");
    if (this.isEmptyArray(examples)) return "";
    if (this.maxexample <= 0) return "";

    let definition = "";
    definition += '<ul class="sents">';
    for (const [index, example] of examples.entries()) {
      if (index > this.maxexample - 1) break;
      let engExample = this.getTrimInnerText(example.querySelector(".eg"));
      definition += `<li class='sent'><span class='eng_sent'>${engExample.replace(
        RegExp(expression, "gi"),
        `<b>${expression}</b>`
      )}</span>`;
    }
    definition += "</ul>";

    return definition;
  }

  async findCambridge(word) {
    let notes = [];
    if (!word) return [];

    let base = "https://dictionary.cambridge.org/search/english/direct/?q=";
    let url = base + encodeURIComponent(word);
    let doc = "";
    try {
      let data = await api.fetch(url);
      let parser = new DOMParser();
      doc = parser.parseFromString(data, "text/html");
    } catch (err) {
      return [];
    }

    const entries = doc.querySelectorAll(".pr .entry-body__el");
    if (this.isEmptyArray(entries)) return [];

    for (const entry of entries) {
      const definitions = [];
      const audios = [];

      const expression = this.getTrimInnerText(
        entry.querySelector(".headword")
      );

      const reading = this.getPronunciation(entry);

      const pos = this.getPosgram(entry.querySelector(".posgram"));

      audios.push(this.getAudio(entry.querySelector(".uk.dpron-i source")));
      audios.push(this.getAudio(entry.querySelector(".us.dpron-i source")));

      const sensbodys = entry.querySelectorAll(".sense-body");
      if (this.isEmptyArray(sensbodys)) continue;

      for (const sensbody of sensbodys) {
        const sensblocks = sensbody.childNodes;
        if (this.isEmptyArray(sensblocks)) continue;

        for (const sensblock of sensblocks) {
          let phrasehead = "";
          let defblocks = [];
          if (
            sensblock.classList &&
            sensblock.classList.contains("phrase-block")
          ) {
            phrasehead = this.getTrimInnerText(
              sensblock.querySelector(".phrase-title")
            );
            phrasehead = phrasehead
              ? `<div class="phrasehead">${phrasehead}</div>`
              : "";
            defblocks = sensblock.querySelectorAll(".def-block") || [];
          }
          if (
            sensblock.classList &&
            sensblock.classList.contains("def-block")
          ) {
            defblocks = [sensblock];
          }
          if (defblocks.length <= 0) continue;

          // make definition segment
          for (const defblock of defblocks) {
            let engTran = this.getTrimInnerText(
              defblock.querySelector(".ddef_h .def")
            );
            if (!engTran) continue;

            let definition = "";
            engTran = `<span class='eng_tran'>${engTran.replace(
              RegExp(expression, "gi"),
              `<b>${expression}</b>`
            )}</span>`;
            const tran = `<span class='tran'>${engTran}</span>`;
            definition += phrasehead ? `${phrasehead}${tran}` : `${pos}${tran}`;

            definition += this.getExamples(expression, defblock);

            if (definition) definitions.push(definition);
          }
        }
      }

      const css = this.renderCSS();
      notes.push({
        css,
        expression,
        reading,
        definitions,
        audios,
      });
    }
    return notes;
  }

  renderCSS() {
    return `
            <style>
                div.phrasehead{margin: 2px 0;font-weight: bold;}
                span.star {color: #FFBB00;}
                span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                span.tran {margin:0; padding:0;}
                span.eng_tran {margin-right:3px; padding:0;}
                ul.sents {font-size:0.8em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent  {margin:0; padding:0;}
                span.eng_sent {margin-right:5px;}
            </style>`;
  }
}
