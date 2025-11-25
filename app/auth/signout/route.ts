import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    // Check if we have a session first
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
        await supabase.auth.signOut()
    }

    const url = new URL(request.url)
    return NextResponse.redirect(new URL('/', url.origin), {
        status: 302,
    })
}
