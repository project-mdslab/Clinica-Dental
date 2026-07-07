const XLSX = require('xlsx');
const filePath = 'obras_sociales.xls';
const wb = XLSX.readFile(filePath);

const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('AMUR'));
if (sheetName) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  for (let i = 20; i < 40; i++) {
    if (data[i]) {
      console.log(`Fila ${i}:`, data[i]);
    }
  }
}
