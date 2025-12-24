const axios = require('axios');

const getHeaders = (extra = {}) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://ytmp3.as',
  'Referer': 'https://ytmp3.as/',
  ...extra
});

const http = axios.create({
  timeout: 15000,
  headers: getHeaders()
});

module.exports = { http, getHeaders };