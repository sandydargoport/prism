# Home Assistant

Run Prism as a Home Assistant add-on, show it in the sidebar, or use Prism's data in your automations.

[Install](getting-started/install.md) covers the add-on. Below are the other two:

1. Show Prism in the Home Assistant sidebar as a Webpage dashboard.
2. Use Prism's data in Home Assistant sensors, through its REST API.

---

## 1. Showing Prism in the HA sidebar

Home Assistant can show any web page as a sidebar entry. Prism only lets a site show it inside a frame if that site is on its allowlist, so this takes two steps.

### Allow Home Assistant to show Prism

Add the address you open Home Assistant at, exactly as the browser shows it (scheme, host and port):

- **Home Assistant add-on:** *Settings → Add-ons → Prism → Configuration*, set **allowed_frame_ancestors** to your Home Assistant address (for example `http://homeassistant.local:8123`), save, and restart the add-on.
- **Docker:** set `ALLOWED_FRAME_ANCESTORS` in your `.env`, then `docker compose up -d app`:

```env
ALLOWED_FRAME_ANCESTORS=http://homeassistant.local:8123
```

If you reach Home Assistant at more than one address, list them all, separated by commas:

```env
ALLOWED_FRAME_ANCESTORS=http://homeassistant.local:8123, https://ha.example.com
```

### Add the sidebar entry

In Home Assistant: *Settings → Dashboards → Add dashboard → Webpage*. Give it a title and icon, and set the URL to Prism's address, for example `http://homeassistant.local:3000`. To open one particular dashboard, use its own address, such as `http://homeassistant.local:3000/d/kitchen`. Leave **Show in sidebar** on.

Older guides use `panel_iframe` in `configuration.yaml`. Home Assistant replaced it with Webpage dashboards in 2024.4.

### Limits

- You can't mix https and http. If you open Home Assistant over `https://` (through Nabu Casa or a reverse proxy, for example), the browser won't show a plain `http://` Prism inside it, so Prism needs an `https://` address too.
- The sidebar entry gives you no remote access. Your browser loads the page from Prism's own address, so it only works where that address can be reached, usually on your home network.
- Wall displays should open Prism at its own address and skip Home Assistant, so the on-screen keyboard, screensaver and full-screen mode work as usual.

---

## 2. Creating an API Token

An API token lets Home Assistant call Prism's REST API without logging in with a PIN.

1. Open Prism Settings (gear icon)
2. Go to **Security**
3. Under **API Tokens**, enter a name (e.g. "Home Assistant")
4. Choose a **scope**: **Voice API only** (the default, and the one to pick; it covers the Voice API and the read-only REST sensors below) or **Full access (legacy)** if you also need to call write endpoints directly
5. Click **Generate Token**
6. Copy the token straight away, because Prism shows it only once
7. Store it in your HA `secrets.yaml`:

```yaml
# secrets.yaml
prism_token: "paste-your-64-char-token-here"
```

### Token scopes

Each token has the **scope** you chose when you generated it:

- **Voice API only** (default, recommended): reaches the Voice API (`/api/v1/voice/*`) and the read-only REST sensors in Section 3. Most HA setups need nothing more.
- **Full access (legacy)**: every endpoint, including writes and admin routes. Pick this only if an automation calls a write endpoint directly instead of going through the Voice API.

The read sensors below (calendar, chores, shopping, meals) work with a **Voice API only** token, since they only make read-only GET requests. Write actions, such as adding a shopping item or completing a chore, go through the Voice API endpoints (see Section 5), which a voice-scoped token can also reach.

- Tokens never expire, and you can revoke one from Settings at any time.
- Each request updates the token's "Last used" time.

---

## 3. REST Sensor Examples

HA's [REST sensor](https://www.home-assistant.io/integrations/rest/) can read data from Prism.

### Upcoming calendar events

```yaml
sensor:
  - platform: rest
    name: "Prism Next Event"
    resource: "http://prism.local:3000/api/events?limit=1"
    headers:
      Authorization: !secret prism_bearer
    value_template: "{{ value_json.events[0].title if value_json.events else 'None' }}"
    json_attributes_path: "$.events[0]"
    json_attributes:
      - startTime
      - endTime
      - location
    scan_interval: 300
```

In `secrets.yaml`:
```yaml
prism_bearer: "Bearer paste-your-64-char-token-here"
```

### Pending chores count

```yaml
sensor:
  - platform: rest
    name: "Prism Pending Chores"
    resource: "http://prism.local:3000/api/chores"
    headers:
      Authorization: !secret prism_bearer
    value_template: >
      {{ value_json.chores | selectattr('enabled', 'true') | list | length }}
    scan_interval: 600
```

### Shopping list item count

{% raw %}
```yaml
sensor:
  - platform: rest
    name: "Prism Shopping Items"
    resource: "http://prism.local:3000/api/shopping-lists?includeItems=true"
    headers:
      Authorization: !secret prism_bearer
    value_template: >
      {% set total = 0 %}
      {% for list in value_json.lists %}
        {% set total = total + (list.items | rejectattr('checked', 'true') | list | length) %}
      {% endfor %}
      {{ total }}
    scan_interval: 600
```
{% endraw %}

### Today's meals

{% raw %}
```yaml
sensor:
  - platform: rest
    name: "Prism Dinner Tonight"
    resource: "http://prism.local:3000/api/meals?weekOf={{ now().strftime('%Y-%m-%d') }}"
    headers:
      Authorization: !secret prism_bearer
    value_template: >
      {% set today = now().strftime('%A') | lower %}
      {% set dinner = value_json.meals | selectattr('dayOfWeek', 'equalto', today) | selectattr('mealType', 'equalto', 'dinner') | list %}
      {{ dinner[0].name if dinner else 'Not planned' }}
    scan_interval: 3600
```
{% endraw %}

---

## 4. Automation Examples

### Announce dinner on smart speaker

```yaml
automation:
  - alias: "Announce tonight's dinner at 4pm"
    trigger:
      - platform: time
        at: "16:00:00"
    action:
      - service: tts.speak
        target:
          entity_id: media_player.kitchen_speaker
        data:
          message: >
            Tonight's dinner is {{ states('sensor.prism_dinner_tonight') }}.
```

### Notify when shopping list grows

```yaml
automation:
  - alias: "Notify when shopping list has 10+ items"
    trigger:
      - platform: numeric_state
        entity_id: sensor.prism_shopping_items
        above: 10
    action:
      - service: notify.mobile_app
        data:
          title: "Shopping List"
          message: "You have {{ states('sensor.prism_shopping_items') }} items on the shopping list."
```

---

## 5. Voice API (recommended surface)

Prism has a Voice API under `/api/v1/voice/*` built for this job, and it is the supported way to connect Home Assistant and voice assistants. Each endpoint returns a `spoken` field, a sentence ready to read aloud, next to the structured data, so you don't have to build sentences from raw fields in Jinja templates. A token with the **Voice API only** scope (the default) is all these endpoints need.

The endpoints include:

- `GET /api/v1/voice/calendar/today` and `/calendar/upcoming`: today's and upcoming events
- `GET /api/v1/voice/chores/today`: chores due today
- `GET /api/v1/voice/tasks/today`: tasks due today
- `GET /api/v1/voice/meals/today`: today's planned meals
- `GET /api/v1/voice/weather/today`: today's weather
- `GET /api/v1/voice/birthdays/upcoming`: upcoming birthdays
- `GET /api/v1/voice/bus/status`: bus tracking status
- `GET /api/v1/voice/family`: family members
- `GET /api/v1/voice/message/recent` and `POST /api/v1/voice/message/post`: read/post messages
- `POST /api/v1/voice/shopping/add`: add a shopping item
- `POST /api/v1/voice/chore/complete`: mark a chore complete

Here is a REST sensor that uses the spoken response:

```yaml
sensor:
  - platform: rest
    name: "Prism Meals Today"
    resource: "http://prism.local:3000/api/v1/voice/meals/today"
    headers:
      Authorization: !secret prism_bearer
    value_template: "{{ value_json.spoken }}"
    scan_interval: 3600
```

The write endpoints (`shopping/add`, `chore/complete`) are part of the Voice API, so a **Voice API only** token can call them too, and you don't need a Full access token for them.

[docs/voice-api.md](voice-api.md) has the full endpoint reference, the request and response shapes, and more examples.

---

## Troubleshooting

**"Authentication required" error**
- Check that the `Authorization` header has `Bearer ` (with a space) before the token.
- Check that the token hasn't been revoked in Settings → Security → API Tokens.

**Sidebar page is blank or "refused to connect"**
- Check that the allowlist is set (the add-on option `allowed_frame_ancestors`, or `ALLOWED_FRAME_ANCESTORS` in `.env`) and that Prism was restarted after.
- The entry must match the address in your browser's address bar exactly, including `http` or `https` and the port.
- If Home Assistant is on `https://` and Prism on `http://`, the browser blocks it (see Limits above).

**Sensors show "unknown"**
- Check that the Prism container is running: `docker ps`
- Test the endpoint by hand: `curl -H "Authorization: Bearer $PRISM_TOKEN" http://prism.local:3000/api/chores`, with `PRISM_TOKEN` set to the token from step 2
- Look for connection errors in the HA logs.

**Google Calendar won't connect: "must end with a public top-level domain"**
- The add-on runs on a private LAN address, and Google won't accept that as an OAuth redirect URI (the address Google sends you back to after sign-in). Either put Prism behind a public HTTPS URL, or use the method that needs no public URL, where you paste a refresh token from Google's OAuth Playground. See [Calendar → Google Calendar without a public URL](features/CALENDAR.md#google-calendar-without-a-public-url-oauth-playground).
