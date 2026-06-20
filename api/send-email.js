import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, subject, text, html } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing recipient email' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'mint.api.iip@gmail.com',
        pass: 'dyrcvuqwqodknoav'
      }
    });

    const mailOptions = {
      from: 'mint.api.iip@gmail.com',
      to: email,
      subject: subject || 'AZNET Notification',
      text: text || '',
      html: html || ''
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);

    return res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Nodemailer Error:', error);
    return res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
