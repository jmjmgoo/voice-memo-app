-- EchoMemo Database Schema

CREATE TABLE IF NOT EXISTS memos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for tags to allow faster searching later
CREATE INDEX idx_memos_tags ON memos USING GIN (tags);
