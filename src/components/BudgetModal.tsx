"use client";

import { useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { createClient } from "@/utils/supabase/client";
import { useEffect } from "react";

interface BudgetItem {
  description: string;
  quantity: number;
  value: number;
}

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
}

export default function BudgetModal({ isOpen, onClose, patientName }: BudgetModalProps) {
  const [items, setItems] = useState<BudgetItem[]>([{ description: "", quantity: 1, value: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    beneficiary: "Titular de la Cuenta",
    bank: "Banco",
    cbu: "0000000000000000000000",
    alias: "clinica.dental.alias",
    cuit: "00-00000000-0"
  });
  const pdfRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      const fetchSettings = async () => {
        const { data } = await supabase.from('clinic_settings').select('value').eq('key', 'bank_details').single();
        if (data && data.value) {
          setBankDetails(data.value as any);
        }
      };
      fetchSettings();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => setItems([...items, { description: "", quantity: 1, value: 0 }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof BudgetItem, val: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
    setItems(newItems);
  };

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.value), 0);
  const total = subtotal - discount;
  const dateStr = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const generatePDF = async () => {
    if (!pdfRef.current) return;
    setIsGenerating(true);
    
    try {
      const element = pdfRef.current;
      
      // Temporarily remove scaling for the capture so the resolution is perfect
      const originalTransform = element.style.transform;
      element.style.transform = "none";
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: "#fbf9f6",
        windowWidth: 794, // Force A4 width
      });
      
      // Restore scaling
      element.style.transform = originalTransform;
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Presupuesto_${patientName.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Reusable PDF template component
  const PDFContent = () => (
    <div style={{ width: "794px", minHeight: "1123px", backgroundColor: "#fbf9f6", fontFamily: "'Poppins', sans-serif", color: "#4e453e", position: "relative", padding: "40px" }}>
      {/* Decorative left margin block simulating the image style */}
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "30px", backgroundColor: "#ebdcd0" }}></div>
      
      <div style={{ paddingLeft: "40px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "60px" }}>
          <div style={{ position: "relative", width: "100px", height: "100px" }}>
            {/* Fake Logo based on image */}
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "#ebdcd0", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "#6a5c4c", fontVariationSettings: "'FILL' 1" }}>dentistry</span>
            </div>
            <div style={{ width: "30px", height: "120px", backgroundColor: "#bca693", position: "absolute", top: "-20px", left: "15px", borderRadius: "15px", zIndex: 0 }}></div>
          </div>
          
          <div style={{ 
            border: "3px solid #bca693", 
            borderRadius: "40px", 
            padding: "10px 30px", 
            backgroundColor: "white",
            fontWeight: 600,
            color: "#1b1c1a",
            fontSize: "20px",
            letterSpacing: "1px"
          }}>
            PRESUPUESTO TRATAMIENTO ODONTOLÓGICO
          </div>
        </div>

        {/* Patient Info */}
        <div style={{ marginBottom: "40px", fontSize: "16px", color: "#9c8c7c", fontWeight: 500 }}>
          <div style={{ marginBottom: "15px" }}>Paciente: <span style={{ color: "#4e453e", marginLeft: "10px" }}>{patientName}</span></div>
          <div>Fecha: <span style={{ color: "#4e453e", marginLeft: "10px" }}>{dateStr}</span></div>
        </div>

        {/* Table */}
        <div style={{ marginBottom: "60px" }}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "3fr 1fr 1fr", 
            border: "2px solid #bca693", 
            borderRadius: "30px", 
            padding: "15px 30px",
            fontWeight: 600,
            backgroundColor: "white",
            color: "#1b1c1a",
            marginBottom: "15px"
          }}>
            <div>Descripción</div>
            <div style={{ textAlign: "center" }}>Cantidad</div>
            <div style={{ textAlign: "right" }}>Valor</div>
          </div>

          {items.map((item, i) => (
            <div key={i} style={{ 
              display: "grid", 
              gridTemplateColumns: "3fr 1fr 1fr", 
              padding: "20px 30px",
              borderBottom: "1px solid #d1c4bb",
              fontSize: "15px"
            }}>
              <div>{item.description || "-"}</div>
              <div style={{ textAlign: "center" }}>{item.quantity}</div>
              <div style={{ textAlign: "right" }}>$ {item.value.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "80px" }}>
          <div style={{ flex: 1 }}></div>
          <div style={{ width: "350px", fontSize: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", paddingRight: "30px" }}>
              <span>Subtotal:</span>
              <span>$ {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", paddingRight: "30px" }}>
              <span>Impuestos:</span>
              <span>$ 0.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px", paddingRight: "30px" }}>
              <span>Descuento:</span>
              <span>$ {discount.toFixed(2)}</span>
            </div>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              border: "2px solid #bca693", 
              borderRadius: "30px", 
              padding: "15px 30px",
              backgroundColor: "white",
              fontWeight: 600,
              fontSize: "18px",
              color: "#1b1c1a"
            }}>
              <span>Total:</span>
              <span>$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Terms and Payment */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", fontSize: "14px", lineHeight: "1.6", borderTop: "1px solid #ebe1d5", paddingTop: "40px" }}>
          <div>
            <h4 style={{ fontSize: "16px", fontWeight: 600, color: "#1b1c1a", marginBottom: "10px" }}>Términos y Condiciones:</h4>
            <p style={{ marginBottom: "10px" }}>El presente presupuesto tendrá vigencia de <strong>20 días</strong> a partir de la fecha de emisión para su aceptación.</p>
            <p style={{ marginBottom: "10px" }}>Los valores indicados quedan sujeto a modificaciones <strong>en etapas de tratamiento no iniciadas.</strong></p>
            <p>Se solicitará una seña del <strong>50%</strong>, para comenzar el tratamiento debiendo abonarse el <strong>saldo total al finalizar cada etapa del mismo.</strong></p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div>
              <h4 style={{ fontSize: "16px", fontWeight: 600, color: "#1b1c1a", marginBottom: "10px" }}>Información de Pago</h4>
              <p><strong style={{ color: "#bca693" }}>Nombre del Beneficiario:</strong> {bankDetails.beneficiary}</p>
              <p><strong style={{ color: "#bca693" }}>CBU:</strong> {bankDetails.cbu}</p>
              <p><strong style={{ color: "#bca693" }}>Alias:</strong> <strong style={{ color: "#1b1c1a" }}>{bankDetails.alias}</strong></p>
              <p><strong style={{ color: "#bca693" }}>Cuit/Cuil:</strong> {bankDetails.cuit}</p>
            </div>
            <div>
              <h4 style={{ fontSize: "16px", fontWeight: 600, color: "#1b1c1a", marginBottom: "10px" }}>Datos de Contacto</h4>
              <p>Tucumán 452, Paraná ER</p>
              <p>343- 4571176</p>
              <p>odontologiaparados@gmail.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Modal Container: split into 2 columns on lg screens */}
      <div className="bg-surface w-full max-w-7xl h-[90vh] rounded-2xl shadow-xl flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Column: Form */}
        <div className="flex-1 flex flex-col max-h-full border-r border-tertiary-fixed">
          <div className="p-lg border-b border-tertiary-fixed flex justify-between items-center bg-surface shrink-0">
            <h2 className="font-headline-md text-headline-md text-on-surface">Generar Presupuesto</h2>
            {/* Close button is visible here on mobile, hidden on desktop if we have a top right one, but let's keep it */}
            <button onClick={onClose} className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="p-lg overflow-y-auto flex-1 bg-surface-container-low">
            <div className="space-y-md mb-lg">
              <div>
                <label className="block font-label-md text-on-surface-variant mb-1">Paciente</label>
                <input type="text" value={patientName} readOnly className="w-full p-3 bg-surface border border-tertiary-fixed rounded-xl font-body-md text-on-surface focus:outline-none opacity-70" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-sm">
                  <label className="font-label-md text-on-surface-variant">Prácticas / Tratamientos</label>
                  <button onClick={handleAddItem} className="text-primary font-label-md flex items-center gap-1 hover:underline">
                    <span className="material-symbols-outlined text-[18px]">add</span> Añadir Ítem
                  </button>
                </div>
                
                <div className="space-y-sm">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-sm items-center bg-surface p-3 rounded-xl border border-outline-variant shadow-sm">
                      <input 
                        type="text" 
                        placeholder="Descripción" 
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        className="flex-1 bg-transparent border-b border-tertiary-fixed focus:border-primary focus:outline-none px-2 py-1 font-body-md"
                      />
                      <input 
                        type="number" 
                        placeholder="Cant." 
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                        className="w-20 bg-transparent border-b border-tertiary-fixed focus:border-primary focus:outline-none px-2 py-1 font-body-md text-center"
                      />
                      <div className="relative w-32">
                        <span className="absolute left-2 top-1.5 text-on-surface-variant">$</span>
                        <input 
                          type="number" 
                          placeholder="Valor" 
                          value={item.value}
                          onChange={(e) => updateItem(idx, "value", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-b border-tertiary-fixed focus:border-primary focus:outline-none pl-6 pr-2 py-1 font-body-md"
                        />
                      </div>
                      <button onClick={() => handleRemoveItem(idx)} className="text-error hover:bg-error-container p-2 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-md border-t border-tertiary-fixed">
                <div className="w-64 space-y-sm">
                  <div className="flex justify-between font-body-md">
                    <span className="text-on-surface-variant">Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center font-body-md">
                    <span className="text-on-surface-variant">Descuento:</span>
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1 text-on-surface-variant">$</span>
                      <input 
                        type="number" 
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="w-full bg-surface border border-tertiary-fixed rounded-lg focus:border-primary focus:outline-none pl-6 pr-2 py-1 text-right shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between font-headline-md text-primary pt-sm border-t border-tertiary-fixed">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-lg border-t border-tertiary-fixed bg-surface flex justify-end gap-md shrink-0">
            <button onClick={onClose} className="px-lg py-3 font-label-md text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">
              Cancelar
            </button>
            <button 
              onClick={generatePDF} 
              disabled={isGenerating}
              className="px-lg py-3 bg-primary text-on-primary rounded-xl font-label-md flex items-center gap-2 hover:bg-secondary transition-all disabled:opacity-50 shadow-md"
            >
              {isGenerating ? (
                <><span className="material-symbols-outlined animate-spin">progress_activity</span> Generando...</>
              ) : (
                <><span className="material-symbols-outlined">picture_as_pdf</span> Descargar PDF</>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Preview */}
        <div className="hidden lg:flex flex-col flex-1 bg-surface-container-highest relative overflow-hidden">
          <div className="absolute top-4 right-4 z-10">
            <button onClick={onClose} className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors shadow-sm bg-surface/50 backdrop-blur-md">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="p-md bg-surface/50 border-b border-tertiary-fixed backdrop-blur-md z-10 text-center shrink-0">
            <span className="font-label-md text-on-surface-variant flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">visibility</span> Vista Previa del PDF
            </span>
          </div>
          
          {/* Scrollable area for the scaled preview */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-lg">
            <div 
              className="shadow-2xl origin-top" 
              style={{ transform: "scale(0.65)", transition: "transform 0.2s ease" }}
            >
              <div ref={pdfRef}>
                <PDFContent />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
