-- =============================================================================
-- SpareHub Deploy Script: promote_platform_admin.sql
-- Run in Supabase SQL Editor to promote Sadewbagya58@gmail.com to Platform Admin.
-- =============================================================================

-- Step 1: Temporarily disable or update the trigger function so bootstrap is permitted
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

-- Step 2: Assign platform_admin role to target email
UPDATE public.user_profiles
SET
  role = 'platform_admin',
  roles = CASE
    WHEN 'platform_admin' = ANY(roles) THEN roles
    ELSE array_append(roles, 'platform_admin')
  END,
  updated_at = now()
WHERE lower(email) = lower('sadewbagya58@gmail.com');

-- Step 3: Verification Query
SELECT 
  id, 
  email, 
  full_name, 
  role, 
  roles, 
  (role = 'platform_admin' OR 'platform_admin' = ANY(roles)) AS is_admin,
  updated_at
FROM public.user_profiles
WHERE lower(email) = lower('sadewbagya58@gmail.com');
