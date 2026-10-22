/**
 * Quick script to reset persona for testing
 * Run: node reset-persona.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPersona() {
  // Get user ID (you can also hardcode it)
  const userId = '3b5b02cd-747d-4b28-9d5f-3b374f74c127';

  console.log('🔍 Checking current persona...');

  // Check current persona
  const { data: current, error: fetchError } = await supabase
    .from('user_personas')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Error fetching:', fetchError);
    return;
  }

  if (!current) {
    console.log('ℹ️  No persona found. You can go through Setup flow now!');
    return;
  }

  console.log('📋 Current persona:');
  console.log('  Setup completed:', current.setup_completed);
  console.log('  Confidence:', current.confidence_score);
  console.log('  Preferences:', JSON.stringify(current.setup_preferences, null, 2));

  // Delete persona
  console.log('\n🗑️  Deleting persona...');

  const { error: deleteError } = await supabase
    .from('user_personas')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    console.error('❌ Delete failed:', deleteError);
    return;
  }

  console.log('✅ Persona deleted successfully!');
  console.log('🎉 You can now restart the app and go through Setup again!');
}

resetPersona().catch(console.error);
