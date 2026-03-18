# Lovable Export Audit

Audit date: 2026-03-17

Source folders reviewed:

- `/Users/alexandrosadamantiadis/Downloads/database Supabase Thegreekcarnivore Recuperate from Lovable`
- `/Users/alexandrosadamantiadis/Downloads/Storage`

## Summary

The downloaded files are enough to recover a large part of the coaching app's business data:

- client profiles
- measurements
- food journal entries
- notes
- messages
- enrollments
- program templates/content
- finance records
- invites
- wellness journal entries

They are **not enough yet for a smooth full migration** out of Lovable by themselves.

The main blockers are:

- no `auth.users` / `auth.identities` export
- no password-hash-preserving auth export
- several app tables are missing from the database export
- most storage buckets/files are missing
- several exported file URLs still point to the old Lovable Cloud storage host

## Database CSVs Present

- `admin_notification_prefs`
- `admin_tasks`
- `ai_chat_messages`
- `api_usage`
- `call_notifications_sent`
- `call_reminders`
- `call_transcript_history`
- `client_categories`
- `client_category_assignments`
- `client_notes`
- `client_notifications`
- `client_program_enrollments`
- `client_programs`
- `client_tasks`
- `client_video_progress`
- `email_invitations`
- `finance_categories`
- `finance_entries`
- `finance_settings`
- `food_journal`
- `group_members`
- `groups`
- `invite_tokens`
- `measurement_comments`
- `measurements`
- `messages`
- `policy_signatures`
- `profiles`
- `program_messages`
- `program_tasks`
- `program_templates`
- `program_videos`
- `progress_photos`
- `push_subscriptions`
- `recipe_categories`
- `recipes`
- `recommendation_history`
- `reference_documents`
- `report_feedback`
- `report_instructions`
- `user_activity`
- `user_roles`
- `video_call_participants`
- `video_calls`
- `video_modules`
- `wellness_journal`

## Database Tables Still Missing

These tables are referenced by the app codebase but were not found in the CSV export:

- `client_form_signatures`
- `group_comments`
- `group_post_likes`
- `group_posts`
- `program_documents`
- `program_forms`
- `recipe_favorites`
- `saved_ai_prompts`
- `weekly_check_ins`

## Auth Data Still Missing

Critical auth exports were not included:

- `auth.users`
- `auth.identities`
- any password-hash-preserving auth dump

Without these, existing client accounts cannot be migrated cleanly with their current passwords.
If we migrate using only the available CSVs, clients would likely need account recreation or password resets.

## Storage Files Present

The reviewed storage downloads currently include:

- one avatar file archive
- partial `recipe-images`/cover image archives

Detected zip files:

- `Covers bucket-recipe-images-files.zip`
- `avatar.jpeg.zip`
- `learn-covers bucket-recipe-images-files (1).zip`
- `recipes bucket-recipe-images-files (2).zip`

## Storage Buckets Still Missing

The app expects these buckets/files, but corresponding exports were not found in the downloaded storage folder:

- `chat-audio`
- `email-assets`
- `finance-receipts`
- `food-photos`
- `group-media`
- `program-documents`
- `progress-photos`
- `signatures`

## Important URL Migration Issue

Some exported rows still reference the old Lovable Cloud storage host directly.

Example:

- `progress_photos.photo_url` points to:
  - `https://lglgmhzgxyvyftdhvdsy.supabase.co/storage/v1/object/public/progress-photos/...`

This means that even after importing rows into a new Supabase project, the media links will stay broken until:

1. the actual files are uploaded into the new storage buckets
2. the URL/path fields are rewritten to the new project domain or bucket paths

## What Can Be Recovered From These Files

With the current export set, we can recover most coaching/business records:

- client profiles and preferences
- coach/client messages
- measurements and wellness tracking
- food journal entries
- notes
- program assignments
- tasks
- finance rows
- category/group membership basics
- recipes and recipe categories
- invitations and roles

## What Is Still Needed Before Safe Cutover

To perform a smooth transition out of Lovable, we still need:

1. Auth export with users and password hashes
2. Missing database tables listed above
3. Missing storage bucket files listed above
4. Confirmation of any missing live bucket policies / auth settings / function secrets
5. Import credentials for the target Supabase project so the recovered data can actually be loaded

## Practical Verdict

Current export quality:

- good enough for **partial data recovery**
- not enough for **smooth full production migration**

The current download is a strong start, but it is still missing the exact pieces that make migration seamless:

- auth continuity
- uploaded files continuity
- some live app tables continuity
