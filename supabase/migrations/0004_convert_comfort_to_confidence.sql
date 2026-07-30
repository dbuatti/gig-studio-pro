-- Convert comfort_level from 0-100 scale to -5/+5 confidence scale
-- Old: 0-100 (mapped from 0-5 stars * 20)
-- New: -5 to +5 (0 = neutral, positive = confident, negative = unsure)

UPDATE repertoire SET comfort_level = ROUND(comfort_level / 20.0) WHERE comfort_level IS NOT NULL;
