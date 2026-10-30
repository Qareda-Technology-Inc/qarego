# Google Play store listing

Upload these in Play Console → **Grow users → Store presence → Main store listing → Graphics**.

| Play Console field | File | Size |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512, 32-bit PNG |
| Feature graphic | `feature-graphic-1024x500.png` | 1024 × 500, PNG without transparency |
| Phone screenshots | `phone/01.png` … `phone/07.png` | 1080 × 1920 (9:16) |
| 7-inch tablet screenshots | `tablet-7inch/01.png` … `03.png` | 1440 × 2560 (9:16) |
| 10-inch tablet screenshots | `tablet-10inch/01.png` … `03.png` | 2160 × 3840 (9:16) |

Upload the phone screenshots in number order: 01 customer home, 02 choose a ride, 03 live
tracking, 04 food, 05 cooking gas, 06 rider offer, 07 rider trip. The tablet set is home, ride and gas.

These use the same app screens and captions as the App Store set in `../ios/`, laid out at 9:16
so the listing is eligible for Play's promotional placements.

## Editing

`source/phone.html` draws every screenshot (`?n=1` … `?n=7` for phones, `?n=t1` … `?n=t3` for
tablets) and `source/feature.html` draws the feature graphic. `source/devices/` holds the phone and
iPad screens cut out of the iOS screenshots. To re-render (needs Google Chrome; run
`npm install` in `marketing/source` once):

```bash
node marketing/source/still.mjs "store-assets/android/source/phone.html?n=1" store-assets/android/phone/01.png 1080 1920
node marketing/source/still.mjs "store-assets/android/source/phone.html?n=t1" store-assets/android/tablet-7inch/01.png 1080 1920 1.3333333
node marketing/source/still.mjs "store-assets/android/source/phone.html?n=t1" store-assets/android/tablet-10inch/01.png 1080 1920 2
node marketing/source/still.mjs store-assets/android/source/feature.html store-assets/android/feature-graphic-1024x500.png 1024 500
```

Play rejects a feature graphic that has an alpha channel, and Chrome's PNGs always have one. After
re-rendering it, open it in Preview → File → Export and untick **Alpha**.
