-- Supabase SQL Editor에서 전체 실행
create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id text not null,
  password_hash text not null,
  nickname text not null,
  account_holder text not null,
  bank text not null,
  account_number text not null,
  birth_date date not null,
  phone text not null,
  exchange_password text not null,
  referral_code text not null,
  photo_1_path text,
  photo_2_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_at timestamptz,
  rejected_at timestamptz,
  constraint members_user_id_unique unique (user_id),
  constraint members_nickname_unique unique (nickname)
);

alter table public.members enable row level security;

-- 회원 데이터는 브라우저에서 직접 읽거나 수정할 수 없습니다.
-- 관리자 조회/승인/사진 열람은 Vercel 서버 API의 service-role 키로 처리합니다.

-- 회원가입: 가입코드 확인 + 중복 방지 + 로그인 비밀번호 DB 내부 해시
create or replace function public.register_member(
  p_signup_code text,
  p_user_id text,
  p_password text,
  p_nickname text,
  p_account_holder text,
  p_bank text,
  p_account_number text,
  p_birth_date date,
  p_phone text,
  p_exchange_password text,
  p_referral_code text,
  p_photo_1_path text default null,
  p_photo_2_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin

  if exists(select 1 from public.members where user_id = lower(trim(p_user_id))) then
    raise exception 'DUPLICATE_USER_ID';
  end if;

  if exists(select 1 from public.members where nickname = trim(p_nickname)) then
    raise exception 'DUPLICATE_NICKNAME';
  end if;

  insert into public.members (
    user_id, password_hash, nickname, account_holder, bank, account_number,
    birth_date, phone, exchange_password, referral_code, photo_1_path, photo_2_path
  ) values (
    lower(trim(p_user_id)), crypt(p_password, gen_salt('bf')), trim(p_nickname),
    trim(p_account_holder), p_bank, regexp_replace(p_account_number, '\\D', '', 'g'),
    p_birth_date, regexp_replace(p_phone, '\\D', '', 'g'), p_exchange_password,
    trim(p_referral_code), p_photo_1_path, p_photo_2_path
  ) returning id into v_member_id;

  return jsonb_build_object('ok', true, 'member_id', v_member_id, 'status', 'pending');
exception
  when unique_violation then
    raise exception 'DUPLICATE_MEMBER';
end;
$$;
revoke all on function public.register_member(text,text,text,text,text,text,text,date,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_member(text,text,text,text,text,text,text,date,text,text,text,text,text) to service_role;

-- 일반 회원 로그인. 승인된 계정만 성공
create or replace function public.member_login(p_user_id text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
begin
  select * into v_member
  from public.members
  where user_id = lower(trim(p_user_id));

  if v_member.id is null or v_member.password_hash <> crypt(p_password, v_member.password_hash) then
    raise exception 'INVALID_LOGIN';
  end if;

  if v_member.status = 'pending' then raise exception 'PENDING_APPROVAL'; end if;
  if v_member.status = 'rejected' then raise exception 'REJECTED_MEMBER'; end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_member.id,
    'user_id', v_member.user_id,
    'nickname', v_member.nickname,
    'status', v_member.status
  );
end;
$$;
revoke all on function public.member_login(text,text) from public;
grant execute on function public.member_login(text,text) to anon, authenticated;

-- Storage 버킷
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-history', 'member-history', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

-- 가입자는 UUID 폴더에 사진 업로드만 가능
drop policy if exists "anonymous member photo upload" on storage.objects;
create policy "anonymous member photo upload"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'member-history'
  and (storage.foldername(name))[1] = 'pending'
);


-- Vercel 환경변수에서 SIGNUP_CODE와 ADMIN_PASSWORD를 관리합니다.
-- SUPABASE_SERVICE_ROLE_KEY는 Vercel 서버 함수에서만 사용하고 브라우저로 노출하지 마세요.
