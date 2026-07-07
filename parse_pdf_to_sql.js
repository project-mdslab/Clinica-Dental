const fs = require('fs');

const lines = fs.readFileSync('ocr_data.txt', 'utf8').split('\n');

function parseLine(line) {
    const parts = line.trim().split('$');
    if (parts.length < 3) return null;
    
    const textPart = parts[0].trim();
    let code, name;
    
    let match = textPart.match(/^([0-9\.]+a?b?c?d?e?f?g?h?i?j?)\s+(.*?)\s+(\d+)$/);
    if (match) {
        code = match[1];
        name = match[2].trim();
    } else {
        match = textPart.match(/^([0-9\.]+a?b?c?d?e?f?g?h?i?j?)\s+(.*)$/);
        if (match) {
            code = match[1];
            name = match[2].trim();
        } else {
            return null;
        }
    }
    
    let priceStr;
    if (code.startsWith('11.')) {
        priceStr = (parts.length >= 5) ? parts[4].split(' ')[0] : parts[parts.length-1].split(' ')[0];
    } else {
        priceStr = (parts.length >= 4) ? parts[3].split(' ')[0] : parts[parts.length-1].split(' ')[0];
    }
    
    priceStr = priceStr.replace(/\./g, '');
    const price = parseInt(priceStr);
    if (isNaN(price)) return null;
    
    let category = "General";
    if (code.startsWith('01')) category = "Consultas";
    else if (code.startsWith('02')) category = "Operatoria";
    else if (code.startsWith('03')) category = "Endodoncia";
    else if (code.startsWith('04')) category = "Prótesis";
    else if (code.startsWith('05')) category = "Prevención";
    else if (code.startsWith('06')) category = "Ortodoncia";
    else if (code.startsWith('07')) category = "Odontopediatría";
    else if (code.startsWith('08')) category = "Periodoncia";
    else if (code.startsWith('09')) category = "Radiología";
    else if (code.startsWith('10')) category = "Cirugía";
    else if (code.startsWith('11')) category = "Implantes";
    else if (code.startsWith('13')) category = "Tratamiento TTM";

    return `INSERT INTO public.treatments (code, name, category, colegio_price) VALUES ('${code}', '${name.replace(/'/g, "''")}', '${category}', ${price}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, colegio_price = EXCLUDED.colegio_price;`;
}

let sqlOut = "-- Vaciamos la tabla de tratamientos actual (opcional, pero asegura limpieza)\nDELETE FROM public.treatments;\n\n-- Insertamos los tratamientos completos de Julio a Diciembre 2026\n";

for (const line of lines) {
    const sql = parseLine(line);
    if (sql) {
        sqlOut += sql + '\n';
    }
}

sqlOut += "\n-- Refrescar el caché\nNOTIFY pgrst, 'reload schema';\n";

fs.writeFileSync('seed_colegio_2026.sql', sqlOut, 'utf8');
console.log('Done!');
