# Testimonial Vault - The Greek Carnivore

Central hub for all client testimonial content. Used for video creation, email campaigns, and website content.

## Sources
1. **Google Doc "Client Stories"** - Detailed client notes (Nikolas, Tasos, Flora, Emi)
2. **Ebook "To Mystiko"** - Published stories + screenshot testimonials (pages 55-103)
3. **Google Drive "Dossier"** - Before/after photos, app screenshots, transformation images
4. **Fathom Call Transcripts** - Stored in Supabase `fathom_recordings` table (NOT yet connected to analysis pipeline)
5. **App Data (Supabase)** - client_notes, measurements, weekly_check_ins, messages

## Privacy Legend
- **PUBLIC** = Face + full name OK
- **FIRST_NAME** = First name only, face OK
- **ANONYMOUS** = No name, no face (or face hidden)

## Content Status Tags
- `unused` - Not yet used in any content
- `video` - Used in a testimonial video
- `email` - Used in an email campaign
- `website` - Used on the website
- `ebook` - Already in the ebook

## How to Use
- Each client has their own file in `clients/`
- `vault-index.md` has the master overview of all clients and assets
- When creating content, update the status tags in the client file
