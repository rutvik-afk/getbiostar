# BioStar — Localhost thi Live Website sudhi

Aa file ma **badhu step-by-step** che: local par chalavvu, domain kharidvu,
hosting par mukvu, Google ma index karavvu, ane roj-ni-4-post (4 vaar/roj) automatic karvi.

---

## 0. Atyare local par chalavo

```bash
cd "bio-site"
npm run dev
```

Browser ma kholo: **http://localhost:4321**

Build test karvo hoy to:

```bash
npm run build && npm run preview
```

`dist/` folder j tamari aakhi website che — ene koi pan static host par mukhi shakay.

---

## 1. Domain kharidvu (₹700–₹1200/year)

Website name: **BioStar** → domain: **`getbiostar.com`** ✅ (WHOIS ma free confirm thayu)

### Kya thi kharidvu (recommended order)

| Registrar | Price (.com/yr) | Kem |
|---|---|---|
| **Cloudflare Registrar** | ~$10.44 (at-cost) | Sasto, koi renewal-price game nahi, WHOIS privacy free |
| **Namecheap** | ~$10–14 | Simple UI, privacy free |
| **GoDaddy** | ~$12–20 | Pehla varsh sasto, renewal maongho |

> ⚠️ Cloudflare Registrar par **navu** domain register kari shakay che, pan
> pehla Cloudflare account joye. Sauthi saral rasto: Namecheap thi kharido,
> pachi Cloudflare ma add karo (niche step 2).

### Steps (Namecheap)

1. https://www.namecheap.com par jao → search `getbiostar.com`
2. Available hoy to **Add to Cart** → **Checkout**
3. **Domain Privacy: ON** rakho (free che)
4. Auto-renew ON rakho — domain expire thay to ranking jaay
5. Payment karo (card / UPI chale che)

> **Kem `.com` j?** `.in` levu etle Google ene India-only ganse ane US/UK
> traffic band thai jashe — ane AdSense ma US traffic no rate 5–10 gano vadhare
> che. `.net` `.co` `.info` `.xyz` — trust ochho, AdSense approval ma pan adchan.
>
> Aa domain pan free che (backup tarike): `biostarhq.com` · `biostarhub.com` ·
> `celebnook.com` · `celebdossier.com` · `famenook.com`

---

## 2. Hosting (FREE — ₹0/month)

Aa site **static** che (badha HTML files pehla thi banela). Etle:
- Server chalavvano kharcho **zero**
- Speed extremely fast (SEO ne direct fayado)
- 3000 pages hoy to pan free plan ma aavi jaay

### Recommended: Cloudflare Pages

**Kem:** unlimited bandwidth free, global CDN, free SSL, India ma fast.

#### Step A — Code GitHub par mukо

> ✅ **git repo already banavelo che ane commit pan thai gayo che.** Tamare fakt
> GitHub par repo banavi ne push karvanu che.

GitHub.com par jai ne navu **private** repository banavo (naam: `getbiostar`).
**Important:** "Add a README" / "Add .gitignore" ni tick **na** karo — khaali repo joye.
Pachi:

```bash
git remote add origin https://github.com/TAMARU-USERNAME/getbiostar.git
git branch -M main
git push -u origin main
```

> **Note — repo size:** `public/img/` ma badha 3452 profiles ni images che (~228 MB).
> E jaan-bujhi ne repo ma rakhi che — etle roj ni publish vakhate Wikimedia par
> fari-fari download karvu na pade. **Deploy ma fakt live profiles ni images j
> jaay che** (`npm run build` apoaap prune kare che — atyare 6.7 MB).
> GitHub push pehli var 5-10 minute lai shake — e normal che.

#### Step B — Cloudflare Pages ma connect karo

1. https://dash.cloudflare.com → sign up (free)
2. Left menu → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. GitHub authorize karo → `getbiostar` repo select karo
4. Build settings:
   - **Framework preset:** `Astro`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** environment variable ma `NODE_VERSION` = `20`
5. **Save and Deploy** → 2-3 minute ma live thai jashe
   (temporary URL: `getbiostar.pages.dev`)

#### Step C — Tamaru domain jodo

1. Cloudflare dashboard → **Add a site** → `getbiostar.com` → Free plan
2. Cloudflare 2 nameservers aapse, jem ke:
   ```
   dana.ns.cloudflare.com
   rick.ns.cloudflare.com
   ```
3. Namecheap → Domain List → **Manage** → Nameservers → **Custom DNS**
   → upar na 2 nameservers paste karo → save
4. 5 minute – 24 kalak ma activate thashe (usually 15 min)
5. Cloudflare → **Workers & Pages** → `getbiostar` → **Custom domains**
   → **Set up a custom domain** → `getbiostar.com` add karo
   → pachi `www.biostar.com` pan add karo
6. SSL apoaap lagi jashe (green lock)

#### Step D — site.config.mjs ma domain badlo

```js
domain: 'https://getbiostar.com',   // ⬅️ aa ek line
```

Pachi:
```bash
git add -A && git commit -m "set live domain" && git push
```

### Vercel par deploy (jo Cloudflare na badle Vercel vaparvu hoy)

Step A (GitHub par push) upar mujab j karo — e badhu host mate common che.
Pachi:

1. https://vercel.com → **Sign up** (GitHub thi login karo — sauthi saral)
2. Dashboard → **Add New...** → **Project**
3. `getbiostar` repo **Import** karo
4. Vercel Astro ne **apoaap** olkhi jashe — "Framework Preset: Astro" pote j set thai jashe
5. Build settings ma kai badalvani jarur nathi (Build command: `npm run build`, Output: `dist` — pote j bharai jashe)
6. **Deploy** dabavo → 2-3 min ma live (`getbiostar.vercel.app`)

#### Domain jodvu (Vercel par)

1. Project → **Settings** → **Domains** → `getbiostar.com` lakho → **Add**
2. Vercel A-record / CNAME batavse, jem ke:
   ```
   A     @     76.76.21.21
   CNAME www   cname.vercel-dns.com
   ```
3. **Hostinger** (jya domain kharidelu che) → hPanel → **Domains** → `getbiostar.com`
   → **DNS / Nameservers** → **DNS Zone Editor** (Hostinger na j DNS rakho,
   nameservers badalvani jarur nathi) → upar na A ane CNAME records **Add** karo.
   Jo already koi A/CNAME record `@` ke `www` mate hoy to e pehla **delete** karo,
   pachi navo umero (be record ek j name mate na chale).
4. 15 min – 24 kalak wait → Vercel dashboard ma "Valid Configuration" ✅ dekhashe
5. SSL apoaap lagi jashe

> Cloudflare Pages ane Vercel banne free ane saras che — je pasand hoy e vaparo,
> DEPLOY steps (GitHub push, Search Console, indexing) baki badha same j rahe che.

### Alternative hosts (badha free, same kaam)

| Host | Build command | Output dir |
|---|---|---|
| **Netlify** | `npm run build` | `dist` |
| **GitHub Pages** | `npm run build` | `dist` (Actions joye) |

### ❌ Shu **nahi** joye
Shared cPanel hosting (Hostinger/Bluehost) aa site mate jaruri **nathi** —
paisa vede jashe ane speed pan ochi malse. Static hosting j best che.

---

## 3. Google ma index karavo (aa step sauthi important che)

### A. Google Search Console

1. https://search.google.com/search-console → **Add property** → **Domain** → `getbiostar.com`
2. Google ek **TXT record** aapse
3. Cloudflare → DNS → **Add record** → Type `TXT`, Name `@`, Content = Google no code → Save
4. Search Console ma **Verify** dabavo
5. Verify thaya pachi ek **meta verification code** pan mali sake — ene
   `site.config.mjs` ma `gscVerification` ma paste karo

### B. Sitemap submit karo

Search Console → **Sitemaps** → aa lakho ane submit karo:

```
sitemap-index.xml
```

Site ni sitemap apoaap bane che — 3000 pages hoy to pan.

### C. Bing pan karo (free traffic)

https://www.bing.com/webmasters → Search Console thi **import** kari lo (1 click)

### D. Pehla 20-30 page manually submit karo

Search Console → upar na **URL Inspection** box ma URL paste karo →
**Request Indexing**. Roj 8-10 URL kari shako — navi site ne
fast index karva no aa sauthi sara rasto che.

---

## 4. Roj ni 5 post — automatic

### Local Mac par (cron)

```bash
crontab -e
```

Aa line add karo (roj savare 9:00 vagye chale):

```
0 9 * * * cd "/Users/yuvrajgohil/Downloads/Bio website/bio-site" && ./scripts/daily.sh >> logs/cron.log 2>&1
```

> Mac band hoy to cron nahi chale. Etle **GitHub Actions** better che ⬇️

### GitHub Actions par (recommended — computer band hoy to pan chale)

File already banelo che: `.github/workflows/daily.yml`
Fakt GitHub par push karo, ane repo → **Actions** → enable karo. Bas.

Roj 03:30 UTC (= 9:00 AM IST) e:
1. Roj 4 vaar (6am, 12pm, 6pm, 11pm IST) — dareek vaar 1 navi post publish thashe
2. Badha live pages ni age recalculate thashe
3. Site rebuild thai ne deploy thashe

Manually chalavvu hoy to: repo → Actions → **Daily publish** → **Run workflow**

### Kitla divas chalse?

```bash
node scripts/05-publish-daily.mjs --dry
```

Aa batavse ke queue ma ketli post baki che ane 4/day e ketla divas chalse.

---

## 5. Paisa kamava (AdSense)

**Pehla aa karo, pachi apply karo:**

- [ ] Ochha ma ochha **30-50 published posts** hoy
- [ ] Site **1 mahino** juni hoy (Google ne aa game che)
- [ ] Thodo organic traffic aavto hoy
- [ ] Aa badha pages hoy — **already banela che** ✅
  - `/about/` · `/contact/` · `/privacy-policy/` · `/terms/`
  - `/disclaimer/` · `/dmca/` · `/editorial-policy/`

**Apply:** https://adsense.google.com → site add karo → approve thay pachi
`site.config.mjs` ma:

```js
adsenseClient: 'ca-pub-XXXXXXXXXXXXXXXX',
```

Analytics mate pan:
```js
gaMeasurementId: 'G-XXXXXXXXXX',
```

---

## 6. Roj-nu checklist (5 minute)

| Kaam | Kya |
|---|---|
| Impressions/clicks jovu | Search Console → Performance |
| Errors check karva | Search Console → Pages |
| Nava page index thaya? | Search Console → Sitemaps |
| Traffic jovu | Google Analytics |

---

## 7. Common problems

**Q: Build fail thay che**
```bash
rm -rf node_modules dist .astro && npm install && npm run build
```

**Q: Domain live nathi thatu**
Nameservers change thaya pachi 24 kalak sudhi wait karo.
Check: https://dnschecker.org

**Q: Google ma page nathi dekhata**
Navi site ne 2-8 week lage che. Roj URL Inspection thi 5-10 page submit karta raho.

**Q: Queue khatam thai gayo**
```bash
TARGET_LIMIT=10000 node scripts/01-build-targets.mjs
node scripts/02-fetch-facts.mjs
node scripts/03-generate-posts.mjs
```

**Q: Koi vyakti e potanu page hatavva kahyu**
```bash
rm content/published/<slug>.json
echo '<slug>' >> data/blocklist.txt
npm run build
```
