
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
    console.error('Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function calculateAverages() {
    console.log('Calculating National Averages (Last 24 Months)...');

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const dateStr = twoYearsAgo.toISOString().split('T')[0];

    let allGenders = [];
    let allAges = [];

    const chunkSize = 10000;
    let offset = 0;
    let fetchMore = true;

    // Safety break
    let loopCount = 0;
    const maxLoops = 100; // Limit to 1 million records approx

    while (fetchMore && loopCount < maxLoops) {
        console.log(`Fetching chunk starting at ${offset}...`);
        const { data, error } = await supabase
            .from('usaw_meet_results')
            .select('gender, competition_age')
            .gte('date', dateStr)
            .range(offset, offset + chunkSize - 1);

        if (error) {
            console.error('Error fetching data:', error.message);
            break;
        }

        if (!data || data.length === 0) {
            fetchMore = false;
            break;
        }

        data.forEach(r => {
            if (r.gender) allGenders.push(r.gender);
            if (r.competition_age) allAges.push(r.competition_age);
        });

        if (data.length < chunkSize) fetchMore = false;
        offset += chunkSize;
        loopCount++;
    }

    console.log(`Total Records Processed: ${allGenders.length}`);

    if (allGenders.length === 0) {
        console.log('No data found. Check your database connection or date range.');
        return;
    }

    // Gender Stats
    const totalGender = allGenders.length;
    const maleCount = allGenders.filter(g => g === 'M').length;
    const femaleCount = allGenders.filter(g => g === 'F').length;

    const genderDist = [
        { name: 'Male', value: (maleCount / totalGender) * 100 },
        { name: 'Female', value: (femaleCount / totalGender) * 100 }
    ];

    // Age Stats
    function getAgeBucket(age) {
        if (age < 15) return 'Under 15';
        if (age >= 100) return '100+';
        const start = Math.floor(age / 5) * 5;
        const end = start + 4;
        return `${start}-${end}`;
    }

    const ageCounts = {}; // Using object as map
    allAges.forEach(age => {
        const b = getAgeBucket(age);
        ageCounts[b] = (ageCounts[b] || 0) + 1;
    });

    const ageDist = Object.entries(ageCounts).map(([range, count]) => ({
        range,
        percentage: (count / allAges.length) * 100
    })).sort((a, b) => {
        const getStartAge = (range) => {
            if (range === 'Under 15') return 0;
            if (range === '100+') return 100;
            return parseInt(range.split('-')[0]);
        };
        return getStartAge(a.range) - getStartAge(b.range);
    });

    console.log('\n--- RESULTS (Copy these to your route.ts) ---');
    console.log('GENDER:');
    console.log(JSON.stringify(genderDist, null, 2));
    console.log('AGE:');
    console.log(JSON.stringify(ageDist, null, 2));
}

calculateAverages();
