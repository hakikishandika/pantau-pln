-- Jalankan di Supabase SQL Editor sebelum deploy fitur auto-approve & processing_error

create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);

insert into app_settings (key, value)
values ('auto_approve', 'false')
on conflict (key) do nothing;

alter table flyers add column if not exists processing_error text;
