convert -> progress)">
const { http } = require('./http');
const { getLiveConfig, generateToken } = require('./config');

/**
 * Orchestrates the conversion flow
 */
const getDownloadUrls = async (videoId, format = 'mp3') => {
  const gC = await getLiveConfig();
  const token = generateToken(gC, videoId);
  
  // 1. Initialize
  const initRes = await http.get(`https://api.gammacloud.net/api/v1/init?id=${videoId}&p=${token}&f=${format}`);
  const { convertURL } = initRes.data;

  if (!convertURL) throw new Error("Initialization failed: No conversion endpoint returned.");

  // 2. Start Conversion
  const convertRes = await http.get(convertURL);
  let { progressURL, downloadURL, title } = convertRes.data;

  // 3. Poll Progress if needed
  if (progressURL) {
    let attempts = 0;
    while (!downloadURL && attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await http.get(progressURL);
      downloadURL = pollRes.data.downloadURL;
      attempts++;
    }
  }

  if (!downloadURL) throw new Error("Conversion timed out or failed.");

  return {
    success: true,
    title: title || videoId,
    directUrl: downloadURL,
    filename: `${title || videoId}.${format}`
  };
};

module.exports = { getDownloadUrls };