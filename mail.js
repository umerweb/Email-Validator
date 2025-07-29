const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dns = require('dns');
const { SMTPClient } = require('smtp-client');

const app = express();
app.use(cors());
app.use(bodyParser.json());

require('dotenv').config();

const isValidEmailFormat = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const verifyInbox = async (email) => {
  const domain = email.split('@')[1];
  const client = new SMTPClient({
    host: 'smtp.' + domain,
    port: 25,
    timeout: 5000,
  });

  try {
    await client.connect();
    await client.greet({ hostname: 'example.com' }); // Replace with your domain
    await client.mail({ from: 'verify@example.com' });
    await client.rcpt({ to: email });
    await client.quit();
    return { valid: true, reason: 'Inbox accepted RCPT TO' };
  } catch (err) {
    return { valid: false, reason: 'SMTP rejected email or blocked' };
  }
};

app.post('/verify-email', async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmailFormat(email)) {
    return res.status(400).json({ valid: false, reason: 'Invalid email format' });
  }

  const domain = email.split('@')[1];

  dns.resolveMx(domain, async (err, addresses) => {
    if (err || !addresses || addresses.length === 0) {
      return res.json({ valid: false, reason: 'No MX records found for domain' });
    }

    // Attempt inbox verification (comment out to disable)
    const inboxResult = await verifyInbox(email);
    return res.json(inboxResult);
  });
});

app.listen(3000, () => {
  console.log(`Email verifier running `);
});
