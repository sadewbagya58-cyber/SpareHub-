-- =============================================================================
-- Migration: 20261014000008_promote_platform_admin.sql
-- Description: Fix prevent_self_role_escalation trigger to support service_role,
--              postgres superuser, and promote Sadewbagya58@gmail.com to Platform Admin.
-- =============================================================================

-- 1. Correct prevent_self_role_escalation trigger function to allow administrative bootstrap
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- Allow service_role, postgres superuser, supabase_admin, or existing platform admins
  IF current_user IN ('postgres', 'supabase_admin')
     OR auth.role() = 'service_role'
     OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role = 'customer';
    NEW.roles = ARRAY['customer']::text[];
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.roles IS DISTINCT FROM OLD.roles THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify user roles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Safely and idempotently promote Sadewbagya58@gmail.com to Platform Admin
DO $$
DECLARE
  v_target_email text := 'sadewbagya58@gmail.com';
  v_user_count int;
BEGIN
  SELECT count(*) INTO v_user_count
  FROM public.user_profiles
  WHERE lower(email) = lower(v_target_email);

  IF v_user_count = 1 THEN
    UPDATE public.user_profiles
    SET
      role = 'platform_admin',
      roles = CASE
        WHEN 'platform_admin' = ANY(roles) THEN roles
        ELSE array_append(roles, 'platform_admin')
      END,
      updated_at = now()
    WHERE lower(email) = lower(v_target_email);

    RAISE NOTICE 'Successfully assigned platform_admin role to %', v_target_email;
  ELSIF v_user_count = 0 THEN
    RAISE NOTICE 'Target user % not found in user_profiles. User must sign up before role promotion.', v_target_email;
  ELSE
    RAISE WARNING 'Multiple user profiles matched email %. Manual inspection required.', v_target_email;
  END IF;
END;
$$;
