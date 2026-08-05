import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inicializar cliente de Supabase con Service Role (requerido para auth.admin)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: usersData, error } = await supabase.auth.admin.listUsers();
    
    if (error) throw error;
    
    const { data: rolesData, error: rolesError } = await supabase.from('user_roles').select('*');
    
    if (rolesError) throw rolesError;
    
    const rolesMap = new Map((rolesData || []).map(r => [r.user_id, r.role]));

    const professionals = usersData.users.map(u => {
      const dbRole = rolesMap.get(u.id);
      const metaRole = u.user_metadata?.role;
      const finalRole = dbRole || metaRole;
      
      let finalName = '';
      if (u.user_metadata?.first_name) {
        finalName = `${u.user_metadata.first_name} ${u.user_metadata.last_name || ''}`.trim();
      } else if (u.user_metadata?.full_name) {
        finalName = u.user_metadata.full_name;
      } else if (u.user_metadata?.name) {
        finalName = u.user_metadata.name;
      }

      return {
        id: u.id,
        email: u.email,
        name: finalName || 'Usuario sin nombre',
        avatar_url: u.user_metadata?.avatar_url || '',
        color: u.user_metadata?.color || 'bg-primary',
        role: finalRole,
        matricula: u.user_metadata?.matricula || '',
        clinic_address: u.user_metadata?.clinic_address || '',
        clinic_logo_url: u.user_metadata?.clinic_logo_url || ''
      };
    }).filter(p => p.role === 'professional' || p.role === 'superuser');

    return NextResponse.json(professionals);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { email, password, name, color, role, avatar_url, matricula, clinic_address, clinic_logo_url } = body;

    const names = name.split(' ');
    const first_name = names[0];
    const last_name = names.slice(1).join(' ');

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        color: color || 'bg-primary',
        role: role || 'professional',
        avatar_url: avatar_url || '',
        matricula: matricula || '',
        clinic_address: clinic_address || '',
        clinic_logo_url: clinic_logo_url || ''
      }
    });

    if (error) throw error;

    // Sync con user_roles
    if (data.user) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role: role || 'professional' });
      if (roleError) console.error('Error inserting into user_roles:', roleError);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { id, password, name, color, role, avatar_url, matricula, clinic_address, clinic_logo_url } = body;

    const updateData: any = {
      user_metadata: {}
    };

    if (password) updateData.password = password;
    if (name) {
      const names = name.split(' ');
      updateData.user_metadata.first_name = names[0];
      updateData.user_metadata.last_name = names.slice(1).join(' ');
    }
    if (color) updateData.user_metadata.color = color;
    if (role) updateData.user_metadata.role = role;
    if (avatar_url !== undefined) updateData.user_metadata.avatar_url = avatar_url;
    if (matricula !== undefined) updateData.user_metadata.matricula = matricula;
    if (clinic_address !== undefined) updateData.user_metadata.clinic_address = clinic_address;
    if (clinic_logo_url !== undefined) updateData.user_metadata.clinic_logo_url = clinic_logo_url;

    // Fetch existing metadata to merge
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(id);
    if (!userError && user?.user_metadata) {
      updateData.user_metadata = {
        ...user.user_metadata,
        ...updateData.user_metadata
      };
    }

    const { data, error } = await supabase.auth.admin.updateUserById(id, updateData);

    if (error) throw error;

    if (role) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', id);
      if (roleError) console.error('Error updating user_roles:', roleError);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const { data, error } = await supabase.auth.admin.deleteUser(id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
