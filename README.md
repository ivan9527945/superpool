# Claude

A minimal web interface for chatting with **Claude**, a next-generation AI assistant built by [Anthropic](https://www.anthropic.com) to be helpful, honest, and harmless.

**Live: https://superpool-production.up.railway.app**

Open the page, click the composer, and start a new chat.

---

## Features

- **New chat** — clean, distraction-free composer. Just start typing.
- **Skills** — type `/` to pull up skills for coding, writing, learning, and everyday tasks.
- **Model picker** — switch models and reasoning effort inline (defaults to Opus 4.8, High).
- **Voice & dictation** — mic and waveform input for hands-free prompting.
- **Installable** — add to your home screen as a PWA for a full-screen, app-like experience.

---

## Stack

Next.js 15 (App Router) · React · TypeScript · PWA.

```bash
npm install
npm run dev        # dev server on localhost:3000
npm run build      # production build (typecheck runs inside it)
npm start          # serve the production build
```

---

## Deploy

Deployed on [Railway](https://railway.app). Pushing to `main` and running `railway up` ships a new build.

---

*Built with Claude Code.*
