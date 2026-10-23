-- The default accent is electric violet now (was neon pink, #FF3D8B). Wheels still on the old default move too.
alter table public.wheels alter column accent set default '#9D6BFF';
update public.wheels set accent = '#9D6BFF' where accent = '#FF3D8B';
