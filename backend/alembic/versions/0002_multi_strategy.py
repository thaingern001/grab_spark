"""Merchant-scoped multi-strategy assumptions and immutable approval snapshot."""
from alembic import op

revision = "0002_multi_strategy"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE TABLE mission_strategy_inputs (
        merchant_id uuid NOT NULL, mission_id uuid NOT NULL,
        evaluation_revision integer NOT NULL CHECK (evaluation_revision > 0),
        baseline_units integer NOT NULL CHECK (baseline_units >= 0),
        bundle_units integer NOT NULL CHECK (bundle_units >= 0),
        discount_amount numeric(12,2) NOT NULL CHECK (discount_amount >= 0),
        discount_demand_lift numeric(7,4) NOT NULL CHECK (discount_demand_lift BETWEEN 0 AND 2),
        advertising_spend numeric(12,2) NOT NULL CHECK (advertising_spend >= 0),
        advertising_incremental_orders integer NOT NULL CHECK (advertising_incremental_orders >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (merchant_id,mission_id),
        FOREIGN KEY (merchant_id,mission_id) REFERENCES missions(merchant_id,id)
    )""")
    op.execute("""CREATE TABLE mission_strategy_approvals (
        merchant_id uuid NOT NULL, mission_id uuid NOT NULL,
        strategy_id text NOT NULL CHECK (strategy_id IN ('bundle','discount','advertising')),
        scenario_revision integer NOT NULL CHECK (scenario_revision > 0),
        evaluation_revision integer NOT NULL CHECK (evaluation_revision > 0),
        model_version text NOT NULL,
        snapshot jsonb NOT NULL,
        approved_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (merchant_id,mission_id),
        FOREIGN KEY (merchant_id,mission_id) REFERENCES missions(merchant_id,id)
    )""")
    op.execute("""CREATE FUNCTION forbid_strategy_approval_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'approved strategy snapshots are immutable'; END $$""")
    op.execute("""CREATE TRIGGER strategy_approval_immutable BEFORE UPDATE OR DELETE
        ON mission_strategy_approvals FOR EACH ROW EXECUTE FUNCTION forbid_strategy_approval_mutation()""")


def downgrade():
    op.execute("DROP TABLE mission_strategy_approvals")
    op.execute("DROP TABLE mission_strategy_inputs")
    op.execute("DROP FUNCTION forbid_strategy_approval_mutation()")
