-- ================================================================
-- Migration: extract workspace membership out of users table
-- ================================================================

-- 1. Create the new join table
CREATE TABLE workspace_users
(
  id           uuid                     NOT NULL,
  workspace_id uuid                     NOT NULL,
  user_id      uuid                     NOT NULL,
  created_at   timestamp with time zone NOT NULL,
  updated_at   timestamp with time zone NOT NULL,
  CONSTRAINT pk_workspace_users PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_workspace_users_workspace_id_user_id
  ON workspace_users (workspace_id, user_id);

-- 2. Resolve canonical user per email (earliest created_at wins)
--    then insert one workspace_users row per original users row.
WITH canonical AS (
  SELECT DISTINCT ON (email)
  id    AS canonical_id,
  email
FROM users
ORDER BY email, created_at ASC, id ASC
  )
INSERT INTO workspace_users (id, workspace_id, user_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.workspace_id,
  c.canonical_id,
  u.created_at,
  u.updated_at
FROM users u
       JOIN canonical c ON c.email = u.email;

-- 3. Re-point any other tables that hold a user_id FK to the canonical user.
--    Add one UPDATE per dependent table before the DELETE below, e.g.:
--
--    UPDATE some_table st
--    SET user_id = c.canonical_id
--    FROM users u
--    JOIN canonical c ON c.email = u.email AND c.canonical_id <> u.id
--    WHERE st.user_id = u.id;
--

WITH canonical AS (
    SELECT DISTINCT ON (email)
        id    AS canonical_id,
        email
    FROM users
    ORDER BY email, created_at ASC, id ASC
)
UPDATE organization_users ou
SET user_id = c.canonical_id
FROM users u
JOIN canonical c ON c.email = u.email AND c.canonical_id <> u.id
WHERE ou.user_id = u.id;

WITH canonical AS (
    SELECT DISTINCT ON (email)
        id    AS canonical_id,
        email
    FROM users
    ORDER BY email, created_at ASC, id ASC
)
UPDATE refresh_tokens r
SET user_id = c.canonical_id
FROM users u
JOIN canonical c ON c.email = u.email AND c.canonical_id <> u.id
WHERE r.user_id = u.id;

-- 4. Delete duplicate (non-canonical) user rows
DELETE FROM users
WHERE id NOT IN (
  SELECT DISTINCT ON (email) id
FROM users
ORDER BY email, created_at ASC, id ASC
  );

-- 5. Drop the now-redundant workspace_id column
ALTER TABLE users DROP COLUMN workspace_id;

ALTER TABLE users ADD COLUMN initial_password text;

-- Copy initial_password from organization_users to users
-- Uses the most recent record per user if multiple org memberships exist
UPDATE users u
SET initial_password = ou.initial_password
  FROM (
    SELECT DISTINCT ON (user_id) user_id, initial_password
    FROM organization_users
    WHERE initial_password IS NOT NULL
    ORDER BY user_id, created_at DESC
) ou
WHERE u.id = ou.user_id;

ALTER TABLE organization_users DROP COLUMN initial_password;
