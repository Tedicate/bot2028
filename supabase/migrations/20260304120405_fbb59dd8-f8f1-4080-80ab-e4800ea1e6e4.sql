
CREATE TABLE public.university_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  university text NOT NULL DEFAULT '',
  college text DEFAULT '',
  department text DEFAULT '',
  core_subjects text DEFAULT '',
  recommended_subjects text DEFAULT '',
  notes text DEFAULT ''
);

ALTER TABLE public.university_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read university_courses" 
  ON public.university_courses 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Service role can manage university_courses"
  ON public.university_courses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
