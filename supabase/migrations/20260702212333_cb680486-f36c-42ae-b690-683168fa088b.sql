
-- Saved replies (canned responses) for support tickets
CREATE TABLE public.saved_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_replies TO authenticated;
GRANT ALL ON public.saved_replies TO service_role;
ALTER TABLE public.saved_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage saved replies" ON public.saved_replies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER saved_replies_updated_at BEFORE UPDATE ON public.saved_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin TOTP 2FA
CREATE TABLE public.admin_totp (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  backup_codes text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_totp TO authenticated;
GRANT ALL ON public.admin_totp TO service_role;
ALTER TABLE public.admin_totp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read own totp" ON public.admin_totp
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins insert own totp" ON public.admin_totp
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update own totp" ON public.admin_totp
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins delete own totp" ON public.admin_totp
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Blog / help center categories
CREATE TABLE public.blog_categories (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_categories TO authenticated;
GRANT ALL ON public.blog_categories TO service_role;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON public.blog_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.blog_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Blog / help center posts
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text,
  cover_image_url text,
  body_md text NOT NULL DEFAULT '',
  category_slug text REFERENCES public.blog_categories(slug) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published posts" ON public.blog_posts
  FOR SELECT USING (published = true);
CREATE POLICY "Admins read all posts" ON public.blog_posts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage posts" ON public.blog_posts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX blog_posts_published_idx ON public.blog_posts(published, published_at DESC);
CREATE INDEX blog_posts_category_idx ON public.blog_posts(category_slug);

-- Seed categories
INSERT INTO public.blog_categories (slug, name, description, sort_order) VALUES
  ('getting-started', 'Getting Started', 'How to place your first order and find your links', 1),
  ('instagram', 'Instagram', 'Guides for Instagram followers, likes, views, and more', 2),
  ('tiktok', 'TikTok', 'Guides for TikTok followers, likes, views, and shares', 3),
  ('youtube', 'YouTube', 'Guides for YouTube subscribers, views, and watch time', 4),
  ('facebook', 'Facebook', 'Guides for Facebook page likes, followers, and post engagement', 5),
  ('twitter', 'Twitter / X', 'Guides for X followers, likes, retweets, and impressions', 6),
  ('billing', 'Billing & Payments', 'Deposits, refunds, and payment troubleshooting', 7);
