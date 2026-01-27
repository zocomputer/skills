# Google API Reference Notes

## Token Lifetimes

| Token Type | Testing Mode | Production Mode |
|------------|--------------|-----------------|
| Access Token | 1 hour | 1 hour |
| Refresh Token | 7 days | 6 months (or until revoked) |

**Always publish your app to Production mode** before doing the final authorization.

## Scopes Included

- `calendar` - Full calendar access
- `calendar.events` - Create/modify events
- `gmail.readonly` - Read emails
- `gmail.send` - Send emails
- `gmail.modify` - Modify emails (labels, archive, etc.)

## Common API Examples

### Calendar

```python
from google_auth import get_calendar_service
from datetime import datetime, timezone

service = get_calendar_service()

# List upcoming events
events = service.events().list(
    calendarId='primary',
    maxResults=10,
    singleEvents=True,
    orderBy='startTime',
    timeMin=datetime.now(timezone.utc).isoformat()
).execute()

for event in events.get('items', []):
    print(event['summary'], event['start'])

# Create an event
event = service.events().insert(calendarId='primary', body={
    'summary': 'Meeting',
    'start': {'dateTime': '2024-01-15T10:00:00', 'timeZone': 'America/New_York'},
    'end': {'dateTime': '2024-01-15T11:00:00', 'timeZone': 'America/New_York'},
}).execute()

# Quick add (natural language)
service.events().quickAdd(calendarId='primary', text='Coffee tomorrow 3pm').execute()
```

### Gmail

```python
from google_auth import get_gmail_service
import base64
from email.mime.text import MIMEText

gmail = get_gmail_service()

# List recent messages
results = gmail.users().messages().list(userId='me', maxResults=10).execute()
messages = results.get('messages', [])

# Read a message
msg = gmail.users().messages().get(userId='me', id=messages[0]['id']).execute()
print(msg['snippet'])

# Send an email
message = MIMEText('Hello!')
message['to'] = 'someone@example.com'
message['subject'] = 'Test'
raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
gmail.users().messages().send(userId='me', body={'raw': raw}).execute()
```

## Troubleshooting

### "Access blocked" error
- Add yourself as a test user in OAuth consent screen
- Or publish the app to Production mode

### "Invalid redirect URI"
- The redirect URI in GCP must exactly match what the OAuth server uses
- Check for trailing slashes, http vs https

### Refresh token missing
- Make sure `access_type=offline` and `prompt=consent` are in the auth URL
- Re-authorize if needed

### Token expires in 7 days
- Your app is in Testing mode
- Go to OAuth consent screen → Publish App
