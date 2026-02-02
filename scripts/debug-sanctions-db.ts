
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_IWF_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSanctions() {
    console.log("Checking connection to:", supabaseUrl);

    // 1. List all tables in public schema
    console.log("\n--- Listing Tables ---");
    const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

    // Note: accessing information_schema might fail with anon key depending on policies, 
    // but usually works. If not, we rely on the specific select below.

    if (tableError) {
        console.error("Error listing tables:", tableError.message);
    } else {
        console.log("Tables found:", tables?.map(t => t.table_name).join(', '));
    }

    // 2. Try to select from iwf_sanctions
    console.log("\n--- Querying iwf_sanctions ---");
    const { data, error, count } = await supabase
        .from('iwf_sanctions')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Error querying iwf_sanctions:", error);
        if (error.code === '42P01') {
            console.error("RELATION DOES NOT EXIST. The table name might be wrong or in a different schema.");
        }
    } else {
        console.log(`Found ${count} rows in iwf_sanctions (HEAD request).`);
    }

    // 3. Try to select just one row to check data structure
    const { data: rows, error: rowError } = await supabase
        .from('iwf_sanctions')
        .select('*')
        .limit(1);

    if (rowError) {
        console.log("Error querying rows:", rowError.message);
    } else if (rows && rows.length > 0) {
        console.log("Sample row keys:", Object.keys(rows[0]));
    } else {
        console.log("Table allows access but returned 0 rows. (RLS might be blocking select)");
    }
}

debugSanctions();
