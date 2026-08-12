-- NUVE admin dashboard permissions and inventory fields.

alter table public.store_products
  add column if not exists stock integer not null default 20;

alter table public.store_products
  drop constraint if exists store_products_stock_check;

alter table public.store_products
  add constraint store_products_stock_check check (stock between 0 and 99999);

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create index if not exists orders_payment_created_idx
  on public.orders (payment_status, created_at desc);

grant update (name, price, active, stock, updated_at)
  on public.store_products to authenticated;

grant update (status)
  on public.orders to authenticated;

revoke insert, delete, truncate on public.store_products from anon;
revoke insert, delete, truncate on public.store_products from authenticated;
