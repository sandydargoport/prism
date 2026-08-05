# Kroger online cart integration

Push your Prism shopping list straight into the online cart of any Kroger banner, for pickup, delivery, or in-store reference. One Kroger account works across every banner:

> Kroger · Mariano's · Ralphs · King Soopers · Fred Meyer · QFC · Smith's · Fry's · Harris Teeter · Pick 'n Save · Metro Market · Pay Less · Food 4 Less · Foods Co. · Bakers' Plus · City Market · Copps · Dillons · Gerbes · Jay C · Ruler Foods

The integration uses Kroger's public Developer API. It's free, has a 10,000-call/day quota (plenty for a family), and respects OAuth 2.0 user consent. Prism never sees your shopper password.

---

## What it does

- **Per-user OAuth**: each Prism family member who wants to push to Kroger connects their own shopper account in **Settings → Integrations → "Kroger / Mariano's cart"** card. Tokens are AES-256-GCM encrypted at rest with the existing `ENCRYPTION_KEY`.
- **SKU picker per item**: for each unchecked shopping item, Prism fetches up to 5 candidate products from Kroger and shows them in a picker with image, name, size, price, and a normalized unit price (lb / fl oz / ct) so candidates within a page are directly comparable.
- **SKU caching**: once you pick *"Mariano's 2% Reduced Fat Milk Gallon"* for the abstract item *"milk"*, that productId is remembered on the shopping item. Next time you push *"milk"*, the same SKU is pre-selected. One-tap weekly staples after the first trip.
- **Quantity controls**: bump the cart quantity per item (1-99) with +/- buttons; review-screen shows `× 2` next to multiples.
- **Search override**: every page has an editable search box so you can refine the term when the parser strips too much (or not enough).
- **Default-store picker**: set your preferred Mariano's (or any banner) by zip code. Subsequent searches use that store's location-aware pricing and stock.
- **Modifier-aware parsing**: recipe-derived items like *"1 Fresno pepper, seeded and sliced, or ½ teaspoon crushed red pepper flakes"* search Kroger for *"Fresno pepper"* (drops quantity, unit, comma modifiers, `" or "` alternatives, and parentheticals).

---

## One-time setup

You need to register a Kroger Developer application for your Prism deployment. Same reason your Google and Microsoft integrations require one: each install runs on its own domain, and Kroger requires the redirect URI to be exact-match-registered.

This takes about 5 minutes.

### 1. Create a Kroger developer account

- Go to **https://developer.kroger.com/**
- Click **Sign In** (top right). You can use your existing Kroger / Mariano's shopper account. Kroger creates a separate "developer" profile automatically.
- If you don't have a Kroger account at all, sign up. Free.

> **Heads up on the 403 trap:** the developer portal's session sometimes drops without telling you. If you hit `403 Forbidden` trying to create an app, sign out and back in (or use an incognito window). Ad blockers and Brave's strict mode can also break the portal. Disable them on `developer.kroger.com` if needed.

### 2. Register the application

- Manage → **Applications** → **Add Application** (https://developer.kroger.com/manage/apps).
- Fill in:
  - **Application Name**: anything. `Prism Family Dashboard` works.
  - **Environment**: **Production**. (Skip "Certification"; it has fake data.)
  - **Description**: anything. *"Personal family shopping list integration"* is fine.
  - **Website**: your Prism URL, `https://prism.example.com`.
- **Logo URL (optional)**: only the OAuth consent screen sees it, and only you / your family will see it. If you want a logo, use a public PNG URL. **Don't use a URL behind Cloudflare Access or any login gate**: Kroger's servers can't fetch it. The Prism repo icon works: `https://raw.githubusercontent.com/sandydargoport/prism/master/public/icons/icon-512.png`. Or leave blank.
- Save.

### 3. Configure the app

On the app's detail page:

**Redirect URIs (Authorized Redirect URIs)**. Paste exactly:

```
https://your-prism-host/api/auth/kroger/callback
```

Exact-match. No trailing slash, must be `https`. If you reach Prism from multiple hosts (e.g. a public WAN hostname and a LAN IP for inside the house) you can register both. Prism dynamically builds the redirect URI from each incoming request, so OAuth from LAN stays on LAN and WAN stays on WAN. Kroger accepts `http://192.168.x.x:3000/...` for LAN; some other OAuth providers don't.

**Scopes**. Check these three:

- `product.compact` (search products)
- `cart.basic:write` (write to the user's cart)
- `profile.compact` (identify which user is consenting, required by the OAuth flow even though no profile data is read)

Save. Kroger sometimes shows the app as "pending approval" for a few minutes after registration. If OAuth fails on the first try, wait ~5 min.

### 4. Copy your credentials

The app detail page shows a **Client ID** and a **Client Secret**. Click **Show** / **Reveal** to expose the secret. Kroger sometimes only shows it once, so copy it now.

### 5. Plug into Prism

In Prism:

1. **Settings → Integrations → "Kroger / Mariano's cart"** card (deep link `/settings?section=integrations#kroger`).
2. If credentials aren't configured yet, click **Enter Kroger credentials** and paste the Client ID + Client Secret. Prism encrypts them at rest.
3. Click **Connect Kroger**. You'll bounce to `kroger.com`, sign in with your **shopper account** (the one you actually shop with, different from the dev portal account if you used two different emails), and approve the requested scopes.
4. You land back at Prism with **Connected** status.
5. Click **Set store**, enter your zip code, and pick your home banner. Without this, searches use Kroger's default pricing. Items still go to your cart, just without location-aware prices in the picker.

You're done. Go to **Shopping**, add some items, and tap **Send to Kroger** in the header.

---

## Things to know

- **The Kroger consent prompt wants your *shopper* account, not your dev portal account**. They can be the same email or different. If you accidentally try to consent with the dev account you'll either fail or end up writing to the wrong cart.
- **Kroger rotates the Client Secret occasionally** when you edit an app's URI list or scopes. If OAuth starts failing after a config change, re-copy the Client Secret from the dev portal and re-paste into Prism's Kroger card.
- **No public AnyList-style webview**: Prism is a PWA, not a native app, so we can't embed Kroger's website inside our own UI. The flow is: pick SKUs in Prism → cart is updated server-side via the Cart API → you open the Kroger / Mariano's app or website to check out.
- **"No price" on every candidate** = no default store set (or store has no pricing data for that product). Set your store first.
- **OAuth state** is bound to your Prism user via Redis with a 10-minute TTL so the callback can't be hijacked or replayed.

---

## Privacy

- Stored on your Prism instance: encrypted access + refresh tokens, your preferred Kroger location id + display name, and a `kroger_product_id` cache on each shopping item. Nothing else.
- Sent to Kroger: only what you'd send by using their website yourself: product search terms, productIds for items you choose to add to your cart, and standard OAuth identity claims.
- Disconnect anytime from the same settings card. That wipes the encrypted tokens; Kroger's side can also be revoked at https://www.kroger.com/account/secure-preferences.

---

## Troubleshooting

| Symptom | Cause + fix |
|---|---|
| `403 Forbidden` on developer.kroger.com | Stale session. Sign out, incognito tab, sign back in. |
| `kroger_state_mismatch` after consent | Redis was flushed or 10 min elapsed between starting and finishing OAuth. Click Connect again. |
| `kroger_token_exchange_failed` | Most often: secret was rotated. Re-paste credentials. Less often: redirect URI mismatch. Check exact-match in the dev portal vs. the URL your browser hit. |
| Picker shows `no price` everywhere | Default store not set. Settings → Integrations → "Kroger / Mariano's card" → "Set store". |
| Picker can't find your item | Use the search box above the candidates to refine the term (e.g. shorten `"jumbo, raw, tail-on shrimp, peeled and deveined"` to `"shrimp"`). |
| "Too many items (max 200 per request)" | One shopping list has more than 200 unchecked items. Split it. |

---

## What's NOT supported (yet)

- The in-Kroger-app "shopping list" feature has no public API endpoint. The cart is what we write to; the in-app list is separate.
- Coupons / digital coupon application. Kroger has a Coupons API but Prism doesn't surface it.
- Order placement: Prism stops at "items in cart". You open the Kroger / Mariano's app or website to choose pickup time and check out.
