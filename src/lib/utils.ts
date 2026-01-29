/**
 * Converts a duration in seconds to a human-readable format (e.g., 3661 seconds -> '1:01:01').
 * @param totalSeconds The total duration in seconds.
 * @returns Formatted time string.
 */
export const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds < 0) return '0:00';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  if (hours > 0) {
    parts.push(hours);
  }
  
  const paddedMinutes = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  parts.push(paddedMinutes);
  parts.push(paddedSeconds);

  return parts.join(':');
};