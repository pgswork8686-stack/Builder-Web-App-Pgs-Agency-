-- Nhân viên đề xuất công việc, Trưởng phòng (quản lý dự án) duyệt.
-- Công việc cũ và công việc do quản lý tạo mặc định 'approved'.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_approval_status_check
    CHECK (approval_status IN ('approved', 'pending', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS tasks_pending_approval_idx
  ON public.tasks (project_id)
  WHERE approval_status = 'pending';

NOTIFY pgrst, 'reload schema';
