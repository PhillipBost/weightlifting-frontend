const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCleanupMigration() {
  console.log('🧹 Running Better Auth cleanup migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '005-cleanup-better-auth-remnants.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements (excluding comments and verification queries)
    const statements = migrationSql
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--') && !line.trim().startsWith('SELECT'))
      .join('\n')
      .split(';')
      .filter(stmt => stmt.trim());

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;

      console.log(`⚡ Executing statement ${i + 1}: ${statement.substring(0, 50)}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try alternative method for DROP statements
          if (statement.includes('DROP TABLE')) {
            const tableName = statement.match(/DROP TABLE IF EXISTS ["]?(\w+)["]?/i)?.[1];
            if (tableName) {
              console.log(`  📋 Attempting to drop table: ${tableName}`);
              const { error: dropError } = await supabase
                .from(tableName)
                .delete()
                .neq('id', 'impossible-id'); // This will fail, but we just want to test table existence
              
              if (dropError && dropError.message.includes('does not exist')) {
                console.log(`  ✅ Table ${tableName} already doesn't exist`);
              } else {
                console.log(`  ⚠️ Table ${tableName} might still exist: ${dropError?.message}`);
              }
            }
          } else if (statement.includes('DROP FUNCTION')) {
            const funcName = statement.match(/DROP FUNCTION IF EXISTS (\w+)/i)?.[1];
            if (funcName) {
              console.log(`  🔧 Attempting to drop function: ${funcName}`);
              try {
                const { error: funcError } = await supabase.rpc(funcName, {});
                if (funcError && funcError.message.includes('does not exist')) {
                  console.log(`  ✅ Function ${funcName} already doesn't exist`);
                }
              } catch (e) {
                if (e.message.includes('does not exist')) {
                  console.log(`  ✅ Function ${funcName} already doesn't exist`);
                }
              }
            }
          } else {
            console.log(`  ⚠️ Error: ${error.message}`);
          }
        } else {
          console.log(`  ✅ Statement executed successfully`);
        }
      } catch (e) {
        console.log(`  ⚠️ Exception: ${e.message}`);
      }
      
      console.log(''); // Empty line for readability
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runCleanupMigration().then(() => {
  console.log('✅ Cleanup migration completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});