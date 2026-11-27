-- Transactional integration checks. All test data is rolled back.
begin;
insert into bingo_private.room(name,token_hash) values
  ('transactional test room',encode(sha256(convert_to(repeat('b',64),'UTF8')),'hex')),
  ('other test room',encode(sha256(convert_to(repeat('c',64),'UTF8')),'hex')),
  ('expired test room',encode(sha256(convert_to(repeat('d',64),'UTF8')),'hex'));
update bingo_private.room set expires_at=now()-interval '1 day' where name='expired test room';
set local role service_role;
do $$
declare
  v_result jsonb;
  v_other jsonb;
  v_payload jsonb;
  v_id text;
begin
  v_result:=public.awards_bingo(repeat('a',64),'list','{}',repeat('f',64));
  if v_result->>'error' is distinct from 'invalid_invitation' then raise exception 'invalid invite accepted'; end if;
  v_result:=public.awards_bingo(repeat('d',64),'list','{}',repeat('f',64));
  if v_result->>'error' is distinct from 'invalid_invitation' then raise exception 'expired invite accepted'; end if;
  v_payload:=jsonb_build_object('title','QA card','creator','QA','free_space',true,'cells',
    (select jsonb_agg(case when i=12 then '' else 'Prediction '||i end order by i) from generate_series(0,24) i));
  v_result:=public.awards_bingo(repeat('b',64),'create',v_payload,repeat('f',64));
  v_id:=v_result->'card'->>'id';
  if v_id is null then raise exception 'create failed: %',v_result; end if;
  v_result:=public.awards_bingo(repeat('b',64),'list','{}',repeat('f',64));
  if jsonb_array_length(v_result->'cards')<>1 then raise exception 'list failed'; end if;
  v_other:=public.awards_bingo(repeat('c',64),'get',jsonb_build_object('id',v_id),repeat('f',64));
  if v_other->>'error' is distinct from 'not_found' then raise exception 'cross-room read allowed'; end if;
  v_payload:=v_payload||jsonb_build_object('id',v_id,'version',1,'title','Updated QA');
  v_result:=public.awards_bingo(repeat('b',64),'update',v_payload,repeat('f',64));
  if v_result->'card'->>'version' is distinct from '2' then raise exception 'update failed: %',v_result; end if;
  v_result:=public.awards_bingo(repeat('b',64),'update',v_payload,repeat('f',64));
  if v_result->>'error' is distinct from 'conflict' then raise exception 'stale update accepted'; end if;
  v_result:=public.awards_bingo(repeat('c',64),'delete',jsonb_build_object('id',v_id,'version',2),repeat('f',64));
  if v_result->>'error' is distinct from 'not_found' then raise exception 'cross-room delete allowed'; end if;
  v_result:=public.awards_bingo(repeat('b',64),'delete',jsonb_build_object('id',v_id,'version',2),repeat('f',64));
  if v_result->>'ok' is distinct from 'true' then raise exception 'delete failed'; end if;
  v_result:=public.awards_bingo(repeat('b',64),'create',jsonb_set(v_payload,'{cells,0}','""'::jsonb),repeat('f',64));
  if v_result->>'error' is distinct from 'invalid_input' then raise exception 'empty prediction accepted'; end if;
  if has_function_privilege('anon','public.awards_bingo(text,text,jsonb,text)','execute') then raise exception 'anonymous RPC access'; end if;
  if has_schema_privilege('anon','bingo_private','usage') then raise exception 'anonymous schema access'; end if;
  if has_schema_privilege('authenticated','bingo_private','usage') then raise exception 'authenticated schema access'; end if;
end;
$$;
rollback;
