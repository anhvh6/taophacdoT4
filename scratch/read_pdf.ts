import fs from 'fs';
const pdfParse = require('pdf-parse');

async function parsePDFs() {
  const files = [
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao 2.pdf',
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao 3.pdf',
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao.pdf'
  ];

  for (const file of files) {
    console.log(`\n--- Reading ${file} ---`);
    try {
      const dataBuffer = fs.readFileSync(file);
      const data = await pdfParse(dataBuffer);
      console.log(data.text.substring(0, 1000)); // Just the first 1000 chars to see what it is
    } catch (e) {
      console.error('Error parsing', file, e.message);
    }
  }
}

parsePDFs();
