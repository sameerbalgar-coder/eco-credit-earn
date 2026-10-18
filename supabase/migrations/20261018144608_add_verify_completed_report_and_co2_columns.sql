/*
# Add verify_completed_report RPC and supporting columns

1. New columns on waste_reports
- co2_saved_kg (numeric, default 0) — CO2 saved from this cleanup
- verification_status (text, default 'pending') — 'pending', 'approved', 'rejected'

2. New column on credit_transactions
- source (text, nullable) — 'report_cleanup', 'bonus', 'redemption'

3. New RPC: verify_completed_report
- Parameters: p_report_id uuid, p_supervisor_id uuid, p_credits_awarded int default 20, p_co2_kg numeric default 1.5
- Actions in single transaction:
  1. Guard against double-verification (status must be 'completed')
  2. Mark report status = 'verified', verification_status = 'approved'
  3. Set credits_awarded, co2_saved_kg, verified_at, verified_by
  4. Call award_carbon_credits to update citizen profile + insert transaction
  5. Create notification for the citizen

4. Security
- Function is SECURITY DEFINER
- GRANT EXECUTE to authenticated, anon

5. Idempotency
- ALTER TABLE ADD COLUMN IF NOT EXISTS
- CREATE OR REPLACE FUNCTION
*/

ALTER TABLE waste_reports ADD COLUMN IF NOT EXISTS co2_saved_kg numeric NOT NULL DEFAULT 0;
ALTER TABLE waste_reports ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS source text;

CREATE OR REPLACE FUNCTION verify_completed_report(
  p_report_id uuid,
  p_supervisor_id uuid,
  p_credits_awarded integer DEFAULT 20,
  p_co2_kg numeric DEFAULT 1.5
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_report waste_reports%ROWTYPE;
  v_citizen_id uuid;
  v_already_verified boolean;
BEGIN
  SELECT * INTO v_report FROM waste_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Report not found');
  END IF;

  v_already_verified := (v_report.status = 'verified');

  IF v_already_verified THEN
    RETURN jsonb_build_object(
      'status', 'already_verified',
      'credits_awarded', v_report.credits_awarded,
      'already_verified', true
    );
  END IF;

  IF v_report.status NOT IN ('completed', 'rejected') THEN
    RETURN jsonb_build_object('error', 'Report must be completed before verification');
  END IF;

  v_citizen_id := v_report.reporter_id;

  -- Mark report as verified
  UPDATE waste_reports
  SET
    status = 'verified',
    verification_status = 'approved',
    credits_awarded = p_credits_awarded,
    co2_saved_kg = p_co2_kg,
    verified_at = now(),
    verified_by = p_supervisor_id,
    is_flagged = false
  WHERE id = p_report_id;

  -- Award credits to the citizen
  PERFORM award_carbon_credits(
    v_citizen_id,
    p_credits_awarded,
    'report_verified',
    'Cleanup verified by supervisor',
    p_report_id,
    p_co2_kg
  );

  -- Update transaction source
  UPDATE credit_transactions
  SET source = 'report_cleanup'
  WHERE related_report_id = p_report_id
    AND user_id = v_citizen_id
    AND transaction_type = 'report_verified';

  -- Notify the citizen
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_citizen_id,
    'Cleanup Verified!',
    CONCAT(p_credits_awarded, ' carbon credits and ', p_co2_kg, ' kg CO2 saved released to your wallet.'),
    'credit'
  );

  RETURN jsonb_build_object(
    'status', 'verified',
    'credits_awarded', p_credits_awarded,
    'co2_saved_kg', p_co2_kg,
    'already_verified', false
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION verify_completed_report(uuid, uuid, integer, numeric) TO authenticated, anon;