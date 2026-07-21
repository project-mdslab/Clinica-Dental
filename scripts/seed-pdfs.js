const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Shim DOMMatrix for Node.js
global.DOMMatrix = class DOMMatrix {
  constructor() {
    this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
  }
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const officialMapping = {
  'AMERICA': 'AMERICA SERVICIOS',
  'AMSTERDAM': 'AMSTERDAM',
  'SAN-PEDRO': 'ASOC. ECLESIASTICA DE SAN PEDRO',
  'JERARQUICOS': 'JERARQUICOS SALUD',
  'AMUPRO': 'ASOCIACION MUTUAL DE PROFESIONALES (AMUPRO)',
  'AMUR': 'ASOCIACION MUTUAL RURALISTA (AMUR)',
  'SANCOR': 'SANCOR MEDICINA PRIVADA',
  'ASSISTRAVEL': 'ASSISTRAVEL',
  'AVALIAN': 'AVALIAN - ACA SALUD',
  'ACA SALUD': 'AVALIAN - ACA SALUD',
  'CAJA-NOTARIAL': 'CAJA NOTARIAL DE ENTRE RIOS',
  'CSFA': 'CIRCULO SUBOFICIALES FUERZA AEREA',
  'CS ECONOMICAS': 'CONSEJO PROF. CS. ECONOMICAS',
  'FEDERADA': 'FEDERADA SALUD',
  'GALENO': 'GALENO ARGENTINA',
  'IAPSER': 'IAPSER',
  'INTEGRAL': 'INTEGRAL SALUD',
  'MEDICUS': 'MEDICUS SA',
  'MEDIFE': 'MEDIFE',
  'FUTBOLISTAS': 'OBRA SOCIAL DE FUTBOLISTAS',
  'POLICIA': 'POLICIA FEDERAL',
  'PODER-JUDICIAL': 'PODER JUDICIAL DE LA NACION',
  'OSSEG': 'OBRA SOCIAL DEL SEGURO (OSSEG)',
  'OSSEG-PROTESIS': 'OBRA SOCIAL DEL SEGURO - PROTESIS',
  'PASTEUR': 'LUIS PASTEUR',
  'OMINT': 'OMINT',
  'OSPE': 'OSPE UNIMEDICA',
  'PATRONES': 'PATRONES DE CABOTAJE',
  'PREVENCION': 'PREVENCION SALUD',
  'PROVINCIA': 'PROVINCIA ART',
  'SADAIC': 'SADAIC',
  'SANATORIO SANTA FE': 'SANATORIO SANTA FE',
  'SSF': 'SANATORIO SANTA FE',
  'SOS': 'SERVICIO ODONTOLOGICO SOLIDARIO',
  'SMEBER': 'SMEBER',
  'SWISS-MEDICAL': 'SWISS MEDICAL & DOCTHOS'
};

async function seed() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  const directoryPath = path.join(__dirname, '../data/obras_sociales');
  const files = fs.readdirSync(directoryPath).filter(f => f.toLowerCase().endsWith('.pdf'));

  console.log(`Found ${files.length} PDF files.`);

  for (const file of files) {
    let fileName = file.replace(/\.[^/.]+$/, "").toUpperCase();
    let isColegio = fileName.includes('COLEGIO');
    let osName = '';
    
    if (!isColegio) {
      for (const key of Object.keys(officialMapping)) {
        if (fileName.includes(key)) {
          osName = officialMapping[key];
          break;
        }
      }
    }

    if (!isColegio && !osName) {
      console.warn(`Archivo ignorado: ${file}`);
      continue;
    }

    console.log(`Processing ${file} -> ${osName || 'COLEGIO'}`);

    let osId = null;
    if (!isColegio) {
      const { data: existingOS } = await supabase.from('insurances').select('id').eq('name', osName).single();
      if (existingOS) {
        osId = existingOS.id;
      } else {
        const { data: newOS } = await supabase.from('insurances').insert({ name: osName }).select('id').single();
        if (newOS) osId = newOS.id;
      }
      if (!osId) continue;
    }

    try {
      const filePath = path.join(directoryPath, file);
      const dataBuffer = new Uint8Array(fs.readFileSync(filePath));
      const pdf = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
      
      let rawData = [];
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const rows = {};
        textContent.items.forEach((item) => {
          const y = Math.round(item.transform[5]);
          let matchedY = Object.keys(rows).find(existingY => Math.abs(parseInt(existingY) - y) <= 3);
          if (!matchedY) matchedY = y.toString();
          
          if (!rows[matchedY]) rows[matchedY] = [];
          rows[matchedY].push({ text: item.str, x: item.transform[4] });
        });
        
        const sortedYs = Object.keys(rows).sort((a, b) => parseInt(b) - parseInt(a));
        
        for (const y of sortedYs) {
          rows[y].sort((a, b) => a.x - b.x);
          
          const rowArray = [];
          let currentCellText = '';
          let lastX = -1;

          rows[y].forEach((item) => {
            if (lastX === -1) {
              currentCellText = item.text.trim();
            } else {
              if (item.x - lastX < 20) {
                currentCellText += ' ' + item.text.trim();
              } else {
                if (currentCellText) rowArray.push(currentCellText.trim());
                currentCellText = item.text.trim();
              }
            }
            lastX = item.x + (item.text.length * 5); 
          });
          
          if (currentCellText) rowArray.push(currentCellText.trim());
          if (rowArray.length > 0) rawData.push(rowArray);
        }
      }
      
      let modality = 'DESCONOCIDO';
      if (!isColegio) {
        for(let i=0; i<15 && i<rawData.length; i++){
          const rowText = rawData[i].join(' ').toUpperCase();
          if (rowText.includes('MODALIDAD')) {
            if (rowText.includes('CARNET') && !rowText.includes('PRESUPUESTO') && !rowText.includes('AUTORIZACION')) {
              modality = 'CARNET';
            } else if ((rowText.includes('PRESUPUESTO') || rowText.includes('AUTORIZACION')) && !rowText.includes('CARNET')) {
              modality = 'PRESUPUESTO';
            } else if (rowText.includes('CARNET') && (rowText.includes('PRESUPUESTO') || rowText.includes('AUTORIZACION'))) {
              modality = 'MIXTO';
            }
          }
        }
      }

      let hasCopay = false;
      let headerRowIdx = -1;
      let colArancel = 2; // default
      let colCopay = -1;
      let colCoverage = -1;

      for(let i=0; i<30 && i<rawData.length; i++){
        if (!rawData[i]) continue;
        const rowArr = rawData[i].map(x => (x || '').toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
        
        if (rowArr.includes('CODIGO') || rowArr.includes('PRESTACION') || rowArr.includes('PRACTICA') || rowArr.includes('ARANCEL') || rowArr.includes('COSEGURO')) {
          headerRowIdx = i;
          for(let j=0; j<rowArr.length; j++){
              const cell = rowArr[j];
              if (cell.includes('ARANCEL') || cell.includes('PRECIO')) colArancel = j;
              if (cell.includes('COSEGURO')) { colCopay = j; hasCopay = true; }
              if (!isColegio && (cell.includes(osName.toUpperCase()) || cell.includes('COBERTURA') || cell.includes('CUBRE'))) colCoverage = j;
          }
          break;
        }
      }

      if (!isColegio) {
        await supabase.from('insurances').update({ has_copay: hasCopay, modality: modality }).eq('id', osId);
      }
      
      const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
      const uniqueRowsMap = new Map();

      for (let i = startIdx; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length < 2) continue;

        const possibleCode = row[0]?.toString().trim();
        const possibleName = row[1]?.toString().trim();
        const totalArancel = parseFloat(row[colArancel]?.toString().replace(/[^0-9.-]+/g,"")) || 0;
        
        if (isColegio) {
          if (possibleCode && possibleName && possibleName.length > 5 && totalArancel > 0) {
            const uniqueKey = `${possibleCode}_${possibleName}`;
            uniqueRowsMap.set(uniqueKey, { code: possibleCode, name: possibleName, price: totalArancel });
          }
        } else {
          const copayPrice = colCopay !== -1 ? (parseFloat(row[colCopay]?.toString().replace(/[^0-9.-]+/g,"")) || 0) : 0;
          const coveragePrice = colCoverage !== -1 ? (parseFloat(row[colCoverage]?.toString().replace(/[^0-9.-]+/g,"")) || 0) : (totalArancel - copayPrice);

          if (possibleCode && possibleName && possibleName.length > 5 && totalArancel > 0) {
            const uniqueKey = `${possibleCode}_${possibleName}`;
            uniqueRowsMap.set(uniqueKey, {
              insurance_id: osId, code: possibleCode, name: possibleName,
              price: totalArancel, coverage_price: coveragePrice, copay_price: copayPrice
            });
          }
        }
      }

      const rowsToInsert = Array.from(uniqueRowsMap.values());
      console.log(`Found ${rowsToInsert.length} valid rows for ${file}`);

      if (rowsToInsert.length > 0) {
        for (let k = 0; k < rowsToInsert.length; k += 500) {
          const chunk = rowsToInsert.slice(k, k + 500);
          const tableName = isColegio ? 'treatments' : 'insurance_treatments';
          const onConflict = isColegio ? 'code' : 'insurance_id, code, name';
          const { error } = await supabase.from(tableName).upsert(chunk, { onConflict });
          if (error) console.error("Error upserting chunk", error);
        }
      }
    } catch (err) {
      console.error("Error parsing", file, err.message);
    }
  }
  console.log("Done seeding PDFs!");
}

seed();
