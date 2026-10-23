-- New look, "Desert night" (scripts/palette.mjs): the default accent is desert gold now, and wheels saved
-- with one of the old theme colours move to its new counterpart.
alter table public.wheels alter column accent set default '#E8B86B';
update public.wheels set accent = case upper(accent)
  when '#FF3D8B' then '#E8B86B' when '#C6FF3D' then '#C9D98A' when '#3DF2FF' then '#7FC8C0' when '#FFB23D' then '#F0A35E'
  else accent end;
