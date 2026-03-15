

## Plan: Remove Personal Messages from Bell Notifications

### Problem
The screenshot shows "sent you a message" notifications appearing in the admin's bell icon. These are redundant since the Message icon already shows unread message counts.

### Root Cause
The `notify_admin_on_client_message` trigger function inserts a `new_message` row into `client_notifications` every time a client sends a message. This creates bell notifications for something already handled by the chat unread system.

### Fix (two-part)

**1. Database: Drop the trigger** that creates bell notifications for client messages.

```sql
DROP TRIGGER IF EXISTS on_client_message_notify_admin ON public.messages;
```

The function can remain (harmless), but the trigger that fires it will be removed.

**2. Database: Clean up existing `new_message` bell entries**

```sql
DELETE FROM public.client_notifications WHERE type = 'new_message';
```

**3. Frontend safeguard**: In `NotificationBell.tsx`, filter out any `new_message` type from the displayed list so even if stale data exists, it won't show.

```tsx
const filtered = notifications.filter(n => n.type !== 'new_message');
```

### Result
- Bell icon shows only actionable notifications (tasks, measurements, photos, compliance alerts)
- Personal messages remain exclusively in the Message icon with unread counts
- No code changes needed beyond one filter line and the migration

