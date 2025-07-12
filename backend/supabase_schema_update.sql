-- Enable UUID generation functionality if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Uploads Table
-- Stores information about uploaded files and their processing status.
CREATE TABLE IF NOT EXISTS public.uploads (
    id TEXT PRIMARY KEY, -- This is the job_id, e.g., "user_uuid_timestamp"
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing', -- e.g., 'processing', 'completed', 'failed'
    error_message TEXT, -- To store any error details if status is 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for uploads table
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON public.uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON public.uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON public.uploads(created_at);

-- RLS policies for uploads table
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own uploads" ON public.uploads;
CREATE POLICY "Users can view their own uploads"
    ON public.uploads FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own uploads" ON public.uploads;
CREATE POLICY "Users can insert their own uploads"
    ON public.uploads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own uploads" ON public.uploads;
CREATE POLICY "Users can update their own uploads"
    ON public.uploads FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own uploads" ON public.uploads;
CREATE POLICY "Users can delete their own uploads"
    ON public.uploads FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to uploads" ON public.uploads;
CREATE POLICY "Service role has full access to uploads"
    ON public.uploads FOR ALL
    USING (auth.role() = 'service_role');


-- 2. Questions Table
-- Stores the AI-generated questions for each upload.
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE, -- Corresponds to uploads.id
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Example: ["Option A", "Option B", "Option C", "Option D"]
    correct_option_index INTEGER NOT NULL, -- 0-indexed
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for questions table
CREATE INDEX IF NOT EXISTS idx_questions_job_id ON public.questions(job_id);

-- RLS policies for questions table
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view questions for their uploads" ON public.questions;
CREATE POLICY "Users can view questions for their uploads"
    ON public.questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.uploads
            WHERE public.uploads.id = public.questions.job_id
            AND public.uploads.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Only service role can insert questions" ON public.questions;
CREATE POLICY "Only service role can insert questions"
    ON public.questions FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can update questions" ON public.questions;
CREATE POLICY "Only service role can update questions"
    ON public.questions FOR UPDATE
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can delete questions" ON public.questions;
CREATE POLICY "Only service role can delete questions"
    ON public.questions FOR DELETE
    USING (auth.role() = 'service_role');


-- 3. Quiz Attempts Table
-- Stores user attempts for quizzes.
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id TEXT NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE, -- Corresponds to uploads.id (the quiz job_id)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answers JSONB, -- Storing user's selected answers, could be an array of indices or more complex if needed
    score INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for quiz_attempts table
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON public.quiz_attempts(completed_at);

-- RLS policies for quiz_attempts table
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view their own quiz attempts"
    ON public.quiz_attempts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can insert their own quiz attempts"
    ON public.quiz_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Only service role can update quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Only service role can update quiz attempts"
    ON public.quiz_attempts FOR UPDATE
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can delete quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Only service role can delete quiz attempts"
    ON public.quiz_attempts FOR DELETE
    USING (auth.role() = 'service_role');


-- 4. User Subscriptions Table
-- Manages user subscription status from payment providers.
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- e.g., 'lemonsqueezy', 'revenuecat', 'test'
    status TEXT NOT NULL, -- e.g., 'active', 'cancelled', 'expired', 'trialing'
    provider_order_id TEXT, -- Store the order/subscription ID from the provider
    provider_order_number TEXT, -- Optional, if LemonSqueezy provides it
    subscription_type TEXT, -- e.g., 'monthly', 'yearly'
    expires_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for user_subscriptions table
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider ON public.user_subscriptions(provider);

-- RLS policies for user_subscriptions table
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view their own subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Only service role can insert subscriptions" ON public.user_subscriptions;
CREATE POLICY "Only service role can insert subscriptions"
    ON public.user_subscriptions FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can update subscriptions" ON public.user_subscriptions;
CREATE POLICY "Only service role can update subscriptions"
    ON public.user_subscriptions FOR UPDATE
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can delete subscriptions" ON public.user_subscriptions;
CREATE POLICY "Only service role can delete subscriptions"
    ON public.user_subscriptions FOR DELETE
    USING (auth.role() = 'service_role');

-- Optional: Function to update 'updated_at' timestamp automatically
-- This is a common pattern but might already be handled by your Supabase setup or triggers.
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to tables that have 'updated_at'
-- (Consider if you want this for created_at or if default NOW() is sufficient)
CREATE TRIGGER set_timestamp_uploads
BEFORE UPDATE ON public.uploads
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_user_subscriptions
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Note on Daily Upload Limits:
-- The backend code (app.py) currently checks for daily upload limits in the application logic.
-- If you wanted to enforce this at the database level, you might consider more complex triggers
-- or RLS policies, possibly involving a separate table to track daily counts or by querying
-- the uploads table within an RLS check. However, application-level checks are often simpler
-- to manage and modify. The current RLS policies focus on ownership and service role access.

-- End of Schema Script