
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Robust environment variable loader for local development
function loadEnv() {
    const envFiles = ['.env.local', '.env'];

    for (const file of envFiles) {
        const envPath = path.resolve(__dirname, '..', file);
        if (fs.existsSync(envPath)) {
            console.log(`Loading credentials from ${file}...`);
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                // Initial cleanup
                let trimmed = line.trim();
                // Skip comments
                if (!trimmed || trimmed.startsWith('#')) return;

                // key=value split
                const equalsIndex = trimmed.indexOf('=');
                if (equalsIndex !== -1) {
                    const key = trimmed.substring(0, equalsIndex).trim();
                    let value = trimmed.substring(equalsIndex + 1).trim();

                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    // Only set if not already set (process.env priority)
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
            // Stop after finding the first valid env file (priority order)
            return;
        }
    }
    console.warn('No .env.local or .env file found in project root.');
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase credentials.');
    console.error(`Url: ${supabaseUrl ? 'Found' : 'Missing'}`);
    console.error(`Key: ${supabaseKey ? 'Found' : 'Missing'}`);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectColumns() {
    console.log('Fetching rows with non-null gamx_total...');

    const { data: gamxData, error: gamxError } = await supabase
        .from('usaw_meet_results')
        .select('gamx_u, gamx_a, gamx_masters, gamx_total, gamx_s, gamx_j, competition_age, gender')
        .not('gamx_total', 'is', null)
        .limit(5);

    if (gamxError) {
        console.error('Error fetching gamx data:', gamxError.message);
    } else {
        console.log('\n--- GAMX DATA SAMPLES ---');
        console.table(gamxData);
    }
}

inspectColumns();
