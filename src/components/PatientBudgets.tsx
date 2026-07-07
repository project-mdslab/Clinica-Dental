'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateBudgetPDF, generatePaymentPDF } from '@/utils/pdfGenerator';
import AlertDialog from './AlertDialog';

interface Budget {
  id: string;
  total_amount: number;
  created_at: string;
  items: BudgetItem[];
  payments: BudgetPayment[];
  status?: string;
  observations?: string;
}

interface BudgetItem {
  id: string;
  description: string;
  value: number;
}

interface BudgetPayment {
  id: string;
  amount: number;
  payment_method: string;
  date: string;
}

export default function PatientBudgets({ patient }: { patient: any }) {
  const patientId = patient?.id;
  const supabase = createClient();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableColegioTreatments, setAvailableColegioTreatments] = useState<any[]>([]);
  const [availableInsuranceTreatments, setAvailableInsuranceTreatments] = useState<any[]>([]);
  const [insuranceName, setInsuranceName] = useState('Obra Social');
  
  const [isCreatingBudget, setIsCreatingBudget] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [newBudgetItems, setNewBudgetItems] = useState([{ description: '', value: 0, refColegio: null as number | null, refOS: null as number | null, isCustom: false }]);
  const [customPractice, setCustomPractice] = useState({ description: '', value: 0 });
  const [newBudgetObservations, setNewBudgetObservations] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });

  const showAlert = (message: string, title?: string) => {
    setAlertDialog({ isOpen: true, title: title || 'Atención', message, type: 'alert', onConfirm: () => setAlertDialog(prev => ({ ...prev, isOpen: false })), confirmText: 'Aceptar' });
  };

  const [activePaymentBudget, setActivePaymentBudget] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState({ amount: 0, method: 'Efectivo', date: format(new Date(), 'yyyy-MM-dd') });
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (patientId) {
      fetchBudgets();
      fetchTreatments();
    }
  }, [patientId]);

  const fetchTreatments = async () => {
    const { data: colegioTreatments } = await supabase.from('treatments').select('*').order('code');
    setAvailableColegioTreatments(colegioTreatments || []);

    if (patient?.insurance_id) {
      const { data: insInfo } = await supabase.from('insurances').select('name').eq('id', patient.insurance_id).single();
      if (insInfo) setInsuranceName(insInfo.name);

      const { data: insTreatments } = await supabase
        .from('insurance_treatments')
        .select('*')
        .eq('insurance_id', patient.insurance_id)
        .order('code');

      setAvailableInsuranceTreatments(insTreatments || []);
    } else {
      setAvailableInsuranceTreatments([]);
    }
  };

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      if (patientId === '1') {
        setBudgets([{
          id: '1', total_amount: 150000, created_at: '2023-10-15',
          items: [{ id: '1', description: 'Tratamiento Conducto', value: 150000 }],
          payments: [{ id: '1', amount: 50000, payment_method: 'Efectivo', date: '2023-10-15' }]
        }]);
        setLoading(false);
        return;
      }

      // Fetch budgets
      const { data: bData, error: bError } = await supabase
        .from('budgets')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
        
      if (bError) throw bError;
      if (!bData || bData.length === 0) {
        setBudgets([]);
        return;
      }

      const budgetIds = bData.map(b => b.id);

      // Fetch items
      const { data: iData } = await supabase
        .from('budget_items')
        .select('*')
        .in('budget_id', budgetIds);

      // Fetch payments
      const { data: pData } = await supabase
        .from('budget_payments')
        .select('*')
        .in('budget_id', budgetIds)
        .order('date', { ascending: true });

      const formattedBudgets = bData.map(b => ({
        ...b,
        items: (iData || []).filter(i => i.budget_id === b.id),
        payments: (pData || []).filter(p => p.budget_id === b.id)
      }));

      setBudgets(formattedBudgets);
    } catch (err) {
      console.error('Error fetching budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async () => {
    if (patientId === '1') {
      showAlert("No se puede editar el paciente de prueba.");
      return;
    }
    const validItems = [
      ...newBudgetItems,
      { description: customPractice.description, value: customPractice.value, refColegio: null, refOS: null, isCustom: true }
    ].filter(i => i.description && i.value > 0);
    if (validItems.length === 0) {
      showAlert('Debes agregar al menos un ítem válido.');
      return;
    }

    setSavingBudget(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Autenticación requerida");

      const total = validItems.reduce((acc, item) => acc + Number(item.value), 0);

      if (editingBudgetId) {
        // Update existing budget
        const { error: budgetError } = await supabase
          .from('budgets')
          .update({ 
            total_amount: total,
            observations: newBudgetObservations 
          })
          .eq('id', editingBudgetId);
        if (budgetError) throw budgetError;

        // Delete old items and insert new ones
        await supabase.from('budget_items').delete().eq('budget_id', editingBudgetId);
        const itemsToInsert = validItems.map(item => ({
          budget_id: editingBudgetId,
          description: item.description,
          value: Number(item.value),
          quantity: 1
        }));
        await supabase.from('budget_items').insert(itemsToInsert);
      } else {
        // Create new budget
        const { data: budget, error: budgetError } = await supabase
          .from('budgets')
          .insert([{ 
            patient_id: patientId, 
            user_id: user.id, 
            total_amount: total,
            status: 'Pendiente',
            observations: newBudgetObservations 
          }])
          .select()
          .single();
        if (budgetError) throw budgetError;

        const itemsToInsert = validItems.map(item => ({
          budget_id: budget.id,
          description: item.description,
          value: Number(item.value),
          quantity: 1
        }));
        const { error: itemsError } = await supabase.from('budget_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      setEditingBudgetId(null);
      setNewBudgetItems([{ description: '', value: 0, refColegio: null, refOS: null, isCustom: false }]);
      setCustomPractice({ description: '', value: 0 });
      setNewBudgetObservations('');
      setIsCreatingBudget(false);
      fetchBudgets();
    } catch (err: any) {
      console.error("Error creating budget:", err);
      showAlert("Error al crear presupuesto: " + err.message);
    } finally {
      setSavingBudget(false);
    }
  };

  const handleAddPayment = async (budgetId: string) => {
    if (patientId === '1') {
      showAlert("No se puede editar el paciente de prueba.");
      return;
    }
    if (newPayment.amount <= 0) {
      showAlert('El monto debe ser mayor a 0');
      return;
    }

    setSavingPayment(true);
    try {
      const { error } = await supabase
        .from('budget_payments')
        .insert([{
          budget_id: budgetId,
          amount: newPayment.amount,
          payment_method: newPayment.method,
          date: newPayment.date
        }]);
      
      if (error) throw error;

      setActivePaymentBudget(null);
      setNewPayment({ amount: 0, method: 'Efectivo', date: format(new Date(), 'yyyy-MM-dd') });
      fetchBudgets();
    } catch (err: any) {
      console.error("Error adding payment:", err);
      showAlert("Error al registrar pago: " + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleShareBudget = async (budget: Budget) => {
    try {
      const formattedDate = new Date(budget.created_at).toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const itemsList = budget.items.map(item => `- ${item.description}: $${Number(item.value).toLocaleString('es-AR')}`).join('\n');
      const balance = Number(budget.total_amount) - budget.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      
      const shareData = {
        title: `Presupuesto Odontológico - ${patient.first_name} ${patient.last_name}`,
        text: `*Presupuesto Odontológico*\nPaciente: ${patient.first_name} ${patient.last_name}\nFecha: ${formattedDate}\n\n*Detalle de Tratamientos:*\n${itemsList}\n\n*Total: $${Number(budget.total_amount).toLocaleString('es-AR')}*\nSaldo a Pagar: $${balance.toLocaleString('es-AR')}\n\n${budget.observations ? `*Observaciones:*\n${budget.observations}` : ''}`
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}`);
        showAlert("Presupuesto copiado al portapapeles. Ahora puedes pegarlo en WhatsApp o Email.");
      }
    } catch (err) {
      console.error("Error compartiendo:", err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm">
        <div>
          <h3 className="text-xl font-black text-on-surface">Presupuestos y Pagos</h3>
          <p className="text-sm text-on-surface-variant font-medium mt-1">Gestiona los tratamientos aprobados y lleva el seguimiento de cuotas o señas entregadas.</p>
        </div>
        {!isCreatingBudget ? (
          <button 
            onClick={() => {
              setEditingBudgetId(null);
              setNewBudgetItems([{ description: '', value: 0, refColegio: null, refOS: null, isCustom: false }]);
              setCustomPractice({ description: '', value: 0 });
              setNewBudgetObservations('');
              setIsCreatingBudget(true);
            }}
            className="bg-[#6B5A4E] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#5A4B40] transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Nuevo Presupuesto
          </button>
        ) : (
          <button 
            onClick={() => {
              setIsCreatingBudget(false);
              setEditingBudgetId(null);
            }}
            className="text-on-surface-variant px-5 py-2.5 rounded-xl font-bold hover:bg-surface-container-high transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
            Cancelar
          </button>
        )}
      </div>

      {/* Creador de Presupuestos */}
      {isCreatingBudget && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 md:p-8 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="mb-6 flex justify-between items-center">
            <h4 className="text-lg font-black text-on-surface">{editingBudgetId ? 'Editar Presupuesto' : 'Crear Nuevo Presupuesto'}</h4>
            {editingBudgetId && (
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-md">Editando</span>
            )}
          </div>
          <div className="space-y-4 mb-6">
            {newBudgetItems.map((item, index) => (
              <div key={index} className={`flex gap-4 items-end flex-wrap ${item.isCustom ? 'bg-orange-50/50 p-4 rounded-xl border border-orange-200' : ''}`}>
                {!item.isCustom && (
                  <div className="w-full md:w-1/3">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Nomenclador Colegio</label>
                    <select 
                      className="w-full bg-surface-container border border-outline-variant rounded-xl p-3 text-sm focus:border-primary outline-none mb-2"
                      value=""
                      onChange={(e) => {
                        const t = availableColegioTreatments.find(x => x.id === e.target.value);
                        if (t) {
                          const newItems = [...newBudgetItems];
                          newItems[index] = { 
                            description: `${t.code} - ${t.name}`, 
                            value: Number(t.colegio_price || 0), 
                            refColegio: Number(t.colegio_price || 0), 
                            refOS: null,
                            isCustom: false
                          };
                          setNewBudgetItems(newItems);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">-- Práctica del Colegio --</option>
                      {availableColegioTreatments.map(t => (
                         <option key={t.id} value={t.id}>
                           {t.code ? t.code+' - ' : ''}{t.name} (Colegio de Odontólogos: ${Number(t.colegio_price||0).toLocaleString('es-AR')})
                         </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex-1 min-w-[200px]">
                  <label className={`text-xs font-bold uppercase tracking-wider mb-1 block ${item.isCustom ? 'text-orange-800' : 'text-on-surface-variant'}`}>
                    {item.isCustom ? 'Práctica no nomenclada (Nombre)' : 'Descripción del Tratamiento'}
                  </label>
                  <div className="flex-1 flex gap-2">
                    {item.isCustom ? (
                      <input 
                        type="text"
                        placeholder="Descripción de la práctica libre..."
                        className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm focus:border-orange-500 outline-none text-orange-900"
                        value={item.description}
                        onChange={e => {
                          const newItems = [...newBudgetItems];
                          newItems[index].description = e.target.value;
                          setNewBudgetItems(newItems);
                        }}
                      />
                    ) : (
                      <input 
                        type="text"
                        placeholder="La descripción se completará automáticamente..."
                        className="w-full bg-surface-container border border-outline-variant rounded-xl p-3 text-sm focus:border-primary outline-none text-on-surface/80"
                        value={item.description}
                        readOnly
                      />
                    )}
                  </div>
                </div>
                <div className="w-[150px]">
                  <label className={`text-xs font-bold uppercase tracking-wider mb-1 block ${item.isCustom ? 'text-orange-800' : 'text-on-surface-variant'}`}>
                    {item.isCustom ? 'Precio ($)' : 'Valor ($)'}
                  </label>
                  <input 
                    type="number"
                    min="0"
                    className={`w-full rounded-xl p-3 text-sm outline-none ${item.isCustom ? 'bg-white border border-orange-200 focus:border-orange-500 text-orange-900' : 'bg-surface-container border border-outline-variant focus:border-primary'}`}
                    value={item.value === 0 && !item.description ? '' : item.value}
                    onChange={e => {
                      const newItems = [...newBudgetItems];
                      newItems[index].value = Number(e.target.value);
                      setNewBudgetItems(newItems);
                    }}
                  />
                  {item.description && (
                    <div className="mt-1 text-[9px] text-on-surface-variant leading-tight">
                      Col: ${item.refColegio?.toLocaleString('es-AR')}
                      {item.refOS !== null && <span><br/>{insuranceName}: ${item.refOS?.toLocaleString('es-AR')}</span>}
                    </div>
                  )}
                </div>
                {index > 0 && (
                  <button 
                    onClick={() => setNewBudgetItems(newBudgetItems.filter((_, i) => i !== index))}
                    className="w-12 h-[46px] rounded-xl flex items-center justify-center text-error hover:bg-error/10 transition-colors mb-[18px]"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Práctica no nomenclada fija */}
          <div className="flex gap-4 items-end flex-wrap bg-orange-50/50 p-4 rounded-xl border border-orange-200 mb-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1 block">Práctica no nomenclada (Nombre)</label>
              <input 
                type="text"
                placeholder="Descripción de la práctica libre..."
                className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm focus:border-orange-500 outline-none text-orange-900"
                value={customPractice.description}
                onChange={e => setCustomPractice({ ...customPractice, description: e.target.value })}
              />
            </div>
            <div className="w-[150px]">
              <label className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1 block">Precio ($)</label>
              <input 
                type="number"
                min="0"
                className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm focus:border-orange-500 outline-none text-orange-900"
                value={customPractice.value === 0 && !customPractice.description ? '' : customPractice.value}
                onChange={e => setCustomPractice({ ...customPractice, value: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Observaciones / Términos del Presupuesto (Opcional)</label>
            <textarea 
              placeholder="Escribe las condiciones o notas particulares para este presupuesto que saldrán en el PDF..."
              className="w-full bg-surface-container border border-outline-variant rounded-xl p-3 text-sm focus:border-primary outline-none min-h-[80px] resize-y"
              value={newBudgetObservations}
              onChange={e => setNewBudgetObservations(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center border-t border-outline-variant/30 pt-6 mt-6">
            <div className="flex gap-2">
              <button 
                onClick={() => setNewBudgetItems([...newBudgetItems, { description: '', value: 0, refColegio: null, refOS: null, isCustom: false }])}
                className="text-primary font-bold hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Sumar práctica de colegio de odontólogos
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Calculado</span>
                <p className="text-xl font-black text-on-surface">
                  ${(newBudgetItems.reduce((acc, item) => acc + Number(item.value), 0) + Number(customPractice.value)).toLocaleString('es-AR')}
                </p>
              </div>
              <button 
                onClick={handleCreateBudget}
                disabled={savingBudget}
                className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2"
              >
                {savingBudget ? <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[20px]">check</span>}
                Guardar Presupuesto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Presupuestos */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/50 bg-surface-container/30 rounded-3xl border border-outline-variant/50">
          <span className="material-symbols-outlined text-5xl mb-4">request_quote</span>
          <p className="font-medium">El paciente no tiene presupuestos generados.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {budgets.map(budget => {
            const totalPaid = budget.payments.reduce((acc, p) => acc + Number(p.amount), 0);
            const balance = Number(budget.total_amount) - totalPaid;
            const isFullyPaid = balance <= 0;

            return (
              <div key={budget.id} className="bg-surface-container-lowest border border-outline-variant rounded-3xl overflow-hidden shadow-sm hover:border-outline transition-colors">
                {/* Cabecera del Presupuesto */}
                <div className="bg-surface-container-low p-5 flex flex-wrap gap-4 items-center justify-between border-b border-outline-variant/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isFullyPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      <span className="material-symbols-outlined">{isFullyPaid ? 'check_circle' : 'pending_actions'}</span>
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">Presupuesto del {format(parseISO(budget.created_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
                      <p className={`text-xs font-bold uppercase tracking-wider ${isFullyPaid ? 'text-green-600' : 'text-amber-600'}`}>
                        {isFullyPaid ? 'SALDADO' : 'PENDIENTE DE PAGO'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-center">
                    {/* Status Toggle */}
                    <div className="bg-surface-container border border-outline-variant rounded-lg flex p-1 text-[10px] font-bold uppercase tracking-wider">
                      <button 
                        onClick={async () => { 
                          await supabase.from('budgets').update({status: 'Pendiente'}).eq('id', budget.id); 
                          if (budget.status === 'Aprobado') {
                            await supabase.from('bills').delete().eq('budget_id', budget.id);
                          }
                          fetchBudgets(); 
                        }}
                        className={`px-3 py-1 rounded-md transition-colors ${budget.status === 'Pendiente' || !budget.status ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-on-surface-variant hover:bg-surface'}`}
                      >
                        Pend.
                      </button>
                      <button 
                        onClick={async () => { 
                          await supabase.from('budgets').update({status: 'Aprobado'}).eq('id', budget.id); 

                          const { data: existingBill, error: checkError } = await supabase.from('bills').select('id').eq('budget_id', budget.id).maybeSingle();
                          
                          if (checkError && checkError.code === '42703') {
                            showAlert("Aviso: El presupuesto fue aprobado, pero falta ejecutar el script de migración SQL para vincularlo al Estado de Cuenta.");
                            fetchBudgets();
                            return;
                          }

                          if (!existingBill) {
                             const { data: bill } = await supabase.from('bills').insert([{
                                patient_id: patientId,
                                total_amount: budget.total_amount,
                                budget_id: budget.id
                             }]).select().single();
                             
                             if (bill) {
                               const itemsToInsert = budget.items.map(item => ({
                                 bill_id: bill.id,
                                 description: item.description,
                                 value: Number(item.value)
                               }));
                               await supabase.from('bill_items').insert(itemsToInsert);
                             }
                          }
                          fetchBudgets(); 
                        }}
                        className={`px-3 py-1 rounded-md transition-colors ${budget.status === 'Aprobado' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-on-surface-variant hover:bg-surface'}`}
                      >
                        Aprobado
                      </button>
                      <button 
                        onClick={async () => { 
                          await supabase.from('budgets').update({status: 'Rechazado'}).eq('id', budget.id); 
                          if (budget.status === 'Aprobado') {
                            await supabase.from('bills').delete().eq('budget_id', budget.id);
                          }
                          fetchBudgets(); 
                        }}
                        className={`px-3 py-1 rounded-md transition-colors ${budget.status === 'Rechazado' ? 'bg-error/20 text-error shadow-sm' : 'text-on-surface-variant hover:bg-surface'}`}
                      >
                        Rechaz.
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleShareBudget(budget)}
                        className="bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface p-2 rounded-xl transition-colors flex items-center justify-center"
                        title="Compartir Presupuesto"
                      >
                        <span className="material-symbols-outlined text-[20px]">share</span>
                      </button>
                      <button 
                        onClick={() => generateBudgetPDF(budget, patient)}
                        className="bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface p-2 rounded-xl transition-colors flex items-center justify-center"
                        title="Imprimir Presupuesto"
                      >
                        <span className="material-symbols-outlined text-[20px]">print</span>
                      </button>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingBudgetId(budget.id);
                        setNewBudgetObservations(budget.observations || '');
                        setNewBudgetItems(budget.items.map(item => ({
                          description: item.description,
                          value: Number(item.value),
                          refColegio: null,
                          refOS: null,
                          isCustom: true
                        })));
                        setCustomPractice({ description: '', value: 0 });
                        setIsCreatingBudget(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-on-surface-variant hover:text-primary hover:bg-primary/10 p-2 rounded-xl transition-colors flex items-center justify-center"
                      title="Editar Presupuesto"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button 
                      onClick={() => {
                        setAlertDialog({
                          isOpen: true,
                          title: 'Eliminar Presupuesto',
                          message: '¿Seguro que deseas eliminar este presupuesto?',
                          type: 'confirm',
                          confirmText: 'Eliminar',
                          onConfirm: async () => {
                            setAlertDialog(prev => ({ ...prev, isOpen: false }));
                            await supabase.from('budgets').delete().eq('id', budget.id);
                            fetchBudgets();
                          }
                        });
                      }}
                      className="text-on-surface-variant hover:text-error hover:bg-error/10 p-2 rounded-xl transition-colors flex items-center justify-center"
                      title="Eliminar Presupuesto"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                    <div className="flex gap-6 text-right border-l border-outline-variant pl-6 ml-2">
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total</p>
                        <p className="font-bold text-on-surface">${Number(budget.total_amount).toLocaleString('es-AR')}</p>
                      </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Abonado</p>
                      <p className="font-bold text-green-600">${totalPaid.toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Saldo</p>
                      <p className={`font-black ${balance > 0 ? 'text-error' : 'text-on-surface'}`}>
                        ${balance.toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Ítems */}
                  <div>
                    <h5 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Detalle de Tratamientos</h5>
                    <div className="space-y-2">
                      {budget.items.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-surface-container/30">
                          <span className="text-on-surface">{item.description}</span>
                          <span className="font-bold text-on-surface-variant">${Number(item.value).toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                    </div>
                    {budget.observations && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <span className="text-[10px] font-bold text-amber-700 uppercase block mb-1">Observaciones</span>
                        <p className="text-sm text-amber-900/80 whitespace-pre-wrap">{budget.observations}</p>
                      </div>
                    )}
                  </div>

                  {/* Acciones de Pago o Estado */}
                  <div>
                    {budget.status === 'Aprobado' ? (
                      <div className="flex flex-col items-center justify-center h-full text-center bg-green-50/50 rounded-2xl border border-green-100 p-6">
                        <span className="material-symbols-outlined text-green-600 text-3xl mb-2">account_balance_wallet</span>
                        <p className="text-sm font-bold text-green-800 mb-1">Presupuesto en Estado de Cuenta</p>
                        <p className="text-xs text-green-700/80 mb-4">Los pagos de este presupuesto se gestionan de forma unificada en la pestaña Facturación.</p>
                      </div>
                    ) : budget.status === 'Rechazado' ? (
                      <div className="flex flex-col items-center justify-center h-full text-center bg-red-50/50 rounded-2xl border border-red-100 p-6">
                        <span className="material-symbols-outlined text-red-600 text-3xl mb-2">cancel</span>
                        <p className="text-sm font-bold text-red-800">Presupuesto Rechazado</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center bg-surface-container/30 rounded-2xl border border-outline-variant/50 p-6">
                        <span className="material-symbols-outlined text-amber-600 text-3xl mb-2">pending_actions</span>
                        <p className="text-sm font-bold text-on-surface mb-1">Presupuesto Pendiente</p>
                        <p className="text-xs text-on-surface-variant">Acepta el presupuesto para que se envíe al Estado de Cuenta del paciente y puedas registrar sus cobros.</p>
                      </div>
                    )}
                  </div>
                </div>
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
