CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_ci_idx ON app_users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_ci_idx ON app_users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_refresh_tokens_user_idx ON app_refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS app_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  category_id text NOT NULL REFERENCES app_categories(id),
  category_name text NOT NULL,
  base_unit text NOT NULL,
  pack_size integer NOT NULL CHECK (pack_size > 0),
  track_stock boolean NOT NULL DEFAULT true,
  cost_price_kobo integer NOT NULL DEFAULT 0 CHECK (cost_price_kobo >= 0),
  reorder_level integer NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  price_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_item_images (
  item_id text PRIMARY KEY REFERENCES app_items(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  image_data bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sales (
  id text PRIMARY KEY,
  client_uuid uuid NOT NULL UNIQUE,
  staff_id text NOT NULL REFERENCES app_users(id),
  staff_name text NOT NULL,
  total_kobo bigint NOT NULL CHECK (total_kobo >= 0),
  created_at timestamptz NOT NULL,
  cleared_at timestamptz,
  voided_at timestamptz,
  void_reason text
);

CREATE TABLE IF NOT EXISTS app_sale_items (
  id text PRIMARY KEY,
  sale_id text NOT NULL REFERENCES app_sales(id),
  item_id text NOT NULL REFERENCES app_items(id),
  item_name text NOT NULL,
  price_point_id text NOT NULL,
  price_point_label text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_kobo integer NOT NULL CHECK (unit_price_kobo >= 0),
  base_units_deducted integer NOT NULL CHECK (base_units_deducted > 0),
  total_kobo bigint NOT NULL CHECK (total_kobo >= 0)
);

CREATE TABLE IF NOT EXISTS app_stock_events (
  id text PRIMARY KEY,
  client_uuid uuid NOT NULL,
  item_id text NOT NULL REFERENCES app_items(id),
  event_type text NOT NULL CHECK (event_type IN ('opening', 'purchase', 'sale', 'adjustment')),
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  description text NOT NULL,
  actor_user_id text NOT NULL REFERENCES app_users(id),
  device_id text NOT NULL,
  unit_cost_kobo integer CHECK (unit_cost_kobo IS NULL OR unit_cost_kobo >= 0),
  created_at_client timestamptz NOT NULL,
  created_at_server timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_uuid, item_id, event_type)
);

CREATE TABLE IF NOT EXISTS app_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES app_users(id),
  user_name text NOT NULL,
  user_role text NOT NULL CHECK (user_role IN ('owner', 'manager', 'staff')),
  action text NOT NULL,
  what text NOT NULL,
  old_value text NOT NULL DEFAULT '',
  new_value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_entry_id uuid REFERENCES app_activity_log(id),
  action text NOT NULL,
  what text NOT NULL,
  user_name text NOT NULL,
  user_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE TABLE IF NOT EXISTS app_sync_actions (
  client_uuid uuid PRIMARY KEY,
  device_id text NOT NULL,
  user_id text NOT NULL REFERENCES app_users(id),
  action_type text NOT NULL,
  payload jsonb NOT NULL,
  accepted boolean NOT NULL,
  result jsonb,
  rejection_reason text,
  created_at_client timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_change_log (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_stock_events_item_time_idx ON app_stock_events(item_id, created_at_server);
CREATE INDEX IF NOT EXISTS app_sales_staff_time_idx ON app_sales(staff_id, created_at);
CREATE INDEX IF NOT EXISTS app_activity_time_idx ON app_activity_log(created_at);
CREATE INDEX IF NOT EXISTS app_notifications_time_idx ON app_notifications(created_at);
CREATE INDEX IF NOT EXISTS app_change_log_time_idx ON app_change_log(created_at);

DO $$
BEGIN
  IF to_regprocedure('app_reject_activity_mutation()') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION app_reject_activity_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN
        RAISE EXCEPTION 'Activity log entries are append-only';
      END;
      $body$
    $function$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'app_activity_log_no_update'
      AND tgrelid = 'app_activity_log'::regclass
  ) THEN
    CREATE TRIGGER app_activity_log_no_update
      BEFORE UPDATE OR DELETE ON app_activity_log
      FOR EACH ROW EXECUTE FUNCTION app_reject_activity_mutation();
  END IF;
END;
$$;
