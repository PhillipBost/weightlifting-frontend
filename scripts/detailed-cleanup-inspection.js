const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function detailedInspection() {
  console.log('🔍 Detailed inspection of Better Auth remnants...\n');

  const betterAuthTables = ['account', 'session', 'user', 'verification', 'verification_token'];

  // Check table structures and data
  for (const tableName of betterAuthTables) {
    console.log(`\n📋 Analyzing table: ${tableName}`);
    
    try {
      // Check if table has any data
      const { data: sampleData, error: dataError } = await supabase
        .from(tableName)
        .select('*')
        .limit(5);
        
      if (!dataError && sampleData) {
        console.log(`  📊 Records found: ${sampleData.length} (showing first 5)`);
        if (sampleData.length > 0) {
          console.log(`  🔑 Columns: ${Object.keys(sampleData[0]).join(', ')}`);
          console.log(`  📝 Sample data:`, sampleData[0]);
        }
      } else {
        console.log(`  ❌ Error querying ${tableName}: ${dataError?.message}`);
      }

      // Get row count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
        
      if (!countError) {
        console.log(`  📈 Total rows: ${count}`);
      }
    } catch (e) {
      console.log(`  ⚠️ Error inspecting ${tableName}: ${e.message}`);
    }
  }

  // Check for any Better Auth related functions/triggers
  console.log('\n🔧 Checking for Better Auth functions and triggers...');
  
  try {
    // Try to run a query to see all functions
    const { data: functions, error } = await supabase
      .rpc('list_functions_and_triggers');
      
    if (error) {
      console.log('Could not query functions directly, checking manually...');
      
      // Check for common Better Auth functions
      const commonFunctions = [
        'create_better_auth_user',
        'handle_better_auth_session',
        'better_auth_trigger',
        'update_updated_at_column'
      ];
      
      for (const funcName of commonFunctions) {
        try {
          const { error } = await supabase.rpc(funcName, {});
          if (!error || error.message.includes('function') && !error.message.includes('does not exist')) {
            console.log(`  ❌ Function found: ${funcName}`);
          } else {
            console.log(`  ✅ Function ${funcName} does not exist`);
          }
        } catch (e) {
          if (e.message.includes('does not exist')) {
            console.log(`  ✅ Function ${funcName} does not exist`);
          } else {
            console.log(`  ⚠️ Error checking ${funcName}: ${e.message}`);
          }
        }
      }
    }
  } catch (e) {
    console.log('Could not check functions:', e.message);
  }

  // Check current working tables
  console.log('\n✅ Verifying current working auth system:');
  
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(3);
      
    if (!error) {
      console.log(`  ✅ profiles table working (${profiles.length} records)`);
      if (profiles.length > 0) {
        console.log(`  🔑 Profile columns: ${Object.keys(profiles[0]).join(', ')}`);
      }
    } else {
      console.log(`  ❌ profiles table error: ${error.message}`);
    }
  } catch (e) {
    console.log(`  ⚠️ Error checking profiles: ${e.message}`);
  }

  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (!error) {
      console.log(`  ✅ auth.users working (${users.users.length} users)`);
    } else {
      console.log(`  ❌ auth.users error: ${error.message}`);
    }
  } catch (e) {
    console.log(`  ⚠️ Error checking auth.users: ${e.message}`);
  }
}

detailedInspection().then(() => {
  console.log('\n✅ Detailed inspection complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Inspection failed:', error);
  process.exit(1);
});