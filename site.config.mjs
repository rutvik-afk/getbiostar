/* ============================================================
   ONE FILE TO REBRAND THE WHOLE SITE.
   Domain kharidyaa pachi fakt `domain` badlo — bijoo badhu auto.
   ============================================================ */
export const SITE = {
  name: 'BioStar',
  tagline: 'Verified Celebrity Biographies, Ages & Career Facts',
  // ⬇️ domain buy karya pachi aa ek line badlo
  // Must match the host the site actually serves on — the apex 308-redirects
  // to www, so canonicals/sitemap/JSON-LD have to say www or every URL Google
  // sees is a redirect hop.
  domain: 'https://www.getbiostar.com',
  locale: 'en_US',
  lang: 'en',
  twitter: '@getbiostar',
  publisherLogo: '/brand/logo.png',
  email: 'getbiostar@gmail.com',
  // Google Search Console / Analytics — mali jaay pachi bharo
  gscVerification: 'yoiQRCSfjJbtwTDJt-kOmdvkpi96d8x7burL_VDrjy0',
  gaMeasurementId: 'G-B27N3MEH80',
  adsenseClient: '', // ex: 'ca-pub-XXXXXXXXXXXXXXXX'
  /* Cut to 3 on 5 Oct on the theory that 54 pages sitting in "Discovered
     – currently not indexed" meant Google could not keep up. The GSC
     export that arrived the same afternoon showed the theory had no
     evidence behind it: across the 4/day period (13–26 Sept) CTR was
     0.136% at position 9.3, and across the 8/day period (27 Sept–3 Oct)
     it was 0.176% at position 8.5. Indexed pages rose 166 to 174 during
     the same window. The impressions collapse everyone was worried about
     ran 23 Aug to 13 Sept — 12,597/day to 1,560 — which is Google's
     August core update, finished six days before the rate ever changed,
     and impressions have been recovering since. Settled at 5 — the
     evidence clears 8, and 5 keeps some headroom while the crawl
     backlog works through. */
  postsPerDay: 5,
  perPage: 24,
  description:
    'Fact-checked celebrity biographies: age, height, birthplace, family, education, career timeline and awards — sourced from open public records.',
};

/* Footer contact + social.
   Leave a value EMPTY and that row/icon simply doesn't render —
   nothing fake ever ships. Fill these in once the accounts exist. */
export const CONTACT = {
  email: 'getbiostar@gmail.com',
  phone: '',            // e.g. '+91 98765 43210'
  mobile: '',
  address: '',          // e.g. 'Ahmedabad, Gujarat, India'
  website: 'getbiostar.com',
};

export const SOCIAL = {
  facebook:  '',        // full URL, e.g. 'https://facebook.com/getbiostar'
  x:         '',
  instagram: '',
  pinterest: 'https://www.pinterest.com/getbiostar/',
  youtube:   '',
};

export const NAV = [
  { label: 'Actors', href: '/category/actor/' },
  { label: 'Musicians', href: '/category/musician/' },
  { label: 'Athletes', href: '/category/athlete/' },
  { label: 'Politics', href: '/category/politics/' },
  { label: 'Creators', href: '/category/creator/' },
  { label: 'A–Z', href: '/celebrities/' },
];
