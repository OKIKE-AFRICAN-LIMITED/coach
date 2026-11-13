-- Cross-thread long-term personal memory for Coach Ziri
CREATE TABLE IF NOT EXISTS public.user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('preference', 'contact', 'goal', 'context', 'general')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_memories TO authenticated;
GRANT ALL ON public.user_memories TO service_role;

ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own user_memories all" ON public.user_memories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_memories_user_updated_idx
  ON public.user_memories(user_id, updated_at DESC);

CREATE TRIGGER user_memories_touch
  BEFORE UPDATE ON public.user_memories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

