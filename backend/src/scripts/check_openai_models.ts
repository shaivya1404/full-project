import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY not set in environment');
  process.exit(1);
}

async function listModels() {
  try {
    const res = await axios.get('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    const models: Array<any> = res.data?.data || [];
    console.log(`Found ${models.length} models.`);

    const realtime = models.filter((m) => /realtime/i.test(m.id));
    if (realtime.length) {
      console.log('\nRealtime models available:');
      realtime.forEach((m) => console.log(`- ${m.id}`));
    } else {
      console.log('\nNo realtime models found in your account.');
    }

    console.log('\nAll models (first 50):');
    models.slice(0, 50).forEach((m) => console.log(`- ${m.id}`));
  } catch (err: any) {
    if (err.response) {
      console.error('API error:', err.response.status, err.response.data);
    } else {
      console.error('Request error:', err.message);
    }
    process.exit(2);
  }
}

listModels();
