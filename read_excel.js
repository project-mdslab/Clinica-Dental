const XLSX = require('xlsx');
const filePath = 'obras_sociales.xls';
const wb = XLSX.readFile(filePath);

const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('convenios cop')) || wb.SheetNames[2];
const ws = wb.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log(`Hoja: ${sheetName}`);
for (let i = 0; i < 30; i++) {
  if (data[i]) {
    console.log(`Fila ${i + 1}:`, data[i]);
  }
}
