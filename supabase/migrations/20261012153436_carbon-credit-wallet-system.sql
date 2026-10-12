/*
# Carbon Credit Wallet System

## Purpose
Make the wallet functional by tying credits to carbon impact. When a supervisor
verifies a report or a worker completes a task, the system awards carbon credits
based on the waste type and quantity. Users can then redeem those credits for
rewards managed by admins.

## Changes

1. New column on `waste_categories`:
   - `co2_saved_per_kg` (numeric, default 2.5) — kg of CO2 saved per kg of waste recycled.
   This drives the carbon-credit calculation.

2. New column on `credit_transactions`:
   - `co2_kg` (numeric, nullable) — CO2 kg saved for this transaction (for credit awards).

3. New column on `rewards`:
   - `co2_cost_kg` (numeric, nullable) — optional CO2 kg equivalent for display.

4. New SECURITY DEFINER function `award_carbon_credits`:
   - Parameters: p_user_id, p_amount, p_transaction_type, p_description, p_related_report_id, p_co2_kg
   - Inserts a credit_transactions row.
   - Atomically increments profiles.credits_balance and profiles.co2_saved_kg.
   - Updates profiles.contribution_score and badge_level.
   - Returns the new balance.

5. RLS policies on `rewards` so authenticated users can read active rewards.

## Security
- `award_carbon_credits` is SECURITY DEFINER so it can update profiles even though
  the calling user shouldn't have direct UPDATE on other people's profiles.
- Executed by authenticated role only.
- No new tables created.
*/

-- 1. Add co2_saved_per_kg to waste_categories
ALTER TABLE waste_categories
  ADD COLUMN IF NOT EXISTS co2_saved_per_kg numeric DEFAULT 2.5;

-- 2. Add co2_kg to credit_transactions
ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS co2_kg numeric;

-- 3. Add co2_cost_kg to rewards (optional display field)
ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS co2_cost_kg numeric;

-- 4. Reward RLS: authenticated users can read active rewards; admins can manage
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_active_rewards" ON rewards;
CREATE POLICY "read_active_rewards"
ON rewards FOR SELECT
TO authenticated USING (active = true);

DROP POLICY IF EXISTS "admin_manage_rewards" ON rewards;
CREATE POLICY "admin_manage_rewards"
ON rewards FOR ALL
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 5. Credit transactions RLS: users can read their own, inserts via function
-- (The function is SECURITY DEFINER so it bypasses RLS for the insert)
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_transactions" ON credit_transactions;
CREATE POLICY "read_own_transactions"
ON credit_transactions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

-- 6. award_carbon_credits function
CREATE OR REPLACE FUNCTION award_carbon_credits(
  p_user_id uuid,
  p_amount integer,
  p_transaction_type text,
  p_description text DEFAULT NULL,
  p_related_report_id uuid DEFAULT NULL,
  p_co2_kg numeric DEFAULT 0
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance integer;
  v_new_co2 numeric;
  v_new_score integer;
  v_badge text;
BEGIN
  -- Insert transaction record
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, related_report_id, co2_kg)
  VALUES (p_user_id, p_amount, p_transaction_type, p_description, p_related_report_id, p_co2_kg);

  -- Update profile balance and CO2
  UPDATE profiles
  SET
    credits_balance = credits_balance + p_amount,
    co2_saved_kg = co2_saved_kg + p_co2_kg,
    contribution_score = contribution_score + LEAST(p_amount, 50)
  WHERE id = p_user_id
  RETURNING credits_balance, co2_saved_kg, contribution_score INTO v_new_balance, v_new_co2, v_new_score;

  -- Update badge level based on contribution score
  v_badge := CASE
    WHEN v_new_score >= 5000 THEN 'Platinum'
    WHEN v_new_score >= 2000 THEN 'Gold'
    WHEN v_new_score >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;

  UPDATE profiles SET badge_level = v_badge WHERE id = p_user_id;

  RETURN v_new_balance;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION award_carbon_credits TO authenticated;
