GRANT SELECT ON public.app_settings TO anon;
DROP POLICY IF EXISTS "app_settings_public_read" ON public.app_settings;
CREATE POLICY "app_settings_public_read" ON public.app_settings FOR SELECT TO anon USING (true);