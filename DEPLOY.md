# Deploy on Render

Create a Node Web Service from branch `codex/gemini-elevenlabs`.
Leave Root Directory empty, choose the Free instance, and set:

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check path: `/healthz`

Use Node.js 24. The production server listens on `0.0.0.0` and Render's `PORT`.
It serves the built `dist` directory and the same AI endpoints used locally.

In Render's Environment settings, add the credentials and model/voice settings
from your local `.env`. The server reads these from its environment; do not
upload `.env` to GitHub. `/api/status` reports whether credentials are configured,
not whether the external providers accept them. Test a battle and narration to
verify provider access after deployment.

After deployment works on the Render URL, add your domain in Settings > Custom
Domains and copy the supplied DNS records into GoDaddy's domain DNS settings.

Free services sleep when idle. The on-disk narration cache is temporary and is
lost on restarts/redeploys. Gemini and ElevenLabs quotas are separate from hosting.
