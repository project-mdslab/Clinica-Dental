'use client';
import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function FinancesPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'receivables' | 'expenses'>('dashboard');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [newExpenseType, setNewExpenseType] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState({
    diario: { total: 0, efectivo: 0, transferencia: 0, gastos: 0 },
    mensual: { total: 0, efectivo: 0, transferencia: 0, gastos: 0 },
    anual: { total: 0, efectivo: 0, transferencia: 0, gastos: 0 }
  });

  const supabase = createClient();

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Bills for Receivables
      const { data: bills, error: billsErr } = await supabase
        .from('bills')
        .select('*, patient:patients(id, first_name, last_name), payments:bill_payments(*)');
      
      // 2. Fetch Payments for Incomes and Transactions
      const { data: payments, error: payErr } = await supabase
        .from('bill_payments')
        .select('*, bill:bills(patient:patients(first_name, last_name), items:bill_items(description))')
        .order('date', { ascending: false });

      // 3. Fetch Expenses
      const { data: expensesData, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (billsErr) throw billsErr;
      if (payErr) throw payErr;
      if (expErr && expErr.code !== '42P01') console.error("Could not fetch expenses:", expErr);

      // Process receivables
      let calculatedReceivables: any[] = [];
      bills?.forEach(bill => {
        if (!bill.patient) return;
        const totalPaid = bill.payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
        const balance = Number(bill.total_amount) - totalPaid;
        if (balance > 0) {
          calculatedReceivables.push({
            id: bill.patient.id,
            name: `${bill.patient.first_name} ${bill.patient.last_name}`,
            debt: balance,
            lastVisit: "Desconocido", // Placeholder as we're not joining appointments here yet
            rawDebt: balance
          });
        }
      });

      // Group receivables by patient
      const groupedReceivables = Object.values(calculatedReceivables.reduce((acc, curr) => {
        if (!acc[curr.id]) acc[curr.id] = { ...curr };
        else acc[curr.id].debt += curr.rawDebt;
        return acc;
      }, {} as any)).sort((a: any, b: any) => b.debt - a.debt);

      // Process payments (metrics)
      const now = new Date();
      const startDay = startOfDay(now).getTime();
      const endDay = endOfDay(now).getTime();
      const startM = startOfMonth(now).getTime();
      const endM = endOfMonth(now).getTime();
      const startY = startOfYear(now).getTime();
      const endY = endOfYear(now).getTime();

      let metrics = {
        diario: { total: 0, efectivo: 0, transferencia: 0, gastos: 0 },
        mensual: { total: 0, efectivo: 0, transferencia: 0, gastos: 0 },
        anual: { total: 0, efectivo: 0, transferencia: 0, gastos: 0 }
      };

      let processedPayments: any[] = [];
      payments?.forEach(p => {
        if (!p.bill || !p.bill.patient) return; // Skip payments from deleted patients

        const pTime = new Date(p.date).getTime();
        const amount = Number(p.amount);
        const isEfectivo = p.payment_method?.toLowerCase().includes('efectivo');

        if (pTime >= startDay && pTime <= endDay) {
          metrics.diario.total += amount;
          if (isEfectivo) metrics.diario.efectivo += amount; else metrics.diario.transferencia += amount;
        }
        if (pTime >= startM && pTime <= endM) {
          metrics.mensual.total += amount;
          if (isEfectivo) metrics.mensual.efectivo += amount; else metrics.mensual.transferencia += amount;
        }
        if (pTime >= startY && pTime <= endY) {
          metrics.anual.total += amount;
          if (isEfectivo) metrics.anual.efectivo += amount; else metrics.anual.transferencia += amount;
        }

        const pat = p.bill.patient;
        const patientName = `${pat.first_name} ${pat.last_name}`;
        const desc = p.bill.items?.[0]?.description || 'Abono de presupuesto';

        processedPayments.push({
          id: p.id,
          patientName,
          desc,
          amount,
          method: p.payment_method,
          date: p.date,
          isIncome: amount > 0
        });
      });

      // Process expenses for metrics
      expensesData?.forEach(e => {
        let eTime = 0;
        if (e.date.includes('T')) {
          eTime = new Date(e.date).getTime();
        } else {
          const [year, month, day] = e.date.split('-');
          eTime = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
        }
        
        const amount = Number(e.amount);
        if (eTime >= startDay && eTime <= endDay) metrics.diario.gastos += amount;
        if (eTime >= startM && eTime <= endM) metrics.mensual.gastos += amount;
        if (eTime >= startY && eTime <= endY) metrics.anual.gastos += amount;
      });

      setExpenses(expensesData || []);
      setAllPayments(processedPayments);
      setRecentPayments(processedPayments.slice(0, 5));
      setReceivables(groupedReceivables);
      setDashboardMetrics(metrics);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseType || !newExpenseAmount) return;
    
    setIsLoading(true);
    let error;
    if (editingExpenseId) {
      const { error: updateErr } = await supabase.from('expenses').update({
        expense_type: newExpenseType,
        amount: Number(newExpenseAmount),
        date: newExpenseDate
      }).eq('id', editingExpenseId);
      error = updateErr;
    } else {
      const { error: insertErr } = await supabase.from('expenses').insert([{
        expense_type: newExpenseType,
        amount: Number(newExpenseAmount),
        date: newExpenseDate
      }]);
      error = insertErr;
    }
    
    if (!error) {
      setIsExpenseModalOpen(false);
      setEditingExpenseId(null);
      setNewExpenseType('');
      setNewExpenseAmount('');
      setNewExpenseDate(format(new Date(), 'yyyy-MM-dd'));
      await fetchFinanceData();
    } else {
      console.error(error);
      alert('Error al guardar el gasto. Asegúrate de haber ejecutado el script SQL.');
      setIsLoading(false);
    }
  };

  const handleEditExpense = (exp: any) => {
    setEditingExpenseId(exp.id);
    setNewExpenseType(exp.expense_type);
    setNewExpenseAmount(exp.amount.toString());
    
    let dStr = exp.date;
    if (dStr.includes('T')) dStr = dStr.split('T')[0];
    setNewExpenseDate(dStr);
    
    setIsExpenseModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setExpenseToDelete(id);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setIsLoading(true);
    const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete);
    if (!error) {
      setExpenseToDelete(null);
      await fetchFinanceData();
    } else {
      console.error(error);
      alert('Error al eliminar el gasto.');
      setExpenseToDelete(null);
      setIsLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    const headers = ['Fecha', 'Paciente', 'Detalle', 'Metodo de Pago', 'Monto'];
    
    // Filter payments based on selected dates
    const start = reportStartDate ? startOfDay(new Date(reportStartDate)).getTime() : 0;
    const end = reportEndDate ? endOfDay(new Date(reportEndDate)).getTime() : Infinity;
    
    const filteredPayments = allPayments.filter(p => {
      const t = new Date(p.date).getTime();
      return t >= start && t <= end;
    });

    const csvData = filteredPayments.map(p => [
      format(new Date(p.date), 'dd/MM/yyyy HH:mm'),
      p.patientName,
      p.desc,
      p.method || 'Transferencia',
      p.amount.toString()
    ]);

    const titleRow = '"Bina Odontología Integral - Reporte Financiero"';
    const dateRow = `"Reporte desde: ${reportStartDate || 'Inicio'} hasta: ${reportEndDate || 'Fin'}"`;
    const emptyRow = '';

    const csvContent = [
      titleRow,
      dateRow,
      emptyRow,
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_finanzas_${reportStartDate || 'inicio'}_al_${reportEndDate || 'fin'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsReportModalOpen(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
  };

  const todayStr = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-auto min-h-full bg-surface animate-in fade-in duration-150">
      
      {/* Top Header */}
      <div className="flex-shrink-0 px-4 md:pl-8 md:pr-28 py-6 border-b border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest/50 backdrop-blur-md relative z-20">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight mb-1">Finanzas</h1>
          <p className="text-sm font-medium text-on-surface-variant capitalize">{todayStr}</p>
        </div>
        
        <div className="relative flex flex-wrap items-center gap-2">
          <button 
            onClick={() => {
              setEditingExpenseId(null);
              setNewExpenseType('');
              setNewExpenseAmount('');
              setNewExpenseDate(format(new Date(), 'yyyy-MM-dd'));
              setIsExpenseModalOpen(true);
            }}
            className="px-5 py-2.5 text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2 bg-primary text-on-primary hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Registrar Gasto
          </button>
          
          <button 
            onClick={() => setIsReportModalOpen(!isReportModalOpen)}
            className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2 ${isReportModalOpen ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined text-[18px]">summarize</span>
            Emitir Reporte
          </button>

          {isReportModalOpen && (
            <div className="absolute right-0 top-full mt-2 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-xl w-72 animate-in fade-in slide-in-from-top-2">
              <h4 className="text-sm font-bold text-on-surface mb-1">Rango del Reporte</h4>
              <p className="text-xs text-on-surface-variant mb-4">Selecciona las fechas a exportar.</p>
              
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Desde</label>
                  <input 
                    type="date" 
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Hasta</label>
                  <input 
                    type="date" 
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary" 
                  />
                </div>
              </div>

              <button 
                onClick={handleDownloadExcel}
                className="w-full py-2 bg-[#107c41] hover:bg-[#107c41]/90 text-white rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">table_chart</span>
                Descargar Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ margin: 0 }}>
          <div className="bg-surface-container-lowest w-full max-w-[400px] rounded-3xl shadow-2xl border border-outline-variant flex flex-col relative">
            <div className="bg-surface-container-low px-6 py-4 border-b border-outline-variant flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-on-surface text-lg">{editingExpenseId ? 'Editar Gasto' : 'Registrar Gasto'}</h3>
              <button onClick={() => { setIsExpenseModalOpen(false); setEditingExpenseId(null); }} className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-6 flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Fecha</label>
                <input 
                  type="date" 
                  value={newExpenseDate}
                  onChange={e => setNewExpenseDate(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-on-surface transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Tipo de Gasto (Insumo)</label>
                <input 
                  type="text" 
                  value={newExpenseType}
                  onChange={e => setNewExpenseType(e.target.value)}
                  placeholder="Ej. Guantes de látex, Anestesia"
                  className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-on-surface transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Monto</label>
                <input 
                  type="number" 
                  value={newExpenseAmount}
                  onChange={e => setNewExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-on-surface transition-colors"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => { setIsExpenseModalOpen(false); setEditingExpenseId(null); }} className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm">
                  {editingExpenseId ? 'Guardar Cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {expenseToDelete && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ margin: 0 }}>
          <div className="bg-surface-container-lowest w-full max-w-[400px] rounded-3xl shadow-2xl border border-outline-variant p-8 flex flex-col gap-4 text-center relative animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#EF4444]/10 text-[#EF4444] rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <h3 className="font-bold text-on-surface text-xl">¿Eliminar Gasto?</h3>
            <p className="text-sm text-on-surface-variant">Esta acción no se puede deshacer. El gasto se eliminará de forma permanente de tu historial.</p>
            <div className="pt-4 flex justify-center gap-3">
              <button type="button" onClick={() => setExpenseToDelete(null)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={confirmDeleteExpense} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#EF4444] text-white hover:bg-[#EF4444]/90 transition-colors shadow-sm">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 md:px-8 pt-6 overflow-x-auto no-scrollbar w-full">
        <div className="flex gap-2 p-1 bg-surface-container/50 rounded-2xl w-max min-w-full">
          {(['dashboard', 'transactions', 'receivables', 'expenses'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-surface-container-lowest text-primary shadow-sm scale-100'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low scale-95'
              }`}
            >
              {tab === 'dashboard' && 'Resumen'}
              {tab === 'transactions' && 'Transacciones'}
              {tab === 'receivables' && 'Cuentas por Cobrar'}
              {tab === 'expenses' && 'Gastos'}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-8 py-6 w-full">
        {activeTab === 'dashboard' && <DashboardTab metrics={dashboardMetrics} recentPayments={recentPayments} receivables={receivables} formatCurrency={formatCurrency} />}
        {activeTab === 'transactions' && <TransactionsTab allPayments={allPayments} formatCurrency={formatCurrency} />}
        {activeTab === 'receivables' && <ReceivablesTab receivables={receivables} formatCurrency={formatCurrency} />}
        {activeTab === 'expenses' && <ExpensesTab expenses={expenses} formatCurrency={formatCurrency} onEdit={handleEditExpense} onDelete={handleDeleteClick} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// DASHBOARD TAB
// ----------------------------------------------------------------------
function DashboardTab({ metrics, recentPayments, receivables, formatCurrency }: { metrics: any, recentPayments: any[], receivables: any[], formatCurrency: any }) {
  const [period, setPeriod] = useState<'diario' | 'mensual' | 'anual'>('mensual');

  const currentMetrics = metrics[period];
  
  const periodLabel = {
    diario: 'Ingresado Hoy',
    mensual: 'Ingresado en el Mes',
    anual: 'Ingresado en el Año'
  }[period];

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-150">
      
      {/* Period Toggle */}
      <div className="flex justify-center">
        <div className="flex gap-1 p-1 bg-surface-container rounded-full">
          {(['diario', 'mensual', 'anual'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all capitalize ${
                period === p ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm relative overflow-hidden group hover:border-primary/30 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          <p className="text-sm font-bold text-on-surface-variant mb-2">Total Ingresos</p>
          <h3 className="text-4xl font-black text-on-surface tracking-tight">{formatCurrency(currentMetrics.total)}</h3>
        </div>
        
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm relative overflow-hidden group hover:border-[#EF4444]/30 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#EF4444]/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          <p className="text-sm font-bold text-on-surface-variant mb-2">Total Gastos</p>
          <h3 className="text-4xl font-black text-[#EF4444] tracking-tight">{formatCurrency(currentMetrics.gastos || 0)}</h3>
        </div>
        
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm relative overflow-hidden group hover:border-[#10B981]/30 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          <p className="text-sm font-bold text-on-surface-variant mb-2">Balance Neto</p>
          <h3 className="text-4xl font-black text-[#10B981] tracking-tight">{formatCurrency(currentMetrics.total - (currentMetrics.gastos || 0))}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Últimos Pagos (Only Incomes) */}
        <div className="lg:col-span-1 bg-surface-container-lowest rounded-[2rem] border border-outline-variant/50 shadow-sm overflow-hidden flex flex-col h-auto min-h-[300px] lg:h-[400px]">
          <div className="p-5 border-b border-outline-variant/30 flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">Últimos Pagos</h2>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto no-scrollbar flex-1">
            {recentPayments.length === 0 && (
              <div className="text-center p-8 text-on-surface-variant text-sm">No hay pagos recientes.</div>
            )}
            {recentPayments.map((tx, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-colors group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-bina-crema text-bina-taupe">
                    <span className="material-symbols-outlined text-[16px]">
                      payments
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-on-surface text-sm">{tx.patientName}</div>
                    <div className="text-xs font-medium text-on-surface-variant line-clamp-1">{tx.desc}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-[#2e7d32]">+{formatCurrency(tx.amount)}</div>
                  <div className="text-[11px] font-medium text-on-surface-variant">{format(new Date(tx.date), "d MMM, HH:mm", {locale: es})}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagos Pendientes */}
        <div className="lg:col-span-1 bg-surface-container-lowest rounded-[2rem] border border-outline-variant/50 shadow-sm overflow-hidden flex flex-col h-auto min-h-[300px] lg:h-[400px]">
          <div className="p-5 border-b border-outline-variant/30 flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">Pagos Pendientes</h2>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto no-scrollbar flex-1">
            {receivables.length === 0 && (
              <div className="text-center p-8 text-on-surface-variant text-sm">No hay deudas pendientes.</div>
            )}
            {receivables.slice(0, 5).map((tx, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-colors group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#ffebee] text-[#c62828]">
                    <span className="material-symbols-outlined text-[16px]">
                      money_off
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-on-surface text-sm">{tx.name}</div>
                    <div className="text-xs font-medium text-on-surface-variant">Saldo Deudor</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-[#d32f2f]">{formatCurrency(tx.debt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TRANSACTIONS TAB
// ----------------------------------------------------------------------
function TransactionsTab({ allPayments, formatCurrency }: { allPayments: any[], formatCurrency: any }) {
  return (
    <div className="animate-in slide-in-from-bottom-4 duration-150 bg-surface-container-lowest rounded-[2rem] border border-outline-variant/50 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest sticky top-0 z-10">
        <h2 className="text-lg font-bold text-on-surface">Historial de Transacciones</h2>
      </div>
      
      <div className="flex-1 overflow-auto p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Fecha</th>
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Detalle</th>
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Método</th>
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {allPayments.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-on-surface-variant text-sm">
                  No hay transacciones registradas.
                </td>
              </tr>
            )}
            {allPayments.map((p, i) => (
              <tr key={i} className="hover:bg-surface-container-low/30 transition-colors">
                <td className="py-4 px-6 text-sm font-medium text-on-surface-variant whitespace-nowrap">
                  {format(new Date(p.date), "dd/MM/yyyy, HH:mm")}
                </td>
                <td className="py-4 px-6">
                  <div className="font-bold text-on-surface text-sm">{p.patientName}</div>
                  <div className="text-xs text-on-surface-variant max-w-xs truncate">{p.desc}</div>
                </td>
                <td className="py-4 px-6">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-surface border border-outline-variant text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">account_balance</span>
                    {p.method || 'Transferencia'}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <span className="font-black text-sm text-[#2e7d32]">+{formatCurrency(p.amount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// RECEIVABLES TAB
// ----------------------------------------------------------------------
function ReceivablesTab({ receivables, formatCurrency }: { receivables: any[], formatCurrency: any }) {
  return (
    <div className="animate-in slide-in-from-bottom-4 duration-150 bg-surface-container-lowest rounded-[2rem] border border-outline-variant/50 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Cuentas por Cobrar</h2>
          <p className="text-sm text-on-surface-variant">Pacientes con saldo deudor o presupuestos pendientes.</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Paciente</th>
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Deuda Pendiente</th>
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {receivables.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-on-surface-variant text-sm">
                  No hay pacientes con deuda. ¡Excelente!
                </td>
              </tr>
            )}
            {receivables.map((patient, i) => (
              <tr key={i} className="hover:bg-surface-container-low/30 transition-colors group">
                <td className="py-4 px-6 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs uppercase">
                      {patient.name.charAt(0)}
                    </div>
                    <span className="font-bold text-on-surface">{patient.name}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <span className="inline-block bg-error/10 text-error px-3 py-1 rounded-full text-sm font-black border border-error/20">
                    {formatCurrency(patient.debt)}
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <Link href={`/patients/${patient.id}`}>
                    <button className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10 inline-flex items-center gap-2" title="Ir a la ficha">
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      <span className="text-xs font-bold">Ver Ficha</span>
                    </button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// EXPENSES TAB
// ----------------------------------------------------------------------
function ExpensesTab({ expenses, formatCurrency, onEdit, onDelete }: { expenses: any[], formatCurrency: any, onEdit: (exp: any) => void, onDelete: (id: string) => void }) {
  return (
    <div className="animate-in slide-in-from-bottom-4 duration-150 bg-surface-container-lowest rounded-[2rem] border border-outline-variant/50 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Registro de Gastos e Insumos</h2>
          <p className="text-sm text-on-surface-variant">Listado de insumos comprados y gastos de la clínica.</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider w-48">Fecha</th>
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tipo de Gasto</th>
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right w-48">Monto</th>
              <th className="py-3 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right w-32">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {expenses.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-on-surface-variant text-sm">
                  No hay gastos registrados.
                </td>
              </tr>
            )}
            {expenses.map((exp, i) => (
              <tr key={exp.id || i} className="hover:bg-surface-container-low/30 transition-colors group cursor-default">
                <td className="py-4 px-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center border border-outline-variant/50 group-hover:border-primary/30 transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_today</span>
                    </div>
                    <span className="font-semibold text-sm text-on-surface">
                      {(() => {
                        if (exp.date.includes('T')) return format(new Date(exp.date), "dd/MM/yyyy");
                        const [y, m, d] = exp.date.split('-');
                        return format(new Date(Number(y), Number(m)-1, Number(d)), "dd/MM/yyyy");
                      })()}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-6 text-sm font-bold text-on-surface">
                  {exp.expense_type}
                </td>
                <td className="py-4 px-6 text-right">
                  <span className="font-black text-sm text-[#EF4444] block">
                    -{formatCurrency(exp.amount)}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onEdit(exp)} className="p-2 text-on-surface-variant hover:text-primary bg-surface border border-outline-variant rounded-xl hover:border-primary/50 transition-colors" title="Editar">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button onClick={() => onDelete(exp.id)} className="p-2 text-on-surface-variant hover:text-error bg-surface border border-outline-variant rounded-xl hover:border-error/50 transition-colors" title="Eliminar">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
