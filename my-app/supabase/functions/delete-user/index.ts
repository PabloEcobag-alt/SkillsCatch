// supabase/functions/delete-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // SECURITY: Verify requester is admin
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseUrl = Deno.env.get('PROJECT_URL')
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

    console.log('PROJECT_URL:', supabaseUrl ? 'set' : 'NOT SET')
    console.log('SERVICE_ROLE_KEY:', serviceRoleKey ? 'set' : 'NOT SET')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ 
        error: 'Server configuration error: Missing environment variables' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Create admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    
    // Create client to verify admin status
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Check if user is admin using service role client to bypass RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      console.error('Unauthorized delete attempt by user:', user.id, 'role:', profile?.role, 'error:', profileError)
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    console.log('Admin verified:', user.id, 'Deleting user:', userId)

    console.log('Deleting profile for user:', userId)
    // First, delete the profile record
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (deleteProfileError) {
      console.error('Delete profile error:', deleteProfileError)
      // Continue anyway, profile might not exist
    } else {
      console.log('Profile deleted successfully')
    }

    console.log('Deleting auth user:', userId)
    
    // First, remove MFA factors if they exist
    try {
      const { data: { factors } } = await supabaseAdmin.auth.admin.listFactors(userId)
      if (factors && factors.length > 0) {
        console.log('Removing MFA factors:', factors.length)
        for (const factor of factors) {
          await supabaseAdmin.auth.admin.deleteFactor(userId, factor.id)
        }
        console.log('MFA factors removed')
      }
    } catch (mfaError) {
      console.error('Error removing MFA factors:', mfaError)
      // Continue anyway
    }

    // Then delete the auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Delete user error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log('User deleted successfully')

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
