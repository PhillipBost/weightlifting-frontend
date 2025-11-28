import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testUSAW2025() {
    console.log('Testing USAW 2025 rankings generation...\n');

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing USAW Supabase environment variables');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        const year = 2025;
        let allResults: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('usaw_meet_results')
                .select(`
                    result_id,
                    meet_id,
                    lifter_id,
                    lifter_name,
                    gender,
                    weight_class,
                    age_category,
                    date,
                    meet_name,
                    body_weight_kg,
                    competition_age,
                    best_snatch,
                    best_cj,
                    total,
                    qpoints,
                    q_youth,
                    q_masters,
                    lifters!inner(membership_number)
                `)
                .gte('date', `${year}-01-01`)
                .lte('date', `${year}-12-31`)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw new Error(`Error: ${error.message}`);

            if (data && data.length > 0) {
                allResults.push(...data);
                console.log(`  Fetched ${allResults.length} results...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`  Total results: ${allResults.length}\n`);

        if (allResults.length === 0) {
            console.log('  No results found for 2025');
            return;
        }

        // Show sample data
        console.log('Sample result:');
        console.log(JSON.stringify(allResults[0], null, 2));
        console.log('\n');

        const processedResults = allResults.map(result => ({
            result_id: result.result_id,
            meet_id: result.meet_id,
            lifter_id: result.lifter_id,
            membership_number: result.lifters?.membership_number || null,
            lifter_name: result.lifter_name,
            gender: result.gender,
            weight_class: result.weight_class,
            age_category: result.age_category,
            date: result.date,
            meet_name: result.meet_name,
            body_weight_kg: result.body_weight_kg,
            competition_age: result.competition_age,
            best_snatch: parseFloat(result.best_snatch) || 0,
            best_cj: parseFloat(result.best_cj) || 0,
            total: parseFloat(result.total) || 0,
            qpoints: parseFloat(result.qpoints) || 0,
            q_youth: result.q_youth ? parseFloat(result.q_youth) : null,
            q_masters: result.q_masters ? parseFloat(result.q_masters) : null
        }));

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `usaw-rankings-${year}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`✓ Saved to ${outputPath}`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`  Uncompressed size: ${(jsonData.length / 1024).toFixed(2)} KB`);
        console.log(`  Compression ratio: ${((1 - stats.size / jsonData.length) * 100).toFixed(1)}%`);

    } catch (err) {
        console.error('Failed:', err);
    }
}

async function testIWF2025() {
    console.log('\n\nTesting IWF 2025 rankings generation...\n');

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_IWF_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing IWF Supabase environment variables');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        const year = 2025;
        let allResults: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('iwf_meet_results')
                .select(`
                    db_result_id,
                    db_meet_id,
                    db_lifter_id,
                    lifter_name,
                    gender,
                    weight_class,
                    age_category,
                    date,
                    meet_name,
                    body_weight_kg,
                    competition_age,
                    best_snatch,
                    best_cj,
                    total,
                    qpoints,
                    q_youth,
                    q_masters,
                    iwf_lifters!inner(iwf_lifter_id)
                `)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw new Error(`Error: ${error.message}`);

            if (data && data.length > 0) {
                const yearResults = data.filter(result => {
                    if (!result.date) return false;
                    const dateYear = result.date.trim().slice(-4);
                    return dateYear === year.toString();
                });

                allResults.push(...yearResults);
                console.log(`  Fetched ${allResults.length} results for ${year}...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`  Total results: ${allResults.length}\n`);

        if (allResults.length === 0) {
            console.log('  No results found for 2025');
            return;
        }

        console.log('Sample result:');
        console.log(JSON.stringify(allResults[0], null, 2));
        console.log('\n');

        const processedResults = allResults.map(result => ({
            db_result_id: result.db_result_id,
            db_meet_id: result.db_meet_id,
            db_lifter_id: result.db_lifter_id,
            iwf_lifter_id: result.iwf_lifters?.iwf_lifter_id || null,
            lifter_name: result.lifter_name,
            gender: result.gender,
            weight_class: result.weight_class,
            age_category: result.age_category,
            date: result.date,
            meet_name: result.meet_name,
            body_weight_kg: result.body_weight_kg,
            competition_age: result.competition_age,
            best_snatch: parseFloat(result.best_snatch) || 0,
            best_cj: parseFloat(result.best_cj) || 0,
            total: parseFloat(result.total) || 0,
            qpoints: parseFloat(result.qpoints) || 0,
            q_youth: result.q_youth ? parseFloat(result.q_youth) : null,
            q_masters: result.q_masters ? parseFloat(result.q_masters) : null
        }));

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `iwf-rankings-${year}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`✓ Saved to ${outputPath}`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`  Uncompressed size: ${(jsonData.length / 1024).toFixed(2)} KB`);
        console.log(`  Compression ratio: ${((1 - stats.size / jsonData.length) * 100).toFixed(1)}%`);

    } catch (err) {
        console.error('Failed:', err);
    }
}

async function main() {
    await testUSAW2025();
    await testIWF2025();
    console.log('\n✓ Test complete!');
}

main();
