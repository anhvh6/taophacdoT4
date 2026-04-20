<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6e9cddcd-5c64-45f6-9e90-8b1cd0160851

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Auto Push + Deploy (Cursor Hook)

Project is configured with a Cursor `stop` hook at `.cursor/hooks.json`.

When an agent run finishes and there are git changes, hook will:

1. `git add -A`
2. auto commit
3. push current branch to `origin`
4. trigger 2 Vercel deploy hooks:
   - admin site: `taophacdot4.vercel.app`
   - client site: `phacdo4.vercel.app`

Current hook also supports direct Vercel CLI deployment for 2 projects:

- `taophacdot4`
- `phacdo4`

Optional:

- `VERCEL_SCOPE` (default: `anhvh6s-projects`)
