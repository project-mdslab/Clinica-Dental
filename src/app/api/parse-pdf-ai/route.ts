import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const osName = formData.get('osName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta configurar GEMINI_API_KEY en el servidor' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `Eres un experto en facturación médica. Analiza este tarifario odontológico de la obra social "${osName}".
Extrae todas las prácticas (tratamientos) con sus precios.
Devuelve la respuesta estrictamente en este formato JSON, como un arreglo de objetos:
[
  {
    "code": "El código del tratamiento (ej. 01.01)",
    "name": "La descripción o nombre de la práctica",
    "price": El arancel/precio total como número (usa punto para decimales, sin símbolos de moneda ni separadores de miles),
    "copay_price": El coseguro a cargo del paciente como número (0 si no hay),
    "coverage_price": El arancel a cargo de la obra social como número (o precio total si no hay coseguro)
  }
]
Si la obra social es "COLEGIO", copay_price será 0 y coverage_price será igual a price.
Asegúrate de extraer TODAS las filas correctamente, respetando las celdas aunque el diseño sea irregular o sin bordes.
No incluyas nada más en tu respuesta que el JSON puro, sin bloques markdown de código (\`\`\`json).`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type || 'application/pdf',
                }
            }
        ],
        config: {
            responseMimeType: 'application/json'
        }
    });

    const text = response.text || '[]';
    let data;
    try {
        data = JSON.parse(text);
    } catch(e) {
        // Fallback cleanup if the model still wrapped it in markdown
        const cleanedText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        data = JSON.parse(cleanedText);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error parsing PDF with AI:', error);
    return NextResponse.json({ error: error.message || 'Error processing the document' }, { status: 500 });
  }
}
