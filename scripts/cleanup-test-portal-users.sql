-- Sharnam portal — preview & retire test portal logins (MySQL)
-- Run on Hostinger phpMyAdmin or: mysql -u USER -p DATABASE < scripts/cleanup-test-portal-users.sql
--
-- SAFE WORKFLOW:
--   1. Run only the SELECT blocks first and review rows.
--   2. Take a DB backup.
--   3. Run the UPDATE block in a transaction.
--   4. Re-run the duplicate-email SELECT — should return zero rows among active users.

-- ---------------------------------------------------------------------------
-- 1) PREVIEW — active logins on test domains (edit patterns as needed)
-- ---------------------------------------------------------------------------
SELECT id, email, fullName, role, portal, isActive, vendorId, createdAt
FROM `User`
WHERE isActive = 1
  AND email NOT LIKE 'deleted.%'
  AND (
    email LIKE '%@twinoxis.com'
    OR email LIKE '%@twinoxis1.com'
    OR email LIKE '%@consultant.demo'
    OR email LIKE '%@arvind.demo'
    OR email LIKE '%@bhavanainfra.demo'
    -- demo seed (keep office@sharnam.demo if you still need the main demo login)
    OR email LIKE '%@sharnam.demo'
  )
ORDER BY email;

-- ---------------------------------------------------------------------------
-- 2) PREVIEW — duplicate emails among active users (should be empty after cleanup)
-- ---------------------------------------------------------------------------
SELECT LOWER(email) AS email, COUNT(*) AS cnt, GROUP_CONCAT(id ORDER BY createdAt) AS user_ids
FROM `User`
WHERE isActive = 1 AND email NOT LIKE 'deleted.%'
GROUP BY LOWER(email)
HAVING cnt > 1;

-- ---------------------------------------------------------------------------
-- 3) PREVIEW — already soft-deleted / [Removed] noise (optional hard cleanup later)
-- ---------------------------------------------------------------------------
SELECT id, email, fullName, role, isActive
FROM `User`
WHERE email LIKE 'deleted.%' OR fullName LIKE '[Removed]%'
ORDER BY updatedAt DESC
LIMIT 100;

-- ---------------------------------------------------------------------------
-- 4) RETIRE test logins (soft delete — matches app HRMS delete behaviour)
--    KEEPS: baibhabmustafi@gmail.com and LIVE_TEAM emails from seed (edit list below)
-- ---------------------------------------------------------------------------
START TRANSACTION;

SET @stamp = UNIX_TIMESTAMP() * 1000;

-- Edit KEEP list if you intentionally want to preserve specific emails:
-- Only baibhabmustafi@gmail.com and @spdc.in are protected in the app now.
-- hello@twinoxis.com / admin@twinoxis.com CAN be retired with this script.

UPDATE `User` u
SET
  isActive = 0,
  vendorId = NULL,
  email = CONCAT(
    'deleted.',
    @stamp,
    '.',
    LEFT(REPLACE(LOWER(u.email), '@', '_at_'), 140)
  ),
  fullName = CONCAT('[Removed] ', LEFT(u.fullName, 180))
WHERE u.isActive = 1
  AND u.email NOT LIKE 'deleted.%'
  AND LOWER(u.email) NOT IN (
    'baibhabmustafi@gmail.com',
    'office@sharnam.demo'  -- remove this line to also retire the main demo office login
  )
  AND (
    u.email LIKE '%@twinoxis.com'
    OR u.email LIKE '%@twinoxis1.com'
    OR u.email LIKE '%@consultant.demo'
    OR u.email LIKE '%@arvind.demo'
    OR u.email LIKE '%@bhavanainfra.demo'
    OR u.email LIKE '%@sharnam.demo'
  );

-- Detach retired users from project membership / HR profiles
DELETE pm FROM `ProjectMember` pm
INNER JOIN `User` u ON u.id = pm.userId
WHERE u.isActive = 0 AND u.email LIKE 'deleted.%';

DELETE ep FROM `EmployeeProfile` ep
INNER JOIN `User` u ON u.id = ep.userId
WHERE u.isActive = 0 AND u.email LIKE 'deleted.%';

-- Review row count before commit:
SELECT ROW_COUNT() AS retired_in_last_update;

COMMIT;
-- ROLLBACK;  -- use instead of COMMIT if preview looks wrong

-- ---------------------------------------------------------------------------
-- 5) VERIFY — no active duplicate emails
-- ---------------------------------------------------------------------------
SELECT LOWER(email) AS email, COUNT(*) AS cnt
FROM `User`
WHERE isActive = 1 AND email NOT LIKE 'deleted.%'
GROUP BY LOWER(email)
HAVING cnt > 1;

-- ---------------------------------------------------------------------------
-- 6) OPTIONAL — hard-delete soft-deleted rows (only after you are sure)
-- ---------------------------------------------------------------------------
-- DELETE FROM `EmployeeProfile` WHERE userId IN (
--   SELECT id FROM `User` WHERE email LIKE 'deleted.%'
-- );
-- DELETE FROM `ProjectMember` WHERE userId IN (
--   SELECT id FROM `User` WHERE email LIKE 'deleted.%'
-- );
-- DELETE FROM `User` WHERE email LIKE 'deleted.%';
