const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Available env vars:', {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupBetterAuth() {
  console.log('🧹 Starting Better Auth cleanup...\n');

  const tablesToClean = ['session', 'verification', 'verification_token', 'account', 'user'];

  console.log('📋 Step 1: Clearing table data');
  for (const tableName of tablesToClean) {
    try {
      console.log(`  🗑️ Clearing data from ${tableName}...`);
      const { error } = await supabase
        .from(tableName)
        .delete()
        .neq('id', 'impossible-match'); // Delete all records

      if (error && !error.message.includes('does not exist')) {
        console.log(`  ⚠️ Error clearing ${tableName}: ${error.message}`);
      } else if (error && error.message.includes('does not exist')) {
        console.log(`  ✅ Table ${tableName} doesn't exist (already clean)`);
      } else {
        console.log(`  ✅ Cleared ${tableName} data`);
      }
    } catch (e) {
      console.log(`  ⚠️ Exception clearing ${tableName}: ${e.message}`);
    }
  }

  console.log('\n📊 Step 2: Verifying cleanup');
  for (const tableName of tablesToClean) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error && error.message.includes('does not exist')) {
        console.log(`  ✅ ${tableName} - Table doesn't exist`);
      } else if (!error) {
        console.log(`  📊 ${tableName} - ${data?.length || 0} records remaining`);
      } else {
        console.log(`  ⚠️ ${tableName} - Error: ${error.message}`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${tableName} - Exception: ${e.message}`);
    }
  }

  console.log('\n🔧 Step 3: Checking functions');
  const functionsToCheck = [
    'create_better_auth_user', 
    'handle_better_auth_session', 
    'better_auth_trigger', 
    'update_updated_at_column'
  ];

  for (const funcName of functionsToCheck) {
    try {
      const { error } = await supabase.rpc(funcName, {});
      if (error && error.message.includes('does not exist')) {
        console.log(`  ✅ ${funcName} - Function doesn't exist`);
      } else if (error) {
        console.log(`  ❌ ${funcName} - Function still exists: ${error.message}`);
      } else {
        console.log(`  ❌ ${funcName} - Function still exists and callable`);
      }
    } catch (e) {
      if (e.message.includes('does not exist')) {
        console.log(`  ✅ ${funcName} - Function doesn't exist`);
      } else {
        console.log(`  ⚠️ ${funcName} - Exception: ${e.message}`);
      }
    }
  }

  console.log('\n✅ Step 4: Verifying current auth system');
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    if (!error) {
      console.log(`  ✅ profiles table working (${profiles.length} records)`);
    } else {
      console.log(`  ❌ profiles table error: ${error.message}`);
    }
  } catch (e) {
    console.log(`  ⚠️ profiles table exception: ${e.message}`);
  }
}

cleanupBetterAuth().then(() => {
  console.log('\n🎉 Better Auth cleanup completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});