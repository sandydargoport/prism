-- 0048_pets.sql
--
-- Pets (#996): a name, a kind and a colour. Not household members: a pet has
-- no account, PIN or points. A chore or reminder can be for a pet; removing
-- the pet clears that and keeps the chore.

CREATE TABLE IF NOT EXISTS pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  kind varchar(20) NOT NULL DEFAULT 'other',
  color varchar(7) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE chores ADD COLUMN IF NOT EXISTS pet_id uuid REFERENCES pets(id) ON DELETE SET NULL;
