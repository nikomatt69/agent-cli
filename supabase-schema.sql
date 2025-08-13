-- Supabase Schema for NikCLI Cloud Documentation System
-- Run this SQL in your Supabase SQL Editor

-- Create shared_docs table for storing documentation entries
CREATE TABLE IF NOT EXISTS shared_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  language TEXT DEFAULT 'en',
  word_count INTEGER DEFAULT 0,
  contributor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  popularity_score REAL DEFAULT 0
);

-- Create docs_libraries table for documentation collections
CREATE TABLE IF NOT EXISTS docs_libraries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  doc_ids UUID[] DEFAULT '{}',
  creator_id UUID,
  installs_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_docs_category ON shared_docs(category);
CREATE INDEX IF NOT EXISTS idx_shared_docs_tags ON shared_docs USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_shared_docs_popularity ON shared_docs(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_shared_docs_created_at ON shared_docs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_libraries_name ON docs_libraries(name);
CREATE INDEX IF NOT EXISTS idx_docs_libraries_installs ON docs_libraries(installs_count DESC);

-- Enable Row Level Security
ALTER TABLE shared_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_libraries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public read access on shared_docs" ON shared_docs;
DROP POLICY IF EXISTS "Public read access on docs_libraries" ON docs_libraries;
DROP POLICY IF EXISTS "Public insert access on shared_docs" ON shared_docs;
DROP POLICY IF EXISTS "Public insert access on docs_libraries" ON docs_libraries;
DROP POLICY IF EXISTS "Public update access on shared_docs" ON shared_docs;
DROP POLICY IF EXISTS "Public update access on docs_libraries" ON docs_libraries;

-- Create policies for public read access
CREATE POLICY "Public read access on shared_docs" 
ON shared_docs FOR SELECT 
USING (true);

CREATE POLICY "Public read access on docs_libraries" 
ON docs_libraries FOR SELECT 
USING (true);

-- Create policies for public insert (contribution)
CREATE POLICY "Public insert access on shared_docs" 
ON shared_docs FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public insert access on docs_libraries" 
ON docs_libraries FOR INSERT 
WITH CHECK (true);

-- Create policies for public update (popularity scores, access counts)
CREATE POLICY "Public update access on shared_docs" 
ON shared_docs FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Public update access on docs_libraries" 
ON docs_libraries FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Create function to update popularity score based on access
CREATE OR REPLACE FUNCTION update_doc_popularity()
RETURNS TRIGGER AS $update_pop$
BEGIN
  -- Update popularity score based on access count and recency
  NEW.popularity_score = (NEW.access_count::REAL / 10.0) + 
                        (EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 86400.0 / 30.0 * -0.1);
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$update_pop$ LANGUAGE plpgsql;

-- Create trigger to auto-update popularity score
DROP TRIGGER IF EXISTS trigger_update_doc_popularity ON shared_docs;
CREATE TRIGGER trigger_update_doc_popularity
  BEFORE UPDATE ON shared_docs
  FOR EACH ROW
  EXECUTE FUNCTION update_doc_popularity();

-- Create function to update word count automatically
CREATE OR REPLACE FUNCTION update_word_count()
RETURNS TRIGGER AS $word_count$
BEGIN
  -- Calculate word count from content
  NEW.word_count = array_length(string_to_array(trim(NEW.content), ' '), 1);
  RETURN NEW;
END;
$word_count$ LANGUAGE plpgsql;

-- Create trigger to auto-update word count
DROP TRIGGER IF EXISTS trigger_update_word_count ON shared_docs;
CREATE TRIGGER trigger_update_word_count
  BEFORE INSERT OR UPDATE ON shared_docs
  FOR EACH ROW
  EXECUTE FUNCTION update_word_count();

-- Insert some sample documentation to test
INSERT INTO shared_docs (title, url, content, category, tags, language) VALUES
(
  'React Hooks Documentation',
  'https://react.dev/reference/react',
  'React Hooks are functions that let you use state and other React features without writing a class. This documentation covers useState, useEffect, useContext, useReducer, useCallback, useMemo, and other built-in hooks.',
  'frontend',
  ARRAY['react', 'hooks', 'javascript', 'frontend'],
  'en'
),
(
  'Node.js API Documentation',
  'https://nodejs.org/docs/latest/api/',
  'Node.js is a JavaScript runtime built on Chrome''s V8 JavaScript engine. This documentation covers the core modules including fs, http, path, os, crypto, and stream APIs.',
  'backend',
  ARRAY['nodejs', 'api', 'javascript', 'backend'],
  'en'
),
(
  'TypeScript Handbook',
  'https://www.typescriptlang.org/docs/',
  'TypeScript is JavaScript with syntax for types. This handbook covers basic types, interfaces, classes, generics, modules, and advanced type manipulation techniques.',
  'language',
  ARRAY['typescript', 'types', 'javascript', 'development'],
  'en'
);

-- Create sample library
INSERT INTO docs_libraries (name, description, doc_ids) VALUES
(
  'Frontend Essentials',
  'Essential documentation for frontend development with React and TypeScript',
  (SELECT ARRAY_AGG(id) FROM shared_docs WHERE category = 'frontend' OR tags @> ARRAY['typescript'])
);

-- Show created tables and sample data
SELECT 'Tables created successfully' as status;
SELECT COUNT(*) as total_docs FROM shared_docs;
SELECT COUNT(*) as total_libraries FROM docs_libraries;