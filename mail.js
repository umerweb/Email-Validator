const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dns = require('dns').promises;
const { SMTPClient } = require('smtp-client');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function checkMX(domain) {
  try {
    const records = await dns.resolveMx(domain);
    return records.sort((a, b) => a.priority - b.priority);
  } catch (err) {
    return [];
  }
}

async function smtpVerify(email, mxHost) {
  try {
    const client = new SMTPClient({
      host: mxHost,
      port: 25,
      timeout: 5000,
    });

    await client.connect();

    // Use a real domain you own or control here
    await client.greet({ hostname: 'vorphix.com' });

    // Use an email address from a domain with proper SPF/DKIM (to avoid getting blocked)
    await client.mail({ from: 'start@vorphix.com' });

    const rcpt = await client.rcpt({ to: email });
    await client.quit();

    return { accepted: rcpt.code === 250 };
  } catch (err) {
    return { accepted: false };
  }
}

app.post('/verify-email', async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.json({ valid: false, reason: 'Invalid email format' });
  }

  const domain = email.split('@')[1];
  const mxRecords = await checkMX(domain);
  if (mxRecords.length === 0) {
    return res.json({ valid: false, reason: 'No MX record—domain cannot receive email' });
  }

  // Check for catch-all behavior
  const fake = `no-user-${Date.now()}@${domain}`;
  const fakeResult = await smtpVerify(fake, mxRecords[0].exchange);
  const isCatchAll = fakeResult.accepted;

  const realResult = await smtpVerify(email, mxRecords[0].exchange);

  if (realResult.accepted && !isCatchAll) {
    return res.json({ valid: true, reason: 'SMTP accepted RCPT TO — mailbox likely exists' });
  } else if (isCatchAll) {
    return res.json({ valid: null, reason: 'Catch-all domain — cannot confirm specific mailbox' });
  } else {
    return res.json({ valid: false, reason: 'SMTP rejected RCPT TO' });
  }
});

app.listen(3000, () => {
  console.log('✅ Email verifier running on http://localhost:3000');
});
