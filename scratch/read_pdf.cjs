const fs = require('fs');
const pdfParse = require('pdf-parse');

console.log(typeof pdfParse, Object.keys(pdfParse));

async function parsePDFs() {
  const file = 'd:/Lap trinh/Taophacdo/Bao cao/bao cao.pdf';
  const dataBuffer = fs.readFileSync(file);
  let data;
  if (typeof pdfParse === 'function') {
      data = await pdfParse(dataBuffer);
  } else if (pdfParse.default) {
      data = await pdfParse.default(dataBuffer);
  } else if (pdfParse.pdf) {
      data = await pdfParse.pdf(dataBuffer);
  }
  console.log(data.text.substring(0, 1000));
}

parsePDFs();
