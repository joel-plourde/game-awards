-- Dedicated data boundary. No card or invitation table is exposed to the Data API.
create schema bingo_private;
revoke all on schema bingo_private from public, anon, authenticated;
grant usage on schema bingo_private to service_role;

create table bingo_private.room (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  short_token_hash text unique check (short_token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table bingo_private.card (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references bingo_private.room(id) on delete cascade,
  title text not null check (length(title) between 1 and 60),
  creator text not null check (length(creator) between 1 and 40),
  cells jsonb not null check (jsonb_typeof(cells) = 'array' and jsonb_array_length(cells) = 25),
  free_space boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bingo_card_room_updated_idx on bingo_private.card (room_id, updated_at desc);
create table bingo_private.rate_limit (
  client_hash text primary key,
  window_start timestamptz not null,
  hits integer not null default 1
);
alter table bingo_private.room enable row level security;
alter table bingo_private.card enable row level security;
alter table bingo_private.rate_limit enable row level security;
revoke all on all tables in schema bingo_private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema bingo_private to service_role;

-- SECURITY INVOKER: only the Edge Function's server-side service role may execute.
-- The service role bypasses RLS; invite checks below are the application authorization.
create function public.awards_bingo(p_token text, p_action text, p_payload jsonb default '{}'::jsonb, p_client_hash text default '')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_hash text;
  v_room bingo_private.room%rowtype;
  v_card bingo_private.card%rowtype;
  v_hits integer;
  v_title text;
  v_creator text;
  v_cells jsonb;
  v_free boolean;
  v_id uuid;
  v_version integer;
begin
  if current_user <> 'service_role' then
    return jsonb_build_object('error','forbidden','status',403);
  end if;
  if p_token is null or p_token !~ '^([a-f0-9]{64}|[A-Za-z0-9_-]{22})$' then
    return jsonb_build_object('error','invalid_invitation','status',403);
  end if;
  if p_client_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('error','invalid_input','status',400);
  end if;
  delete from bingo_private.rate_limit where window_start < now() - interval '10 minutes';
  insert into bingo_private.rate_limit as r (client_hash,window_start,hits)
  values (p_client_hash,date_trunc('minute',now()),1)
  on conflict (client_hash) do update
  set hits = case when r.window_start = date_trunc('minute',now()) then r.hits + 1 else 1 end,
      window_start = date_trunc('minute',now())
  returning hits into v_hits;
  if v_hits > 180 then return jsonb_build_object('error','rate_limited','status',429); end if;
  v_hash := encode(sha256(convert_to(p_token,'UTF8')),'hex');
  select * into v_room from bingo_private.room
  where (token_hash = v_hash or short_token_hash = v_hash)
    and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error','invalid_invitation','status',403); end if;

  if p_action = 'list' then
    return jsonb_build_object('room',jsonb_build_object('id',v_room.id,'name',v_room.name),'cards',
      coalesce((select jsonb_agg(to_jsonb(c) - 'room_id' order by c.updated_at desc)
        from bingo_private.card c where room_id = v_room.id),'[]'::jsonb));
  end if;
  if jsonb_typeof(p_payload) <> 'object' then return jsonb_build_object('error','invalid_input','status',400); end if;
  if p_action in ('get','update','delete') then
    if coalesce(p_payload->>'id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
      return jsonb_build_object('error','invalid_input','status',400);
    end if;
    v_id := (p_payload->>'id')::uuid;
    select * into v_card from bingo_private.card where id = v_id and room_id = v_room.id for update;
    if not found then return jsonb_build_object('error','not_found','status',404); end if;
    if p_action = 'get' then return jsonb_build_object('card',to_jsonb(v_card)-'room_id'); end if;
    if coalesce(p_payload->>'version','') !~ '^[0-9]{1,9}$' then return jsonb_build_object('error','invalid_input','status',400); end if;
    v_version := (p_payload->>'version')::integer;
    if v_card.version <> v_version then return jsonb_build_object('error','conflict','status',409); end if;
    if p_action = 'delete' then
      delete from bingo_private.card where id = v_card.id and room_id = v_room.id;
      return jsonb_build_object('ok',true);
    end if;
  end if;
  if p_action not in ('create','update') then return jsonb_build_object('error','invalid_input','status',400); end if;
  if jsonb_typeof(p_payload->'title') is distinct from 'string'
    or jsonb_typeof(p_payload->'creator') is distinct from 'string'
    or jsonb_typeof(p_payload->'free_space') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'cells') is distinct from 'array' then
    return jsonb_build_object('error','invalid_input','status',400);
  end if;
  v_title := btrim(p_payload->>'title');v_creator := btrim(p_payload->>'creator');
  v_cells := p_payload->'cells';v_free := (p_payload->>'free_space')::boolean;
  if length(v_title) not between 1 and 60 or length(v_creator) not between 1 and 40 or jsonb_array_length(v_cells) <> 25 then
    return jsonb_build_object('error','invalid_input','status',400);
  end if;
  if exists(select 1 from jsonb_array_elements(v_cells) with ordinality as e(value,position)
    where jsonb_typeof(value) <> 'string' or length(value#>>'{}') > 120
      or (length(btrim(value#>>'{}'))=0 and not (v_free and position=13))) then
    return jsonb_build_object('error','invalid_input','status',400);
  end if;
  if v_free then v_cells := jsonb_set(v_cells,'{12}','""'::jsonb); end if;
  if p_action = 'create' then
    -- Serialize room creation so the group size limit holds under concurrent saves.
    perform 1 from bingo_private.room where id=v_room.id for update;
    if (select count(*) from bingo_private.card where room_id=v_room.id) >= 250 then
      return jsonb_build_object('error','room_full','status',409);
    end if;
    insert into bingo_private.card(room_id,title,creator,cells,free_space)
      values(v_room.id,v_title,v_creator,v_cells,v_free) returning * into v_card;
  else
    update bingo_private.card set title=v_title,creator=v_creator,cells=v_cells,free_space=v_free,
      version=version+1,updated_at=clock_timestamp()
      where id=v_id and room_id=v_room.id returning * into v_card;
  end if;
  return jsonb_build_object('card',to_jsonb(v_card)-'room_id');
end;
$$;
revoke all on function public.awards_bingo(text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.awards_bingo(text,text,jsonb,text) to service_role;
comment on function public.awards_bingo(text,text,jsonb,text) is 'Invite-scoped bingo API. Server-side service role only; no anonymous database access.';
