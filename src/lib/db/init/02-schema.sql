--
-- PostgreSQL database dump
-- Generated from live DB. Regenerate with: docker exec prism-db pg_dump -U prism -d prism --schema-only --no-owner --no-privileges --no-comments
--

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15



--


--


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;




--
-- Name: __prism_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.__prism_migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: __prism_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.__prism_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __prism_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.__prism_migrations_id_seq OWNED BY public.__prism_migrations.id;


--
-- Name: api_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.api_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service character varying(100) NOT NULL,
    encrypted_credentials text NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: api_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.api_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    token_hash character varying(64) NOT NULL,
    created_by uuid NOT NULL,
    last_used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    scopes jsonb DEFAULT '["*"]'::jsonb NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id character varying(255),
    summary character varying(500) NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: babysitter_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.babysitter_info (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section character varying(50) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    content jsonb NOT NULL,
    is_sensitive boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: birthdays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.birthdays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    birth_date date NOT NULL,
    event_type character varying(20) DEFAULT 'birthday'::character varying NOT NULL,
    user_id uuid,
    gift_ideas text,
    send_card_days_before integer DEFAULT 7,
    google_calendar_source character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bus_geofence_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.bus_geofence_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_id uuid NOT NULL,
    event_type character varying(30) NOT NULL,
    checkpoint_name character varying(255) NOT NULL,
    checkpoint_index integer NOT NULL,
    event_time timestamp without time zone NOT NULL,
    day_of_week integer NOT NULL,
    trip_date date NOT NULL,
    gmail_message_id character varying(255) NOT NULL,
    raw_data jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bus_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.bus_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_name character varying(100) NOT NULL,
    user_id uuid,
    trip_id character varying(50) NOT NULL,
    direction character varying(10) NOT NULL,
    label character varying(255) NOT NULL,
    scheduled_time character varying(5) NOT NULL,
    active_days jsonb DEFAULT '[1, 2, 3, 4, 5]'::jsonb NOT NULL,
    checkpoints jsonb DEFAULT '[]'::jsonb NOT NULL,
    stop_name character varying(255),
    school_name character varying(255),
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: calendar_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.calendar_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    color character varying(7) DEFAULT '#3B82F6'::character varying NOT NULL,
    type character varying(20) DEFAULT 'custom'::character varying NOT NULL,
    user_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.calendar_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.calendar_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    provider character varying(50) NOT NULL,
    source_calendar_id character varying(255) NOT NULL,
    dashboard_calendar_name character varying(255) NOT NULL,
    display_name character varying(255),
    color character varying(7),
    enabled boolean DEFAULT true NOT NULL,
    show_in_event_modal boolean DEFAULT true NOT NULL,
    is_family boolean DEFAULT false NOT NULL,
    group_id uuid,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    ical_url text,
    last_synced timestamp without time zone,
    sync_errors jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: chore_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.chore_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chore_id uuid NOT NULL,
    completed_by uuid NOT NULL,
    completed_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    points_awarded integer,
    photo_url text,
    notes text
);


--
-- Name: chores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.chores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    assigned_to uuid,
    frequency character varying(20) NOT NULL,
    custom_interval_days integer,
    start_day character varying(10),
    last_completed timestamp without time zone,
    next_due date,
    point_value integer DEFAULT 0 NOT NULL,
    requires_approval boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    next_due_time character varying(5)
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    calendar_source_id uuid,
    external_event_id character varying(255),
    title character varying(255) NOT NULL,
    description text,
    location character varying(255),
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    all_day boolean DEFAULT false NOT NULL,
    recurring boolean DEFAULT false NOT NULL,
    recurrence_rule text,
    created_by uuid,
    color character varying(7),
    reminder_minutes integer,
    last_synced timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: family_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.family_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message text NOT NULL,
    author_id uuid NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    important boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gift_ideas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.gift_ideas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    for_user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    url text,
    notes text,
    price numeric(10,2),
    purchased boolean DEFAULT false NOT NULL,
    purchased_at timestamp without time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: goal_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.goal_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    period_start date NOT NULL,
    achieved_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    point_cost integer NOT NULL,
    emoji character varying(10),
    priority integer DEFAULT 0 NOT NULL,
    recurring boolean DEFAULT false NOT NULL,
    recurrence_period character varying(20),
    active boolean DEFAULT true NOT NULL,
    last_reset_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    display_id character varying(100),
    widgets jsonb NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    slug character varying(100),
    screensaver_widgets jsonb,
    orientation character varying(20) DEFAULT 'landscape'::character varying,
    font_scale integer
);


--
-- Name: maintenance_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.maintenance_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reminder_id uuid NOT NULL,
    completed_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_by uuid,
    cost numeric(10,2),
    vendor character varying(255),
    notes text
);


--
-- Name: maintenance_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.maintenance_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    schedule character varying(20) NOT NULL,
    custom_interval_days integer,
    last_completed timestamp without time zone,
    next_due date NOT NULL,
    assigned_to uuid,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: meals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.meals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    recipe_id uuid,
    recipe text,
    recipe_url text,
    prep_time integer,
    cook_time integer,
    servings integer,
    ingredients text,
    week_of date NOT NULL,
    day_of_week character varying(20) NOT NULL,
    meal_type character varying(20) NOT NULL,
    cooked_at timestamp without time zone,
    cooked_by uuid,
    source character varying(50) DEFAULT 'internal'::character varying NOT NULL,
    source_id character varying(255),
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    meal_time character varying(5)
);


--
-- Name: photo_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.photo_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    onedrive_folder_id character varying(255),
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    immich_server_url text,
    immich_share_key text,
    immich_password_enc text,
    immich_album_id text,
    last_synced timestamp without time zone,
    sync_errors jsonb,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    mime_type character varying(50) NOT NULL,
    width integer,
    height integer,
    size_bytes integer,
    taken_at timestamp without time zone,
    external_id character varying(255),
    thumbnail_path character varying(255),
    favorite boolean DEFAULT false NOT NULL,
    orientation character varying(20),
    usage character varying(100) DEFAULT 'wallpaper,gallery,screensaver'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    latitude numeric(9,6),
    longitude numeric(10,6),
    is_external boolean DEFAULT false NOT NULL,
    dedupe_key character varying(120)
);


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    url text,
    source_type character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    ingredients jsonb DEFAULT '[]'::jsonb NOT NULL,
    instructions text,
    prep_time integer,
    cook_time integer,
    servings integer,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    cuisine character varying(100),
    category character varying(100),
    image_url text,
    rating integer,
    notes text,
    times_made integer DEFAULT 0 NOT NULL,
    last_made_at timestamp without time zone,
    is_favorite boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shopping_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shopping_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    quantity integer,
    unit character varying(50),
    category character varying(50),
    checked boolean DEFAULT false NOT NULL,
    source character varying(50) DEFAULT 'internal'::character varying NOT NULL,
    source_id character varying(255),
    recurring boolean DEFAULT false NOT NULL,
    recurrence_interval character varying(20),
    added_by uuid,
    notes text,
    shopping_list_source_id uuid,
    external_id character varying(255),
    external_updated_at timestamp without time zone,
    last_synced timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shopping_list_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shopping_list_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    external_list_id character varying(255) NOT NULL,
    external_list_name character varying(255),
    shopping_list_id uuid NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    last_sync_at timestamp without time zone,
    last_sync_error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shopping_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.shopping_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(7),
    list_type character varying(20) DEFAULT 'grocery'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    assigned_to uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    visible_categories jsonb
);


--
-- Name: task_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.task_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    color character varying(7),
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: task_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.task_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    external_list_id character varying(255) NOT NULL,
    external_list_name character varying(255),
    task_list_id uuid NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    last_sync_at timestamp without time zone,
    last_sync_error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    list_id uuid,
    assigned_to uuid,
    due_date timestamp without time zone,
    priority character varying(20),
    category character varying(100),
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp without time zone,
    completed_by uuid,
    task_source_id uuid,
    external_id character varying(255),
    external_updated_at timestamp without time zone,
    last_synced timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: travel_pin_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.travel_pin_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pin_id uuid NOT NULL,
    photo_id uuid NOT NULL,
    linked_manually boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: travel_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.travel_pins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(10,6) NOT NULL,
    place_name character varying(255),
    color character varying(7),
    visited_date date,
    visited_end_date date,
    year integer,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    photo_radius_km numeric(6,2) DEFAULT 50,
    created_by uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'want_to_go'::character varying NOT NULL,
    is_bucket_list boolean DEFAULT false NOT NULL,
    trip_label character varying(255),
    stops jsonb DEFAULT '[]'::jsonb NOT NULL,
    national_parks jsonb DEFAULT '[]'::jsonb NOT NULL,
    parent_id uuid,
    pin_type character varying(20) DEFAULT 'location'::character varying NOT NULL,
    trip_id uuid,
    is_hub boolean DEFAULT false NOT NULL
);


--
-- Name: travel_trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.travel_trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    trip_style character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'want_to_go'::character varying NOT NULL,
    is_bucket_list boolean DEFAULT false NOT NULL,
    color character varying(7),
    emoji character varying(10),
    visited_date date,
    visited_end_date date,
    year integer,
    member_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    color character varying(7) NOT NULL,
    pin character varying(255),
    email character varying(255),
    avatar_url text,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: weekend_places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.weekend_places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    latitude numeric(9,6),
    longitude numeric(10,6),
    place_name character varying(255),
    address character varying(500),
    url character varying(1000),
    status character varying(20) DEFAULT 'backlog'::character varying NOT NULL,
    is_favorite boolean DEFAULT false NOT NULL,
    rating integer,
    notes text,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_provider character varying(20),
    source_id character varying(100),
    last_visited_date character varying(10),
    visit_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: weekend_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.weekend_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    visited_by uuid,
    visited_on character varying(10) NOT NULL,
    rating integer,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: wish_item_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.wish_item_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    external_list_id character varying(255) NOT NULL,
    external_list_name character varying(255),
    member_id uuid NOT NULL,
    sync_enabled boolean DEFAULT true NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    last_sync_at timestamp without time zone,
    last_sync_error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: wish_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.wish_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    url text,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    claimed boolean DEFAULT false NOT NULL,
    claimed_by uuid,
    claimed_at timestamp without time zone,
    added_by uuid,
    wish_item_source_id uuid,
    external_id character varying(255),
    external_updated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: __prism_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.__prism_migrations ALTER COLUMN id SET DEFAULT nextval('public.__prism_migrations_id_seq'::regclass);


--
-- Name: __prism_migrations __prism_migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.__prism_migrations
    ADD CONSTRAINT __prism_migrations_name_key UNIQUE (name);


--
-- Name: __prism_migrations __prism_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.__prism_migrations
    ADD CONSTRAINT __prism_migrations_pkey PRIMARY KEY (id);


--
-- Name: api_credentials api_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_credentials
    ADD CONSTRAINT api_credentials_pkey PRIMARY KEY (id);


--
-- Name: api_credentials api_credentials_service_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_credentials
    ADD CONSTRAINT api_credentials_service_unique UNIQUE (service);


--
-- Name: api_tokens api_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: babysitter_info babysitter_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.babysitter_info
    ADD CONSTRAINT babysitter_info_pkey PRIMARY KEY (id);


--
-- Name: birthdays birthdays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthdays
    ADD CONSTRAINT birthdays_pkey PRIMARY KEY (id);


--
-- Name: bus_geofence_log bus_geofence_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_geofence_log
    ADD CONSTRAINT bus_geofence_log_pkey PRIMARY KEY (id);


--
-- Name: bus_routes bus_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_routes
    ADD CONSTRAINT bus_routes_pkey PRIMARY KEY (id);


--
-- Name: calendar_groups calendar_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_groups
    ADD CONSTRAINT calendar_groups_pkey PRIMARY KEY (id);


--
-- Name: calendar_notes calendar_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notes
    ADD CONSTRAINT calendar_notes_pkey PRIMARY KEY (id);


--
-- Name: calendar_sources calendar_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_pkey PRIMARY KEY (id);


--
-- Name: chore_completions chore_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_pkey PRIMARY KEY (id);


--
-- Name: chores chores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: family_messages family_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_messages
    ADD CONSTRAINT family_messages_pkey PRIMARY KEY (id);


--
-- Name: gift_ideas gift_ideas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_ideas
    ADD CONSTRAINT gift_ideas_pkey PRIMARY KEY (id);


--
-- Name: goal_achievements goal_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_achievements
    ADD CONSTRAINT goal_achievements_pkey PRIMARY KEY (id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: layouts layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_pkey PRIMARY KEY (id);


--
-- Name: layouts layouts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_slug_key UNIQUE (slug);


--
-- Name: maintenance_completions maintenance_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_pkey PRIMARY KEY (id);


--
-- Name: maintenance_reminders maintenance_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_pkey PRIMARY KEY (id);


--
-- Name: meals meals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_pkey PRIMARY KEY (id);


--
-- Name: photo_sources photo_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photo_sources
    ADD CONSTRAINT photo_sources_pkey PRIMARY KEY (id);


--
-- Name: photos photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_unique UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: shopping_items shopping_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_pkey PRIMARY KEY (id);


--
-- Name: shopping_list_sources shopping_list_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_list_sources
    ADD CONSTRAINT shopping_list_sources_pkey PRIMARY KEY (id);


--
-- Name: shopping_lists shopping_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_pkey PRIMARY KEY (id);


--
-- Name: task_lists task_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_lists
    ADD CONSTRAINT task_lists_pkey PRIMARY KEY (id);


--
-- Name: task_sources task_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sources
    ADD CONSTRAINT task_sources_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: travel_pin_photos travel_pin_photos_pin_photo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_pin_photos
    ADD CONSTRAINT travel_pin_photos_pin_photo_key UNIQUE (pin_id, photo_id);


--
-- Name: travel_pin_photos travel_pin_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_pin_photos
    ADD CONSTRAINT travel_pin_photos_pkey PRIMARY KEY (id);


--
-- Name: travel_pins travel_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_pins
    ADD CONSTRAINT travel_pins_pkey PRIMARY KEY (id);


--
-- Name: travel_trips travel_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_trips
    ADD CONSTRAINT travel_trips_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: weekend_places weekend_places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekend_places
    ADD CONSTRAINT weekend_places_pkey PRIMARY KEY (id);


--
-- Name: weekend_visits weekend_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekend_visits
    ADD CONSTRAINT weekend_visits_pkey PRIMARY KEY (id);


--
-- Name: wish_item_sources wish_item_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wish_item_sources
    ADD CONSTRAINT wish_item_sources_pkey PRIMARY KEY (id);


--
-- Name: wish_items wish_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wish_items
    ADD CONSTRAINT wish_items_pkey PRIMARY KEY (id);


--
-- Name: api_tokens_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS api_tokens_created_by_idx ON public.api_tokens USING btree (created_by);


--
-- Name: api_tokens_token_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS api_tokens_token_hash_idx ON public.api_tokens USING btree (token_hash);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_entity_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON public.audit_logs USING btree (entity_type);


--
-- Name: audit_logs_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs USING btree (user_id);


--
-- Name: babysitter_info_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS babysitter_info_section_idx ON public.babysitter_info USING btree (section);


--
-- Name: babysitter_info_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS babysitter_info_sort_order_idx ON public.babysitter_info USING btree (sort_order);


--
-- Name: birthdays_name_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS birthdays_name_event_type_idx ON public.birthdays USING btree (name, event_type);


--
-- Name: bus_geofence_log_event_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS bus_geofence_log_event_time_idx ON public.bus_geofence_log USING btree (event_time);


--
-- Name: bus_geofence_log_gmail_message_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS bus_geofence_log_gmail_message_id_idx ON public.bus_geofence_log USING btree (gmail_message_id);


--
-- Name: bus_geofence_log_route_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS bus_geofence_log_route_id_idx ON public.bus_geofence_log USING btree (route_id);


--
-- Name: bus_geofence_log_trip_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS bus_geofence_log_trip_date_idx ON public.bus_geofence_log USING btree (trip_date);


--
-- Name: bus_routes_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS bus_routes_enabled_idx ON public.bus_routes USING btree (enabled);


--
-- Name: bus_routes_trip_direction_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS bus_routes_trip_direction_idx ON public.bus_routes USING btree (trip_id, direction);


--
-- Name: calendar_groups_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS calendar_groups_type_idx ON public.calendar_groups USING btree (type);


--
-- Name: calendar_notes_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS calendar_notes_date_idx ON public.calendar_notes USING btree (date);


--
-- Name: calendar_sources_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS calendar_sources_enabled_idx ON public.calendar_sources USING btree (enabled);


--
-- Name: calendar_sources_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS calendar_sources_user_id_idx ON public.calendar_sources USING btree (user_id);


--
-- Name: chore_completions_approved_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS chore_completions_approved_by_idx ON public.chore_completions USING btree (approved_by);


--
-- Name: chore_completions_chore_approved_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS chore_completions_chore_approved_by_idx ON public.chore_completions USING btree (chore_id, approved_by);


--
-- Name: chore_completions_chore_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS chore_completions_chore_id_idx ON public.chore_completions USING btree (chore_id);


--
-- Name: chore_completions_completed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS chore_completions_completed_at_idx ON public.chore_completions USING btree (completed_at);


--
-- Name: chores_assigned_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS chores_assigned_to_idx ON public.chores USING btree (assigned_to);


--
-- Name: chores_next_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS chores_next_due_idx ON public.chores USING btree (next_due);


--
-- Name: events_calendar_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS events_calendar_source_idx ON public.events USING btree (calendar_source_id);


--
-- Name: events_end_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS events_end_time_idx ON public.events USING btree (end_time);


--
-- Name: events_source_external_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS events_source_external_unique ON public.events USING btree (calendar_source_id, external_event_id);


--
-- Name: events_start_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS events_start_time_idx ON public.events USING btree (start_time);


--
-- Name: family_messages_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS family_messages_created_at_idx ON public.family_messages USING btree (created_at);


--
-- Name: family_messages_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS family_messages_expires_at_idx ON public.family_messages USING btree (expires_at);


--
-- Name: gift_ideas_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS gift_ideas_created_by_idx ON public.gift_ideas USING btree (created_by);


--
-- Name: gift_ideas_for_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS gift_ideas_for_user_id_idx ON public.gift_ideas USING btree (for_user_id);


--
-- Name: gift_ideas_for_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS gift_ideas_for_user_idx ON public.gift_ideas USING btree (for_user_id);


--
-- Name: goal_achievements_goal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS goal_achievements_goal_id_idx ON public.goal_achievements USING btree (goal_id);


--
-- Name: goal_achievements_goal_user_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS goal_achievements_goal_user_period_idx ON public.goal_achievements USING btree (goal_id, user_id, period_start);


--
-- Name: goal_achievements_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS goal_achievements_unique_idx ON public.goal_achievements USING btree (goal_id, user_id, period_start);


--
-- Name: goal_achievements_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS goal_achievements_user_id_idx ON public.goal_achievements USING btree (user_id);


--
-- Name: goals_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS goals_active_idx ON public.goals USING btree (active);


--
-- Name: goals_active_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS goals_active_priority_idx ON public.goals USING btree (active, priority);


--
-- Name: layouts_slug_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS layouts_slug_unique_idx ON public.layouts USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: maintenance_reminders_next_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS maintenance_reminders_next_due_idx ON public.maintenance_reminders USING btree (next_due);


--
-- Name: meals_day_of_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS meals_day_of_week_idx ON public.meals USING btree (day_of_week);


--
-- Name: meals_week_of_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS meals_week_of_idx ON public.meals USING btree (week_of);


--
-- Name: photos_favorite_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS photos_favorite_idx ON public.photos USING btree (favorite);


--
-- Name: photos_dedupe_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS photos_dedupe_key_idx ON public.photos USING btree (dedupe_key);


--
-- Name: photos_source_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS photos_source_id_idx ON public.photos USING btree (source_id);


--
-- Name: photos_taken_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS photos_taken_at_idx ON public.photos USING btree (taken_at);


--
-- Name: photos_usage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS photos_usage_idx ON public.photos USING btree (usage);


--
-- Name: recipes_favorite_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS recipes_favorite_idx ON public.recipes USING btree (is_favorite);


--
-- Name: recipes_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS recipes_name_idx ON public.recipes USING btree (name);


--
-- Name: recipes_source_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS recipes_source_type_idx ON public.recipes USING btree (source_type);


--
-- Name: shopping_items_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS shopping_items_category_idx ON public.shopping_items USING btree (category);


--
-- Name: shopping_items_checked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS shopping_items_checked_idx ON public.shopping_items USING btree (checked);


--
-- Name: shopping_items_external_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS shopping_items_external_id_idx ON public.shopping_items USING btree (external_id);


--
-- Name: shopping_items_list_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS shopping_items_list_id_idx ON public.shopping_items USING btree (list_id);


--
-- Name: shopping_items_shopping_list_source_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS shopping_items_shopping_list_source_id_idx ON public.shopping_items USING btree (shopping_list_source_id);


--
-- Name: shopping_items_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS shopping_items_source_idx ON public.shopping_items USING btree (shopping_list_source_id);


--
-- Name: shopping_list_sources_shopping_list_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS shopping_list_sources_shopping_list_idx ON public.shopping_list_sources USING btree (shopping_list_id);


--
-- Name: shopping_list_sources_user_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS shopping_list_sources_user_provider_idx ON public.shopping_list_sources USING btree (user_id, provider);


--
-- Name: task_sources_task_list_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS task_sources_task_list_idx ON public.task_sources USING btree (task_list_id);


--
-- Name: task_sources_user_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS task_sources_user_provider_idx ON public.task_sources USING btree (user_id, provider);


--
-- Name: tasks_assigned_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON public.tasks USING btree (assigned_to);


--
-- Name: tasks_completed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS tasks_completed_idx ON public.tasks USING btree (completed);


--
-- Name: tasks_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks USING btree (due_date);


--
-- Name: tasks_external_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS tasks_external_id_idx ON public.tasks USING btree (external_id);


--
-- Name: tasks_list_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS tasks_list_id_idx ON public.tasks USING btree (list_id);


--
-- Name: tasks_task_source_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS tasks_task_source_id_idx ON public.tasks USING btree (task_source_id);


--
-- Name: tasks_task_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS tasks_task_source_idx ON public.tasks USING btree (task_source_id);


--
-- Name: travel_pin_photos_photo_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS travel_pin_photos_photo_id_idx ON public.travel_pin_photos USING btree (photo_id);


--
-- Name: travel_pin_photos_pin_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS travel_pin_photos_pin_id_idx ON public.travel_pin_photos USING btree (pin_id);


--
-- Name: travel_pins_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS travel_pins_parent_id_idx ON public.travel_pins USING btree (parent_id);


--
-- Name: travel_pins_trip_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS travel_pins_trip_id_idx ON public.travel_pins USING btree (trip_id);


--
-- Name: travel_pins_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS travel_pins_year_idx ON public.travel_pins USING btree (year);


--
-- Name: travel_trips_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS travel_trips_year_idx ON public.travel_trips USING btree (year);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users USING btree (email);


--
-- Name: weekend_places_favorite_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS weekend_places_favorite_idx ON public.weekend_places USING btree (is_favorite);


--
-- Name: weekend_places_last_visited_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS weekend_places_last_visited_idx ON public.weekend_places USING btree (last_visited_date);


--
-- Name: weekend_places_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS weekend_places_status_idx ON public.weekend_places USING btree (status);


--
-- Name: weekend_visits_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS weekend_visits_place_id_idx ON public.weekend_visits USING btree (place_id, visited_on);


--
-- Name: wish_item_sources_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_item_sources_member_idx ON public.wish_item_sources USING btree (member_id);


--
-- Name: wish_item_sources_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS wish_item_sources_unique_idx ON public.wish_item_sources USING btree (user_id, member_id, provider);


--
-- Name: wish_item_sources_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_item_sources_user_id_idx ON public.wish_item_sources USING btree (user_id);


--
-- Name: wish_item_sources_user_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_item_sources_user_provider_idx ON public.wish_item_sources USING btree (user_id, provider);


--
-- Name: wish_items_added_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_items_added_by_idx ON public.wish_items USING btree (added_by);


--
-- Name: wish_items_claimed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_items_claimed_idx ON public.wish_items USING btree (claimed);


--
-- Name: wish_items_external_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_items_external_id_idx ON public.wish_items USING btree (external_id);


--
-- Name: wish_items_member_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_items_member_id_idx ON public.wish_items USING btree (member_id);


--
-- Name: wish_items_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_items_source_idx ON public.wish_items USING btree (wish_item_source_id);


--
-- Name: wish_items_wish_item_source_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS wish_items_wish_item_source_id_idx ON public.wish_items USING btree (wish_item_source_id);


--
-- Name: api_tokens api_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: birthdays birthdays_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthdays
    ADD CONSTRAINT birthdays_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: birthdays birthdays_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.birthdays
    ADD CONSTRAINT birthdays_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bus_geofence_log bus_geofence_log_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_geofence_log
    ADD CONSTRAINT bus_geofence_log_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.bus_routes(id) ON DELETE CASCADE;


--
-- Name: bus_routes bus_routes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_routes
    ADD CONSTRAINT bus_routes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: calendar_groups calendar_groups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_groups
    ADD CONSTRAINT calendar_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_groups calendar_groups_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_groups
    ADD CONSTRAINT calendar_groups_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_notes calendar_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notes
    ADD CONSTRAINT calendar_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: calendar_sources calendar_sources_group_id_calendar_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_group_id_calendar_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.calendar_groups(id) ON DELETE SET NULL;


--
-- Name: calendar_sources calendar_sources_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.calendar_groups(id) ON DELETE SET NULL;


--
-- Name: calendar_sources calendar_sources_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_sources calendar_sources_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_sources
    ADD CONSTRAINT calendar_sources_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chore_completions chore_completions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chore_completions chore_completions_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chore_completions chore_completions_chore_id_chores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_chore_id_chores_id_fk FOREIGN KEY (chore_id) REFERENCES public.chores(id) ON DELETE CASCADE;


--
-- Name: chore_completions chore_completions_chore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_chore_id_fkey FOREIGN KEY (chore_id) REFERENCES public.chores(id) ON DELETE CASCADE;


--
-- Name: chore_completions chore_completions_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chore_completions chore_completions_completed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chore_completions
    ADD CONSTRAINT chore_completions_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chores chores_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chores chores_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chores chores_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chores chores_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chores
    ADD CONSTRAINT chores_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: events events_calendar_source_id_calendar_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_calendar_source_id_calendar_sources_id_fk FOREIGN KEY (calendar_source_id) REFERENCES public.calendar_sources(id) ON DELETE CASCADE;


--
-- Name: events events_calendar_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_calendar_source_id_fkey FOREIGN KEY (calendar_source_id) REFERENCES public.calendar_sources(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: events events_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: family_messages family_messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_messages
    ADD CONSTRAINT family_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: family_messages family_messages_author_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_messages
    ADD CONSTRAINT family_messages_author_id_users_id_fk FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: gift_ideas gift_ideas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_ideas
    ADD CONSTRAINT gift_ideas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: gift_ideas gift_ideas_for_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_ideas
    ADD CONSTRAINT gift_ideas_for_user_id_fkey FOREIGN KEY (for_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: goal_achievements goal_achievements_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_achievements
    ADD CONSTRAINT goal_achievements_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: goal_achievements goal_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_achievements
    ADD CONSTRAINT goal_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: layouts layouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: layouts layouts_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: maintenance_completions maintenance_completions_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: maintenance_completions maintenance_completions_completed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: maintenance_completions maintenance_completions_reminder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.maintenance_reminders(id) ON DELETE CASCADE;


--
-- Name: maintenance_completions maintenance_completions_reminder_id_maintenance_reminders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_completions
    ADD CONSTRAINT maintenance_completions_reminder_id_maintenance_reminders_id_fk FOREIGN KEY (reminder_id) REFERENCES public.maintenance_reminders(id) ON DELETE CASCADE;


--
-- Name: maintenance_reminders maintenance_reminders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: maintenance_reminders maintenance_reminders_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: maintenance_reminders maintenance_reminders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: maintenance_reminders maintenance_reminders_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_reminders
    ADD CONSTRAINT maintenance_reminders_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meals meals_cooked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_cooked_by_fkey FOREIGN KEY (cooked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meals meals_cooked_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_cooked_by_users_id_fk FOREIGN KEY (cooked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meals meals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meals meals_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meals meals_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;


--
-- Name: photos photos_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.photo_sources(id) ON DELETE CASCADE;


--
-- Name: photos photos_source_id_photo_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_source_id_photo_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.photo_sources(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shopping_items shopping_items_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shopping_items shopping_items_added_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_added_by_users_id_fk FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shopping_items shopping_items_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;


--
-- Name: shopping_items shopping_items_list_id_shopping_lists_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_list_id_shopping_lists_id_fk FOREIGN KEY (list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;


--
-- Name: shopping_items shopping_items_shopping_list_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_items
    ADD CONSTRAINT shopping_items_shopping_list_source_id_fkey FOREIGN KEY (shopping_list_source_id) REFERENCES public.shopping_list_sources(id) ON DELETE SET NULL;


--
-- Name: shopping_list_sources shopping_list_sources_shopping_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_list_sources
    ADD CONSTRAINT shopping_list_sources_shopping_list_id_fkey FOREIGN KEY (shopping_list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;


--
-- Name: shopping_list_sources shopping_list_sources_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_list_sources
    ADD CONSTRAINT shopping_list_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shopping_lists shopping_lists_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shopping_lists shopping_lists_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shopping_lists shopping_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shopping_lists shopping_lists_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_lists
    ADD CONSTRAINT shopping_lists_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_lists task_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_lists
    ADD CONSTRAINT task_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_sources task_sources_task_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sources
    ADD CONSTRAINT task_sources_task_list_id_fkey FOREIGN KEY (task_list_id) REFERENCES public.task_lists(id) ON DELETE CASCADE;


--
-- Name: task_sources task_sources_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sources
    ADD CONSTRAINT task_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_completed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.task_lists(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_task_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_task_source_id_fkey FOREIGN KEY (task_source_id) REFERENCES public.task_sources(id) ON DELETE SET NULL;


--
-- Name: travel_pin_photos travel_pin_photos_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_pin_photos
    ADD CONSTRAINT travel_pin_photos_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


--
-- Name: travel_pin_photos travel_pin_photos_pin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_pin_photos
    ADD CONSTRAINT travel_pin_photos_pin_id_fkey FOREIGN KEY (pin_id) REFERENCES public.travel_pins(id) ON DELETE CASCADE;


--
-- Name: travel_pins travel_pins_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_pins
    ADD CONSTRAINT travel_pins_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: travel_pins travel_pins_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_pins
    ADD CONSTRAINT travel_pins_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.travel_pins(id) ON DELETE CASCADE;


--
-- Name: travel_pins travel_pins_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_pins
    ADD CONSTRAINT travel_pins_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.travel_trips(id) ON DELETE CASCADE;


--
-- Name: travel_trips travel_trips_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_trips
    ADD CONSTRAINT travel_trips_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: weekend_places weekend_places_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekend_places
    ADD CONSTRAINT weekend_places_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: weekend_visits weekend_visits_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekend_visits
    ADD CONSTRAINT weekend_visits_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.weekend_places(id) ON DELETE CASCADE;


--
-- Name: weekend_visits weekend_visits_visited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekend_visits
    ADD CONSTRAINT weekend_visits_visited_by_fkey FOREIGN KEY (visited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wish_item_sources wish_item_sources_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wish_item_sources
    ADD CONSTRAINT wish_item_sources_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wish_item_sources wish_item_sources_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wish_item_sources
    ADD CONSTRAINT wish_item_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wish_items wish_items_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wish_items
    ADD CONSTRAINT wish_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wish_items wish_items_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wish_items
    ADD CONSTRAINT wish_items_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wish_items wish_items_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wish_items
    ADD CONSTRAINT wish_items_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wish_items wish_items_wish_item_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wish_items
    ADD CONSTRAINT wish_items_wish_item_source_id_fkey FOREIGN KEY (wish_item_source_id) REFERENCES public.wish_item_sources(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


