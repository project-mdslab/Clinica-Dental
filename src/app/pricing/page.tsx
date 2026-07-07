'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import * as XLSX from 'xlsx';
import AlertDialog from '@/components/AlertDialog';

export default function PricingPage() {
  const supabase = createClient();
  const [insurances, setInsurances] = useState<any[]>([]);
  const [selectedOS, setSelectedOS] = useState<any | 'colegio'>('colegio'); // 'colegio' means Colegio de Odontólogos
  const [treatments, setTreatments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });

  const showAlert = (message: string, title?: string) => {
    setAlertDialog({ isOpen: true, title: title || 'Atención', message, type: 'alert', onConfirm: () => setAlertDialog(prev => ({ ...prev, isOpen: false })), confirmText: 'Aceptar' });
  };

  // Comparator State
  const [showComparator, setShowComparator] = useState(false);
  const [compOS, setCompOS] = useState<any>(null);
  const [compSearchColegio, setCompSearchColegio] = useState('');
  const [compSearchOS, setCompSearchOS] = useState('');
  const [compColegioResults, setCompColegioResults] = useState<any[]>([]);
  const [compOSResults, setCompOSResults] = useState<any[]>([]);
  const [selectedColegioTreat, setSelectedColegioTreat] = useState<any>(null);
  const [selectedOSTreat, setSelectedOSTreat] = useState<any>(null);

  useEffect(() => {
    fetchInsurances();
  }, []);

  useEffect(() => {
    fetchTreatments();
  }, [selectedOS]);

  const fetchInsurances = async () => {
    const { data, error } = await supabase.from('insurances').select('*').order('name');
    if (!error && data) {
      setInsurances(data);
    }
  };

  const fetchTreatments = async () => {
    if (selectedOS === 'colegio') {
      const { data, error } = await supabase.from('treatments').select('*').order('code');
      if (!error && data) setTreatments(data);
    } else if (selectedOS) {
      const { data, error } = await supabase
        .from('insurance_treatments')
        .select('*')
        .eq('insurance_id', selectedOS.id)
        .order('code');
      if (!error && data) setTreatments(data);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        const officialMapping: Record<string, string> = {
          'AMERICA SERVICIOS (57)': 'AMERICA SERVICIOS',
          'AMSTERDAM (60) ': 'AMSTERDAM',
          ' SAN PEDRO (41)': 'ASOC. ECLESIASTICA DE SAN PEDRO',
          'JERARQUICOS SALUD (49)': 'JERARQUICOS SALUD',
          'amupro': 'ASOCIACION MUTUAL DE PROFESIONALES (AMUPRO)',
          'AMUR (9) ': 'ASOCIACION MUTUAL RURALISTA (AMUR)',
          'SANCOR (8)': 'SANCOR MEDICINA PRIVADA',
          'ASSISTRAVEL (86) ': 'ASSISTRAVEL',
          'ACA SALUD (73)': 'AVALIAN - ACA SALUD',
          'CAJA NOTARIAL (54)': 'CAJA NOTARIAL DE ENTRE RIOS',
          'C.S.F.A (89)': 'CIRCULO SUBOFICIALES FUERZA AEREA',
          'CS ECONOMICAS (69)': 'CONSEJO PROF. CS. ECONOMICAS',
          'FEDERADA SALUD (167)': 'FEDERADA SALUD',
          'GALENO (46)': 'GALENO ARGENTINA',
          'IAPSER (84)': 'IAPSER',
          'INTEGRAL SALUD (12)': 'INTEGRAL SALUD',
          'MEDICUS (112)': 'MEDICUS SA',
          'MEDIFE (119)': 'MEDIFE',
          'FUTBOLISTAS (19)': 'OBRA SOCIAL DE FUTBOLISTAS',
          'POL.FEDERAL (139)': 'POLICIA FEDERAL',
          'PODER JUDICIAL (26)': 'PODER JUDICIAL DE LA NACION',
          'OSSEG (51-52)': 'OBRA SOCIAL DEL SEGURO (OSSEG)',
          'OSSEG PROTESIS (50)': 'OBRA SOCIAL DEL SEGURO - PROTESIS',
          'LUIS PASTEUR (91)': 'LUIS PASTEUR',
          'OMINT (92)': 'OMINT',
          'OSPE-UNIMEDICA (191)': 'OSPE UNIMEDICA',
          'PATRONES (5)': 'PATRONES DE CABOTAJE',
          'PREVENCION SALUD (179)': 'PREVENCION SALUD',
          'PROVINCIA ART (71)': 'PROVINCIA ART',
          'SADAIC (97)': 'SADAIC',
          'SANATORIO SANTA FE': 'SANATORIO SANTA FE',
          'S . O . S ': 'SERVICIO ODONTOLOGICO SOLIDARIO',
          'SMEBER(18) ': 'SMEBER',
          'SWISS MEDICAL (58) DOCTHOS (127': 'SWISS MEDICAL & DOCTHOS'
        };

        const validSheets = wb.SheetNames.filter(name => officialMapping[name]);

        if (validSheets.length === 0) throw new Error("No se encontraron hojas válidas.");
        
        let progress = 10;
        const progressStep = 80 / validSheets.length;

        for (const sheetName of validSheets) {
          const osName = officialMapping[sheetName];

          let osId = null;
          const { data: existingOS } = await supabase.from('insurances').select('id').eq('name', osName).single();
          if (existingOS) {
            osId = existingOS.id;
          } else {
            const { data: newOS } = await supabase.from('insurances').insert({ name: osName }).select('id').single();
            if (newOS) osId = newOS.id;
          }

          if (!osId) continue;

          const ws = wb.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          let modality = 'DESCONOCIDO';
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

          let hasCopay = false;
          let headerRowIdx = -1;
          let colArancel = 2; // default
          let colCopay = -1;
          let colCoverage = -1;

          for(let i=0; i<30 && i<rawData.length; i++){
            if (!rawData[i]) continue;
            
            // Convert to a dense array of strings, normalized (no accents, no trailing spaces)
            const rowArr = [];
            for(let j=0; j<rawData[i].length; j++) {
              const cleanStr = (rawData[i][j] || '').toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              rowArr.push(cleanStr);
            }

            if (rowArr.includes('CODIGO') || rowArr.includes('PRESTACION') || rowArr.includes('PRACTICA') || rowArr.includes('ARANCEL') || rowArr.includes('COSEGURO')) {
              headerRowIdx = i;
              for(let j=0; j<rowArr.length; j++){
                 const cell = rowArr[j];
                 if (cell.includes('ARANCEL') || cell.includes('PRECIO')) colArancel = j;
                 if (cell.includes('COSEGURO')) { colCopay = j; hasCopay = true; }
                 if (cell.includes(osName.toUpperCase()) || cell.includes('COBERTURA') || cell.includes('CUBRE')) colCoverage = j;
              }
              break;
            }
          }

          await supabase.from('insurances').update({ has_copay: hasCopay, modality: modality }).eq('id', osId);
          
          const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
          
          // Usamos un Map para evitar duplicados en la misma hoja, lo que hace fallar el batch upsert en Postgres
          const uniqueRowsMap = new Map();

          for (let i = startIdx; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length < 2) continue;

            const possibleCode = row[0]?.toString().trim();
            const possibleName = row[1]?.toString().trim();
            const totalArancel = parseFloat(row[colArancel]?.toString().replace(/[^0-9.-]+/g,"")) || 0;
            const copayPrice = colCopay !== -1 ? (parseFloat(row[colCopay]?.toString().replace(/[^0-9.-]+/g,"")) || 0) : 0;
            const coveragePrice = colCoverage !== -1 ? (parseFloat(row[colCoverage]?.toString().replace(/[^0-9.-]+/g,"")) || 0) : (totalArancel - copayPrice);

            if (possibleCode && possibleName && possibleName.length > 5 && totalArancel > 0) {
              const uniqueKey = `${possibleCode}_${possibleName}`;
              uniqueRowsMap.set(uniqueKey, {
                insurance_id: osId,
                code: possibleCode,
                name: possibleName,
                price: totalArancel,
                coverage_price: coveragePrice,
                copay_price: copayPrice
              });
            }
          }

          const rowsToInsert = Array.from(uniqueRowsMap.values());

          // Batch insert para mejorar velocidad
          if (rowsToInsert.length > 0) {
            for (let k = 0; k < rowsToInsert.length; k += 500) {
              const chunk = rowsToInsert.slice(k, k + 500);
              const { error } = await supabase.from('insurance_treatments').upsert(chunk, { onConflict: 'insurance_id, code, name' });
              if (error) console.error("Error upserting chunk in", osName, error);
            }
          }
          
          progress += progressStep;
          setUploadProgress(Math.round(progress));
        }

        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          fetchInsurances();
          fetchTreatments();
          showAlert("Excel procesado con éxito.", "Éxito");
        }, 1000);

      } catch (err: any) {
        showAlert("Error procesando Excel: " + err.message);
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredTreatments = treatments.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.code && t.code.toLowerCase().includes(search.toLowerCase()))
  );

  // Comparator Logic
  useEffect(() => {
    if (showComparator && compSearchColegio.length > 1) {
      supabase.from('treatments').select('*')
        .ilike('name', `%${compSearchColegio}%`).limit(10)
        .then(({data}) => setCompColegioResults(data || []));
    } else {
      setCompColegioResults([]);
    }
  }, [compSearchColegio, showComparator]);

  useEffect(() => {
    if (showComparator && compOS && compSearchOS.length > 1) {
      supabase.from('insurance_treatments').select('*')
        .eq('insurance_id', compOS.id)
        .ilike('name', `%${compSearchOS}%`).limit(10)
        .then(({data}) => setCompOSResults(data || []));
    } else {
      setCompOSResults([]);
    }
  }, [compSearchOS, showComparator, compOS]);

  return (
    <div className="flex flex-col h-full w-full bg-surface">
      <div className="p-6 sm:px-10 border-b border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Aranceles y Obras Sociales</h1>
          <p className="text-on-surface-variant text-sm mt-1">Nomenclador Oficial y Precios de Coberturas</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowComparator(true)}
            className="flex items-center gap-2 bg-secondary text-on-secondary px-5 py-2.5 rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">compare_arrows</span>
            Comparador
          </button>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".xls,.xlsx" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <button className="flex items-center gap-2 bg-surface-container border border-outline-variant px-5 py-2.5 rounded-full text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined text-[20px]">upload_file</span>
              {isUploading ? `Procesando... ${uploadProgress}%` : 'Subir Excel O.S.'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col">
          <div className="p-6 border-b border-outline-variant/30">
            <h2 className="text-lg font-bold text-on-surface">Listas de Precios</h2>
          </div>
          <div className="overflow-y-auto p-4 flex-1 space-y-2">
            <button
              onClick={() => setSelectedOS('colegio')}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${
                selectedOS === 'colegio' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined">verified</span>
              Colegio de Odontólogos
            </button>
            
            <div className="my-4 border-t border-outline-variant/30"></div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 px-2">Obras Sociales</p>

            {insurances.map(os => (
              <button
                key={os.id}
                onClick={() => setSelectedOS(os)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex flex-col gap-2 ${
                  selectedOS?.id === os.id ? 'bg-primary/10 border border-primary/30 shadow-sm' : 'hover:bg-surface-container-high'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`font-bold ${selectedOS?.id === os.id ? 'text-primary' : 'text-on-surface'}`}>{os.name}</span>
                  <span className="material-symbols-outlined text-[18px] opacity-70">chevron_right</span>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {os.has_copay && (
                    <span className="text-[10px] bg-orange-100 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-full font-bold">
                      Coseguro
                    </span>
                  )}
                  {os.modality === 'CARNET' && (
                    <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                      Carnet
                    </span>
                  )}
                  {os.modality === 'PRESUPUESTO' && (
                    <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                      Autorización Previa
                    </span>
                  )}
                  {os.modality === 'MIXTO' && (
                    <span className="text-[10px] bg-gray-100 text-gray-800 border border-gray-200 px-2 py-0.5 rounded-full font-bold">
                      Mixto
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-surface-container-lowest flex flex-col min-w-0">
          <div className="p-6 border-b border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface/50 backdrop-blur-md sticky top-0 z-10">
            <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">list_alt</span>
              {selectedOS === 'colegio' ? 'Nomenclador Oficial (Privados)' : `Aranceles - ${selectedOS.name}`}
            </h3>
            
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">search</span>
              <input 
                type="text" 
                placeholder="Buscar prestación o código..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-full py-2 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="bg-surface rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container/50">
                  <tr>
                    <th className="py-4 px-6 font-bold text-sm text-on-surface-variant border-b border-outline-variant/30 w-32">Código</th>
                    <th className="py-4 px-6 font-bold text-sm text-on-surface-variant border-b border-outline-variant/30">Prestación</th>
                    {selectedOS === 'colegio' && <th className="py-4 px-6 font-bold text-sm text-on-surface-variant border-b border-outline-variant/30 w-48">Categoría</th>}
                    <th className="py-4 px-6 font-bold text-sm text-on-surface-variant border-b border-outline-variant/30 text-right w-40">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTreatments.length > 0 ? (
                    filteredTreatments.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="py-4 px-6 text-sm font-medium text-on-surface border-b border-outline-variant/30">{t.code || '-'}</td>
                        <td className="py-4 px-6 text-sm text-on-surface border-b border-outline-variant/30">{t.name}</td>
                        {selectedOS === 'colegio' && <td className="py-4 px-6 text-sm text-on-surface-variant border-b border-outline-variant/30">{t.category || '-'}</td>}
                        <td className="py-4 px-6 text-sm font-bold text-primary border-b border-outline-variant/30 text-right">
                          ${(t.colegio_price || t.price || 0).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-on-surface-variant">
                        {search ? 'No se encontraron resultados.' : 'No hay datos cargados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Comparator Modal */}
      {showComparator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest">
              <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">compare_arrows</span>
                Comparador de Presupuestos
              </h2>
              <button onClick={() => setShowComparator(false)} className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-surface">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Panel Colegio */}
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex flex-col">
                  <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">verified</span>
                    Valor Colegio (Privado)
                  </h3>
                  <input 
                    type="text" 
                    placeholder="Buscar práctica en Colegio..." 
                    value={compSearchColegio}
                    onChange={(e) => setCompSearchColegio(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors mb-2"
                  />
                  {compColegioResults.length > 0 && (
                    <div className="border border-outline-variant/30 rounded-xl max-h-40 overflow-y-auto bg-surface shadow-sm mb-4">
                      {compColegioResults.map(r => (
                        <button key={r.id} onClick={() => {setSelectedColegioTreat(r); setCompSearchColegio('');}} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-container border-b border-outline-variant/30 last:border-0">
                          <span className="font-bold">{r.code}</span> - {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedColegioTreat ? (
                    <div className="mt-auto bg-secondary/10 border border-secondary/20 rounded-xl p-4">
                      <p className="text-xs text-secondary font-bold uppercase">Seleccionado</p>
                      <p className="font-medium text-on-surface mt-1">{selectedColegioTreat.code} - {selectedColegioTreat.name}</p>
                      <p className="text-2xl font-bold text-secondary mt-2">${selectedColegioTreat.colegio_price.toLocaleString('es-AR')}</p>
                    </div>
                  ) : (
                    <div className="mt-auto bg-surface-container rounded-xl p-4 flex items-center justify-center text-on-surface-variant text-sm h-24">
                      Ninguna práctica seleccionada
                    </div>
                  )}
                </div>

                {/* Panel Obra Social */}
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex flex-col">
                  <div className="flex flex-col gap-3 mb-4">
                    <h3 className="font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                      Valor Obra Social
                    </h3>
                    <select 
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      value={compOS?.id || ''}
                      onChange={(e) => setCompOS(insurances.find(o => o.id === e.target.value))}
                    >
                      <option value="">Elegir Obra Social...</option>
                      {insurances.map(os => <option key={os.id} value={os.id}>{os.name}</option>)}
                    </select>
                  </div>
                  
                  <input 
                    type="text" 
                    placeholder={compOS ? `Buscar en ${compOS.name}...` : 'Elige una OS primero'} 
                    value={compSearchOS}
                    onChange={(e) => setCompSearchOS(e.target.value)}
                    disabled={!compOS}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors mb-2 disabled:opacity-50"
                  />
                  {compOSResults.length > 0 && (
                    <div className="border border-outline-variant/30 rounded-xl max-h-40 overflow-y-auto bg-surface shadow-sm mb-4">
                      {compOSResults.map(r => (
                        <button key={r.id} onClick={() => {setSelectedOSTreat(r); setCompSearchOS('');}} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-container border-b border-outline-variant/30 last:border-0">
                          <span className="font-bold">{r.code}</span> - {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedOSTreat ? (
                    <div className="mt-auto bg-primary/10 border border-primary/20 rounded-xl p-4">
                      <p className="text-xs text-primary font-bold uppercase">Seleccionado</p>
                      <p className="font-medium text-on-surface mt-1">{selectedOSTreat.code} - {selectedOSTreat.name}</p>
                      <div className="mt-3 bg-surface/50 p-3 rounded-lg border border-outline-variant/30">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-on-surface-variant">Arancel Total OS:</span>
                          <span className="font-bold text-on-surface">${selectedOSTreat.price.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-on-surface-variant">Cubre OS:</span>
                          <span className="font-bold text-primary">${selectedOSTreat.coverage_price.toLocaleString('es-AR')}</span>
                        </div>
                        {selectedOSTreat.copay_price > 0 && (
                          <div className="flex justify-between text-sm border-t border-outline-variant/30 pt-1 mt-1">
                            <span className="font-bold text-orange-600">Coseguro (A cobrar):</span>
                            <span className="font-bold text-orange-600">${selectedOSTreat.copay_price.toLocaleString('es-AR')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto bg-surface-container rounded-xl p-4 flex items-center justify-center text-on-surface-variant text-sm h-24">
                      Ninguna práctica seleccionada
                    </div>
                  )}
                </div>

              </div>
              
              {selectedColegioTreat && selectedOSTreat && (
                <div className="mt-6 bg-error/10 border border-error/20 rounded-2xl p-6 text-center">
                  <p className="text-on-surface-variant">Diferencia a cargo del paciente (Brecha + Coseguro):</p>
                  <p className="text-4xl font-bold text-error mt-2">
                    ${(Math.max(0, selectedColegioTreat.colegio_price - selectedOSTreat.price) + (selectedOSTreat.copay_price || 0)).toLocaleString('es-AR')}
                  </p>
                  <p className="text-sm text-error/80 mt-2">
                    Brecha con Colegio: ${Math.max(0, selectedColegioTreat.colegio_price - selectedOSTreat.price).toLocaleString('es-AR')} 
                    {selectedOSTreat.copay_price > 0 ? ` + Coseguro: $${selectedOSTreat.copay_price.toLocaleString('es-AR')}` : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog 
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
        onConfirm={alertDialog.onConfirm}
        onCancel={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText={alertDialog.confirmText}
      />
    </div>
  );
}
