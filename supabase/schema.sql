create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 80),
  constraint profiles_phone_length check (char_length(phone) <= 30)
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke all on public.profiles from authenticated;
grant select, insert, update on public.profiles to authenticated;
revoke all on public.profiles from anon;

create table if not exists public.cart_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_product_id_length check (char_length(product_id) between 1 and 100),
  constraint cart_items_quantity_range check (quantity between 1 and 10),
  constraint cart_items_user_product_unique unique (user_id, product_id)
);

create index if not exists cart_items_user_id_idx on public.cart_items(user_id);
alter table public.cart_items enable row level security;

create policy "cart_items_select_own" on public.cart_items for select to authenticated
using ((select auth.uid()) = user_id);
create policy "cart_items_insert_own" on public.cart_items for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "cart_items_update_own" on public.cart_items for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cart_items_delete_own" on public.cart_items for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.cart_items from authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant usage, select on sequence public.cart_items_id_seq to authenticated;
revoke all on public.cart_items from anon;

create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  constraint wishlist_items_product_id_length check (char_length(product_id) between 1 and 100),
  constraint wishlist_items_pkey primary key (user_id, product_id)
);

alter table public.wishlist_items enable row level security;

create policy "wishlist_items_select_own" on public.wishlist_items for select to authenticated
using ((select auth.uid()) = user_id);
create policy "wishlist_items_insert_own" on public.wishlist_items for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "wishlist_items_delete_own" on public.wishlist_items for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.wishlist_items from authenticated;
grant select, insert, delete on public.wishlist_items to authenticated;
revoke all on public.wishlist_items from anon;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();
