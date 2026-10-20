BEGIN;

CREATE TABLE IF NOT EXISTS app_businesses (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_categories ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_items ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_item_images ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_sales ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_sale_items ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_stock_events ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_activity_log ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_notifications ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_sync_actions ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_change_log ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES app_businesses(id);

DO $$
DECLARE
  legacy_business_id uuid;
  legacy_business_name text;
BEGIN
  SELECT id INTO legacy_business_id
  FROM app_businesses
  ORDER BY created_at
  LIMIT 1;

  IF legacy_business_id IS NULL THEN
    SELECT COALESCE(value #>> '{}', 'D''Queens')
    INTO legacy_business_name
    FROM app_settings
    WHERE key = 'businessName'
    LIMIT 1;
    legacy_business_name := COALESCE(legacy_business_name, 'D''Queens');

    INSERT INTO app_businesses (id, name)
    VALUES (gen_random_uuid(), legacy_business_name)
    RETURNING id INTO legacy_business_id;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS app_activity_log_no_update ON app_activity_log';

  UPDATE app_users SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_categories SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_items SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_item_images SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_sales SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_sale_items SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_stock_events SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_activity_log SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_notifications SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_sync_actions SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_change_log SET business_id = legacy_business_id WHERE business_id IS NULL;
  UPDATE app_settings SET business_id = legacy_business_id WHERE business_id IS NULL;

  EXECUTE 'CREATE TRIGGER app_activity_log_no_update
    BEFORE UPDATE OR DELETE ON app_activity_log
    FOR EACH ROW EXECUTE FUNCTION app_reject_activity_mutation()';
END;
$$;

ALTER TABLE app_users ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_categories ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_items ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_item_images ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_sales ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_sale_items ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_stock_events ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_activity_log ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_notifications ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_sync_actions ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_change_log ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (business_id, key);

CREATE INDEX IF NOT EXISTS app_users_business_idx ON app_users(business_id);
CREATE INDEX IF NOT EXISTS app_categories_business_idx ON app_categories(business_id);
CREATE INDEX IF NOT EXISTS app_items_business_idx ON app_items(business_id);
CREATE INDEX IF NOT EXISTS app_sales_business_idx ON app_sales(business_id);
CREATE INDEX IF NOT EXISTS app_stock_events_business_idx ON app_stock_events(business_id);
CREATE INDEX IF NOT EXISTS app_activity_business_idx ON app_activity_log(business_id);
CREATE INDEX IF NOT EXISTS app_notifications_business_idx ON app_notifications(business_id);
CREATE INDEX IF NOT EXISTS app_sync_actions_business_idx ON app_sync_actions(business_id);
CREATE INDEX IF NOT EXISTS app_change_log_business_id_idx ON app_change_log(business_id, id);

COMMIT;
