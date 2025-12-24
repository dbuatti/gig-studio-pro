const cheerio = require('cheerio');
const { http } = require('./http');
const vm = require('vm');

let cachedConfig = null;
let cacheExpiry = 0;

/**
 * Scrapes the latest obfuscated config (gC) from ytmp3.as
 */
const getLiveConfig = async () => {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  try {
    const { data: html } = await http.get('https://ytmp3.as/');
    const $ = cheerio.load(html);
    
    // Find the script that defines gC
    let configScript = '';
    $('script').each((i, el) => {
      const content = $(el).html();
      if (content && content.includes('var gC =')) {
        configScript = content;
      }
    });

    if (!configScript) throw new Error("Could not find configuration script on host.");

    // Create a sandbox to evaluate the script safely
    const sandbox = { window: {}, document: {}, navigator: {} };
    vm.createContext(sandbox);
    vm.runInContext(configScript, sandbox);

    const gC = sandbox.gC;
    if (!gC || !gC.d) throw new Error("Invalid configuration object.");

    // Cache for 1 hour
    cachedConfig = gC;
    cacheExpiry = now + (3600 * 1000);
    
    return gC;
  } catch (err) {
    console.error("[Config] Scrape failed:", err.message);
    throw err;
  }
};

/**
 * Generates the authorization token based on gC logic
 */
const generateToken = (gC, videoId) => {
  // This mirrors the logic inside gC.d(videoId)
  return gC.d(videoId);
};

module.exports = { getLiveConfig, generateToken };