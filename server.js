require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('CCDI SSG Election System Backend is Running!');
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variable.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// GET endpoint to load JSON data by key from Supabase
app.get('/api/:key', async (req, res) => {
  const { key } = req.params;
  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) {
    return res.json(null); // Return null if key doesn't exist yet
  }
  res.json(data.value);
});

// POST endpoint to save or update JSON data by key in Supabase
app.post('/api/:key', async (req, res) => {
  const { key } = req.params;
  const value = req.body;

  const { error } = await supabase
    .from('app_storage')
    .upsert({ key: key, value: value }, { onConflict: 'key' });

  if (error) {
    console.error('Supabase save error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});