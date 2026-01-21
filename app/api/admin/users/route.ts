import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client with service role for user management
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  : null

export async function GET(request: NextRequest) {
  try {
    // Check if service role key is configured
    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'Service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.'
      }, { status: 500 })
    }
    // Get the session from cookies
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin using admin client to avoid RLS issues
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      console.error('Admin check failed:', { profileError, userRole: profile?.role, userId: user.id })
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get all users with their profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get auth users to get last_sign_in_at
    // page 1, 1000 users - should cover reasonably sized user base for now
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    if (authError) {
      console.error('Error fetching auth users:', authError)
      // Continue with just profiles if auth fetch fails
    }

    // Create a map for quick lookup
    const authUserMap = new Map(authUsers?.map(u => [u.id, u]) || [])

    // Format the response
    const users = profiles.map(profile => {
      const authUser = authUserMap.get(profile.id)
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name || '',
        role: profile.role,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        lastLogin: authUser?.last_sign_in_at || null
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error in GET /api/admin/users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}