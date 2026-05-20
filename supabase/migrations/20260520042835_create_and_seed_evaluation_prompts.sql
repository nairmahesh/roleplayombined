/*
  # Create and Seed Evaluation Prompts Table

  ## Summary
  Creates the evaluation_prompts table and seeds it with industry-standard
  scoring rubrics for 7 roleplay types. Global defaults (company_id IS NULL)
  are used when no company-specific override exists.

  ## New Table: evaluation_prompts
  - id (uuid PK)
  - company_id (uuid, nullable — NULL = global default)
  - roleplay_type (text) — e.g. 'cold_call', 'discovery_call'
  - display_name (text)
  - scoring_criteria (jsonb) — array of criterion groups
  - prompt_template (text) — AI scoring instructions
  - is_active (boolean)
  - created_at / updated_at (timestamptz)

  ## Security
  - RLS enabled; authenticated users can read active prompts
  - Only super admins can write (company admins handled via app layer)

  ## Rubrics Seeded
  Cold Call, Discovery Call, Sales Pitch, Objection Handling,
  Negotiation, Account Expansion, Customer Support
*/

CREATE TABLE IF NOT EXISTS evaluation_prompts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid,
  roleplay_type    text NOT NULL,
  display_name     text NOT NULL DEFAULT '',
  scoring_criteria jsonb NOT NULL DEFAULT '[]',
  prompt_template  text NOT NULL DEFAULT '',
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_prompts_company_type
  ON evaluation_prompts (company_id, roleplay_type);

ALTER TABLE evaluation_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active evaluation prompts"
  ON evaluation_prompts FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role can manage evaluation prompts"
  ON evaluation_prompts FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update evaluation prompts"
  ON evaluation_prompts FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed global defaults (company_id IS NULL)

INSERT INTO evaluation_prompts (company_id, roleplay_type, display_name, scoring_criteria, prompt_template, is_active)
SELECT NULL, 'cold_call', 'Cold Call',
'[
  {"group":"Opener","criteria":[
    {"question":"Permission-based opener?","hint":"Did the rep ask for a brief moment before pitching? e.g. Do you have 30 seconds?"},
    {"question":"Used research on prospect?","hint":"Referenced something specific about the prospect or company to personalise the opener."}
  ]},
  {"group":"Discovery","criteria":[
    {"question":"SDR asked for preconceptions of product?","hint":"Did the rep ask about current awareness or opinion of the product/category before pitching?"}
  ]},
  {"group":"Social Proof","criteria":[
    {"question":"Provided social proof?","hint":"Cited a relevant customer reference, metric, or case study."},
    {"question":"Asked if social proof was relevant?","hint":"Checked whether the example resonated with this specific prospect."}
  ]},
  {"group":"Takeaway","criteria":[
    {"question":"Re-confirmed that the time works for the prospect?","hint":"Checked that timing still worked before closing."},
    {"question":"Asked for success criteria for next call?","hint":"Asked what a successful next call would look like for the prospect."}
  ]},
  {"group":"Closing","criteria":[
    {"question":"Next steps agreed upon?","hint":"Both parties agreed on a clear next step."},
    {"question":"Follow-up meeting booked?","hint":"A specific date/time for a follow-up was confirmed."}
  ]}
]'::jsonb,
'You are an expert SDR coach evaluating a cold call roleplay. Score each criterion 0 (not done) or 1 (done well) with one-sentence transcript evidence.',
true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_prompts WHERE company_id IS NULL AND roleplay_type = 'cold_call');

INSERT INTO evaluation_prompts (company_id, roleplay_type, display_name, scoring_criteria, prompt_template, is_active)
SELECT NULL, 'discovery_call', 'Discovery Call',
'[
  {"group":"Introduction & Agenda","criteria":[
    {"question":"Did the seller discuss the agenda and ask for prospect input?","hint":"Set an agenda AND asked if the prospect wants to add anything."},
    {"question":"Did the seller introduce an Upfront Contract?","hint":"Established mutual expectations: what will happen and what the outcome will be."}
  ]},
  {"group":"Pain & Metrics Discovery","criteria":[
    {"question":"Did the seller uncover specific pain points?","hint":"At least one concrete, specific problem the prospect is experiencing."},
    {"question":"Did the seller uncover relevant metrics?","hint":"Quantified impact — time lost, revenue lost, cost, or other measurable metric."}
  ]},
  {"group":"Objection Handling","criteria":[
    {"question":"Did the seller handle objections effectively using the FFF framework?","hint":"Acknowledged, empathised (Feel-Felt-Found), then reframed any objection raised."}
  ]},
  {"group":"Customer Reference & Value Pyramid Discovery","criteria":[
    {"question":"Did the seller present a customer reference?","hint":"Referenced a similar customer and their outcome."},
    {"question":"Did the seller explore the prospect goal-setting framework?","hint":"Asked how the prospect measures success or sets targets."}
  ]},
  {"group":"Closing","criteria":[
    {"question":"Did the seller revisit the upfront contract and define next steps?","hint":"Closed by referencing the start-of-call agreement and confirming concrete next steps."},
    {"question":"Did the seller qualify out or in effectively?","hint":"Reached a clear conclusion about whether this is a qualified opportunity."}
  ]}
]'::jsonb,
'You are an expert AE coach evaluating a discovery call roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.',
true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_prompts WHERE company_id IS NULL AND roleplay_type = 'discovery_call');

INSERT INTO evaluation_prompts (company_id, roleplay_type, display_name, scoring_criteria, prompt_template, is_active)
SELECT NULL, 'sales_pitch', 'Sales Pitch',
'[
  {"group":"Value Proposition","criteria":[
    {"question":"Was the value proposition clear and specific?","hint":"Articulated what the product does and who it helps in concrete terms."},
    {"question":"Was the pitch personalised to the prospect situation?","hint":"Referenced specific context or pain points of this prospect."}
  ]},
  {"group":"Differentiation","criteria":[
    {"question":"Did the rep differentiate from competition?","hint":"Explained what makes this solution different from alternatives."},
    {"question":"Was a customer story or case study used?","hint":"Backed claims with a real customer outcome."}
  ]},
  {"group":"ROI & Business Case","criteria":[
    {"question":"Was ROI or business value quantified?","hint":"Provided a number, time saving, or cost reduction estimate."}
  ]},
  {"group":"Objection Handling","criteria":[
    {"question":"Were objections handled effectively?","hint":"Acknowledged, explored, and reframed at least one objection."},
    {"question":"Was momentum maintained after objections?","hint":"Returned to the pitch without losing energy after handling pushback."}
  ]},
  {"group":"Closing","criteria":[
    {"question":"Was a clear next step defined?","hint":"Both parties agreed on a specific next action."},
    {"question":"Was urgency or a reason to act now established?","hint":"Gave a compelling reason to move forward now vs. later."}
  ]}
]'::jsonb,
'You are an expert sales coach evaluating a sales pitch roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.',
true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_prompts WHERE company_id IS NULL AND roleplay_type = 'sales_pitch');

INSERT INTO evaluation_prompts (company_id, roleplay_type, display_name, scoring_criteria, prompt_template, is_active)
SELECT NULL, 'objection_handling', 'Objection Handling',
'[
  {"group":"Acknowledgement","criteria":[
    {"question":"Did the rep acknowledge the objection without defending?","hint":"Showed they heard the concern before responding."},
    {"question":"Did the rep explore the root cause with a question?","hint":"Asked a clarifying question to understand the objection deeper."}
  ]},
  {"group":"Response","criteria":[
    {"question":"Did the rep provide relevant evidence or reframe?","hint":"Used a customer story, data point, or reframe to address the concern."},
    {"question":"Did the rep confirm the objection was resolved?","hint":"Checked: Does that make sense? or similar before moving on."}
  ]},
  {"group":"Momentum","criteria":[
    {"question":"Did the rep maintain momentum toward the next step?","hint":"Transitioned back to the opportunity without losing energy."}
  ]}
]'::jsonb,
'You are an expert sales coach evaluating an objection handling roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.',
true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_prompts WHERE company_id IS NULL AND roleplay_type = 'objection_handling');

INSERT INTO evaluation_prompts (company_id, roleplay_type, display_name, scoring_criteria, prompt_template, is_active)
SELECT NULL, 'negotiation', 'Negotiation',
'[
  {"group":"Anchoring","criteria":[
    {"question":"Did the rep anchor high before conceding?","hint":"Opened at full price/terms before negotiating."},
    {"question":"Did the rep trade concessions (not give without getting)?","hint":"Every concession was paired with a request for something in return."}
  ]},
  {"group":"Value Protection","criteria":[
    {"question":"Did the rep protect margin and core terms?","hint":"Avoided discounting on price without moving something else."},
    {"question":"Did the rep use value justification before conceding?","hint":"Re-stated ROI or business case before offering any flexibility."}
  ]},
  {"group":"Outcome","criteria":[
    {"question":"Was a mutually agreed outcome reached?","hint":"Both parties aligned on a specific deal or next step."},
    {"question":"Was the relationship maintained throughout?","hint":"Tone remained collaborative, not adversarial."}
  ]}
]'::jsonb,
'You are an expert sales coach evaluating a negotiation roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.',
true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_prompts WHERE company_id IS NULL AND roleplay_type = 'negotiation');

INSERT INTO evaluation_prompts (company_id, roleplay_type, display_name, scoring_criteria, prompt_template, is_active)
SELECT NULL, 'account_expansion', 'Account Expansion',
'[
  {"group":"Relationship & Context","criteria":[
    {"question":"Did the rep reference the existing relationship and past wins?","hint":"Opened by acknowledging what has already been achieved together."},
    {"question":"Did the rep identify a new business need or expansion trigger?","hint":"Surfaced a specific new problem, team, or use case not yet solved."}
  ]},
  {"group":"Expansion Discovery","criteria":[
    {"question":"Did the rep map to additional stakeholders?","hint":"Identified or asked about other decision-makers or teams that could benefit."},
    {"question":"Did the rep present an expansion business case with ROI?","hint":"Showed the financial or operational value of the expanded solution."}
  ]},
  {"group":"Next Steps","criteria":[
    {"question":"Was a clear next step for the expansion defined?","hint":"Agreed on a specific action to advance the expansion conversation."}
  ]}
]'::jsonb,
'You are an expert CSM/AE coach evaluating an account expansion roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.',
true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_prompts WHERE company_id IS NULL AND roleplay_type = 'account_expansion');

INSERT INTO evaluation_prompts (company_id, roleplay_type, display_name, scoring_criteria, prompt_template, is_active)
SELECT NULL, 'customer_support', 'Customer Support',
'[
  {"group":"Empathy & Acknowledgement","criteria":[
    {"question":"Did the rep acknowledge the customer frustration?","hint":"Validated the customer feelings before problem-solving."},
    {"question":"Did the rep apologise or take ownership appropriately?","hint":"Took responsibility without over-promising or deflecting."}
  ]},
  {"group":"Problem Resolution","criteria":[
    {"question":"Did the rep ask clarifying questions to understand the issue?","hint":"Gathered enough detail before proposing a solution."},
    {"question":"Was a clear resolution or next step provided?","hint":"Customer left knowing exactly what happens next."}
  ]},
  {"group":"Experience & Retention","criteria":[
    {"question":"Did the rep confirm customer satisfaction before closing?","hint":"Asked if the resolution met the customer needs."},
    {"question":"Did the rep look for an opportunity to add value or expand?","hint":"Mentioned a related feature, resource, or upsell where appropriate."}
  ]}
]'::jsonb,
'You are an expert CSM coach evaluating a customer support roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.',
true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_prompts WHERE company_id IS NULL AND roleplay_type = 'customer_support');
