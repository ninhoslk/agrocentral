-- AgroCentral — Fazenda demonstrativa deslocada ~11 km para área rural (antes caía sobre a malha urbana).
-- Deslocamento uniforme de -0,1° em latitude e longitude em todas as geometrias e pontos de exemplo.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.seed_demo_data(uuid)'::regprocedure);
  d := replace(d, '-50.9', '-51.0');
  d := replace(d, '-17.8', '-17.9');
  d := replace(d, '-17.7', '-17.8');
  execute d;
end $$;

create or replace function private.shift_geojson(p jsonb, dx numeric, dy numeric)
returns jsonb language sql immutable
set search_path = ''
as $$
  select extensions.st_asgeojson(extensions.st_translate(extensions.st_geomfromgeojson(p::text), dx::float8, dy::float8), 6)::jsonb;
$$;

update public.farms set latitude = null, longitude = null,
  boundary_geojson = private.shift_geojson(boundary_geojson, -0.1, -0.1)
where is_demo and boundary_geojson is not null;
update public.fields set geojson = private.shift_geojson(geojson, -0.1, -0.1) where is_demo and geojson is not null;
update public.points_of_interest set latitude = latitude - 0.1, longitude = longitude - 0.1 where is_demo;
drop function private.shift_geojson(jsonb, numeric, numeric);
