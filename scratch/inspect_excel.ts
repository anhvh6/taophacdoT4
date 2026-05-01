import * as XLSX from 'xlsx';
import * as fs from 'fs';

const excelPath = 'd:\\Lap trinh\\Taophacdo\\QLKH_SupaBase (1).xlsx';

try {
  const content = fs.readFileSync(excelPath);
  const workbook = XLSX.read(content, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'customers') || workbook.SheetNames[0];
  console.log('Using sheet:', sheetName);
  const sheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('Headers:');
  console.log(data[0]);
  
  if (data.length > 1) {
    console.log('First row of data:');
    console.log(data[1]);
  }
} catch (e) {
  console.error("Error reading excel file:", e);
}
