const XLSX = require('xlsx');
const filePath = 'obras_sociales.xls';
const wb = XLSX.readFile(filePath);

const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('CAJA NOTARIAL'));
if (sheetName) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`Hoja: ${sheetName}`);
  for (let i = 0; i < 30; i++) {
    if (data[i]) {
      console.log(`Fila ${i + 1}:`, data[i]);
    }
  }
} else {
  console.log('No se encontro CAJA NOTARIAL');
}
