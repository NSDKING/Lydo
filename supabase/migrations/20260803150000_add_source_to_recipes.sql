-- Tags each saved recipe by where it came from, so the plan-generation prompt
-- can pull specifically the user's TikTok-imported recipes (not manually
-- created ones or recipes saved from a generated plan meal).
alter table user_recipes
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'plan', 'tiktok'));
