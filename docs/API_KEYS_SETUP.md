# API Keys Setup for NikCLI Documentation System

## Overview
NikCLI supports cloud-based documentation storage using Supabase. This guide explains how to configure the necessary API keys.

## Required API Keys

### Supabase (Cloud Documentation)
To enable cloud documentation features, you need:

1. **SUPABASE_URL** - Your Supabase project URL
2. **SUPABASE_ANON_KEY** - Your Supabase anonymous key

## Configuration Methods

### Method 1: Environment Variables (Recommended)
Set these environment variables in your shell:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key-here"
```

Or add them to your `.env` file:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### Method 2: Configuration File
You can also set them in the NikCLI configuration:

```json
{
  "cloudDocs": {
    "enabled": true,
    "provider": "supabase",
    "apiUrl": "https://your-project.supabase.co",
    "apiKey": "your-anon-key-here",
    "autoSync": true,
    "contributionMode": true
  }
}
```

## Getting Supabase Credentials

1. **Create a Supabase Account**
   - Go to [supabase.com](https://supabase.com)
   - Sign up for a free account

2. **Create a New Project**
   - Click "New Project"
   - Choose an organization
   - Set project name and database password
   - Select a region

3. **Get Your API Keys**
   - Go to Settings → API
   - Copy the "URL" (this is your SUPABASE_URL)
   - Copy the "anon public" key (this is your SUPABASE_ANON_KEY)

## Database Schema

NikCLI expects the following tables in your Supabase database:

```sql
-- Shared documentation entries
CREATE TABLE shared_docs (
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

-- Documentation libraries (collections)
CREATE TABLE docs_libraries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  doc_ids UUID[] DEFAULT '{}',
  creator_id UUID,
  installs_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE shared_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_libraries ENABLE ROW LEVEL SECURITY;

-- Public read access policy
CREATE POLICY "Public read access" ON shared_docs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON docs_libraries FOR SELECT USING (true);
```

## Testing the Configuration

After setting up your API keys, test the connection:

```bash
nikcli
/doc-sync
```

You should see:
- ✅ Connected to Supabase docs cloud
- 🔄 Synchronizing with cloud library...
- 📥 Downloaded X shared documents

## Troubleshooting

### Common Issues

1. **"Supabase credentials not configured"**
   - Check that your environment variables are set correctly
   - Verify the variable names are exactly `SUPABASE_URL` and `SUPABASE_ANON_KEY`

2. **"Failed to initialize Supabase"**
   - Verify your URL format: `https://your-project.supabase.co`
   - Check that your anon key is correct (it's a long JWT token)

3. **Database errors**
   - Ensure the required tables exist in your Supabase database
   - Check that Row Level Security policies allow public read access

### Debug Commands

```bash
# Check current configuration
nikcli
/config show

# Test cloud docs connection
/doc-sync

# View documentation context
/doc-context
```

## Security Notes

- The **anon key** is safe to use in client applications
- Never share your **service role key** (it has admin access)
- Use environment variables for better security
- Consider using different Supabase projects for development and production

## Features Enabled

With proper API key configuration, you'll have access to:

- ✅ Cloud documentation synchronization
- ✅ Shared documentation library
- ✅ AI agents can auto-load documentation
- ✅ Cross-user documentation sharing
- ✅ Persistent documentation across sessions
- ✅ Documentation library installation
- ✅ Popular documentation discovery

## Next Steps

1. Set up your API keys using one of the methods above
2. Run `/doc-sync` to test the connection
3. Add your first documentation with `/doc-add <url>`
4. Explore available documentation with `/doc-list`
5. Load documentation into AI context with `/doc-load <names>`