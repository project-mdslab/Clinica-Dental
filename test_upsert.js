const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testUpsert() {
  const os = await supabase.from('insurances').select('*').limit(1).single();
  if (os.error) return console.log(os.error);
  
  const chunk = [{
    insurance_id: os.data.id,
    code: "TEST1234",
    name: "TESTING TREATMENT",
    price: 100,
    coverage_price: 100,
    copay_price: 0
  }];
  
  const { data, error } = await supabase.from('insurance_treatments').upsert(chunk, { onConflict: 'insurance_id, code, name' });
  if (error) {
    console.error("UPSERT ERROR:", JSON.stringify(error, null, 2));
    console.error("UPSERT ERROR RAW:", error);
  } else {
    console.log("SUCCESS:", data);
  }
}

testUpsert();
