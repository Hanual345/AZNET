import nodemailer from 'nodemailer';

async function test() {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'mint.api.iip@gmail.com',
        pass: 'dyrcvuqwqodknoav'
      }
    });

    const info = await transporter.sendMail({
      from: 'mint.api.iip@gmail.com',
      to: 'mint.api.iip@gmail.com',
      subject: 'Test Email',
      text: 'This is a test email to verify credentials.'
    });

    console.log('Success!', info.response);
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

test();
