const XLSX = require('xlsx');
const filePath = 'obras_sociales.xls';
const wb = XLSX.readFile(filePath);
console.log(wb.SheetNames);
