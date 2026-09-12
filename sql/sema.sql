-- =====================================================================
-- Almanca Yazma Puanlama Platformu — veritabanı şeması
-- Supabase projesi: puanlama-platformu (eu-central-1)
-- Bu dosya, veritabanına uygulanan göçlerin birleştirilmiş hâlidir.
-- =====================================================================

-- ---------- 1. TABLOLAR ----------

create table if not exists ayarlar (
  anahtar text primary key,
  deger   text not null
);
insert into ayarlar(anahtar,deger) values
  ('capa_sayisi','4'), ('rastgele_sayisi','4'), ('kaydirma','1.8')
on conflict (anahtar) do nothing;

create table if not exists metinler (
  id             text primary key,
  duzey          text not null check (duzey in ('A2','B1','B2','C1')),
  gorev_turu     text not null,
  gorev_metni    text not null,
  transkripsiyon text not null,
  gorsel_yolu    text,
  ham_htr        text,
  capa           boolean not null default false,
  aktif          boolean not null default true
);

create table if not exists puanlayicilar (
  token       text primary key,
  kosul       char(1) not null check (kosul in ('A','B','C')),
  onam_tarihi timestamptz,
  onam_ai     boolean not null default false,
  olusturma   timestamptz not null default now()
);

create table if not exists atamalar (
  token        text references puanlayicilar(token) on delete cascade,
  metin_id     text references metinler(id),
  sira         int not null,
  atama_turu   text not null check (atama_turu in ('capa','rastgele')),
  sunum_kosulu text not null default 'transkripsiyon'
               check (sunum_kosulu in ('transkripsiyon','elyazisi','ham_htr')),
  primary key (token, metin_id)
);

create table if not exists puanlamalar (
  id                  bigserial primary key,
  token               text references puanlayicilar(token) on delete cascade,
  metin_id            text references metinler(id),
  b1_gorev_icerik     smallint check (b1_gorev_icerik between 0 and 4),
  b2_orgutleme        smallint check (b2_orgutleme between 0 and 4),
  b3_sozcuk           smallint check (b3_sozcuk between 0 and 4),
  b4_dilbilgisi       smallint check (b4_dilbilgisi between 0 and 4),
  butuncul            smallint check (butuncul between 0 and 10),
  puanlanamaz         boolean not null default false,
  puanlanamaz_gerekce text,
  guven_derecesi      smallint check (guven_derecesi between 1 and 5),
  gosterilen_ai       numeric(4,1),
  kaydirma            numeric(4,1),
  yorum               text,
  sure_sn             int,
  olusturma           timestamptz not null default now(),
  unique (token, metin_id)
);
create index if not exists ix_puanlamalar_metin on puanlamalar(metin_id);
create index if not exists ix_puanlamalar_token on puanlamalar(token);

create table if not exists model_puanlari (
  id              bigserial primary key,
  metin_id        text references metinler(id),
  model_adi       text not null,
  model_surumu    text not null,
  istem_kosulu    text not null check (istem_kosulu in ('rubriksiz','rubrikli','ornekli')),
  zaman_noktasi   smallint not null check (zaman_noktasi in (1,2)),
  sunum_kosulu    text not null default 'transkripsiyon',
  b1 smallint, b2 smallint, b3 smallint, b4 smallint,
  butuncul        numeric(4,1),
  gerekce         text,
  ham_yanit       jsonb,
  uretim_ayarlari jsonb,
  olusturma       timestamptz not null default now(),
  unique (metin_id, model_adi, model_surumu, istem_kosulu, zaman_noktasi, sunum_kosulu)
);

create table if not exists oturum_gunlugu (
  id        bigserial primary key,
  token     text,
  olay      text not null,
  ayrinti   jsonb,
  zaman     timestamptz not null default now()
);

-- ---------- 2. GÜVENLİK ----------
-- Tüm tablolarda RLS açık ve hiçbir politika yok: tarayıcı (anon rolü)
-- tablolara doğrudan erişemez, yalnızca aşağıdaki iki fonksiyonu çağırabilir.

alter table ayarlar        enable row level security;
alter table metinler       enable row level security;
alter table puanlayicilar  enable row level security;
alter table atamalar       enable row level security;
alter table puanlamalar    enable row level security;
alter table model_puanlari enable row level security;
alter table oturum_gunlugu enable row level security;

-- ---------- 3. FONKSİYONLAR ----------

create or replace function public.kosul_uret(p_token text)
returns char(1) language sql immutable set search_path = public, pg_temp as $$
  select (array['A','B','C'])[ (abs(hashtext(p_token)) % 3) + 1 ]::char(1)
$$;

create or replace function public.oturum_baslat(p_token text, p_onam_ai boolean default false)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_kosul char(1);
  v_capa int := (select deger::int from ayarlar where anahtar='capa_sayisi');
  v_rast int := (select deger::int from ayarlar where anahtar='rastgele_sayisi');
  v_n int := 0;
  r record;
  v_plan json;
  v_tamam int;
begin
  if p_token is null or length(btrim(p_token)) < 3 then
    raise exception 'gecersiz_token';
  end if;
  p_token := upper(btrim(p_token));
  v_kosul := kosul_uret(p_token);

  insert into puanlayicilar(token, kosul, onam_tarihi, onam_ai)
  values (p_token, v_kosul, now(), coalesce(p_onam_ai,false))
  on conflict (token) do update set onam_ai = excluded.onam_ai;

  if not exists (select 1 from atamalar where token = p_token) then
    for r in
      select id from metinler where capa and aktif
      order by md5(p_token || id) limit v_capa
    loop
      v_n := v_n + 1;
      insert into atamalar(token, metin_id, sira, atama_turu)
      values (p_token, r.id, v_n, 'capa');
    end loop;

    for r in
      select m.id, count(p.id) as n
      from metinler m
      left join puanlamalar p on p.metin_id = m.id
      where not m.capa and m.aktif
      group by m.id
      order by n asc, md5(p_token || m.id)
      limit v_rast
    loop
      v_n := v_n + 1;
      insert into atamalar(token, metin_id, sira, atama_turu)
      values (p_token, r.id, v_n, 'rastgele');
    end loop;
  end if;

  select json_agg(x order by x.sira) into v_plan from (
    select a.sira, a.metin_id, a.atama_turu, a.sunum_kosulu,
           m.duzey, m.gorev_turu, m.gorev_metni,
           case a.sunum_kosulu when 'ham_htr' then coalesce(m.ham_htr, m.transkripsiyon)
                               else m.transkripsiyon end as metin,
           m.gorsel_yolu,
           case when v_kosul = 'A' then null
                else round(mp.butuncul + case when v_kosul='C'
                     then (case when (abs(hashtext(a.metin_id)) % 2) = 0 then 1 else -1 end)
                          * (select deger::numeric from ayarlar where anahtar='kaydirma')
                     else 0 end, 1) end as gosterilen_ai,
           case when v_kosul = 'C'
                then (case when (abs(hashtext(a.metin_id)) % 2) = 0 then 1 else -1 end)
                     * (select deger::numeric from ayarlar where anahtar='kaydirma')
                else 0 end as kaydirma,
           case when v_kosul = 'A' then null else mp.gerekce end as ai_gerekce,
           (p.id is not null) as puanlandi
    from atamalar a
    join metinler m on m.id = a.metin_id
    left join model_puanlari mp
      on mp.metin_id = a.metin_id and mp.istem_kosulu = 'rubrikli' and mp.zaman_noktasi = 1
    left join puanlamalar p on p.token = a.token and p.metin_id = a.metin_id
    where a.token = p_token
  ) x;

  select count(*) into v_tamam from puanlamalar where token = p_token;

  insert into oturum_gunlugu(token, olay, ayrinti)
  values (p_token, 'oturum_baslat', json_build_object('kosul', v_kosul)::jsonb);

  return json_build_object('token', p_token, 'kosul', v_kosul,
                           'tamamlanan', v_tamam, 'plan', coalesce(v_plan, '[]'::json));
end $$;

create or replace function public.puan_kaydet(
  p_token text, p_metin text,
  p_b1 int default null, p_b2 int default null, p_b3 int default null, p_b4 int default null,
  p_butuncul int default null, p_puanlanamaz boolean default false,
  p_gerekce text default null, p_guven int default null,
  p_yorum text default null, p_sure int default null)
returns json
language plpgsql security definer set search_path = public as $$
declare v_kosul char(1); v_ai numeric(4,1); v_kay numeric(4,1); v_tamam int;
begin
  p_token := upper(btrim(p_token));
  select kosul into v_kosul from puanlayicilar where token = p_token;
  if v_kosul is null then raise exception 'oturum_yok'; end if;
  if not exists (select 1 from atamalar where token = p_token and metin_id = p_metin) then
    raise exception 'metin_atanmamis';
  end if;

  select case when v_kosul='A' then null
              else round(mp.butuncul + case when v_kosul='C'
                   then (case when (abs(hashtext(p_metin)) % 2) = 0 then 1 else -1 end)
                        * (select deger::numeric from ayarlar where anahtar='kaydirma')
                   else 0 end, 1) end,
         case when v_kosul='C'
              then (case when (abs(hashtext(p_metin)) % 2) = 0 then 1 else -1 end)
                   * (select deger::numeric from ayarlar where anahtar='kaydirma')
              else 0 end
    into v_ai, v_kay
  from model_puanlari mp
  where mp.metin_id = p_metin and mp.istem_kosulu='rubrikli' and mp.zaman_noktasi=1
  limit 1;

  insert into puanlamalar(token, metin_id, b1_gorev_icerik, b2_orgutleme, b3_sozcuk, b4_dilbilgisi,
                          butuncul, puanlanamaz, puanlanamaz_gerekce, guven_derecesi,
                          gosterilen_ai, kaydirma, yorum, sure_sn)
  values (p_token, p_metin,
          case when p_puanlanamaz then null else p_b1 end,
          case when p_puanlanamaz then null else p_b2 end,
          case when p_puanlanamaz then null else p_b3 end,
          case when p_puanlanamaz then null else p_b4 end,
          case when p_puanlanamaz then null else p_butuncul end,
          coalesce(p_puanlanamaz,false), p_gerekce, p_guven, v_ai, v_kay, p_yorum, p_sure)
  on conflict (token, metin_id) do update set
    b1_gorev_icerik = excluded.b1_gorev_icerik, b2_orgutleme = excluded.b2_orgutleme,
    b3_sozcuk = excluded.b3_sozcuk, b4_dilbilgisi = excluded.b4_dilbilgisi,
    butuncul = excluded.butuncul, puanlanamaz = excluded.puanlanamaz,
    puanlanamaz_gerekce = excluded.puanlanamaz_gerekce, guven_derecesi = excluded.guven_derecesi,
    yorum = excluded.yorum, sure_sn = excluded.sure_sn, olusturma = now();

  select count(*) into v_tamam from puanlamalar where token = p_token;
  return json_build_object('ok', true, 'tamamlanan', v_tamam);
end $$;

-- ---------- 4. YETKİLER ----------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant execute on function public.oturum_baslat(text, boolean) to anon;
grant execute on function public.puan_kaydet(text, text, int, int, int, int, int, boolean, text, int, text, int) to anon;

-- ---------- 5. DIŞA AKTARIM GÖRÜNÜMLERİ ----------

-- Uzun biçim: her satır bir puanlayıcı × metin × boyut gözlemi (MFRM / FACETS)
create or replace view v_mfrm_uzun with (security_invoker = true) as
select p.token as puanlayici, pl.kosul, p.metin_id, m.duzey, m.gorev_turu,
       a.atama_turu, a.sunum_kosulu, b.boyut, b.puan, p.butuncul, p.sure_sn, p.olusturma
from puanlamalar p
join puanlayicilar pl on pl.token = p.token
join metinler m on m.id = p.metin_id
left join atamalar a on a.token = p.token and a.metin_id = p.metin_id
cross join lateral (values
  ('b1', p.b1_gorev_icerik), ('b2', p.b2_orgutleme),
  ('b3', p.b3_sozcuk),       ('b4', p.b4_dilbilgisi)
) as b(boyut, puan)
where not p.puanlanamaz and b.puan is not null;

-- İnsan ve model puanlarını tek ölçeğe koyan birleşik görünüm
create or replace view v_tum_puanlayicilar with (security_invoker = true) as
select token as puanlayici_id, 'insan' as tur, metin_id,
       b1_gorev_icerik b1, b2_orgutleme b2, b3_sozcuk b3, b4_dilbilgisi b4, butuncul::numeric
from puanlamalar where not puanlanamaz
union all
select model_adi||'@'||model_surumu||'/'||istem_kosulu||'/t'||zaman_noktasi,
       'model', metin_id, b1, b2, b3, b4, butuncul
from model_puanlari;

-- Metin başına kapsam (veri toplama izleme)
create or replace view v_kapsam with (security_invoker = true) as
select m.id, m.duzey, m.capa, count(p.id) as puanlama_sayisi
from metinler m left join puanlamalar p on p.metin_id = m.id
group by m.id, m.duzey, m.capa;

revoke all on v_mfrm_uzun, v_tum_puanlayicilar, v_kapsam from anon;

-- ---------- 6. DEPOLAMA ----------
-- Taranmış el yazısı görüntüleri için özel kova (herkese kapalı).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('metin-gorselleri','metin-gorselleri', false, 26214400,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
