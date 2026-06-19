const fetch = require('node-fetch'); // if node < 18, but node >= 18 has fetch

async function testDelete() {
  try {
    const res = await fetch('http://localhost:5000/api/assets/3', { method: 'DELETE' });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (err) {
    console.error(err);
  }
}

testDelete();
