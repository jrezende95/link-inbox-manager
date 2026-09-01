# Start Here

This project is intentionally set up through a coding agent rather than a fixed terminal questionnaire.

## What you need

- A Mac you can leave running for the scheduled service
- A personal LinkedIn account you are willing to connect through a dedicated local Chrome profile
- Node.js 22 or newer
- A capable coding agent with local file, terminal, and browser-automation support
- An API key from OpenAI, Anthropic, or Google Gemini
- Google Sheets access through either your agent's connector or Google OAuth
- Approximately 50–85 minutes for the interview and technical setup, plus validation review time

## Start the setup

Open this repository with your coding agent and say:

> Review this repository and help me set up Link.

The agent should first explain what Link will do, what stays local, what external providers receive, what must remain running, and what risks you accept. It should ask for confirmation before beginning the interview.

The interview is conversational. Voice dictation is encouraged. The agent will report a completion percentage after every section and save progress under `.link/onboarding.json`.

## Approval gates

Your agent must pause before:

1. Connecting the dedicated Chrome profile to LinkedIn
2. Creating or accessing the validation Sheet
3. Beginning any historical inbox scan
4. Enabling mark-read actions
5. Enabling live replies
6. Installing the always-on background service

Validation uses your real inbox because Link is not a demo product. No live reply may be sent until you explicitly approve launch.
