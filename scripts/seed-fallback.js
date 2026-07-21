const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

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
    if (!isColegio && !osName) continue;

    let osId = null;
    if (!isColegio) {
      const { data: existingOS } = await supabase.from('insurances').select('id').eq('name', osName).single();
      if (existingOS) osId = existingOS.id;
      if (!osId) continue;
    }

    try {
      const filePath = path.join(directoryPath, file);
      const dataBuffer = new Uint8Array(fs.readFileSync(filePath));
      const pdf = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
      
      let fullText = '';
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
          const line = rows[y].map(item => item.text.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
          fullText += line + '\n';
        }
      }

      // Fallback regex parser for missing lines
      const codeRegex = /(?:^|\s)(\d{2}\.\d{2}(?:\.\d{2})?)\s+(.*?)\s+([\d.,]+)(?:\s|$)/g;
      const uniqueRowsMap = new Map();

      let match;
      while ((match = codeRegex.exec(fullText)) !== null) {
        let code = match[1].trim();
        let name = match[2].trim();
        let priceStr = match[3];

        if (name.length < 4) continue;
        
        // Handle price correctly
        let priceNum = 0;
        if (priceStr.includes(',') && priceStr.includes('.')) {
          // Has both (e.g. 25.310,19)
          let cleanStr = priceStr;
          if (cleanStr.lastIndexOf(',') > cleanStr.lastIndexOf('.')) {
            // Comma is decimal
            cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
          } else {
            // Dot is decimal
            cleanStr = cleanStr.replace(/,/g, '');
          }
          priceNum = parseFloat(cleanStr);
        } else if (priceStr.includes(',')) {
          // Only comma (e.g. 25310,19)
          priceNum = parseFloat(priceStr.replace(',', '.'));
        } else {
          // Only dot or nothing
          priceNum = parseFloat(priceStr);
        }

        if (priceNum > 0) {
            const uniqueKey = `${code}_${name}`;
            if (isColegio) {
              uniqueRowsMap.set(uniqueKey, { code, name, price: priceNum });
            } else {
              uniqueRowsMap.set(uniqueKey, {
                insurance_id: osId, code, name,
                price: priceNum, coverage_price: priceNum, copay_price: 0
              });
            }
        }
      }

      const rowsToInsert = Array.from(uniqueRowsMap.values());

      if (rowsToInsert.length > 0) {
        // Fetch existing count
        const tableName = isColegio ? 'treatments' : 'insurance_treatments';
        const { data: existingData } = await supabase.from(tableName).select('id').eq(isColegio ? 'code' : 'insurance_id', isColegio ? undefined : osId);
        
        if (existingData && existingData.length < rowsToInsert.length) {
            console.log(`Inserting ${rowsToInsert.length} rows for ${file} (Regex fallback)`);
            for (let k = 0; k < rowsToInsert.length; k += 500) {
              const chunk = rowsToInsert.slice(k, k + 500);
              const onConflict = isColegio ? 'code' : 'insurance_id, code, name';
              const { error } = await supabase.from(tableName).upsert(chunk, { onConflict });
              if (error) console.error("Error upserting chunk", error);
            }
        } else if (!existingData || existingData.length === 0) {
            console.log(`Inserting ${rowsToInsert.length} rows for ${file} (Regex fallback)`);
            for (let k = 0; k < rowsToInsert.length; k += 500) {
              const chunk = rowsToInsert.slice(k, k + 500);
              const onConflict = isColegio ? 'code' : 'insurance_id, code, name';
              const { error } = await supabase.from(tableName).upsert(chunk, { onConflict });
              if (error) console.error("Error upserting chunk", error);
            }
        }
      } else {
        // console.log(`No rows extracted for ${file}`);
      }
    } catch (err) {
      console.error("Error parsing", file, err.message);
    }
  }
  console.log("Fallback script done.");
}

seed();
