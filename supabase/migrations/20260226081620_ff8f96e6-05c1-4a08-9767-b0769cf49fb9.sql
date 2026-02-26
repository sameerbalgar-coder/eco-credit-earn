
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('citizen', 'worker', 'supervisor', 'admin');

-- Create report status enum
CREATE TYPE public.report_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'rejected');

-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role app_role NOT NULL DEFAULT 'citizen',
  credits_balance INTEGER NOT NULL DEFAULT 0,
  co2_saved_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  badge_level TEXT NOT NULL DEFAULT 'Bronze',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Waste reports table
CREATE TABLE public.waste_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  waste_type TEXT NOT NULL,
  description TEXT,
  quantity_kg NUMERIC(10,2),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  address TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  photo_urls TEXT[] DEFAULT '{}',
  assigned_worker_id UUID REFERENCES auth.users(id),
  assigned_supervisor_id UUID REFERENCES auth.users(id),
  credits_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.waste_reports(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES auth.users(id),
  assigned_by UUID REFERENCES auth.users(id),
  status task_status NOT NULL DEFAULT 'pending',
  before_photo_url TEXT,
  after_photo_url TEXT,
  completion_notes TEXT,
  weight_kg NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit transactions table
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- 'earned', 'spent', 'bonus'
  description TEXT,
  related_report_id UUID REFERENCES public.waste_reports(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Materials/categories reference table
CREATE TABLE public.waste_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  handling_info TEXT,
  recycling_method TEXT,
  credits_per_kg INTEGER NOT NULL DEFAULT 10
);

-- Insert default waste categories
INSERT INTO public.waste_categories (name, icon, handling_info, recycling_method, credits_per_kg) VALUES
  ('Plastic', '♻️', 'Rinse and remove labels. Separate by resin type.', 'Mechanical recycling into pellets for new products.', 10),
  ('Paper', '📄', 'Keep dry. Remove staples and plastic windows.', 'Pulped and reformed into new paper products.', 5),
  ('Glass', '🫙', 'Rinse clean. Separate by color if possible.', 'Crushed and melted to form new glass containers.', 8),
  ('Metal', '🔩', 'Rinse cans. Separate ferrous and non-ferrous.', 'Melted and reformed. Aluminum is infinitely recyclable.', 15),
  ('Organic', '🍂', 'Separate from non-organic waste.', 'Composted into nutrient-rich soil amendment.', 3),
  ('E-Waste', '🔌', 'Do not break open. Keep batteries separate.', 'Disassembled for precious metal recovery.', 20),
  ('Hazardous', '☢️', 'Do not mix. Keep in original containers.', 'Specialized treatment at licensed facilities.', 25),
  ('Mixed', '🗑️', 'Sort as much as possible before submission.', 'Sorted at facility then processed by type.', 5);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_categories ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper to get user role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'citizen')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'citizen')
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_waste_reports_updated_at BEFORE UPDATE ON public.waste_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- Profiles: users see own, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Waste reports
CREATE POLICY "Citizens see own reports" ON public.waste_reports FOR SELECT USING (
  reporter_id = auth.uid() OR assigned_worker_id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
);
CREATE POLICY "Authenticated users can create reports" ON public.waste_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Authorized users can update reports" ON public.waste_reports FOR UPDATE USING (
  reporter_id = auth.uid() OR assigned_worker_id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
);

-- Tasks
CREATE POLICY "Users see relevant tasks" ON public.tasks FOR SELECT USING (
  worker_id = auth.uid() OR assigned_by = auth.uid() OR 
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
);
CREATE POLICY "Supervisors and admins create tasks" ON public.tasks FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
);
CREATE POLICY "Authorized users update tasks" ON public.tasks FOR UPDATE USING (
  worker_id = auth.uid() OR assigned_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- Credit transactions
CREATE POLICY "Users see own transactions" ON public.credit_transactions FOR SELECT USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "System creates transactions" ON public.credit_transactions FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);

-- Notifications
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System creates notifications" ON public.notifications FOR INSERT WITH CHECK (user_id = auth.uid());

-- Waste categories: public read
CREATE POLICY "Anyone can read categories" ON public.waste_categories FOR SELECT TO authenticated USING (true);

-- Storage bucket for report photos
INSERT INTO storage.buckets (id, name, public) VALUES ('report-photos', 'report-photos', true);

CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-photos');
CREATE POLICY "Anyone can view report photos" ON storage.objects FOR SELECT USING (bucket_id = 'report-photos');
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
