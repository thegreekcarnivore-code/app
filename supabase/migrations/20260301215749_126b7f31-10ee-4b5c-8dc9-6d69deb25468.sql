
-- Drop the partially created tables from failed migration
DROP TABLE IF EXISTS public.group_post_likes CASCADE;
DROP TABLE IF EXISTS public.group_comments CASCADE;
DROP TABLE IF EXISTS public.group_posts CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;

-- Create all tables first without RLS policies
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_image_url text DEFAULT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE public.group_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  media_urls text[] DEFAULT '{}',
  mentions text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Now enable RLS and add policies
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_post_likes ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Members can view their groups" ON public.groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = groups.id AND gm.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Group members policies (use security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id)
$$;

CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT USING (
  is_group_member(group_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Admins can manage group members" ON public.group_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Group posts policies
CREATE POLICY "Members can view group posts" ON public.group_posts FOR SELECT USING (
  is_group_member(group_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Members can insert group posts" ON public.group_posts FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (is_group_member(group_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);
CREATE POLICY "Users can update own posts" ON public.group_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts or admins" ON public.group_posts FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Group comments policies
CREATE POLICY "Members can view group comments" ON public.group_comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.group_posts gp WHERE gp.id = group_comments.post_id AND is_group_member(gp.group_id, auth.uid())
  ) OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Members can insert comments" ON public.group_comments FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (
      SELECT 1 FROM public.group_posts gp WHERE gp.id = group_comments.post_id AND is_group_member(gp.group_id, auth.uid())
    ) OR has_role(auth.uid(), 'admin'::app_role)
  )
);
CREATE POLICY "Users can delete own comments or admins" ON public.group_comments FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Group post likes policies
CREATE POLICY "Members can view likes" ON public.group_post_likes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.group_posts gp WHERE gp.id = group_post_likes.post_id AND is_group_member(gp.group_id, auth.uid())
  ) OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Members can insert likes" ON public.group_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own likes" ON public.group_post_likes FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for group media (20MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('group-media', 'group-media', false, 20971520);

CREATE POLICY "Authenticated users can upload group media" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'group-media' AND auth.uid() IS NOT NULL
);
CREATE POLICY "Authenticated users can view group media" ON storage.objects FOR SELECT USING (
  bucket_id = 'group-media' AND auth.uid() IS NOT NULL
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_post_likes;
