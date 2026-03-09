import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const listingId = searchParams.get('listing_id')

        if (!listingId) {
            return NextResponse.json({ error: 'listing_id query param required' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('usaw_meet_entries')
            .select('club, wso')
            .eq('listing_id', parseInt(listingId))

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data || [])
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
