-- ============================================================================
-- Prism Demo Data Seed
-- Runs automatically on first PostgreSQL container creation.
-- Creates a demo family with sample data for all features.
--
-- Demo PINs: 1234 (all users)
-- ============================================================================

DO $$
DECLARE
    alex_id UUID;
    jordan_id UUID;
    emma_id UUID;
    sophie_id UUID;
    chore_dishwasher_id UUID;
    chore_bed_id UUID;
    chore_pets_id UUID;
    chore_room_id UUID;
    grocery_list_id UUID;
    hardware_list_id UUID;
    pin_hash TEXT := '$2a$12$GSuYU2yztgNzxPDgT8n0AON8F5E00niiiE4rdM9NZALC/alM/30xS';
    today DATE := CURRENT_DATE;
    tomorrow DATE := CURRENT_DATE + 1;
    next_week DATE := CURRENT_DATE + 7;
    next_month DATE := CURRENT_DATE + INTERVAL '1 month';
    week_start DATE := CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER;
BEGIN

    -- Skip if already seeded
    IF EXISTS (SELECT 1 FROM users LIMIT 1) THEN
        RAISE NOTICE 'Database already has users, skipping seed';
        RETURN;
    END IF;

    RAISE NOTICE 'Seeding database with demo data...';

    -- ========================================================================
    -- USERS (Family Members)
    -- ========================================================================
    INSERT INTO users (name, role, color, pin, email, preferences)
    VALUES ('Alex', 'parent', '#3B82F6', pin_hash, 'alex@example.com', '{"theme": "system"}')
    RETURNING id INTO alex_id;

    INSERT INTO users (name, role, color, pin, email, preferences)
    VALUES ('Jordan', 'parent', '#EC4899', pin_hash, 'jordan@example.com', '{"theme": "system"}')
    RETURNING id INTO jordan_id;

    INSERT INTO users (name, role, color, pin, preferences)
    VALUES ('Emma', 'child', '#10B981', pin_hash, '{}')
    RETURNING id INTO emma_id;

    INSERT INTO users (name, role, color, pin, preferences)
    VALUES ('Sophie', 'child', '#F59E0B', pin_hash, '{}')
    RETURNING id INTO sophie_id;

    RAISE NOTICE '  Created 4 family members';

    -- ========================================================================
    -- TASKS
    -- ========================================================================
    INSERT INTO tasks (title, description, assigned_to, due_date, priority, category, created_by) VALUES
        ('Schedule dentist appointments', 'Book checkups for the whole family', jordan_id, next_week, 'medium', 'Health', jordan_id),
        ('Fix leaky faucet in bathroom', 'The upstairs bathroom faucet is dripping', alex_id, tomorrow, 'high', 'Home', jordan_id),
        ('Science project research', 'Research solar system for school project', emma_id, next_week, 'high', 'School', emma_id),
        ('Practice piano', '30 minutes of practice', sophie_id, today, 'medium', 'Activities', jordan_id),
        ('Buy birthday gift for Grandma', NULL, alex_id, next_week, 'medium', 'Shopping', alex_id);

    INSERT INTO tasks (title, assigned_to, due_date, priority, category, completed, completed_at, completed_by, created_by)
    VALUES ('Return library books', emma_id, tomorrow, 'low', 'Errands', true, now(), emma_id, jordan_id);

    RAISE NOTICE '  Created 6 tasks';

    -- ========================================================================
    -- FAMILY MESSAGES
    -- ========================================================================
    INSERT INTO family_messages (message, author_id, important, pinned) VALUES
        ('Soccer practice moved to 4pm today!', jordan_id, true, true),
        ('Great job on your spelling test, Emma!', alex_id, false, false),
        ('Grandma is coming to visit this weekend', jordan_id, false, true),
        ('Don''t forget to feed the fish!', sophie_id, false, false);

    RAISE NOTICE '  Created 4 family messages';

    -- ========================================================================
    -- EVENTS
    -- ========================================================================
    INSERT INTO events (title, location, start_time, end_time, color, created_by) VALUES
        ('Soccer Practice', 'Community Park',
            (today + TIME '16:00')::timestamp, (today + TIME '17:30')::timestamp,
            '#10B981', jordan_id),
        ('Dentist Appointment', 'Dr. Smith''s Office',
            (tomorrow + TIME '09:00')::timestamp, (tomorrow + TIME '10:00')::timestamp,
            '#3B82F6', alex_id),
        ('Family Movie Night', NULL,
            ((today + 3) + TIME '18:00')::timestamp, ((today + 3) + TIME '20:00')::timestamp,
            '#EC4899', jordan_id);

    UPDATE events SET description = 'Vote on the movie by Friday!' WHERE title = 'Family Movie Night';

    RAISE NOTICE '  Created 3 events';

    -- ========================================================================
    -- CHORES
    -- ========================================================================
    INSERT INTO chores (title, description, category, assigned_to, frequency, point_value, requires_approval, created_by)
    VALUES ('Empty dishwasher', 'Put away all clean dishes', 'dishes', emma_id, 'daily', 5, false, jordan_id)
    RETURNING id INTO chore_dishwasher_id;

    INSERT INTO chores (title, description, category, frequency, point_value, requires_approval, created_by)
    VALUES ('Make bed', 'Make your bed before school', 'cleaning', 'daily', 2, false, jordan_id)
    RETURNING id INTO chore_bed_id;

    INSERT INTO chores (title, description, category, assigned_to, frequency, point_value, requires_approval, created_by)
    VALUES ('Feed the pets', 'Feed the fish and cat', 'pets', sophie_id, 'daily', 3, false, alex_id)
    RETURNING id INTO chore_pets_id;

    INSERT INTO chores (title, description, category, frequency, point_value, requires_approval, created_by)
    VALUES ('Clean room', 'Tidy up and vacuum your room', 'cleaning', 'weekly', 10, true, jordan_id)
    RETURNING id INTO chore_room_id;

    RAISE NOTICE '  Created 4 chores';

    -- Chore completions
    INSERT INTO chore_completions (chore_id, completed_by, points_awarded) VALUES
        (chore_dishwasher_id, emma_id, 5),
        (chore_pets_id, sophie_id, 3);

    RAISE NOTICE '  Created 2 chore completions';

    -- ========================================================================
    -- SHOPPING LISTS
    -- ========================================================================
    INSERT INTO shopping_lists (name, icon, color, sort_order)
    VALUES ('Grocery', 'shopping-cart', '#10B981', 1)
    RETURNING id INTO grocery_list_id;

    INSERT INTO shopping_lists (name, icon, color, sort_order)
    VALUES ('Hardware', 'wrench', '#F59E0B', 2)
    RETURNING id INTO hardware_list_id;

    RAISE NOTICE '  Created 2 shopping lists';

    -- Shopping items
    INSERT INTO shopping_items (list_id, name, quantity, unit, category, added_by) VALUES
        (grocery_list_id, 'Milk', 1, 'gallon', 'dairy', jordan_id),
        (grocery_list_id, 'Bread', 2, 'loaves', 'bakery', jordan_id),
        (grocery_list_id, 'Apples', 6, NULL, 'produce', alex_id),
        (grocery_list_id, 'Chicken breast', 2, 'lbs', 'meat', jordan_id),
        (hardware_list_id, 'Lightbulbs', 4, NULL, 'household', alex_id),
        (hardware_list_id, 'Furnace filter', 1, NULL, 'household', alex_id);

    RAISE NOTICE '  Created 6 shopping items';

    -- ========================================================================
    -- MEALS
    -- ========================================================================
    INSERT INTO meals (name, day_of_week, meal_type, week_of, created_by) VALUES
        ('Spaghetti and Meatballs', 'monday', 'dinner', week_start, jordan_id),
        ('Grilled Chicken Salad', 'tuesday', 'dinner', week_start, jordan_id),
        ('Taco Tuesday', 'tuesday', 'lunch', week_start, jordan_id),
        ('Pizza Night', 'friday', 'dinner', week_start, alex_id);

    RAISE NOTICE '  Created 4 meal plans';

    -- ========================================================================
    -- MAINTENANCE REMINDERS
    -- ========================================================================
    INSERT INTO maintenance_reminders (title, category, description, schedule, next_due, assigned_to, created_by) VALUES
        ('Change furnace filter', 'home', 'Replace the HVAC filter', 'quarterly', next_month, alex_id, alex_id),
        ('Car oil change', 'car', 'Family car - regular oil change', 'quarterly', next_month, alex_id, alex_id),
        ('Test smoke detectors', 'home', NULL, 'monthly', next_month, NULL, jordan_id);

    RAISE NOTICE '  Created 3 maintenance reminders';

    -- ========================================================================
    -- BIRTHDAYS
    -- ========================================================================
    INSERT INTO birthdays (name, birth_date, user_id) VALUES
        ('Emma', '2014-09-10', emma_id),
        ('Sophie', '2017-12-03', sophie_id);

    RAISE NOTICE '  Created 2 birthdays';

    -- ========================================================================
    -- GOALS
    -- ========================================================================
    INSERT INTO goals (name, description, point_cost, emoji, priority, recurring, recurrence_period) VALUES
        ('Weekly Allowance', 'Earn your weekly spending money', 50, '💰', 1, true, 'weekly'),
        ('Ice Cream Trip', 'Family trip to the ice cream shop', 100, '🍦', 2, false, NULL),
        ('Movie Night', 'Pick the movie for family movie night', 75, '🎬', 3, false, NULL);

    RAISE NOTICE '  Created 3 goals';

    -- ========================================================================
    -- SETTINGS
    -- ========================================================================
    INSERT INTO settings (key, value) VALUES
        ('theme', '{"mode": "system"}'),
        ('location', '{"city": "Springfield", "state": "IL", "country": "US"}'),
        ('security', '{"requirePinForEvents": true, "requirePinForDelete": true, "requirePinForSettings": true, "sessionTimeout": 30}');

    RAISE NOTICE '  Created 3 settings';

    -- ========================================================================
    -- DEFAULT LAYOUT
    -- ========================================================================
    INSERT INTO layouts (name, is_default, widgets, created_by) VALUES
        ('Default Dashboard', true,
         '[{"i":"calendar","x":0,"y":0,"w":2,"h":2},{"i":"clock","x":2,"y":0,"w":1,"h":1},{"i":"weather","x":3,"y":0,"w":1,"h":2},{"i":"tasks","x":2,"y":1,"w":1,"h":2},{"i":"messages","x":0,"y":2,"w":1,"h":2},{"i":"chores","x":1,"y":2,"w":1,"h":2},{"i":"shopping","x":3,"y":2,"w":1,"h":2},{"i":"birthdays","x":0,"y":4,"w":1,"h":2},{"i":"meals","x":1,"y":4,"w":2,"h":2}]',
         alex_id);

    RAISE NOTICE '  Created 1 layout';

    RAISE NOTICE '';
    RAISE NOTICE 'Database seeded successfully!';
    RAISE NOTICE 'Default PIN for all users: 1234';

END $$;
