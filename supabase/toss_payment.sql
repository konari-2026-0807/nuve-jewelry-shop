-- NUVE Toss Payments test checkout
-- Run this migration before deploying the toss-payment Edge Function.

alter table public.orders
  add column if not exists delivery_request text;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status = any (array['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']));

insert into public.store_products (slug, name, price, image, active)
values
  ('earrings-1', '라일 미니 후프 귀걸이', 19000, 'assets/earrings-grid.png#0', true),
  ('earrings-2', '오브 슬림 골드 링 귀걸이', 22000, 'assets/earrings-grid.png#1', true),
  ('earrings-3', '듀 포인트 진주 귀걸이', 24000, 'assets/earrings-grid.png#2', true),
  ('earrings-4', '리네 드롭 체인 귀걸이', 21000, 'assets/earrings-grid.png#3', true),
  ('earrings-5', '미오 자개 하트 귀걸이', 26000, 'assets/earrings-grid.png#4', true),
  ('earrings-6', '로프 트위스트 링 귀걸이', 29000, 'assets/earrings-grid.png#5', true),
  ('earrings-7', '쁘띠 데이지 귀걸이', 18000, 'assets/earrings-grid.png#6', true),
  ('earrings-8', '루나 크리스탈 드롭 귀걸이', 27000, 'assets/earrings-grid.png#7', true),
  ('earrings-9', '볼드 오벌 원터치 귀걸이', 32000, 'assets/earrings-grid.png#8', true),
  ('earrings-10', '레이어드 이어커프 세트', 17000, 'assets/earrings-grid.png#9', true),
  ('necklaces-1', '하트 노트 펜던트 목걸이', 29000, 'assets/necklaces-grid.png#0', true),
  ('necklaces-2', '모브 슬림 바 목걸이', 32000, 'assets/necklaces-grid.png#1', true),
  ('necklaces-3', '듀 담수 진주 체인 목걸이', 34000, 'assets/necklaces-grid.png#2', true),
  ('necklaces-4', '오브 베젤 크리스탈 목걸이', 31000, 'assets/necklaces-grid.png#3', true),
  ('necklaces-5', '에센셜 레이어드 체인', 39000, 'assets/necklaces-grid.png#4', true),
  ('necklaces-6', '쁘띠 리본 실버 목걸이', 33000, 'assets/necklaces-grid.png#5', true),
  ('necklaces-7', '아르코 라인 펜던트 목걸이', 35000, 'assets/necklaces-grid.png#6', true),
  ('necklaces-8', '코스타 쉘 펜던트 목걸이', 37000, 'assets/necklaces-grid.png#7', true),
  ('necklaces-9', '플로우 스네이크 체인', 28000, 'assets/necklaces-grid.png#8', true),
  ('necklaces-10', '클로버 미니 펜던트 목걸이', 36000, 'assets/necklaces-grid.png#9', true),
  ('bracelets-1', '리네 데일리 체인 팔찌', 22000, 'assets/bracelets-grid.png#0', true),
  ('bracelets-2', '미오 하트 포인트 팔찌', 25000, 'assets/bracelets-grid.png#1', true),
  ('bracelets-3', '듀 담수 진주 팔찌', 29000, 'assets/bracelets-grid.png#2', true),
  ('bracelets-4', '모브 투톤 비즈 팔찌', 24000, 'assets/bracelets-grid.png#3', true),
  ('bracelets-5', '아르코 슬림 뱅글', 27000, 'assets/bracelets-grid.png#4', true),
  ('bracelets-6', '루나 테니스 팔찌', 35000, 'assets/bracelets-grid.png#5', true),
  ('bracelets-7', '코스타 참 체인 팔찌', 32000, 'assets/bracelets-grid.png#6', true),
  ('bracelets-8', '플로우 페이퍼클립 팔찌', 26000, 'assets/bracelets-grid.png#7', true),
  ('bracelets-9', '리본 패브릭 브레이슬릿', 19000, 'assets/bracelets-grid.png#8', true),
  ('bracelets-10', '믹스 투톤 체인 팔찌', 33000, 'assets/bracelets-grid.png#9', true),
  ('rings-1', '리네 슬림 실버 링', 17000, 'assets/rings-grid.png#0', true),
  ('rings-2', '웨이브 오픈 반지', 19000, 'assets/rings-grid.png#1', true),
  ('rings-3', '듀 진주 포인트 링', 21000, 'assets/rings-grid.png#2', true),
  ('rings-4', '로프 트위스트 골드 링', 22000, 'assets/rings-grid.png#3', true),
  ('rings-5', '오브 볼드 돔 반지', 25000, 'assets/rings-grid.png#4', true),
  ('rings-6', '미오 미니 하트 링', 18000, 'assets/rings-grid.png#5', true),
  ('rings-7', '루나 크리스탈 라인 링', 24000, 'assets/rings-grid.png#6', true),
  ('rings-8', '레이어드 실버 링 세트', 29000, 'assets/rings-grid.png#7', true),
  ('rings-9', '아르코 미니 시그넷 링', 23000, 'assets/rings-grid.png#8', true),
  ('rings-10', '노트 매듭 포인트 링', 20000, 'assets/rings-grid.png#9', true)
on conflict (slug) do update
set name = excluded.name,
    price = excluded.price,
    image = excluded.image,
    active = excluded.active,
    updated_at = now();

create or replace function public.prepare_toss_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_phone text,
  p_postal_code text,
  p_address_line1 text,
  p_address_line2 text,
  p_delivery_request text default null
)
returns table (
  order_id bigint,
  order_number text,
  toss_order_id text,
  subtotal integer,
  shipping_fee integer,
  total integer,
  order_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_product public.store_products%rowtype;
  v_quantity integer;
  v_subtotal integer := 0;
  v_shipping_fee integer := 0;
  v_total integer := 0;
  v_order_id bigint;
  v_order_number text;
  v_toss_order_id text;
  v_order_name text;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'INVALID_CART';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) not between 1 and 80
     or length(trim(coalesce(p_customer_email, ''))) not between 3 and 254
     or length(trim(coalesce(p_phone, ''))) not between 9 and 30
     or length(trim(coalesce(p_postal_code, ''))) not between 3 and 12
     or length(trim(coalesce(p_address_line1, ''))) not between 3 and 300
     or length(trim(coalesce(p_address_line2, ''))) not between 1 and 300 then
    raise exception 'INVALID_CHECKOUT';
  end if;
  if p_delivery_request is not null and p_delivery_request not in ('', 'door', 'security', 'call') then
    raise exception 'INVALID_DELIVERY_REQUEST';
  end if;
  if (select count(*) from jsonb_array_elements(p_items) item)
     <> (select count(distinct item->>'productId') from jsonb_array_elements(p_items) item) then
    raise exception 'DUPLICATE_CART_ITEM';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'productId', '') !~ '^[a-z]+-[0-9]+$'
       or coalesce(v_item->>'quantity', '') !~ '^[0-9]+$' then
      raise exception 'INVALID_CART_ITEM';
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 10 then
      raise exception 'INVALID_QUANTITY';
    end if;
    select * into v_product
    from public.store_products
    where slug = v_item->>'productId' and active = true;
    if not found then
      raise exception 'PRODUCT_NOT_AVAILABLE';
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'slug', v_product.slug,
      'name', v_product.name,
      'price', v_product.price,
      'quantity', v_quantity,
      'image', v_product.image
    ));
  end loop;

  v_shipping_fee := case when v_subtotal >= 50000 then 0 else 3000 end;
  v_total := v_subtotal + v_shipping_fee;
  v_order_number := 'NV' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_toss_order_id := 'NUVE_' || replace(gen_random_uuid()::text, '-', '');
  v_order_name := left((v_lines->0->>'name') || case when jsonb_array_length(v_lines) > 1 then ' 외 ' || (jsonb_array_length(v_lines) - 1)::text || '건' else '' end, 100);

  insert into public.orders (
    order_number, user_id, status, payment_status, payment_method,
    subtotal, shipping_fee, total, customer_name, customer_email, phone,
    postal_code, address_line1, address_line2, delivery_request, toss_order_id
  ) values (
    v_order_number, v_user_id, 'pending', 'pending', 'toss_test',
    v_subtotal, v_shipping_fee, v_total, trim(p_customer_name), lower(trim(p_customer_email)), trim(p_phone),
    trim(p_postal_code), trim(p_address_line1), trim(p_address_line2), nullif(p_delivery_request, ''), v_toss_order_id
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(v_lines)
  loop
    insert into public.order_items (
      order_id, user_id, product_slug, product_name, color, option_name,
      unit_price, quantity, line_total, image
    ) values (
      v_order_id, v_user_id, v_line->>'slug', v_line->>'name', '기본', '기본',
      (v_line->>'price')::integer, (v_line->>'quantity')::integer,
      (v_line->>'price')::integer * (v_line->>'quantity')::integer, v_line->>'image'
    );
  end loop;

  return query select v_order_id, v_order_number, v_toss_order_id, v_subtotal, v_shipping_fee, v_total, v_order_name;
end;
$$;

revoke all on function public.prepare_toss_order(jsonb, text, text, text, text, text, text, text) from public;
revoke all on function public.prepare_toss_order(jsonb, text, text, text, text, text, text, text) from anon;
grant execute on function public.prepare_toss_order(jsonb, text, text, text, text, text, text, text) to authenticated;
