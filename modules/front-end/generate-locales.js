const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const fs = require('fs').promises;
const path = require('path');

const targetLocales = ['zh'];
const localeBasePath = './src/locale';
(async () => {
  const attributeNamePrefix = "@_";
  const options = {
    ignoreAttributes: false,
    attributeNamePrefix,
    format: true
  };
  const builder = new XMLBuilder(options);
  const parser = new XMLParser(options);

  const sourceXlf = await fs.readFile(path.join(localeBasePath, 'messages.xlf'), { encoding: 'utf8' });
  const sourceObjecct = parser.parse(sourceXlf);
  const transUnits = sourceObjecct.xliff.file.body['trans-unit'];

  for(let targetLocale of targetLocales) {
    let targetXlf = '';
    let targetObject = '';
    let targetTransUnits = '';
    try {
      targetXlf = await fs.readFile(path.join(localeBasePath, `messages.${targetLocale}.xlf`), { encoding: 'utf8' });
      const targetObject = parser.parse(targetXlf);
      targetTransUnits = targetObject.xliff.file.body['trans-unit'];
    } catch (error) {
      targetTransUnits = [];
    }

    const translatedUnits = transUnits.map((transUnit) => {
      const targetTransUnit = targetTransUnits.find(x => x[`${attributeNamePrefix}id`] === transUnit[`${attributeNamePrefix}id`]);
      if (targetTransUnit) {
        transUnit[`target`] = targetTransUnit['target'];
      } else {
        transUnit[`target`] = '';
      }

      return transUnit;
    })

    const translatedObject = { ...sourceObjecct };
    translatedObject.xliff.file[`${attributeNamePrefix}source-language`] = targetLocale;
    translatedObject.xliff.file.body['trans-unit'] = translatedUnits;
    const translatedXlf = builder.build(translatedObject);

    await fs.writeFile(path.join(localeBasePath, `messages.${targetLocale}.xlf`), translatedXlf);
    console.log(`Done messages.${targetLocale}.xlf`);
  }
})();

