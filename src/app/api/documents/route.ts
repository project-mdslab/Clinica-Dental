import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    const patient_id = url.searchParams.get('patient_id');

    let query = supabase
      .from('patient_documents')
      .select('*, patients(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (patient_id) {
      query = query.eq('patient_id', patient_id);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { patient_id, template_id, title, type, content, signature_url } = body;

    // Get current user id
    const { data: { session } } = await supabase.auth.getSession();
    const professional_id = session?.user?.id;

    const { data, error } = await supabase
      .from('patient_documents')
      .insert({ 
        patient_id, 
        template_id, 
        title, 
        type, 
        content, 
        signature_url,
        professional_id
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, content } = body;

    if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 });

    const { data, error } = await supabase
      .from('patient_documents')
      .update({ content })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 });

    const { error } = await supabase.from('patient_documents').delete().eq('id', id);
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
