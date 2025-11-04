import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import LoginPage from '@/components/auth/login-page';

export default async function LoginRoute() {
  const supabase = await getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect('/dashboard');
  }

  return <LoginPage />;
}