# Notifications

Assessment email delivery uses the server-only SendGrid adapter in
`src/server/assessments/email.js`. Credentials are read only during delivery
and are never serialized to clients.

Immediate delivery and the `npm run assessments:deliver-due` worker call the
same assessment delivery service. Delivery attempts contain only controlled
provider metadata and sanitized error codes/messages.
