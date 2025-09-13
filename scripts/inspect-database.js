const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.log('Available env vars:', {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
  console.log('🔍 Inspecting database for Better Auth remnants...\n');

  try {
    // Get all tables in public schema
    const { data: tables, error: tablesError } = await supabase.rpc('get_schema_tables', {});
    
    if (tablesError) {
      console.log('Using alternative method to check tables...');
      
      // Alternative: Check for specific Better Auth tables
      const betterAuthTables = [
        'account', 'session', 'user', 'verification', 
        'twoFactor', 'passkey', 'invitation', 'organization',
        'organizationMember', 'organizationRole'
      ];
      
      console.log('🔍 Checking for Better Auth tables:');
      for (const tableName of betterAuthTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
            
          if (!error) {
            console.log(`❌ Found Better Auth table: ${tableName}`);
          } else if (error.message.includes('does not exist')) {
            console.log(`✅ Table ${tableName} does not exist`);
          } else {
            console.log(`⚠️ Error checking ${tableName}: ${error.message}`);
          }
        } catch (e) {
          console.log(`⚠️ Error checking ${tableName}: ${e.message}`);
        }
      }
      
      // Check current auth-related tables
      console.log('\n🔍 Checking current auth-related tables:');
      const currentTables = ['profiles', 'auth.users'];
      
      for (const tableName of currentTables) {
        try {
          if (tableName === 'auth.users') {
            const { data, error } = await supabase.auth.admin.listUsers();
            if (!error) {
              console.log(`✅ auth.users table exists and accessible (${data.users.length} users)`);
            }
          } else {
            const { data, error } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
              
            if (!error) {
              console.log(`✅ ${tableName} table exists (${data[0].count} records)`);
            } else {
              console.log(`❌ Error with ${tableName}: ${error.message}`);
            }
          }
        } catch (e) {
          console.log(`⚠️ Error checking ${tableName}: ${e.message}`);
        }
      }
      
      return;
    }

    console.log('Tables found:', tables);
  } catch (error) {
    console.error('Error inspecting database:', error.message);
  }

  // Check for triggers
  console.log('\n🔍 Checking for triggers...');
  try {
    const { data: triggers, error } = await supabase.rpc('get_triggers', {});
    if (triggers && triggers.length > 0) {
      console.log('Triggers found:', triggers);
    } else {
      console.log('No custom triggers found or unable to query triggers');
    }
  } catch (error) {
    console.log('Could not check triggers:', error.message);
  }

  // Check for functions/stored procedures
  console.log('\n🔍 Checking for custom functions...');
  try {
    const { data: functions, error } = await supabase.rpc('get_functions', {});
    if (functions && functions.length > 0) {
      console.log('Custom functions found:', functions);
    } else {
      console.log('No custom functions found or unable to query functions');
    }
  } catch (error) {
    console.log('Could not check functions:', error.message);
  }
}

inspectDatabase().then(() => {
  console.log('\n✅ Database inspection complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Database inspection failed:', error);
  process.exit(1);
});