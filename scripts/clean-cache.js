const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    try {
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`✅ Deleted: ${folderPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete ${folderPath}:`, error.message);
      return false;
    }
  } else {
    console.log(`ℹ️  Not found (skipping): ${folderPath}`);
    return true;
  }
}

console.log('🧹 Cleaning Next.js build cache...\n');

const nextDir = path.join(process.cwd(), '.next');
const nodeCacheDir = path.join(process.cwd(), 'node_modules', '.cache');

const success1 = deleteFolderRecursive(nextDir);
const success2 = deleteFolderRecursive(nodeCacheDir);

if (success1 && success2) {
  console.log('\n✨ Cache cleaned successfully!');
  console.log('💡 You can now run: npm run dev\n');
} else {
  console.log('\n⚠️  Some cache directories could not be deleted.');
  console.log('💡 Try closing all running processes and try again.\n');
  process.exit(1);
}
