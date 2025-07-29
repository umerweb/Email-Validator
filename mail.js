const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SMTPClient } = require('smtp-client');

const app = express();
app.use(cors());
app.use(bodyParser.json());

require('dotenv').config();

const isValidEmailFormat = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const verifyInbox = async (targetEmail) => {
  const client = new SMTPClient({
    host: 'smtp.hostinger.com',     // your own SMTP host
    port: 465,                      // secure SMTP port
    secure: true,                   // use TLS
    timeout: 5000
  });

  try {
    await client.connect();
    await client.greet({ hostname: 'vorphix.com' });
    await client.authLogin({      // use your SMTP credentials
      username: process.env.SMTP_USER,
      password: process.env.SMTP_PASS
    });
    await client.mail({ from: process.env.SMTP_USER });  // use your domain email
    await client.rcpt({ to: targetEmail });              // target email to check
    await client.quit();
    return { valid: true, reason: 'Inbox exists and accepted RCPT TO' };
  } catch (err) {
    return { valid: false, reason: 'SMTP rejected email or mailbox does not exist' };
  }
};

app.post('/verify-email', async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmailFormat(email)) {
    return res.status(400).json({ valid: false, reason: 'Invalid email format' });
  }

  const result = await verifyInbox(email);
  return res.json(result);
});

app.listen(3000, () => {
  console.log('Email verifier running on port 3000');
});
