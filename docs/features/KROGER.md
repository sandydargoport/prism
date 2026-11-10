# Grocery cart

Send your shopping list to your online cart at Kroger or any of its stores, such as Mariano's or Ralphs.

Use the cart for pickup or delivery, or as a list while you walk round the store. One Kroger account works at every store in the group:

> Kroger · Mariano's · Ralphs · King Soopers · Fred Meyer · QFC · Smith's · Fry's · Harris Teeter · Pick 'n Save · Metro Market · Pay Less · Food 4 Less · Foods Co. · Bakers' Plus · City Market · Copps · Dillons · Gerbes · Jay C · Ruler Foods

Prism uses Kroger's free public API. You sign in on Kroger's own page, so Prism never sees your password.

## Set it up

### One-time setup

You need to register a Kroger Developer application for your Prism install, for the same reason the Google and Microsoft integrations need one: each install runs on its own domain, and Kroger only accepts a redirect URI (the address it sends you back to after sign-in) that exactly matches one you registered.

It takes about 5 minutes.

#### 1. Create a Kroger developer account

- Go to **https://developer.kroger.com/**
- Click **Sign In** (top right). You can use the Kroger or Mariano's account you already shop with, and Kroger makes a separate developer profile for you.
- If you have no Kroger account at all, sign up for a free one.

> **Heads up on the 403 trap:** the developer portal sometimes drops your session without saying so. If you get `403 Forbidden` when creating an app, sign out and back in, or use a private window. Ad blockers and Brave's strict mode can also break the portal, so turn them off for `developer.kroger.com` if you need to.

#### 2. Register the application

- Go to Manage → **Applications** → **Add Application** (https://developer.kroger.com/manage/apps).
- Fill in:
  - **Application Name**: anything you like. `Prism Family Dashboard` works.
  - **Environment**: **Production**. (Skip "Certification", which has fake data.)
  - **Description**: anything. *"Personal family shopping list integration"* is fine.
  - **Website**: your Prism URL, such as `https://prism.example.com`.
- **Logo URL (optional)**: it appears only on the sign-in consent screen, which only you and your family will see. If you want a logo, use a public PNG URL. **Don't use a URL behind Cloudflare Access or any other login**, because Kroger's servers can't fetch it. The Prism repo icon works: `https://raw.githubusercontent.com/sandydargoport/prism/master/public/icons/icon-512.png`. You can also leave it blank.
- Save.

#### 3. Configure the app

On the app's detail page:

**Redirect URIs (Authorized Redirect URIs)**. Paste exactly:

```
https://your-prism-host/api/auth/kroger/callback
```

It must match exactly, with no trailing slash, and must use `https`. If you reach Prism at more than one address (a public hostname from outside and a LAN IP at home, for example), register both. Prism builds the redirect URI from each request, so a sign-in started on the LAN stays on the LAN and one started from outside stays outside. Kroger accepts `http://192.168.x.x:3000/...` for the LAN, which some other sign-in providers don't.

**Scopes**. Tick these three:

- `product.compact` (search products)
- `cart.basic:write` (write to the user's cart)
- `profile.compact` (tells Kroger which user is giving consent; the sign-in needs it, though Prism reads no profile data)

Save. For a few minutes after you register, Kroger sometimes shows the app as "pending approval". If sign-in fails the first time, wait about 5 minutes.

#### 4. Copy your credentials

The app's detail page shows a **Client ID** and a **Client Secret**. Click **Show** or **Reveal** to see the secret. Kroger sometimes shows it only once, so copy it now.

#### 5. Plug into Prism

In Prism:

1. Open the **Settings → Integrations → "Kroger / Mariano's cart"** card (direct link `/settings?section=integrations#kroger`).
2. If no credentials are set yet, click **Enter Kroger credentials** and paste the Client ID and Client Secret. Prism stores them encrypted.
3. Click **Connect Kroger**. You go to `kroger.com`, sign in with your **shopper account** (the one you really shop with, which may differ from the developer account if you used two emails) and approve the requested scopes.
4. You come back to Prism with the status **Connected**.
5. Click **Set store**, enter your zip code and pick your usual store. Without a store, searches use Kroger's default prices. Items still go to your cart, but the picker won't show your store's prices.

Setup is finished, so go to **Shopping**, add some items and tap **Send to Kroger** in the header.

## Use it

### What it does

- **Per-user OAuth**: each family member who wants to send items to Kroger connects their own shopper account on the **Settings → Integrations → "Kroger / Mariano's cart"** card. Their tokens are stored encrypted with AES-256-GCM, using the existing `ENCRYPTION_KEY`.
- **SKU picker per item**: for each unchecked shopping item, Prism fetches up to 5 matching products from Kroger and shows them with image, name, size, price and a unit price in the same unit (lb, fl oz or ct), so you can compare the products on a page directly.
- **SKU caching**: once you pick *"Mariano's 2% Reduced Fat Milk Gallon"* for the item *"milk"*, Prism remembers that productId on the shopping item. The next time you send *"milk"*, the same product is already selected, so after the first trip your weekly staples take one tap.
- **Quantity controls**: set how many of each item go in the cart (1 to 99) with the +/- buttons. The review screen shows `× 2` next to anything with more than one.
- **Search override**: every page has a search box you can edit, for when Prism trims the search term too much or too little.
- **Default-store picker**: choose your usual Mariano's (or any other store in the group) by zip code. Later searches use that store's prices and stock.
- **Modifier-aware parsing**: an item from a recipe such as *"1 Fresno pepper, seeded and sliced, or ½ teaspoon crushed red pepper flakes"* searches Kroger for *"Fresno pepper"*. Prism drops the quantity, the unit, anything after a comma, `" or "` alternatives and anything in brackets.

### Things to know

- **The Kroger consent prompt needs your shopper account.** Your developer portal account is a separate login, though both can use the same email. If you try to give consent with the developer account, it will either fail or write to the wrong cart.
- **Kroger sometimes changes the Client Secret** when you edit an app's redirect URIs or scopes. If sign-in starts failing after a change like that, copy the Client Secret from the developer portal again and paste it into Prism's Kroger card.
- **No public AnyList-style webview**: Prism is a PWA (a web app you install from the browser), so it can't show Kroger's website inside its own screens. You pick products in Prism, Prism's server updates your cart through Kroger's Cart API, and then you open the Kroger or Mariano's app or website to check out.
- **"No price" on every product** means no default store is set, or the store has no price for that product. Set your store first.
- **OAuth state** (the token that links a sign-in to the person who started it) is tied to your Prism user in Redis and expires after 10 minutes, so nobody can take over or replay the callback.

## Details

### Privacy

- Your Prism instance stores your encrypted access and refresh tokens, your chosen Kroger store's id and name, and a `kroger_product_id` on each shopping item. It stores nothing else.
- Prism sends Kroger only what you would send by using their website yourself: product search terms, the productIds of items you add to your cart, and the standard OAuth identity details.
- You can disconnect at any time from the same settings card, which deletes the encrypted tokens. You can also revoke access on Kroger's side at https://www.kroger.com/account/secure-preferences.

### Troubleshooting

| Symptom | Cause + fix |
|---|---|
| `403 Forbidden` on developer.kroger.com | Your session went stale. Sign out, open a private window and sign back in. |
| `kroger_state_mismatch` after consent | Redis was cleared, or more than 10 minutes passed between starting and finishing sign-in. Click Connect again. |
| `kroger_token_exchange_failed` | Usually the secret changed, so paste the credentials again. Less often the redirect URI doesn't match: compare the one in the developer portal with the URL your browser went to. |
| Picker shows `no price` everywhere | No default store is set. Go to Settings → Integrations → "Kroger / Mariano's card" → "Set store". |
| Picker can't find your item | Use the search box above the products to change the term (for example shorten `"jumbo, raw, tail-on shrimp, peeled and deveined"` to `"shrimp"`). |
| "Too many items (max 200 per request)" | A shopping list has more than 200 unchecked items. Split it into two lists. |

### What's NOT supported (yet)

- The "shopping list" inside the Kroger app has no public API. Prism writes to the cart, which is separate from that list.
- Coupons, including digital coupons. Kroger has a Coupons API, but Prism doesn't use it.
- Placing the order. Prism stops once the items are in your cart, and you open the Kroger or Mariano's app or website to choose a pickup time and check out.
