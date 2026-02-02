import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_IWF_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer Service Role Key for backend scripts to bypass RLS, otherwise use Anon Key
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing IWF Supabase environment variables (URL/KEY). Ensure SUPABASE_SERVICE_ROLE_KEY or ANON_KEY is set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function generateIwSanctions() {
    console.log('Fetching IWF Sanctions...');

    try {
        const { data, error } = await supabase
            .from('iwf_sanctions')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            throw new Error(`Error fetching sanctions: ${error.message}`);
        }

        if (!data || data.length === 0) {
            console.log('No sanctions found.');
            return;
        }

        console.log(`Fetched ${data.length} sanctions.`);

        // Compress and save
        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(data);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, 'iwf-sanctions.json.gz');
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`Saved to ${outputPath}`);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);

    } catch (err) {
        console.error('Failed to generate sanctions file:', err);
        process.exit(1);
    }
}

generateIwSanctions();
