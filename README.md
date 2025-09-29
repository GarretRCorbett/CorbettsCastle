<!-- README.md -->
# CorbettsCastle — Static Site

A tiny, static landing page for **Corbett’s Castle** hosted on **GitHub Pages**. No external assets, pure HTML/CSS/vanilla JS.

## Deploy (GitHub Pages)
1. Create a repo named `CorbettsCastle` (or your choice).
2. Add these files to the repo root (keep the `/assets` folder).
3. In **Settings → Pages**, select **Deploy from branch**, choose `main` and `/ (root)`.
4. (Optional) Add a custom domain: put your domain in `CNAME` and configure DNS.

## Editing links & content
- **Steam links**: Edit the `href="#"` placeholders in `index.html` (hero CTAs and the game card) to your Steam page(s).
- **Email**: Change `hello@corbettscastle.com` in `index.html` and `privacy.html`.
- **SEO/Open Graph**: Update meta tags in `index.html` and the `/assets/og-image.svg` artwork if you like.

## Accessibility & Reduced Motion
- The site includes a **Skip to content** link, keyboard-focus styles, AA contrast, and semantic HTML.
- Animations respect `prefers-reduced-motion`. Users can also toggle **Reduce Motion** in the footer; the setting persists in `localStorage`.

## Development notes
- System font stack only.
- All graphics are CSS/SVG; no images, fonts, or external libraries.
- Parallax and other motion effects are gated by motion preferences.

## Local preview
Just open `index.html` in a browser. No build tools required.
