-- New look, "Desert night" (scripts/palette.mjs): the default accent is desert gold now. Sunset is no longer a
-- theme (Maroon took its place), so wheels saved with it move to desert gold. The neon colours are still themes.
alter table public.wheels alter column accent set default '#E8B86B';
update public.wheels set accent = '#E8B86B' where upper(accent) in ('#FFB23D', '#F0A35E', '#9D6BFF');
