# Questionnaires

The public DSMA-8 form is rendered from the immutable questionnaire definition
stored by the Task 03 seed. Question text, answer options, score bounds, and
risk-band boundaries are not duplicated in the UI or submission service.

An emailed raw token is hashed and exchanged server-side for a short-lived,
signed `HttpOnly` assessment-access cookie. Submission validates all eight
answers against the stored item and option sets. Completion conditionally
consumes a still-sent, unused, unexpired assessment and creates its response and
audit record in the same transaction.
