
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 문서 청크 저장 테이블
CREATE TABLE IF NOT EXISTS public.documents (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content    text NOT NULL,
  metadata   jsonb DEFAULT '{}',
  embedding  vector(768),
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read documents" ON public.documents FOR SELECT USING (true);

-- 서비스 역할은 모든 작업 가능
CREATE POLICY "Service role can manage documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);

-- 벡터 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON public.documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 유사도 검색 함수
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.content,
    d.metadata,
    (1 - (d.embedding <=> query_embedding))::float AS similarity
  FROM public.documents d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;
