# Testimonial Vault - Master Index

## Clients with Full Stories (Ready for Content)

| Client | Privacy | Key Result | Best Angle | Photos | Story | Video Priority |
|--------|---------|-----------|------------|--------|-------|---------------|
| **Emi** | PUBLIC | -25kg | Wedding transformation | Yes (Drive) | Yes (ebook + doc) | HIGH |
| **Flora** | PUBLIC | 107->100kg+ | Bikini after 4 years | Yes (3 files) | Yes (extensive chat) | HIGH |
| **Nikolas** | PUBLIC | Diabetes gone | Health reversal | Yes (2 files) | Yes (message) | HIGH |
| **Giorgos** | PUBLIC | Reflux gone, Hashimoto mgmt | Medical transformation | Yes (2 files) | Yes (notes) | MEDIUM |

## Clients with Photos Only (Need Story Extraction)

| Client | Privacy | Photos | Next Step |
|--------|---------|--------|-----------|
| **Eli** | PUBLIC | 2 files | Get story from Fathom/app data |

## Ebook Screenshot Testimonials (Pages 55-103)
The ebook "To Mystiko" contains ~48 pages of testimonial screenshots including:
- App screenshots from Everfit Coach showing client progress
- Before/after photos
- Survey results from clients
- Graph screenshots showing weight loss progress
- Client messages/reviews

**These are IMAGE-BASED** - text cannot be extracted from the .txt export.
To catalog them individually, the PDF pages need to be reviewed visually.

## Google Drive Photo Assets Inventory

### Named Client Photos
- `Image2_Emi.jpg` - Emi
- `Image3_Eli.jpg` - Eli
- `eli.jpeg` - Eli
- `Flora (3).png`, `Flora.jpg`, `Flora.png` - Flora (3 photos)
- `Giorgos_.jpeg`, `Giorgos.jpg` - Giorgos (2 photos)
- `Nikos.jpg`, `Nikolasp.png` (listed as Νικολας.png) - Nikolas

### Numbered/Generic Images (need identification)
- `Image1.jpg` through `Image10.jpg` - Unidentified clients
- `Image4_20250706_233010_0002.jpg` - Dated July 2025
- `Image5D7367C2-06A4-4CCE-9E8E-A283227F41AA.jpeg` - UUID-named
- `Copie de Day 3 Reviews_20250713_003008_0000 (2).jpg` - Day 3 review
- `Untitled design (10).png` - Canva design

### App Screenshots (Everfit Coach)
12 screenshots from the coaching app, dated Feb-Mar 2025:
- `Screenshot_20250212_163401_Everfit Coach.jpg`
- `Screenshot_20250213_153350_Everfit Coach.jpg`
- `Screenshot_20250213_153452_Everfit Coach.jpg`
- `Screenshot_20250214_220302_Everfit Coach.jpg`
- `Screenshot_20250218_210811_Everfit Coach.jpg`
- `Screenshot_20250219_102716_Everfit Coach.jpg`
- `Screenshot_20250225_103538_Everfit Coach.jpg`
- `Screenshot_20250226_001500_Everfit Coach.jpg`
- `Screenshot_20250227_151932_Everfit Coach.jpg`
- `Screenshot_20250302_164328_Everfit Coach.jpg`
- `Screenshot_20250305_083204_Everfit Coach.jpg`
- `Screenshot_20250309_143218_Everfit Coach.jpg`

## Untapped Sources

### Fathom Call Transcripts (Supabase)
- Full transcripts stored in `fathom_recordings.transcript_text`
- Participants matched to profiles via `fathom_recording_invitees`
- **PROBLEM**: Data is ingested but NEVER read or analyzed automatically
- **ACTION NEEDED**: Build a bridge to auto-analyze transcripts and flag testimonial moments

### App Client Data (Supabase)
- `client_notes` - Meeting notes, goals (category: meeting_note, goal, etc.)
- `measurements` - Body metrics over time
- `weekly_check_ins` - Weekly summaries and reports
- `messages` - Chat messages between coach and clients
- **ACTION NEEDED**: Query these tables to enrich existing client profiles and discover new testimonials

### Fathom Call Clips
- `fathom_recordings.share_url` contains links to full recordings
- `fathom_action_items.recording_playback_url` has timestamped links
- **POTENTIAL**: Use these URLs to find specific moments for video clips

## Content Creation Priority

### Tier 1 - Ready Now (have story + photos)
1. Emi - Wedding transformation (-25kg)
2. Flora - Bikini after 4 years
3. Nikolas - Diabetes reversal

### Tier 2 - Need More Content
4. Tasos - Medical transformation (need photos)
5. Eli - Have photos (need story)
6. Giorgos - Have photos (need story)

### Tier 3 - Hidden in Data (Need Extraction)
7-N. Unknown clients in ebook screenshots (pages 55-103)
8-N. Clients in Fathom call recordings (need transcript mining)
9-N. Clients with data in app but no testimonial yet
