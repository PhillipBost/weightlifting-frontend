
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function inspectGamx() {
    const { data, error } = await supabase
        .from('iwf_meet_results')
        .select('*')
        .limit(1);

    if (error) console.error(error);
    else console.table(data);
}

inspectGamx();
