
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const supabaseUrl = 'https://supabasekong-zoss8scsow00wsssgkck0g88.46.62.223.85.sslip.io';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NDM1NTg2MCwiZXhwIjo0OTIwMDI5NDYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.fscJwL-qBbPw_S0AKMUlbgYGd8uJWEyem0mOTkQ5q6s';


if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
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
    const maxLoops = 100; // Limit to 1 million records approx just in case

    while (fetchMore && loopCount < maxLoops) {
        console.log(`Fetching chunk starting at ${offset}...`);
        const { data, error } = await supabase
            .from('usaw_meet_results')
            .select('gender, competition_age')
            .gte('date', dateStr)
            .range(offset, offset + chunkSize - 1);

        if (error) {
            console.error('Error:', error);
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

    console.log('\n--- RESULTS ---');
    console.log('GENDER:');
    console.log(JSON.stringify(genderDist, null, 2));
    console.log('AGE:');
    console.log(JSON.stringify(ageDist, null, 2));
}

calculateAverages();
