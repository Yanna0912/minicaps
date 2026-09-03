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
    // 1. Fetch student from Supabase
    const { data: student, error: fetchError } = await supabase
      .from('Student')
      .select('*')
      .eq('id_no', id_no)
      .single();

    if (fetchError || !student) {
      return res.status(404).json({ success: false, message: 'ID Number not found in the roster.' });
    }

    // 2. Validate name match
    if (student.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
      return res.status(400).json({ success: false, message: 'The name provided does not match this ID Number in the roster.' });
    }

    // 3. Check if already registered
    if (student.email && student.username) {
      return res.status(400).json({ success: false, message: 'An account has already been generated for this student.' });
    }

    // 4. Generate random username and password
    const username = 'voter_' + Math.floor(1000 + Math.random() * 9000);
    const password = Math.random().toString(36).slice(-8); // or a simple alphanumeric string
    const issuedAt = new Date().toISOString();

    // 5. Auto-save email and credentials to Supabase
    const { error: updateError } = await supabase
      .from('Student')
      .update({
        email: email,
        username: username,
        password: password,
        issued_at: issuedAt,
        voted: false
      })
      .eq('id_no', id_no);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ success: false, message: 'Failed to save credentials to database.' });
    }

    // 6. Send the generated credentials via Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your SMTP configuration
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your CCDI SSG Election Voting Credentials',
      text: `Hello ${student.name},\n\nYour voter account has been successfully generated.\n\nUsername: ${username}\nPassword: ${password}\n\nUse these credentials to log in and cast your vote on the election portal.`
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: 'Credentials generated, saved, and emailed successfully.' });

  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
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