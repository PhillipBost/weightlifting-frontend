-- ============================================================
-- Migration: link_lauret_rodriguez_usaw_to_iwf
-- Run this in your self-hosted Supabase SQL editor
-- ============================================================
-- What's already done:
--   • athlete_aliases table exists with iwf_db_lifter_id_2 column
--   • IWF↔IWF row exists: (usaw=null, iwf=52608, iwf_2=58978)
--     → IWF pages already discover each other via Step 3 code
--
-- What this script does:
--   • Adds two USAW↔IWF rows so that USAW page 1079023
--     links to both IWF profiles, AND the IWF pages gain
--     a USAW back-link via the existing Step 1/2 logic
-- ============================================================

DO $$
DECLARE
  v_usaw_lifter_id  bigint;
  v_iwf_db_id_52608 bigint;
  v_iwf_db_id_58978 bigint;
BEGIN

  -- Resolve USAW internal lifter_id for membership_number 1079023
  SELECT lifter_id INTO v_usaw_lifter_id
  FROM usaw_lifters
  WHERE membership_number = '1079023'
  LIMIT 1;

  IF v_usaw_lifter_id IS NULL THEN
    RAISE EXCEPTION 'USAW lifter with membership_number 1079023 not found.';
  END IF;

  -- Resolve IWF db_lifter_id values (these are the FK targets)
  SELECT db_lifter_id INTO v_iwf_db_id_52608
  FROM iwf_lifters WHERE db_lifter_id = 52608 LIMIT 1;

  SELECT db_lifter_id INTO v_iwf_db_id_58978
  FROM iwf_lifters WHERE db_lifter_id = 58978 LIMIT 1;

  IF v_iwf_db_id_52608 IS NULL THEN
    RAISE EXCEPTION 'IWF lifter with db_lifter_id 52608 not found.';
  END IF;
  IF v_iwf_db_id_58978 IS NULL THEN
    RAISE EXCEPTION 'IWF lifter with db_lifter_id 58978 not found.';
  END IF;

  RAISE NOTICE 'USAW lifter_id: %, IWF db_ids: % and %',
    v_usaw_lifter_id, v_iwf_db_id_52608, v_iwf_db_id_58978;

  -- USAW 1079023 ↔ IWF 52608
  INSERT INTO public.athlete_aliases
    (usaw_lifter_id, iwf_db_lifter_id, match_confidence, manual_override)
  VALUES
    (v_usaw_lifter_id, v_iwf_db_id_52608, 100, true)
  ON CONFLICT ON CONSTRAINT unique_usaw_iwf_link DO NOTHING;

  -- USAW 1079023 ↔ IWF 58978
  INSERT INTO public.athlete_aliases
    (usaw_lifter_id, iwf_db_lifter_id, match_confidence, manual_override)
  VALUES
    (v_usaw_lifter_id, v_iwf_db_id_58978, 100, true)
  ON CONFLICT ON CONSTRAINT unique_usaw_iwf_link DO NOTHING;

  RAISE NOTICE 'Done.';
END $$;


-- ============================================================
-- Verification — confirm all three rows look correct
-- ============================================================
SELECT
  aa.id,
  aa.usaw_lifter_id,
  ul.membership_number   AS usaw_membership_no,
  aa.iwf_db_lifter_id,
  il.iwf_lifter_id,
  il.athlete_name        AS iwf_name,
  aa.iwf_db_lifter_id_2,
  aa.match_confidence,
  aa.manual_override
FROM athlete_aliases aa
LEFT JOIN usaw_lifters ul ON ul.lifter_id  = aa.usaw_lifter_id
LEFT JOIN iwf_lifters  il ON il.db_lifter_id = aa.iwf_db_lifter_id
WHERE aa.iwf_db_lifter_id  IN (52608, 58978)
   OR aa.iwf_db_lifter_id_2 IN (52608, 58978)
ORDER BY aa.usaw_lifter_id NULLS LAST, aa.created_at;
