-- Phase 1 PostgreSQL 15+ design schema. Phase 2 standalone migration is in backend/alembic/versions/0001_initial.py.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE merchants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(trim(name)) > 0),
 business_type text NOT NULL,
 currency char(3) NOT NULL DEFAULT 'THB' CHECK (currency = 'THB'),
 timezone text NOT NULL DEFAULT 'Asia/Bangkok' CHECK (timezone = 'Asia/Bangkok'),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE merchant_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES merchants(id),
 email text NOT NULL,
 display_name text NOT NULL,
 role text NOT NULL CHECK (role IN ('owner','viewer')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (merchant_id, id),
 UNIQUE (merchant_id, email)
);

CREATE TABLE menu_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES merchants(id),
 name text NOT NULL,
 category text NOT NULL,
 current_price numeric(12,2) NOT NULL CHECK (current_price >= 0),
 available boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (merchant_id, id),
 UNIQUE (merchant_id, name)
);

CREATE TABLE menu_cost_assumptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL,
 menu_item_id uuid NOT NULL,
 food_cost numeric(12,2) CHECK (food_cost >= 0),
 packaging_cost numeric(12,2) CHECK (packaging_cost >= 0),
 other_variable_cost numeric(12,2) CHECK (other_variable_cost >= 0),
 deduction_rate numeric(7,4) CHECK (deduction_rate BETWEEN 0 AND 1),
 source_kind text NOT NULL CHECK (source_kind IN ('synthetic_history','merchant_confirmed','assumption')),
 source_note text,
 effective_from timestamptz NOT NULL,
 confirmed_at timestamptz,
 CHECK ((source_kind = 'merchant_confirmed') = (confirmed_at IS NOT NULL)),
 UNIQUE (merchant_id, id),
 UNIQUE (merchant_id, menu_item_id, effective_from),
 FOREIGN KEY (merchant_id, menu_item_id) REFERENCES menu_items(merchant_id, id)
);

CREATE TABLE orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES merchants(id),
 placed_at timestamptz NOT NULL,
 status text NOT NULL CHECK (status IN ('completed','cancelled','refunded')),
 synthetic boolean NOT NULL DEFAULT true,
 seed_version text,
 UNIQUE (merchant_id, id)
);
CREATE INDEX orders_merchant_date_idx ON orders (merchant_id, placed_at) WHERE status = 'completed';

CREATE TABLE order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL,
 order_id uuid NOT NULL,
 menu_item_id uuid NOT NULL,
 quantity integer NOT NULL CHECK (quantity > 0),
 unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
 unit_merchant_discount numeric(12,2) NOT NULL CHECK (unit_merchant_discount >= 0 AND unit_merchant_discount <= unit_price),
 unit_deduction_rate numeric(7,4) NOT NULL CHECK (unit_deduction_rate BETWEEN 0 AND 1),
 unit_deduction_amount numeric(12,2) NOT NULL CHECK (unit_deduction_amount >= 0),
 unit_food_cost numeric(12,2) NOT NULL CHECK (unit_food_cost >= 0),
 unit_packaging_cost numeric(12,2) NOT NULL CHECK (unit_packaging_cost >= 0),
 unit_other_variable_cost numeric(12,2) NOT NULL CHECK (unit_other_variable_cost >= 0),
 provenance text NOT NULL CHECK (provenance IN ('synthetic_history','merchant_confirmed','assumption')),
 source_note text,
 confirmed_at timestamptz,
 CHECK ((provenance = 'merchant_confirmed') = (confirmed_at IS NOT NULL)),
 CHECK (unit_deduction_amount <= unit_price),
 UNIQUE (merchant_id, id),
 FOREIGN KEY (merchant_id, order_id) REFERENCES orders(merchant_id, id),
 FOREIGN KEY (merchant_id, menu_item_id) REFERENCES menu_items(merchant_id, id)
);
CREATE INDEX order_items_order_idx ON order_items (merchant_id, order_id);
CREATE INDEX order_items_menu_idx ON order_items (merchant_id, menu_item_id);

CREATE TABLE missions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL REFERENCES merchants(id),
 title text NOT NULL,
 rationale text NOT NULL,
 intended_outcome text NOT NULL,
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','running','completed','reviewed','rejected','cancelled')),
 trial_days integer NOT NULL DEFAULT 7 CHECK (trial_days BETWEEN 1 AND 30),
 current_revision integer NOT NULL DEFAULT 1 CHECK (current_revision > 0),
 approved_revision integer CHECK (approved_revision > 0),
 approval_idempotency_key text,
 approval_request_fingerprint text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (merchant_id, id),
 CHECK (approved_revision IS NULL OR approved_revision <= current_revision),
 CHECK ((approval_idempotency_key IS NULL) = (approval_request_fingerprint IS NULL))
);
CREATE UNIQUE INDEX missions_approval_key_idx ON missions (merchant_id, approval_idempotency_key) WHERE approval_idempotency_key IS NOT NULL;
CREATE INDEX missions_status_idx ON missions (merchant_id, status, created_at DESC);

CREATE TABLE mission_scenarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL,
 mission_id uuid NOT NULL,
 revision integer NOT NULL CHECK (revision > 0),
 arm text NOT NULL CHECK (arm IN ('baseline','proposed')),
 label text NOT NULL,
 unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
 food_cost numeric(12,2) CHECK (food_cost >= 0),
 packaging_cost numeric(12,2) CHECK (packaging_cost >= 0),
 other_variable_cost numeric(12,2) CHECK (other_variable_cost >= 0),
 deduction_rate numeric(7,4) CHECK (deduction_rate BETWEEN 0 AND 1),
 merchant_discount numeric(12,2) CHECK (merchant_discount >= 0 AND merchant_discount <= unit_price),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (merchant_id, id),
 UNIQUE (merchant_id, mission_id, revision, arm),
 FOREIGN KEY (merchant_id, mission_id) REFERENCES missions(merchant_id, id)
);

CREATE TABLE scenario_input_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL,
 scenario_id uuid NOT NULL,
 input_name text NOT NULL CHECK (input_name IN ('unit_price','food_cost','packaging_cost','other_variable_cost','deduction_rate','merchant_discount')),
 source_kind text NOT NULL CHECK (source_kind IN ('synthetic_history','merchant_confirmed','assumption')),
 source_note text,
 confirmed_at timestamptz,
 UNIQUE (merchant_id, scenario_id, input_name),
 FOREIGN KEY (merchant_id, scenario_id) REFERENCES mission_scenarios(merchant_id, id),
 CHECK ((source_kind = 'merchant_confirmed') = (confirmed_at IS NOT NULL))
);

CREATE TABLE mission_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL,
 mission_id uuid NOT NULL,
 actor_user_id uuid,
 from_status text,
 to_status text NOT NULL CHECK (to_status IN ('proposed','approved','running','completed','reviewed','rejected','cancelled')),
 source text NOT NULL CHECK (source IN ('seed','merchant','simulation')),
 reason text,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (merchant_id, id),
 FOREIGN KEY (merchant_id, mission_id) REFERENCES missions(merchant_id, id),
 FOREIGN KEY (merchant_id, actor_user_id) REFERENCES merchant_users(merchant_id, id)
);
CREATE INDEX mission_events_timeline_idx ON mission_events (merchant_id, mission_id, occurred_at);

CREATE TABLE mission_outcomes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid NOT NULL,
 mission_id uuid NOT NULL,
 arm text NOT NULL CHECK (arm IN ('baseline','trial')),
 period_start date NOT NULL,
 period_end date NOT NULL CHECK (period_end >= period_start),
 units integer NOT NULL CHECK (units >= 0),
 gmv numeric(12,2) NOT NULL CHECK (gmv >= 0),
 merchant_revenue numeric(12,2) NOT NULL,
 estimated_contribution numeric(12,2) NOT NULL,
 simulated boolean NOT NULL DEFAULT true CHECK (simulated),
 simulation_version text NOT NULL,
 generated_at timestamptz NOT NULL DEFAULT now(),
 learning_summary text NOT NULL,
 next_step_guidance text NOT NULL,
 UNIQUE (merchant_id, mission_id, arm),
 FOREIGN KEY (merchant_id, mission_id) REFERENCES missions(merchant_id, id)
);

-- A revision is inserted as both arms in one transaction. The deferred check
-- prevents a half-written revision from committing; uniqueness prevents duplicates.
CREATE FUNCTION check_scenario_pair() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT count(*) FROM mission_scenarios
     WHERE merchant_id = NEW.merchant_id AND mission_id = NEW.mission_id
       AND revision = NEW.revision) <> 2 THEN
   RAISE EXCEPTION 'scenario revision requires baseline and proposed arms';
 END IF;
 IF (SELECT count(*) FROM scenario_input_sources src
     JOIN mission_scenarios s ON (s.merchant_id, s.id) = (src.merchant_id, src.scenario_id)
     WHERE s.merchant_id = NEW.merchant_id AND s.mission_id = NEW.mission_id
       AND s.revision = NEW.revision) <> 12 THEN
   RAISE EXCEPTION 'each scenario arm requires six input sources';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER scenario_pair_at_commit
 AFTER INSERT ON mission_scenarios DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION check_scenario_pair();

CREATE FUNCTION check_mission_revisions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT count(*) FROM mission_scenarios
     WHERE merchant_id = NEW.merchant_id AND mission_id = NEW.id
       AND revision = NEW.current_revision) <> 2 THEN
   RAISE EXCEPTION 'current mission revision must have two arms';
 END IF;
 IF NEW.approved_revision IS NOT NULL AND
    (SELECT count(*) FROM mission_scenarios
     WHERE merchant_id = NEW.merchant_id AND mission_id = NEW.id
       AND revision = NEW.approved_revision) <> 2 THEN
   RAISE EXCEPTION 'approved mission revision must have two arms';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER mission_revisions_at_commit
 AFTER INSERT OR UPDATE OF current_revision, approved_revision ON missions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION check_mission_revisions();

CREATE FUNCTION forbid_scenario_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'scenario arms are immutable; create a new revision';
END $$;
CREATE TRIGGER scenario_immutable
 BEFORE UPDATE OR DELETE ON mission_scenarios
 FOR EACH ROW EXECUTE FUNCTION forbid_scenario_mutation();

CREATE FUNCTION guard_scenario_source_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE approved integer;
BEGIN
 IF TG_OP = 'DELETE' THEN
   RAISE EXCEPTION 'scenario input sources cannot be deleted';
 END IF;
 IF (OLD.merchant_id, OLD.scenario_id, OLD.input_name) IS DISTINCT FROM
    (NEW.merchant_id, NEW.scenario_id, NEW.input_name) THEN
   RAISE EXCEPTION 'scenario input source identity is immutable';
 END IF;
 SELECT m.approved_revision INTO approved
 FROM mission_scenarios s JOIN missions m ON (m.merchant_id, m.id) = (s.merchant_id, s.mission_id)
 WHERE s.merchant_id = OLD.merchant_id AND s.id = OLD.scenario_id;
 IF approved IS NOT NULL AND approved =
    (SELECT revision FROM mission_scenarios WHERE merchant_id = OLD.merchant_id AND id = OLD.scenario_id) THEN
   RAISE EXCEPTION 'approved scenario sources are immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scenario_sources_guard
 BEFORE UPDATE OR DELETE ON scenario_input_sources
 FOR EACH ROW EXECUTE FUNCTION guard_scenario_source_mutation();

CREATE FUNCTION forbid_mission_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'mission events are append-only';
END $$;
CREATE TRIGGER mission_events_immutable
 BEFORE UPDATE OR DELETE ON mission_events
 FOR EACH ROW EXECUTE FUNCTION forbid_mission_event_mutation();
