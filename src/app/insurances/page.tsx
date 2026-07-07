import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function InsurancesPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch insurances
  const { data: insurances } = await supabase.from('health_insurances').select('*').order('name');

  return (
    <div className="p-lg md:p-xl max-w-7xl mx-auto space-y-lg animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display-sm text-display-sm text-on-surface mb-2">Obras Sociales</h1>
          <p className="text-on-surface-variant text-body-lg">Gestiona las obras sociales y actualiza los tarifarios mensuales.</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-lg hover:bg-primary/90 transition-colors shadow-sm">
          <span className="material-symbols-outlined">add</span>
          Nueva Obra Social
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
        {insurances && insurances.length > 0 ? (
          insurances.map((ins: any) => (
            <div key={ins.id} className="bg-surface-container-low rounded-2xl p-md border border-outline-variant shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <h3 className="font-headline-sm text-headline-sm text-primary">{ins.name}</h3>
              <p className="text-on-surface-variant text-sm mt-1 mb-4 flex-1">{ins.contact_info || "Sin información de contacto"}</p>
              
              <div className="pt-4 border-t border-outline-variant mt-auto">
                <button className="w-full py-2 bg-primary-container text-on-primary-container font-label-md rounded-lg flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-colors">
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  Importar Tarifario
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-xl text-center bg-surface-container-lowest rounded-3xl border border-outline-variant border-dashed">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">health_and_safety</span>
            <h3 className="font-title-md text-title-md text-on-surface mb-1">No hay Obras Sociales</h3>
            <p className="text-on-surface-variant text-body-md mb-6">Comienza agregando las obras sociales con las que trabaja la clínica.</p>
            <button className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-full font-label-md hover:bg-primary/90 transition-colors">
              <span className="material-symbols-outlined">add</span>
              Añadir la Primera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
