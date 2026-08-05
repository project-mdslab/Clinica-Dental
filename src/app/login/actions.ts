'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Faltan credenciales' }
  }

  console.log('Attempting login with email:', email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  console.log('Login result:', { data: data?.user?.id, error });

  if (error) {
    return { error: 'Correo o contraseña incorrectos' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
