-- Migration: disconnect_google
-- Description: Allow users to delete their google integration row & disconnect RPC

CREATE POLICY "Users can delete their own integrations"
  ON public.user_integrations FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.disconnect_google_integration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.user_integrations
  WHERE user_id = auth.uid();
END;
$$;
