/**
 * Extracts Video ID from various YouTube URL formats
 */
const extractVideoId = (url) => {
  if (!url) return null;
  
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  
  return match ? match[1] : null;
};

module.exports = { extractVideoId };