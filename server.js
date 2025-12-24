const express = require('express');
const cors = require('cors');
const { extractVideoId } = require('./src/utils/youtube');
const { getDownloadUrls } = require('./src/utils/converter');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// API Endpoint for frontend
app.post('/api/download', async (req, res) => {
  const { url, format = 'mp3' } = req.body;
  
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const result = await getDownloadUrls(videoId, format);
    res.json(result);
  } catch (err) {
    console.error("[Server] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy stream to bypass CORS and hide direct links
app.get('/api/stream', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send("Missing URL");

  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://ytmp3.as/'
      }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send("Streaming failed");
  }
});

app.get('/health', (req, res) => {
  res.json({ status: "online", engine: "yt-rip-v1" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[Engine] yt-rip listening on port ${PORT}`);
});