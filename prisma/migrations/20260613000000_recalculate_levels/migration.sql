-- Recalculate all user levels using tiered thresholds
-- Level 1: 0 pts | Level 2: 200 | Level 3: 500 | Level 4: 1000 | Level 5: 1750
-- Level 6+: 2750 + (level-6) * 1000
UPDATE "User" SET level =
  CASE
    WHEN "pointsBalance" >= 1750 THEN 5 + FLOOR(("pointsBalance" - 1750)::numeric / 1000) + 1
    WHEN "pointsBalance" >= 1000 THEN 4
    WHEN "pointsBalance" >= 500  THEN 3
    WHEN "pointsBalance" >= 200  THEN 2
    ELSE 1
  END;
