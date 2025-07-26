# SecureDrive - Password-Protected Cloud Storage

A Google Drive-like application with password-based folder authentication built with Next.js and Cloudflare Workers.

## Features

- 🔐 Password-protected folders (no user accounts needed)
- 📤 Drag-and-drop file uploads
- 🖼️ Media preview (images & videos)
- 🌙 Beautiful dark mode UI
- 📱 Fully responsive design
- 🚀 Serverless architecture with Cloudflare Workers
- 💾 R2 storage for files
- ⚡ KV storage for metadata

## Setup Instructions

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Cloudflare KV namespace:
   ```bash
   wrangler kv:namespace create "FOLDERS_KV"
   ```

4. Create an R2 bucket:
   ```bash
   wrangler r2 bucket create secure-drive-files
   ```

5. Update `wrangler.toml` with your KV namespace ID and R2 bucket name

6. Set up environment variables in `wrangler.toml`:
   - `JWT_SECRET`: A secure random string

### Development

```bash
npm run dev
```

### Deployment

```bash
npm run build
wrangler deploy
```

## Architecture

- **Frontend**: Next.js with Tailwind CSS and shadcn/ui
- **Backend**: Cloudflare Workers
- **Storage**: R2 for files, KV for metadata
- **Authentication**: Password-based (bcrypt hashed)

## Usage

1. Create a folder with a password
2. Share the folder ID and password with others
3. Upload files via drag-and-drop
4. View media files directly in the browser
5. Download or delete files as needed

## Security Notes

- Passwords are hashed using bcrypt
- Each folder has its own unique password
- No user accounts or sessions stored
- Files are stored securely in R2

## License

MIT
