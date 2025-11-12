import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { ROLES } from '@/lib/roles'

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

export async function POST(request: NextRequest) {
  try {
    // Check if service role key is configured
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.' 
      }, { status: 500 })
    }
    const { userId, newRole } = await request.json()

    if (!userId || !newRole) {
      return NextResponse.json({ error: 'Missing userId or newRole' }, { status: 400 })
    }

    // Validate the role
    const validRoles = Object.values(ROLES)
    if (!validRoles.includes(newRole as any)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
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

    // Prevent admins from removing their own admin role
    if (userId === user.id && newRole !== ROLES.ADMIN) {
      return NextResponse.json({ 
        error: 'Cannot remove your own admin privileges' 
      }, { status: 400 })
    }

    // Update the user's role
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating user role:', updateError)
      return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name,
        role: updatedProfile.role,
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at
      }
    })
  } catch (error) {
    console.error('Error in POST /api/admin/update-role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}