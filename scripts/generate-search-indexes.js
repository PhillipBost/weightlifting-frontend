const { execSync } = require('child_process');
const path = require('path');

const scripts = [
    'generate-iwf-search-index.ts',
    'generate-usaw-search-index.ts',
    'generate-usaw-meet-search-index.ts',
    'generate-iwf-meet-search-index.ts',
    'generate-usaw-rankings.ts',
    'generate-iwf-rankings.ts'
];

console.log('🚀 Starting master search index generation...');

for (const script of scripts) {
    const scriptPath = path.join(__dirname, script);
    console.log(`\n--------------------------------------------------`);
    console.log(`Running ${script}...`);
    console.log(`--------------------------------------------------\n`);

    try {
        // Use npx tsx to execute the TypeScript scripts
        execSync(`npx tsx "${scriptPath}"`, { stdio: 'inherit' });
        console.log(`\n✅ Successfully ran ${script}`);
    } catch (error) {
        console.error(`\n❌ Failed to run ${script}:`, error.message);
        process.exit(1);
    }
}

console.log('\n🎉 All search indexes and rankings generated successfully!');
