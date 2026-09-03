require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// POST endpoint for student signup, credential generation, and email dispatch
app.post('/api/signup', async (req, res) => {
  const { id_no, name, email } = req.body;

  try {
    const { data: Student, error: fetchError } = await supabase
      .from('Student')
      .select('*')
      .eq('id_no', id_no)
      .single();

    if (fetchError || !Student) {
      return res.status(404).json({ success: false, message: 'ID Number not found in the roster.' });
    }

    if (Student.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
      return res.status(400).json({ success: false, message: 'The name provided does not match this ID Number in the roster.' });
    }

    if (Student.email && Student.username) {
      return res.status(400).json({ success: false, message: 'An account has already been generated for this student.' });
    }

    const username = `user_${id_no.replace(/-/g, '')}`;
    const tempPassword = crypto.randomBytes(4).toString('hex');

    const { error: updateError } = await supabase
      .from('Student')
      .update({ email: email, username: username, password: tempPassword })
      .eq('id_no', id_no);

    if (updateError) throw updateError;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'CCDI SSG Election Portal Credentials',
      text: `Hello ${Student.name},\n\nYour username is: ${username}\nYour temporary password is: ${tempPassword}\n\nUse these credentials to log in and vote.`
    });

    res.json({ success: true, message: 'Credentials generated and sent to your email.' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET endpoint to load JSON data by key from Supabase
app.get('/api/:key', async (req, res) => {
  const { key } = req.params;
  const { data, error } = await supabase
    .from('app_storage')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) {
    return res.json(null);
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