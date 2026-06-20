import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import nodemailer from 'nodemailer';

const localApiPlugin = () => ({
  name: 'local-api-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/api/send-email' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: 'mint.api.iip@gmail.com',
                pass: 'dyrcvuqwqodknoav'
              }
            });
            await transporter.sendMail({
              from: 'mint.api.iip@gmail.com',
              to: data.email,
              subject: data.subject || 'AZNET Notification',
              html: data.html || ''
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      } else if (req.url === '/api/send-sms' && req.method === 'POST') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'SMS endpoint hit (Twilio not configured)' }));
      } else {
        next();
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), tailwindcss(), localApiPlugin()]
});
