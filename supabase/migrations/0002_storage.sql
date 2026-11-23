-- Public bucket for the event logo (branding). Reads are public;
-- writes only ever happen through the service-role key in
-- uploadLogoAction, so no insert/update policy is needed for
-- anon or authenticated.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy branding_public_read on storage.objects
  for select using (bucket_id = 'branding');
