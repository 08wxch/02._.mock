-- Public image bucket for figures attached to individual exam questions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images',
  'question-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "question_images_public_read" on storage.objects;
create policy "question_images_public_read" on storage.objects
  for select using (bucket_id = 'question-images');

drop policy if exists "question_images_teacher_insert" on storage.objects;
create policy "question_images_teacher_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-images' and public.jwt_role() = 'teacher');

drop policy if exists "question_images_teacher_update" on storage.objects;
create policy "question_images_teacher_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'question-images' and public.jwt_role() = 'teacher')
  with check (bucket_id = 'question-images' and public.jwt_role() = 'teacher');

drop policy if exists "question_images_teacher_delete" on storage.objects;
create policy "question_images_teacher_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-images' and public.jwt_role() = 'teacher');
