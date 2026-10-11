# Photos you add yourself

Drop a picture in here named after the profile's slug and the next run will
use it instead of the generated artwork. Nothing else to do.

    manual-photos/raj-arjun.jpg
    manual-photos/pradeep-ranganathan.png

The slug is the last part of the page's address, so
`www.getbiostar.com/raj-arjun/` is `raj-arjun`. `.jpg`, `.jpeg`, `.png`,
`.webp` and `.avif` all work.

**Shape:** the site crops every portrait to 600×800 (tall, 3:4) anchored to
the top of the frame, so a head-and-shoulders or full-length shot works and
a wide landscape photo will lose its sides. Anything 600px wide or more is
enough; bigger is fine.

**Replacing one:** overwrite the file. The run notices the change by size
and timestamp and re-crops it. Deleting the file goes back to generated art.

## Who gets the credit

Only add a photo the site is allowed to publish — one you took, one you own,
or one under a licence that permits commercial use. With no credit recorded
the page attributes the photo to the site itself, which is only true if that
is really the case.

To credit a source properly, add an entry to `data/manual-photos.json`:

```json
{
  "raj-arjun": {
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "author": "Photographer's name",
    "page": "https://example.com/where-it-came-from",
    "source": "https://example.com/the-image.jpg"
  }
}
```

Every field is optional; `license` and `author` are the two that show on the
page.

## Which profiles need one

These 11 live pages have no free photograph anywhere — not on Wikidata, not
as a Wikipedia lead image, not on Commons — so they ship generated artwork
until someone supplies a picture:

| slug | monthly searches |
|---|---|
| raj-arjun | 789,970 |
| pradeep-ranganathan | 589,170 |
| akeal-hosein | 307,710 |
| divya-bharti | 152,740 |
| milind-kumar | 148,210 |
| danish-taimoor | 100,130 |
| ayeza-khan | 78,260 |
| ravi-gupta | 74,400 |
| avesh-khan | 74,210 |
| gayathri-arun | 57,330 |
| salim-durani | 50,100 |

A further 628 profiles in the queue are in the same position. To see the
current list at any time:

```bash
node -e 'const fs=require("fs");for(const f of fs.readdirSync("content/published")){const p=JSON.parse(fs.readFileSync("content/published/"+f));if(p.image?.license==="Original artwork")console.log(p.slug,p.seo?.volume||0)}'
```
