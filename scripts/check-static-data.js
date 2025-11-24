const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'public', 'data');

// Required static data files that must exist before dev server starts
const requiredFiles = [
  'wso-boundaries.json',
  'club-locations.json',
  'usaw-athlete-search-index.json.gz'
];

console.log('🔍 Checking for required static data files...');

const missingFiles = requiredFiles.filter(file =>
  !fs.existsSync(path.join(dataDir, file))
);

if (missingFiles.length > 0) {
  console.error('\n❌ Missing required static data files:');
  missingFiles.forEach(f => console.error(`   - ${f}`));
  console.error('\n🔧 Please run: npm run generate-all');
  console.error('   (This will take ~2 minutes to generate all static data)\n');
  process.exit(1);
}

console.log('✅ All required static data files are present\n');
