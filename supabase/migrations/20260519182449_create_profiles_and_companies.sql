/*
  # Create evaluation_prompts table

  ## Summary
  Stores per-roleplay-type scoring rubrics and AI evaluation prompts,
  configurable per company. Global defaults (companyId IS NULL) are the
  system-wide fallbacks. Company-specific rows override the global defaults.

  ## New Tables
  - `evaluation_prompts`
    - `id` (uuid, PK)
    - `company_id` (uuid, nullable FK → companies, NULL = global default)
    - `roleplay_type` (text) — e.g. 'cold_call', 'discovery_call', 'sales_pitch'
    - `display_name` (text) — human-readable label shown in admin UI
    - `scoring_criteria` (jsonb) — array of criterion groups with questions
    - `prompt_template` (text) — full AI prompt template with {transcript} placeholder
    - `is_active` (boolean, default true)
    - `created_at` / `updated_at` (timestamptz)

  ## scoring_criteria JSON shape:
  [
    {
      "group": "Opener",
      "maxPoints": 2,
      "criteria": [
        { "question": "Used a permission-based opener?", "hint": "Did the rep ask for time before pitching?" },
        { "question": "Used research on prospect?", "hint": "Referenced company-specific info?" }
      ]
    }
  ]

  ## Security
  - RLS enabled
  - COMPANY_ADMIN and SUPER_ADMIN can read/write their company's prompts
  - All authenticated users can read active prompts for their company (needed for session analysis)
*/

CREATE TABLE IF NOT EXISTS evaluation_prompts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  roleplay_type   text NOT NULL,
  display_name    text NOT NULL DEFAULT '',
  scoring_criteria jsonb NOT NULL DEFAULT '[]',
  prompt_template  text NOT NULL DEFAULT '',
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_prompts_company_roleplay
  ON evaluation_prompts (company_id, roleplay_type);

ALTER TABLE evaluation_prompts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active prompts (global or their company's)
CREATE POLICY "Authenticated users can read active evaluation prompts"
  ON evaluation_prompts FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      company_id IS NULL
      OR company_id = auth.uid()
    )
  );

-- Admins can insert evaluation prompts for their company
CREATE POLICY "Admins can insert company evaluation prompts"
  ON evaluation_prompts FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth.uid());

-- Admins can update their company's evaluation prompts
CREATE POLICY "Admins can update company evaluation prompts"
  ON evaluation_prompts FOR UPDATE
  TO authenticated
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- Admins can delete their company's evaluation prompts
CREATE POLICY "Admins can delete company evaluation prompts"
  ON evaluation_prompts FOR DELETE
  TO authenticated
  USING (company_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_evaluation_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evaluation_prompts_updated_at
  BEFORE UPDATE ON evaluation_prompts
  FOR EACH ROW EXECUTE FUNCTION update_evaluation_prompts_updated_at();
