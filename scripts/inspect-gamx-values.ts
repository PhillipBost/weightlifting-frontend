
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function inspectGamx() {
    const { data, error } = await supabase
        .from('usaw_meet_results')
        .select('result_id, lifter_name, date, gamx_total, gamx_u, gamx_a, gamx_masters')
        .gt('date', '2024-01-01')
        .not('gamx_total', 'is', null)
        .limit(10);

    if (error) console.error(error);
    else console.table(data);
}

inspectGamx();
