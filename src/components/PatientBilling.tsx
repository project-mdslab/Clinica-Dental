'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateBudgetPDF, generatePaymentPDF, generateBillPDF } from '@/utils/pdfGenerator';
import AlertDialog from './AlertDialog';

interface Bill {
  id: string;
  total_amount: number;
  created_at: string;
  budget_id?: string;
  items: BillItem[];
  payments: BillPayment[];
}

interface BillItem {
  id: string;
  description: string;
  value: number;
}

interface BillPayment {
  id: string;
  amount: number;
  payment_method: string;
  date: string;
}

export default function PatientBilling({ 
  patient,
  autoOpenNoteId,
  onAutoOpenClear
}: { 
  patient: any,
  autoOpenNoteId?: string | null,
  onAutoOpenClear?: () => void
}) {
  const patientId = patient?.id;
  const supabase = createClient();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const [availableTreatments, setAvailableTreatments] = useState<any[]>([]);
  const [insuranceName, setInsuranceName] = useState<string>('Obra Social');
  
  const [activePaymentBill, setActivePaymentBill] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState({ amount: 0, method: 'Efectivo' });
  const [savingPayment, setSavingPayment] = useState(false);
  const [highlightedBillId, setHighlightedBillId] = useState<string | null>(null);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });

  const showAlert = (message: string, title?: string) => {
    setAlertDialog({ isOpen: true, title: title || 'Atención', message, type: 'alert', onConfirm: () => setAlertDialog(prev => ({ ...prev, isOpen: false })), confirmText: 'Aceptar' });
  };

  useEffect(() => {
    if (patientId) {
      fetchBills();
      fetchTreatments();
    }
  }, [patientId]);

  const fetchTreatments = async () => {
    try {
      const { data: baseTreatments, error: treatmentsError } = await supabase.from('treatments').select('*').order('code', { ascending: true });
      if (treatmentsError) throw treatmentsError;

      let combined = baseTreatments || [];

      if (patient?.insurance_id) {
        const { data: insData } = await supabase.from('insurances').select('name').eq('id', patient.insurance_id).single();
        if (insData) setInsuranceName(insData.name);

        const { data: insTreatments, error: insError } = await supabase.from('insurance_treatments').select('*').eq('insurance_id', patient.insurance_id);
        if (!insError && insTreatments && insTreatments.length > 0) {
          combined = combined.map(bt => {
            const it = insTreatments.find(i => i.code === bt.code);
            if (it) {
              return { ...bt, has_insurance: true, copay_price: it.price, insurance_price: it.price };
            }
            return bt;
          });
          setAvailableTreatments(combined);
          return;
        }
      }

      setAvailableTreatments(combined.map(t => ({ ...t, has_insurance: false })));

    } catch (error) {
      console.error('Error fetching treatments:', error);
    }
  };

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          items:bill_items(*),
          payments:bill_payments(*)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
      
      if (autoOpenNoteId && data && onAutoOpenClear) {
        const targetBill = data.find((b: any) => b.clinical_note_id === autoOpenNoteId);
        if (targetBill) {
          setHighlightedBillId(targetBill.id);
          setTimeout(() => {
            const el = document.getElementById(`bill-${targetBill.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => setHighlightedBillId(null), 3000);
          }, 100);
          onAutoOpenClear();
        }
      }
    } catch (error) {
      console.error('Error loading bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (billId: string) => {
    if (newPayment.amount <= 0) return;
    
    setSavingPayment(true);
    try {
      const { error } = await supabase
        .from('bill_payments')
        .insert([{
          bill_id: billId,
          amount: newPayment.amount,
          payment_method: newPayment.method
        }]);

      if (error) throw error;
      
      setActivePaymentBill(null);
      setNewPayment({ amount: 0, method: 'Efectivo' });
      fetchBills();
    } catch (error) {
      console.error('Error adding payment:', error);
      showAlert('Error al guardar el pago');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleShareBill = async (bill: Bill) => {
    try {
      const formattedDate = new Date(bill.created_at).toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const itemsList = bill.items.map(item => `- ${item.description}: $${Number(item.value).toLocaleString('es-AR')}`).join('\n');
      const balance = Number(bill.total_amount) - bill.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      
      const shareData = {
        title: `Estado de Cuenta - ${patient.first_name} ${patient.last_name}`,
        text: `*Estado de Cuenta Odontológico*\nPaciente: ${patient.first_name} ${patient.last_name}\nFecha: ${formattedDate}\n\n*Detalle:*\n${itemsList}\n\n*Monto Total: $${Number(bill.total_amount).toLocaleString('es-AR')}*\n*Saldo Pendiente: $${balance.toLocaleString('es-AR')}*`
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}`);
        showAlert("Estado de cuenta copiado al portapapeles. Ahora puedes pegarlo en WhatsApp o Email.");
      }
    } catch (err) {
      console.error("Error compartiendo:", err);
    }
  };

  const totalBilled = bills.reduce((acc, b) => acc + Number(b.total_amount), 0);
  const totalPaid = bills.reduce((acc, b) => acc + b.payments.reduce((pAcc, p) => pAcc + Number(p.amount), 0), 0);
  const totalBalance = totalBilled - totalPaid;

  return (
    <div className="space-y-6">
      {/* Resumen Financiero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/30 flex flex-col justify-center">
          <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Total Facturado</p>
          <p className="text-3xl font-black text-on-surface">${totalBilled.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-green-50/50 rounded-3xl p-6 border border-green-100 flex flex-col justify-center">
          <p className="text-sm font-bold text-green-700 uppercase tracking-wider mb-2">Total Abonado</p>
          <p className="text-3xl font-black text-green-600">${totalPaid.toLocaleString('es-AR')}</p>
        </div>
        <div className={`rounded-3xl p-6 border flex flex-col justify-center ${totalBalance > 0 ? 'bg-red-50/50 border-red-100' : 'bg-surface-container-low border-outline-variant/30'}`}>
          <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${totalBalance > 0 ? 'text-red-700' : 'text-on-surface-variant'}`}>Saldo Deudor</p>
          <p className={`text-3xl font-black ${totalBalance > 0 ? 'text-red-600' : 'text-on-surface'}`}>${totalBalance.toLocaleString('es-AR')}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">receipt_long</span>
          Estado de Cuenta
        </h3>
      </div>

      {/* Lista Estilo Tarjetas */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : bills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/50 bg-surface-container/30 rounded-3xl border border-outline-variant/50">
          <span className="material-symbols-outlined text-5xl mb-4">account_balance_wallet</span>
          <p className="font-medium">No hay registros en el estado de cuenta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bills.map(bill => {
            const billTotalPaid = bill.payments.reduce((acc, p) => acc + Number(p.amount), 0);
            const balance = Number(bill.total_amount) - billTotalPaid;
            const isFullyPaid = balance <= 0;
            const shortId = bill.id.split('-')[0].toUpperCase();

            return (
              <div 
                key={bill.id} 
                id={`bill-${bill.id}`}
                className={`bg-surface-container-lowest border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-500 flex flex-col ${
                  highlightedBillId === bill.id 
                    ? 'ring-4 ring-primary border-primary bg-primary/5 scale-[1.02]' 
                    : 'border-outline-variant'
                }`}
              >
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">ID #{shortId}</span>
                        {bill.budget_id && (
                          <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">request_quote</span>
                            Presupuesto
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-on-surface-variant">{format(parseISO(bill.created_at), "d MMM, yyyy", { locale: es })}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isFullyPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isFullyPaid ? 'Pagado' : 'Pendiente'}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {bill.items.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-sm border-b border-outline-variant/30 pb-2 last:border-0 last:pb-0">
                        <span className="text-on-surface line-clamp-1 flex-1 pr-2" title={item.description}>{item.description}</span>
                        <span className="font-bold text-on-surface-variant whitespace-nowrap">${Number(item.value).toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-surface-container-low rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-on-surface-variant">Monto Total</span>
                      <span className="font-bold text-on-surface">${Number(bill.total_amount).toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-on-surface-variant">Saldo Restante</span>
                      <span className={`font-black ${balance > 0 ? 'text-error' : 'text-green-600'}`}>
                        ${balance.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-outline-variant p-4 bg-surface-container-low/50 flex gap-2">
                  <button 
                    onClick={() => handleShareBill(bill)}
                    className="flex-1 bg-surface border border-outline-variant/30 hover:bg-surface-container text-on-surface py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">share</span> Compartir
                  </button>
                  <button 
                    onClick={async () => { await generateBillPDF(bill, patient); }}
                    className="flex-1 bg-surface border border-outline-variant hover:bg-outline-variant/20 text-on-surface py-2 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">print</span>
                    Ticket
                  </button>
                  {!isFullyPaid && (
                    <button 
                      onClick={() => setActivePaymentBill(activePaymentBill === bill.id ? null : bill.id)}
                      className="flex-1 bg-primary text-on-primary hover:bg-primary/90 py-2 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">{activePaymentBill === bill.id ? 'close' : 'payments'}</span>
                      Pagar
                    </button>
                  )}
                </div>

                {activePaymentBill === bill.id && (
                  <div className="p-4 border-t border-outline-variant bg-primary/5 animate-in slide-in-from-top-2">
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-primary uppercase mb-1 block">Monto ($)</label>
                          <input 
                            type="number" max={balance}
                            className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                            value={newPayment.amount || ''}
                            onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-primary uppercase mb-1 block">Método</label>
                          <select 
                            className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                            value={newPayment.method}
                            onChange={e => setNewPayment({...newPayment, method: e.target.value})}
                          >
                            <option>Efectivo</option>
                            <option>Transferencia</option>
                            <option>Tarjeta Crédito</option>
                            <option>Tarjeta Débito</option>
                          </select>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddPayment(bill.id)}
                        disabled={savingPayment}
                        className="w-full bg-primary text-on-primary py-2 rounded-lg font-bold hover:bg-primary/90 flex items-center justify-center gap-2"
                      >
                        {savingPayment ? 'Guardando...' : 'Confirmar Pago'}
                      </button>
                    </div>
                  </div>
                )}
                
                {bill.payments.length > 0 && (
                  <div className="px-4 pb-4 border-t border-outline-variant pt-3 bg-surface-container-low/30">
                    <h6 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Historial de Pagos</h6>
                    <div className="space-y-1.5">
                      {bill.payments.map(payment => (
                        <div key={payment.id} className="flex justify-between items-center text-xs bg-green-50/50 p-2 rounded-lg border border-green-100">
                          <span className="text-green-700 font-bold">${Number(payment.amount).toLocaleString('es-AR')}</span>
                          <span className="text-green-600/80">{payment.payment_method}</span>
                          <span className="text-green-700/60 font-medium">{format(parseISO(payment.date), "dd/MM")}</span>
                          <button onClick={() => generatePaymentPDF(payment, bill, patient)} className="text-green-700 hover:text-green-900" title="Imprimir Recibo">
                             <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
