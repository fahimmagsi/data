const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Telegram Bot Token
const BOT_TOKEN = '8085728332:AAGVCPbdi2wYv1qih8dNhMI6ScJsOa1WQDs';
const bot = new Telegraf(BOT_TOKEN);

// Google Drive File ID and URL
const FILE_ID = '12jrsPFNtHkvLqSE5in_cnqSKuAiTDbJ3';
const FILE_URL = `https://drive.google.com/uc?id=${FILE_ID}&export=download`;

// Local file path for caching
const LOCAL_FILE = path.join('/tmp', 'All_Data_IRP.json'); // Use `/tmp` for Vercel compatibility

// Function to download the JSON file from Google Drive
async function fetchJSONFile() {
  try {
    const response = await axios.get(FILE_URL, { responseType: 'stream' });
    const writer = fs.createWriteStream(LOCAL_FILE);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error fetching JSON file:', error.message);
  }
}

// Function to search data
function searchData(query, key, data) {
  const results = data.filter((record) => record[key]?.toString().includes(query));
  return results.length > 0 ? results : 'No records found for your query.';
}

// Bot commands
bot.start((ctx) => {
  ctx.reply('Welcome to the IRP Data Bot. You can search for records using CNIC, Kin CNIC, or Mobile Number. Use /search to begin.');
});

bot.command('search', (ctx) => {
  ctx.reply('Please send your query in the format:\n`CNIC:<value>`\nor\n`KinCNIC:<value>`\nor\n`Mobile:<value>`', { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
  const message = ctx.message.text;
  const [key, value] = message.split(':').map((s) => s.trim());

  if (!key || !value) {
    ctx.reply('Invalid format. Please use:\n`CNIC:<value>`\nor\n`KinCNIC:<value>`\nor\n`Mobile:<value>`', { parse_mode: 'Markdown' });
    return;
  }

  const keyMap = {
    CNIC: 'Household CNIC',
    KinCNIC: 'CNIC of Kin/Legal',
    Mobile: 'Contact No\n(Mobile/LandLine)',
  };

  const dataKey = keyMap[key];
  if (!dataKey) {
    ctx.reply('Invalid key. Use CNIC, KinCNIC, or Mobile.');
    return;
  }

  try {
    // Fetch the latest JSON file
    await fetchJSONFile();

    // Read and parse the JSON file
    const fileData = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));

    // Search the data
    const results = searchData(value, dataKey, fileData);

    // Format results
    if (Array.isArray(results)) {
      results.forEach((record) => {
        ctx.reply(
          `Record Found:\nProvince: ${record.Province}\nDistrict: ${record.District}\nTehsil: ${record.Tehsil}\nUC: ${record.UC}\nHousehold Name: ${record['Household Name/\nHead Name']}\nFather/Husband Name: ${record['Father / Husband Name']}\nCNIC: ${record['Household CNIC']}\nMobile: ${record['Contact No\n(Mobile/LandLine)']}\nAddress: ${record.Address}`
        );
      });
    } else {
      ctx.reply(results);
    }
  } catch (error) {
    console.error('Error processing request:', error.message);
    ctx.reply('An error occurred while processing your request. Please try again later.');
  }
});

// Export as a serverless function for Vercel
module.exports = async (req, res) => {
  await bot.handleUpdate(req.body);
  res.status(200).send('OK');
};

// Set webhook on Vercel deployment
const WEBHOOK_URL = 'https://data-x8je-ok0u8popd-fahimmagsis-projects.vercel.app/api/bot';
bot.telegram.setWebhook(WEBHOOK_URL);
