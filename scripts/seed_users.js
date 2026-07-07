const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const usersToCreate = [
    { email: 'admin@bina.com', password: 'password123', role: 'superuser', name: 'SuperUsuario' },
    { email: 'martina@bina.com', password: 'password123', role: 'professional', name: 'Martina Johnston' },
    { email: 'secretaria@bina.com', password: 'password123', role: 'secretary', name: 'Secretaria' }
  ];

  console.log('--- Creando Usuarios y Roles en Supabase ---');

  for (const u of usersToCreate) {
    // 1. Crear usuario en auth.users
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
      options: {
        data: {
          full_name: u.name,
        }
      }
    });

    if (authError) {
      console.error(`Error creando ${u.email}:`, authError.message);
      continue;
    }

    const userId = authData.user.id;
    console.log(`Usuario creado: ${u.email} (ID: ${userId})`);

    // 2. Insertar rol en user_roles
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([{ user_id: userId, role: u.role }]);

    if (roleError) {
       console.error(`Error asignando rol a ${u.email}:`, roleError.message);
    } else {
       console.log(`Rol '${u.role}' asignado a ${u.email}`);
    }
  }
  
  console.log('--- Proceso Terminado ---');
}

main();
