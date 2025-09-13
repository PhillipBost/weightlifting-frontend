const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalVerification() {
  console.log('🔍 Final verification of cleanup status...\n');

  // Check Better Auth tables are empty
  const betterAuthTables = ['account', 'session', 'user', 'verification'];
  
  console.log('📊 Better Auth Tables Status:');
  let allTablesEmpty = true;
  
  for (const tableName of betterAuthTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error && error.message.includes('does not exist')) {
        console.log(`  ✅ ${tableName} - Table doesn't exist`);
      } else if (!error) {
        const count = data?.length || 0;
        if (count === 0) {
          console.log(`  ✅ ${tableName} - Empty (0 records)`);
        } else {
          console.log(`  ❌ ${tableName} - Still has ${count} records`);
          allTablesEmpty = false;
        }
      } else {
        console.log(`  ⚠️ ${tableName} - Error: ${error.message}`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${tableName} - Exception: ${e.message}`);
    }
  }

  // Check current auth system
  console.log('\n✅ Current Auth System Status:');
  
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*');

    if (!error) {
      console.log(`  ✅ profiles table working (${profiles.length} records)`);
      if (profiles.length > 0) {
        console.log('  📋 Current profiles:');
        profiles.forEach(profile => {
          console.log(`    - ${profile.email} (${profile.role}) - ${profile.full_name}`);
        });
      }
    } else {
      console.log(`  ❌ profiles table error: ${error.message}`);
    }
  } catch (e) {
    console.log(`  ⚠️ profiles table exception: ${e.message}`);
  }

  // Check Supabase auth users
  try {
    const { data: authUsers, error } = await supabase.auth.admin.listUsers();
    if (!error && authUsers.users) {
      console.log(`  ✅ Supabase auth.users working (${authUsers.users.length} users)`);
      if (authUsers.users.length > 0) {
        console.log('  📋 Current auth users:');
        authUsers.users.forEach(user => {
          console.log(`    - ${user.email} - ID: ${user.id.substring(0, 8)}...`);
        });
      }
    } else {
      console.log(`  ❌ auth.users error: ${error?.message || 'No error message'}`);
    }
  } catch (e) {
    console.log(`  ⚠️ auth.users exception: ${e.message}`);
  }

  // Summary
  console.log('\n📋 Cleanup Summary:');
  if (allTablesEmpty) {
    console.log('  ✅ All Better Auth table data has been cleared');
    console.log('  📝 Note: Table structures still exist but are empty');
    console.log('  💡 To complete cleanup, table structures should be dropped via Supabase dashboard');
  } else {
    console.log('  ⚠️ Some Better Auth tables still contain data');
  }
}

finalVerification().then(() => {
  console.log('\n✅ Final verification complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});