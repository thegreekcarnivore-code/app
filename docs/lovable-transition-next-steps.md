# Lovable Exit: Next Steps

## 1. Exact Message to Send to Lovable

Use this as-is:

```text
I am migrating my live coaching app off Lovable Cloud and into my own Supabase project.

Current Lovable Cloud project ref:
lglgmhzgxyvyftdhvdsy

Target Supabase project ref:
bowvosskzbtuxmrwatoj

I have already downloaded partial CSV and storage exports, but important pieces are still missing.

Please provide the following missing export items so I can complete a smooth migration without losing client access, files, or historical data:

1. Auth export
- auth.users
- auth.identities
- any password-hash-preserving export path so existing users can keep their passwords

2. Missing database tables
- client_form_signatures
- group_comments
- group_post_likes
- group_posts
- program_documents
- program_forms
- recipe_favorites
- saved_ai_prompts
- weekly_check_ins

3. Missing storage buckets/files
- chat-audio
- email-assets
- finance-receipts
- food-photos
- group-media
- program-documents
- progress-photos
- signatures

4. Any additional migration-critical backend configuration
- auth settings / redirect URLs
- bucket policies
- edge function secrets list
- scheduled jobs / automations list

Important:
Some exported rows still point to the old Lovable storage URLs, so I also need the actual files for the missing buckets in order to migrate media correctly.

Please confirm the best export format for these missing pieces and whether there is a supported way to preserve existing user passwords during the migration.
```

## 2. What We Can Already Migrate

The current export set is good enough to prepare import for:

- `profiles`
- `user_roles`
- `client_notes`
- `client_notifications`
- `measurements`
- `food_journal`
- `messages`
- `client_program_enrollments`
- `client_programs`
- `client_tasks`
- `program_templates`
- `program_messages`
- `program_tasks`
- `program_videos`
- `recipes`
- `recipe_categories`
- `finance_entries`
- `finance_categories`
- `finance_settings`
- `wellness_journal`
- `measurement_comments`
- `video_calls`
- `video_call_participants`
- `call_reminders`
- `call_notifications_sent`
- `call_transcript_history`
- `groups`
- `group_members`
- `email_invitations`
- `invite_tokens`
- `push_subscriptions`
- `api_usage`
- `ai_chat_messages`
- `user_activity`
- `reference_documents`
- `report_feedback`
- `report_instructions`

## 3. Recommended Import Order

When the missing pieces are recovered, import in this order:

1. Core account / identity-adjacent app data
- `profiles`
- `user_roles`
- `admin_notification_prefs`

2. Program structure
- `program_templates`
- `program_messages`
- `program_tasks`
- `program_videos`
- `program_forms`
- `program_documents`

3. Client enrollment / delivery
- `client_programs`
- `client_program_enrollments`
- `client_tasks`
- `client_video_progress`
- `client_notes`
- `client_notifications`
- `client_form_signatures`
- `policy_signatures`

4. Tracking / coaching data
- `measurements`
- `measurement_comments`
- `food_journal`
- `progress_photos`
- `wellness_journal`
- `weekly_check_ins`

5. Messaging / automation history
- `messages`
- `ai_chat_messages`
- `call_reminders`
- `call_notifications_sent`
- `call_transcript_history`
- `push_subscriptions`
- `recommendation_history`

6. Community / grouping
- `groups`
- `group_members`
- `group_posts`
- `group_comments`
- `group_post_likes`
- `client_categories`
- `client_category_assignments`

7. Finance
- `finance_categories`
- `finance_entries`
- `finance_settings`

8. Content / preference tables
- `recipe_categories`
- `recipes`
- `recipe_favorites`
- `saved_ai_prompts`
- `reference_documents`
- `report_feedback`
- `report_instructions`

## 4. Important Technical Notes

- The CSVs appear to be semicolon-delimited, not comma-delimited.
- Some exported media-related rows already reference the old Lovable storage host and will need URL/path rewriting after file upload.
- Storage migration is separate from table import. Upload the files first or very close to import time so path rewriting can be done accurately.
- Without `auth.users` and `auth.identities`, a smooth client login migration is not possible.

## 5. What Is Still Blocking Full Cutover

Full production cutover should wait until all of the following are available:

- missing auth export
- missing tables
- missing storage buckets/files
- target Supabase project secrets configured
- imported data verified
- client media URLs rewritten and tested
