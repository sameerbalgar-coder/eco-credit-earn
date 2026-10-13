/*
# Supervisor review and protected credit release

## Purpose
Add a supervisor-controlled review step after a worker finishes a cleanup task.
A completed report can be verified once, which releases carbon credits to the
citizen who submitted the report, or flagged as fake without releasing credits.

## Database changes

1. `report_status` enum
- Adds `verified` so completed work can be separated from work awaiting review.

2. `waste_reports` columns
- `verified_at` — time the supervisor approved the completed work.
- `verified_by` — supervisor or admin who approved it.
- `credits_awarded` — exact credits released for this report.
- `review_reason` — reason for a rejection or review decision.
- `flagged_at` — time a report was flagged as fake.
- `flagged_by` — supervisor or admin who flagged it.

3. `verify_completed_report` function
- Only supervisors and admins may call it.
- Locks the report while reviewing it and accepts only completed reports.
- Releases credits once, based on verified weight and the server-side waste category rate.
- Creates a credit transaction and citizen notification in the same database action.
- Supports flagging as fake without issuing credits.
- Returns the review result, credit amount, and timestamp.

## Security
- The review function derives the reviewer from `auth.uid()` and checks their role.
- Duplicate verification attempts return the already-verified result without another payout.
- The existing credit function is restricted so callers cannot award credits to another user unless they are a supervisor or admin.
- Both functions use a fixed `public` search path.
*/

ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'verified';

ALTER TABLE public.waste_reports
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS flagged_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.award_carbon_credits(
  p_user_id uuid,
  p_amount integer,
  p_transaction_type text,
  p_description text DEFAULT NULL,
  p_related_report_id uuid DEFAULT NULL,
  p_co2_kg numeric DEFAULT 0
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
  v_new_score integer;
  v_badge text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id <> auth.uid()
    AND NOT public.has_role(auth.uid(), 'supervisor')
    AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_amount < -100000 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, related_report_id, co2_kg)
  VALUES (p_user_id, p_amount, p_transaction_type, p_description, p_related_report_id, greatest(p_co2_kg, 0));

  UPDATE public.profiles
  SET
    credits_balance = credits_balance + p_amount,
    co2_saved_kg = co2_saved_kg + greatest(p_co2_kg, 0),
    contribution_score = contribution_score + greatest(least(p_amount, 50), 0)
  WHERE id = p_user_id
  RETURNING credits_balance, contribution_score INTO v_new_balance, v_new_score;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  v_badge := CASE
    WHEN v_new_score >= 5000 THEN 'Platinum'
    WHEN v_new_score >= 2000 THEN 'Gold'
    WHEN v_new_score >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;

  UPDATE public.profiles SET badge_level = v_badge WHERE id = p_user_id;
  RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_carbon_credits(uuid, integer, text, text, uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_carbon_credits(uuid, integer, text, text, uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_completed_report(
  p_report_id uuid,
  p_action text,
  p_verified_weight numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.waste_reports%ROWTYPE;
  v_rate integer;
  v_weight numeric;
  v_credits integer;
  v_co2 numeric;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL
    OR (NOT public.has_role(auth.uid(), 'supervisor') AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_action NOT IN ('verify', 'flag_fake') THEN
    RAISE EXCEPTION 'Invalid review action';
  END IF;

  SELECT * INTO v_report
  FROM public.waste_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF v_report.id IS NULL THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF p_action = 'verify' AND v_report.status = 'verified' THEN
    RETURN jsonb_build_object(
      'status', 'verified',
      'credits_awarded', coalesce(v_report.credits_awarded, 0),
      'verified_at', v_report.verified_at,
      'already_verified', true
    );
  END IF;

  IF v_report.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed reports can be reviewed';
  END IF;

  IF p_action = 'flag_fake' THEN
    UPDATE public.waste_reports
    SET
      status = 'rejected',
      review_reason = nullif(left(trim(coalesce(p_reason, '')), 500), ''),
      flagged_at = v_now,
      flagged_by = auth.uid(),
      updated_at = v_now
    WHERE id = p_report_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_report.reporter_id,
      'Report flagged for review',
      'Your waste report was flagged and no carbon credits were released. Please review the report details and contact support if this was incorrect.',
      'report'
    );

    RETURN jsonb_build_object('status', 'rejected', 'credits_awarded', 0, 'flagged_at', v_now);
  END IF;

  v_weight := greatest(coalesce(p_verified_weight, v_report.quantity_kg, 1), 0.1);
  SELECT coalesce(max(credits_per_kg), 10) INTO v_rate
  FROM public.waste_categories
  WHERE lower(name) = lower(v_report.waste_type);
  v_credits := greatest(10, round(v_weight * v_rate));
  v_co2 := round(v_weight * 2.5, 2);

  UPDATE public.waste_reports
  SET
    status = 'verified',
    credits_awarded = v_credits,
    verified_at = v_now,
    verified_by = auth.uid(),
    review_reason = null,
    updated_at = v_now
  WHERE id = p_report_id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description, related_report_id, co2_kg)
  VALUES (
    v_report.reporter_id,
    v_credits,
    'report_verified',
    format('Report verified: %s (%skg)', v_report.waste_type, trim(to_char(v_weight, 'FM999999990.##'))),
    p_report_id,
    v_co2
  );

  UPDATE public.profiles
  SET
    credits_balance = credits_balance + v_credits,
    co2_saved_kg = co2_saved_kg + v_co2,
    contribution_score = contribution_score + least(v_credits, 50),
    badge_level = CASE
      WHEN contribution_score + least(v_credits, 50) >= 5000 THEN 'Platinum'
      WHEN contribution_score + least(v_credits, 50) >= 2000 THEN 'Gold'
      WHEN contribution_score + least(v_credits, 50) >= 500 THEN 'Silver'
      ELSE 'Bronze'
    END
  WHERE id = v_report.reporter_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_report.reporter_id,
    'Carbon credits released',
    format('Your %s report was verified. %s carbon credits were added to your wallet.', v_report.waste_type, v_credits),
    'credit'
  );

  RETURN jsonb_build_object(
    'status', 'verified',
    'credits_awarded', v_credits,
    'verified_at', v_now,
    'already_verified', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_completed_report(uuid, text, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_completed_report(uuid, text, numeric, text) TO authenticated;
