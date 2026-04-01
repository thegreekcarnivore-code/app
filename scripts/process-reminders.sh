#!/bin/bash

# Script to process call reminders
# This should run every 5 minutes to check for pending reminders

cd /srv/thegreekcarnivore-app

# Source environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Set Supabase URL from production config
SUPABASE_URL="https://bowvosskzbtuxmrwatoj.supabase.co"

# Note: SUPABASE_SERVICE_ROLE_KEY should be set in the server environment
# This is sensitive and should not be stored in files
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "$(date): ERROR - SUPABASE_SERVICE_ROLE_KEY not set" >> /tmp/call-reminders.log
    exit 1
fi

# Call the Supabase Edge Function to process reminders
curl -X POST \
  "${SUPABASE_URL}/functions/v1/process-call-reminders" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  --max-time 30 \
  --silent \
  --show-error \
  >> /tmp/call-reminders.log 2>&1

# Add timestamp to log
echo "$(date): Processed call reminders" >> /tmp/call-reminders.log