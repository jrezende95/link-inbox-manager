# Google Sheets setup

Google Sheets is the suggested validation and audit surface. Link supports two paths.

## Connector-assisted validation

Use this when a coding agent can access Google Sheets and all replies remain unsent drafts.

1. Leave Google OAuth values blank.
2. Run validation to generate an ignored JSONL artifact under `artifacts/review/`.
3. Ask the agent to create or update a Sheet from that artifact.
4. Review the classifications and proposed replies in the Sheet's feedback column.
5. Ask the agent to read the feedback and revise the ignored private policy.

This path is supervised. The runtime cannot update the Sheet after the agent session ends.

## OAuth for unattended logging

Use this when the always-on service should append records without a coding agent present.

1. Create or choose a Google Cloud project.
2. Enable the Google Sheets API.
3. Configure the OAuth consent screen for personal use. Add your Google account as a test user if the app remains in testing.
4. Create an OAuth client with application type **Desktop app**.
5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the ignored `.env.local`.
6. With the user's explicit approval to access Google Sheets, run `npm run sheets:authorize`.
7. Complete Google's consent screen. Link saves only the refresh token to `.link/google-oauth.json` with owner-only permissions and does not print it.
8. Add `LINK_GOOGLE_SHEET_ID` and, optionally, `LINK_GOOGLE_SHEET_TAB` to `.env.local`.
9. Run `npm run doctor` and a supervised validation run.

The OAuth scope is limited to Google Sheets. The helper does not request Gmail, Drive file management, or profile scopes.

## Sheet columns

Link appends batch, conversation identifiers and URL, sender metadata, received time, inbound text, recent context, classification, confidence, rationale, proposed actions, proposed response, escalation state, and one blank owner-feedback column.

Do not make the Sheet public. It contains private inbox data.
