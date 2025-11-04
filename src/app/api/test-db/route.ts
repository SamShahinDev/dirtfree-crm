import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  return Response.json({ data, error, count: data?.length || 0 })
}