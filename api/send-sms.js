// Twilio integration stub
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phone, message } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Missing phone number' });
  }

  // To implement SMS, we need Twilio credentials:
  // const twilio = require('twilio');
  // const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  // await client.messages.create({ body: message, from: TWILIO_PHONE_NUMBER, to: phone });

  console.log(`[STUB] Would have sent SMS to ${phone}: ${message}`);
  
  return res.status(200).json({ 
    success: true, 
    message: 'SMS endpoint hit (Twilio not configured yet)', 
    details: 'Awaiting Twilio credentials to activate SMS sending.' 
  });
}
