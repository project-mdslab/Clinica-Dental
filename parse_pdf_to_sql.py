import re

def parse_line(line):
    # Regex to match:
    # 1. Code (e.g. 01.01 or 01.04a or 04.01.01)
    # 2. Description (everything before the numbers)
    # 3. Numbers at the end
    
    # We want to extract code, name, and the "Arancel" price.
    # Looking at the format: Code Name Time TotalCost Honorarios Arancel Discapacidad
    # For Chapter 11, it is: Code Name Time TotalCost Honorarios Ayudante Arancel
    
    parts = line.strip().split('$')
    if len(parts) < 3:
        return None
    
    # The text before the first $ contains the code, the name, and the time.
    text_part = parts[0].strip()
    match = re.match(r'^([0-9\.]+a?b?c?d?e?f?g?h?i?j?)\s+(.*?)\s+(\d+)$', text_part)
    
    if match:
        code = match.group(1)
        name = match.group(2).strip()
    else:
        # Sometimes there's no time?
        match2 = re.match(r'^([0-9\.]+a?b?c?d?e?f?g?h?i?j?)\s+(.*)$', text_part)
        if match2:
            code = match2.group(1)
            name = match2.group(2).strip()
        else:
            return None

    # The Arancel is typically the 3rd or 4th dollar amount.
    # From the file:
    # Most chapters: 1st=$Total 2nd=$Honorario 3rd=$Arancel 4th=$Discapacidad
    # Chap 11: 1st=$Total 2nd=$Honorario 3rd=$Ayudante 4th=$Arancel
    
    if code.startswith('11.'):
        # Arancel is the 4th item
        if len(parts) >= 5:
            price_str = parts[4].split()[0]
        else:
            price_str = parts[-1].split()[0]
    else:
        # Arancel is the 3rd item
        if len(parts) >= 4:
            price_str = parts[3].split()[0]
        else:
            price_str = parts[-1].split()[0]
            
    # Clean price_str (remove dots)
    price_str = price_str.replace('.', '')
    try:
        price = int(price_str)
    except:
        return None
        
    # Determine category
    category = "General"
    if code.startswith('01'): category = "Consultas"
    elif code.startswith('02'): category = "Operatoria"
    elif code.startswith('03'): category = "Endodoncia"
    elif code.startswith('04'): category = "Prótesis"
    elif code.startswith('05'): category = "Prevención"
    elif code.startswith('06'): category = "Ortodoncia"
    elif code.startswith('07'): category = "Odontopediatría"
    elif code.startswith('08'): category = "Periodoncia"
    elif code.startswith('09'): category = "Radiología"
    elif code.startswith('10'): category = "Cirugía"
    elif code.startswith('11'): category = "Implantes"
    elif code.startswith('13'): category = "Tratamiento TTM"

    return f"INSERT INTO public.treatments (code, name, category, colegio_price) VALUES ('{code}', '{name.replace(chr(39), chr(39)+chr(39))}', '{category}', {price}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, colegio_price = EXCLUDED.colegio_price;"

with open('ocr_data.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('seed_colegio_2026.sql', 'w', encoding='utf-8') as out:
    out.write("-- Vaciamos la tabla de tratamientos actual (opcional, pero asegura limpieza)\\n")
    out.write("DELETE FROM public.treatments;\\n\\n")
    out.write("-- Insertamos los tratamientos completos de Julio a Diciembre 2026\\n")
    for line in lines:
        sql = parse_line(line)
        if sql:
            out.write(sql + '\\n')
    out.write("\\n-- Refrescar el caché\\n")
    out.write("NOTIFY pgrst, 'reload schema';\\n")

print("Generated seed_colegio_2026.sql successfully.")
