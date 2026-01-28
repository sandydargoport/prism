-- Add assignedTo column to shopping_lists table
-- This allows shopping lists to be assigned to specific users
-- Only the assigned user (or parents) can check off items on their list
-- If null, the list is a family list and anyone can check items

ALTER TABLE "shopping_lists" ADD COLUMN "assigned_to" uuid;

-- Add foreign key constraint
ALTER TABLE "shopping_lists"
  ADD CONSTRAINT "shopping_lists_assigned_to_users_id_fk"
  FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL;
