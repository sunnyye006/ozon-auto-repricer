create table if not exists stores (
  id bigserial primary key,
  name varchar(120) not null unique,
  api_key_encrypted text not null,
  client_id varchar(120) not null,
  is_active boolean not null default true,
  api_base_url varchar(200) not null,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id bigserial primary key,
  store_id bigint not null references stores(id) on delete cascade,
  ozon_product_id varchar(120) not null,
  sku varchar(120),
  name varchar(255) not null,
  current_price numeric(12,2) not null,
  cost_price numeric(12,2) not null,
  auto_reprice_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint uq_store_product unique (store_id, ozon_product_id)
);

create table if not exists repricing_states (
  product_id bigint primary key references products(id) on delete cascade,
  in_round boolean not null default false,
  round_original_price numeric(12,2),
  floor_reached boolean not null default false,
  competitor_count integer not null default 0,
  last_scan_at timestamptz
);

create table if not exists price_events (
  id bigserial primary key,
  platform varchar(20) not null default 'Ozon',
  store_name varchar(120) not null,
  product_name varchar(255) not null,
  direction varchar(1) not null,
  old_price numeric(12,2) not null,
  new_price numeric(12,2) not null,
  note varchar(255),
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key varchar(80) primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_store_id on products(store_id);
create index if not exists idx_events_created_at on price_events(created_at desc);
