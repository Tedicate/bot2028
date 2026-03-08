
CREATE TABLE public.admission_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university text NOT NULL DEFAULT '',
  year integer NOT NULL DEFAULT 2026,
  document_type text NOT NULL DEFAULT '',
  admission_type text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  embedding vector(768),
  created_at timestamptz DEFAULT now(),
  source_file text DEFAULT ''
);

ALTER TABLE public.admission_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admission_documents" ON public.admission_documents FOR SELECT USING (true);
CREATE POLICY "Service role can manage admission_documents" ON public.admission_documents FOR ALL USING (true) WITH CHECK (true);
