ALTER DATABASE postgres SET default_text_search_config TO english;

DROP FUNCTION IF EXISTS match_document_chunks(text,integer);
DROP FUNCTION IF EXISTS immutable_tsvector(text);

CREATE TABLE IF NOT EXISTS document_chunks (
  id          BIGSERIAL PRIMARY KEY,
  document_id TEXT      NOT NULL,
  content     TEXT      NOT NULL,
  chunk_index INTEGER   NOT NULL
);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks (document_id);

CREATE OR REPLACE FUNCTION immutable_tsvector(t TEXT)
RETURNS tsvector LANGUAGE SQL IMMUTABLE
BEGIN ATOMIC
  SELECT to_tsvector(t);
END;

CREATE INDEX IF NOT EXISTS document_chunks_fts_idx ON document_chunks USING GIN (immutable_tsvector(content));

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access"
  ON document_chunks
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_text  TEXT,
  match_count INTEGER DEFAULT 8
)
RETURNS TABLE (
  document_id   TEXT,
  document_name TEXT,
  uploaded_at   TEXT,
  content       TEXT,
  chunk_index   INTEGER
)
LANGUAGE SQL
BEGIN ATOMIC
  SELECT
    dc.document_id,
    pd.name               AS document_name,
    pd."uploadedAt"::TEXT AS uploaded_at,
    dc.content,
    dc.chunk_index
  FROM public.document_chunks dc
  JOIN public."PolicyDocument" pd ON pd.id = dc.document_id
  WHERE immutable_tsvector(dc.content) @@ plainto_tsquery(query_text)
    AND pd."isActive" = true
  ORDER BY ts_rank(immutable_tsvector(dc.content), plainto_tsquery(query_text)) DESC
  LIMIT match_count;
END;
