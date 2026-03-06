-- Run this in your Supabase SQL Editor to set up the database

-- Documents table
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_url text not null,
  file_name text not null,
  file_type text not null,
  status text not null default 'processing',
  extracted_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security
alter table documents enable row level security;

-- Users can only access their own documents
create policy "Users see own documents" on documents
  for all using (auth.uid() = user_id);

-- Create storage bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage RLS: users can only access their own folder
create policy "Users access own folder" on storage.objects
  for all using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
