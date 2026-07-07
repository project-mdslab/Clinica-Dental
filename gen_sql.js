const fs = require('fs');

const nomenclador = [
  { code: '01.01', name: 'Primera consulta', category: 'Consultas', price: 38000 },
  { code: '01.05', name: 'Consulta ulterior', category: 'Consultas', price: 26000 },
  { code: '01.04a', name: 'Medicación', category: 'Consultas', price: 38000 },
  { code: '01.04b', name: 'Tratamiento Pulpitis aguda', category: 'Consultas', price: 80000 },
  { code: '01.04c', name: 'Tratamiento Necrosis / Gangrena', category: 'Consultas', price: 86000 },
  { code: '01.04d', name: 'Tratamiento Abscesos agudos', category: 'Consultas', price: 64000 },
  { code: '01.04e', name: 'Tratamiento Alveolitis y Hemorragias', category: 'Consultas', price: 70000 },
  { code: '01.04f', name: 'Tratamiento GUNA y PUNA', category: 'Consultas', price: 58000 },
  { code: '01.04g', name: 'Tratamiento traum. dent. sin expos. pulpar', category: 'Consultas', price: 105000 },
  { code: '01.04h', name: 'Tratamiento traum. dent. con expos. pulpar', category: 'Consultas', price: 110000 },
  { code: '01.04i', name: 'Tratamiento traum. dent. con lux. o avulsión', category: 'Consultas', price: 116000 },
  { code: '01.04j', name: 'Prótesis fijas descementadas', category: 'Consultas', price: 67000 },
  
  { code: '02.01', name: 'Amalgama simple', category: 'Operatoria', price: 97000 },
  { code: '02.02', name: 'Amalgama compuesta', category: 'Operatoria', price: 108000 },
  { code: '02.03', name: 'Amalgama compleja', category: 'Operatoria', price: 119000 },
  { code: '02.04', name: 'Amalgama con refuerzo metálico', category: 'Operatoria', price: 132000 },
  { code: '02.09', name: 'Reconstrucción de ángulo', category: 'Operatoria', price: 179000 },
  { code: '02.15', name: 'Restauración estética simple', category: 'Operatoria', price: 94000 },
  { code: '02.16', name: 'Restauración estética compuesta', category: 'Operatoria', price: 121000 },
  { code: '02.17', name: 'Restauración estética compleja', category: 'Operatoria', price: 174000 },
  { code: '02.18', name: 'Blanqueamiento interno x pieza dentaria', category: 'Operatoria', price: 390000 },
  { code: '02.19', name: 'Blanqueamiento ext.consul x sesión', category: 'Operatoria', price: 555000 },
  { code: '02.20', name: 'Blanqueamiento ambulatorio', category: 'Operatoria', price: 559000 },

  { code: '03.01', name: 'Endodoncia 1 conducto', category: 'Endodoncia', price: 204000 },
  { code: '03.02', name: 'Endodoncia 2 conductos', category: 'Endodoncia', price: 269000 },
  { code: '03.03', name: 'Endodoncia 3 conductos', category: 'Endodoncia', price: 384000 },
  { code: '03.04', name: 'Endodoncia 4 conductos', category: 'Endodoncia', price: 497000 },
  { code: '03.05', name: 'Endodoncia parcial', category: 'Endodoncia', price: 115000 },
  { code: '03.06', name: 'Desobturación p/ tratamiento o retratamiento', category: 'Endodoncia', price: 139000 },
  { code: '03.07', name: 'Protección pulpar directa', category: 'Endodoncia', price: 85000 },

  { code: '04.01.01', name: 'Incrustación Metálica', category: 'Prótesis', price: 340000 },
  { code: '04.01.02', name: 'Incrustación Resina fotocurado', category: 'Prótesis', price: 382000 },
  { code: '04.01.03', name: 'Incrustación Porcelana', category: 'Prótesis', price: 511000 },
  { code: '04.01.10', name: 'Perno colado simple directo', category: 'Prótesis', price: 320000 },
  { code: '04.01.11', name: 'Perno colado simple indirecto', category: 'Prótesis', price: 265000 },
  { code: '04.01.12', name: 'Perno colado comp. (secc. o pasante) indirecto', category: 'Prótesis', price: 310000 },
  { code: '04.01.13', name: 'Perno preformado simple', category: 'Prótesis', price: 158000 },
  { code: '04.01.14', name: 'Perno preformado compuesto (doble)', category: 'Prótesis', price: 197000 },
  { code: '04.01.15', name: 'Perno O-Ring (a bola) colado', category: 'Prótesis', price: 378000 },
  { code: '04.01.20', name: 'Corona forjada', category: 'Prótesis', price: 249000 },
  { code: '04.01.21', name: 'Corona colada', category: 'Prótesis', price: 468000 },
  { code: '04.01.22', name: 'Corona Veener', category: 'Prótesis', price: 494000 },
  { code: '04.01.23', name: 'Corona acrílico', category: 'Prótesis', price: 273000 },
  { code: '04.01.24', name: 'Corona composite', category: 'Prótesis', price: 440000 },
  { code: '04.01.25', name: 'Corona porcelana sobre metal', category: 'Prótesis', price: 674000 },
  { code: '04.01.26', name: 'Corona de porcelana SIN metal', category: 'Prótesis', price: 927000 },
  { code: '04.01.27', name: 'Corona provisoria de policarbonato', category: 'Prótesis', price: 124000 },
  { code: '04.01.28a', name: 'Tramo de puente de porcelana sobre metal', category: 'Prótesis', price: 249000 },
  { code: '04.01.28b', name: 'Tramo de puente de porcelana SIN metal', category: 'Prótesis', price: 326000 },
  { code: '04.01.30', name: 'Extracción de corona', category: 'Prótesis', price: 134000 },
  { code: '04.01.31', name: 'Extracción de perno', category: 'Prótesis', price: 129000 },
  { code: '04.02.01', name: 'PPR Acrílico - de 5 dientes', category: 'Prótesis', price: 503000 },
  { code: '04.02.02', name: 'PPR Acrílico - de 5 dientes o +', category: 'Prótesis', price: 592000 },
  { code: '04.02.03', name: 'PPR Flexible (de nylon)', category: 'Prótesis', price: 610000 },
  { code: '04.02.04', name: 'PPR Cromo Cobalto - de 5 dientes', category: 'Prótesis', price: 847000 },
  { code: '04.02.05', name: 'PPR Cromo Cobalto - de 5 dientes o +', category: 'Prótesis', price: 900000 },
  { code: '04.02.10', name: 'P. Completa Acrílico', category: 'Prótesis', price: 817000 },
  { code: '04.02.11', name: 'P. Completa Nylon (flexibles)', category: 'Prótesis', price: 868000 },
  { code: '04.02.12', name: 'P. Completa Acrílico con base Cr. Co.', category: 'Prótesis', price: 1068000 },
  { code: '04.03.01', name: 'Compostura simple', category: 'Prótesis', price: 99000 },
  { code: '04.03.02', name: 'Compostura comp. o con ref. metálico', category: 'Prótesis', price: 101000 },
  { code: '04.03.03', name: 'Agregado de retenedor', category: 'Prótesis', price: 103000 },
  { code: '04.03.04', name: 'Agregado de diente', category: 'Prótesis', price: 103000 },
  { code: '04.03.05', name: 'Agregado de diente subsig.', category: 'Prótesis', price: 51000 },
  { code: '04.03.06', name: 'Soldadura de Cromo Cobalto', category: 'Prótesis', price: 112000 },
  { code: '04.03.07', name: 'Soldadura de Cromo Cobalto subs.', category: 'Prótesis', price: 105000 },
  { code: '04.03.08', name: 'Rebasado Pr. Comp. autoc.', category: 'Prótesis', price: 105000 },
  { code: '04.03.09', name: 'Rebasado Pr. Comp. termoc.', category: 'Prótesis', price: 203000 },
  { code: '04.03.10', name: 'Rebasado P.P.R. autocurado', category: 'Prótesis', price: 120000 },

  { code: '05.01', name: 'Tartrectomía, cep.mecánico ambas arcadas', category: 'Prevención', price: 85000 },
  { code: '05.02', name: 'Topicación de flúor', category: 'Prevención', price: 56000 },
  { code: '05.03', name: 'Inactivación caries activa', category: 'Prevención', price: 113000 },
  { code: '05.04', name: 'Educación para la salud', category: 'Prevención', price: 97000 },
  { code: '05.05', name: 'Sellador de puntos y fisuras', category: 'Prevención', price: 68000 },
  { code: '05.06', name: 'Inactivación caries incipiente', category: 'Prevención', price: 52000 },

  { code: '06.01.00', name: 'Primera consulta de Ortodoncia/ Ortopedia', category: 'Ortodoncia', price: 72000 },
  { code: '06.01.01', name: 'Consulta diagnostico (modelos, fotos, etc)', category: 'Ortodoncia', price: 122000 },
  { code: '06.02.00', name: 'Trat. Dent. Primaria/mixta (ortopedia)', category: 'Ortodoncia', price: 3588000 },
  { code: '06.03.00', name: 'Trat. Dent. Permanente (ortodoncia)', category: 'Ortodoncia', price: 5160000 },
  { code: '06.03.01', name: 'Corrección de mal posiciones simples con espacio', category: 'Ortodoncia', price: 1246000 },
  { code: '06.04.01', name: 'Contención fija o removible ambos maxilares', category: 'Ortodoncia', price: 334000 },
  { code: '06.05.00', name: 'Reparacion de aparatología removible', category: 'Ortodoncia', price: 167000 },

  { code: '07.01', name: 'Motivación', category: 'Odontopediatría', price: 97000 },
  { code: '07.03', name: 'Coronas / bandas forjadas', category: 'Odontopediatría', price: 185000 },
  { code: '07.04', name: 'Mantenedor de espacio, fijo', category: 'Odontopediatría', price: 188000 },
  { code: '07.05', name: 'Mantenedor de espacio, removible', category: 'Odontopediatría', price: 203000 },
  { code: '07.06', name: 'Reducción luxación', category: 'Odontopediatría', price: 192000 },
  { code: '07.10', name: 'Endodoncia parcial en niños', category: 'Odontopediatría', price: 121000 },

  { code: '08.01', name: 'Historia clínica periodontal', category: 'Periodoncia', price: 74000 },
  { code: '08.02', name: 'Tratamiento supragingival, ambos maxilares', category: 'Periodoncia', price: 84000 },
  { code: '08.03', name: 'Tratamiento subgingival, por sector', category: 'Periodoncia', price: 115000 },
  { code: '08.04', name: 'Cirugía periodontal, por sector', category: 'Periodoncia', price: 154000 },
  { code: '08.05', name: 'Desgaste selectivo, por sesión', category: 'Periodoncia', price: 84000 },

  { code: '09.01.01', name: 'Radiografía periapical', category: 'Radiología', price: 36000 },
  { code: '09.01.04', name: 'Radiografía seriada 1 arcada (5 a 7 placas)', category: 'Radiología', price: 62000 },
  { code: '09.01.05', name: 'Radiografía seriada 1 arcada (10 a 14 placas)', category: 'Radiología', price: 92000 },
  { code: '09.01.06', name: 'Radiografía oclusal', category: 'Radiología', price: 47000 },

  { code: '10.01', name: 'Exodoncia simple', category: 'Cirugía', price: 80000 },
  { code: '10.02', name: 'Plástica de comunicación buco-sinusal', category: 'Cirugía', price: 81000 },
  { code: '10.03', name: 'Biopsia por punción o aspiración', category: 'Cirugía', price: 121000 },
  { code: '10.04', name: 'Exodoncia compleja (quirúrgica)', category: 'Cirugía', price: 134000 },
  { code: '10.05', name: 'Reimplante dentario inmediato al trauma', category: 'Cirugía', price: 316000 },
  { code: '10.06', name: 'Drenaje absceso, vía bucal', category: 'Cirugía', price: 190000 },
  { code: '10.07', name: 'Biopsia por escisión', category: 'Cirugía', price: 177000 },
  { code: '10.08', name: 'Alargamiento quir. de corona clínica o decapuchonaje', category: 'Cirugía', price: 85000 },
  { code: '10.09a', name: 'Extracción retención mucosa', category: 'Cirugía', price: 318000 },
  { code: '10.09b', name: 'Extracción retención ósea', category: 'Cirugía', price: 434000 },
  { code: '10.10', name: 'Germectomía', category: 'Cirugía', price: 422000 },
  { code: '10.11', name: 'Lib. dientes retenidos con colgajo y ostectomia', category: 'Cirugía', price: 319000 },
  { code: '10.12', name: 'Apicectomía', category: 'Cirugía', price: 419000 },
  { code: '10.13', name: 'Frenectomia', category: 'Cirugía', price: 215000 },

  { code: '11.01', name: 'Téc. quirúrgica simple: coloc. de un implante', category: 'Implantes', price: 945000 },
  { code: '11.02', name: 'Téc. de regeneración ósea guiada ROG (inmediata)', category: 'Implantes', price: 294000 },
  { code: '11.03', name: 'Técnica de regeneración ósea guiada ROG para la colocacion diferida de un implante', category: 'Implantes', price: 697000 },

  { code: '13.01', name: 'Consulta Diagnótica', category: 'Tratamiento TTM', price: 101000 },
  { code: '13.02', name: 'Dispositivo interoclusal', category: 'Tratamiento TTM', price: 265000 },
  { code: '13.03', name: 'Controles', category: 'Tratamiento TTM', price: 70000 }
];

let sql = `-- Nomenclador Colegio Odontologos (Julio - Diciembre 2026)\n\n`;

for (const t of nomenclador) {
  // Upsert to treatments table based on code
  sql += `
INSERT INTO treatments (code, name, category, colegio_price) 
VALUES ('${t.code}', '${t.name}', '${t.category}', ${t.price})
ON CONFLICT (id) DO NOTHING; -- We actually need an index on code if we want to upsert by code, but let's assume table is empty or just insert.
`;
}

// Since ID is UUID and code is not explicitly UNIQUE, doing ON CONFLICT is hard if not UNIQUE.
// Wait, we should just DELETE all treatments and insert them fresh to be safe, or just insert them.
// Let's create a script that just inserts them. Wait, if code is not UNIQUE, it will duplicate. Let's make code UNIQUE.
let finalSql = `-- 1. Hacer el campo 'code' UNIQUE para evitar duplicados\n`;
finalSql += `ALTER TABLE treatments DROP CONSTRAINT IF EXISTS treatments_code_key;\n`;
finalSql += `ALTER TABLE treatments ADD CONSTRAINT treatments_code_key UNIQUE (code);\n\n`;

finalSql += `-- 2. Insertar Nomenclador\n`;
for (const t of nomenclador) {
  finalSql += `INSERT INTO treatments (code, name, category, colegio_price) VALUES ('${t.code}', '${t.name}', '${t.category}', ${t.price}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, colegio_price = EXCLUDED.colegio_price;\n`;
}

fs.writeFileSync('seed_nomenclador.sql', finalSql);
console.log("Generado seed_nomenclador.sql");
