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
  gscVerification: '',
  gaMeasurementId: 'G-B27N3MEH80',
  adsenseClient: '', // ex: 'ca-pub-XXXXXXXXXXXXXXXX'
  postsPerDay: 4,
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
