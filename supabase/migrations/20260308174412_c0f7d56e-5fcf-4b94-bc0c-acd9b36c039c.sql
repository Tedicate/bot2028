
-- 1. university_subjects: 대학별 권장과목 구조화 데이터
CREATE TABLE public.university_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  university text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  is_core boolean NOT NULL DEFAULT false,
  is_recommended boolean NOT NULL DEFAULT false,
  year integer NOT NULL DEFAULT 2028,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.university_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read university_subjects"
  ON public.university_subjects FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage university_subjects"
  ON public.university_subjects FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. admission_plans: 전형 정보 구조화 데이터
CREATE TABLE public.admission_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university text NOT NULL DEFAULT '',
  year integer NOT NULL DEFAULT 2028,
  admission_type text NOT NULL DEFAULT '',
  admission_category text NOT NULL DEFAULT '',
  selection_method text NOT NULL DEFAULT '',
  suneung_minimum boolean NOT NULL DEFAULT false,
  suneung_minimum_detail text DEFAULT '',
  subject_recommendation_applied boolean NOT NULL DEFAULT false,
  subject_recommendation_note text DEFAULT '',
  reflected_subjects jsonb DEFAULT '{}',
  special_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admission_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admission_plans"
  ON public.admission_plans FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage admission_plans"
  ON public.admission_plans FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. subject_descriptions 테이블 (과목 안내서 벡터)
CREATE TABLE IF NOT EXISTS public.subject_descriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_name text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  embedding vector(768),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subject_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subject_descriptions"
  ON public.subject_descriptions FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage subject_descriptions"
  ON public.subject_descriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. 벡터 검색 함수: subject_descriptions용
CREATE OR REPLACE FUNCTION public.match_subject_descriptions(
  query_embedding vector(768),
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 5
)
RETURNS TABLE(id bigint, subject_name text, content text, category text, metadata jsonb, similarity double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    d.id,
    d.subject_name,
    d.content,
    d.category,
    d.metadata,
    (1 - (d.embedding <=> query_embedding))::float AS similarity
  FROM public.subject_descriptions d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;
