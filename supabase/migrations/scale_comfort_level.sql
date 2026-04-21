-- Scale existing comfort_level from 0-5 to 0-100
UPDATE repertoire SET comfort_level = comfort_level * 20 WHERE comfort_level <= 5;
