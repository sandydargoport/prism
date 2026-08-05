# Home Assistant Integration

This guide covers two ways to connect Prism with Home Assistant:

1. **Embed Prism** as an iframe panel in the HA sidebar
2. **Pull Prism data** into HA sensors via REST API

---

## 1. Embedding Prism as an HA Panel

### Allow iframe embedding

By default, Prism blocks iframe embedding for security. To allow Home Assistant to embed it, set the `ALLOWED_FRAME_ANCESTORS` environment variable in your `.env`:

```env
ALLOWED_FRAME_ANCESTORS=http://homeassistant.local:8123
```

Multiple origins (comma-separated):
```env
ALLOWED_FRAME_ANCESTORS=http://homeassistant.local:8123, https://ha.example.com
```

Restart the Prism container after changing:
```bash
docker-compose restart app
```

### Add the panel in HA

In your Home Assistant `configuration.yaml`:

```yaml
panel_iframe:
  prism:
    title: "Family Dashboard"
    url: "http://prism.local:3000"
    icon: mdi:view-dashboard
```

Restart Home Assistant. Prism will appear in the sidebar.

To show a specific dashboard (e.g. the kitchen layout):
```yaml
    url: "http://prism.local:3000/d/kitchen"
```

---

## 2. Creating an API Token

API tokens let Home Assistant query Prism's REST API without PIN-based login.

1. Open Prism Settings (gear icon)
2. Go to **Security**
3. Under **API Tokens**, enter a name (e.g. "Home Assistant")
4. Choose a **scope**: **Voice API only** (the default and recommended; sufficient for the Voice API and the read-only REST sensors below) or **Full access (legacy)** if you also need to drive write endpoints directly
5. Click **Generate Token**
6. **Copy the token immediately** (it's only shown once)
7. Store it in your HA `secrets.yaml`:

```yaml
# secrets.yaml
prism_token: "paste-your-64-char-token-here"
```

### Token scopes

Tokens carry a **scope** chosen when you generate them:

- **Voice API only** (default, recommended): reaches the Voice API (`/api/v1/voice/*`) and the read-only REST sensors in Section 3. This is all most HA setups need.
- **Full access (legacy)**: every endpoint, including writes and admin routes. Only pick this if an automation calls a write endpoint directly instead of going through the Voice API.

The read sensors below (calendar, chores, shopping, meals) work with a **Voice API only** token. They are read-only GETs. Write actions (adding a shopping item, completing a chore) are exposed through the Voice API endpoints (see Section 5), which a voice-scoped token can also reach.

- Tokens never expire but can be revoked from Settings at any time
- Each request updates the token's "Last used" timestamp

---

## 3. REST Sensor Examples

Use HA's [REST sensor](https://www.home-assistant.io/integrations/rest/) to pull data from Prism.

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

Prism ships a purpose-built **Voice API** under `/api/v1/voice/*` that is the supported integration surface for Home Assistant and voice assistants. Each endpoint returns a ready-to-speak `spoken` field alongside structured data, so you don't have to assemble sentences from raw fields in Jinja templates. A **Voice API only** scoped token (the default) is all these endpoints need.

Available endpoints include:

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

Example REST sensor using the spoken response:

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

Because the write endpoints (`shopping/add`, `chore/complete`) are part of the Voice API, a **Voice API only** token can drive them too. You do not need a Full access token for these.

See [docs/voice-api.md](voice-api.md) for the full endpoint reference, request/response shapes, and more examples.

---

## Troubleshooting

**"Authentication required" error**
- Make sure the `Authorization` header includes `Bearer ` (with a space) before the token
- Verify the token hasn't been revoked in Settings → Security → API Tokens

**iframe shows blank/refuses to connect**
- Check `ALLOWED_FRAME_ANCESTORS` is set in `.env` and the container was restarted
- Verify the URL matches exactly (including port)

**Sensors show "unknown"**
- Check the Prism container is running: `docker ps`
- Test the endpoint manually: `curl -H "Authorization: Bearer YOUR_TOKEN" http://prism.local:3000/api/chores`
- Check HA logs for connection errors
