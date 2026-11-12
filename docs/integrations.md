# Services Prism works with

Prism shows what your family already keeps in other places. Your calendars stay in Google or iCloud, your to-do and shopping lists stay in Microsoft To Do or Google Tasks, and your recipes stay in Tandoor or Mealie. Prism brings them onto one screen, and where a service allows it, a change you make in Prism goes back to that service.

Each row says whether Prism **reads** from the service, **writes** to it, or both.

## Calendars

| Service | What Prism does | Guide |
|---|---|---|
| **Google Calendar** | Reads and writes. Events you add, edit, move or delete in Prism change in Google too. A calendar connected with read-only access stays read-only. | [Calendar](features/CALENDAR.md) |
| **Apple iCloud, Nextcloud and other CalDAV servers** | Reads and writes. New events and edits go back to the server. Deleting a single event deletes it there too; deleting a repeating series removes it from Prism only. | [Calendar](features/CALENDAR.md), [Apple iCloud](features/ICLOUD.md) |
| **Any calendar link** (iCal, webcal, a school or team feed) | Reads. The feed goes one way, so the events cannot be edited in Prism. | [Calendar](features/CALENDAR.md) |
| **Contacts over CardDAV** (iCloud and others) | Reads birthdays from your contacts. | [Birthdays](features/BIRTHDAYS.md) |

## Tasks and lists

| Service | What Prism does | Guide |
|---|---|---|
| **Microsoft To Do: tasks** | Reads and writes. Tasks you add, edit, tick or delete in Prism change in To Do too. | [To-dos](features/TASKS.md) |
| **Microsoft To Do: shopping lists** | Reads and writes. Items you add, edit or tick in Prism change in To Do too. | [Shopping](features/SHOPPING.md) |
| **Microsoft To Do: wish lists** | Reads and writes. Items you add or edit in Prism change in To Do too. | [Wish lists](features/WISHES.md) |
| **Google Tasks** | Reads and writes. Tasks you add, edit, tick or delete in Prism change in Google too. | [To-dos](features/TASKS.md) |
| **Apple Reminders over CalDAV** | Reads, for Reminders lists that are still on CalDAV. Apple has moved most lists to a newer system that offers no outside access, and those do not come through. | [Apple iCloud](features/ICLOUD.md) |

## Recipes and groceries

| Service | What Prism does | Guide |
|---|---|---|
| **Tandoor** | Reads recipes, their pictures and the meal plan. | [Recipes](features/RECIPES.md) |
| **Mealie** | Reads recipes and the meal plan. | [Recipes](features/RECIPES.md) |
| **Recipe web pages** | Reads a recipe from its web address. | [Recipes](features/RECIPES.md) |
| **Paprika** | Imports a Paprika export file. Prism makes no connection to Paprika. | [Recipes](features/RECIPES.md) |
| **Kroger and its stores** (Mariano's, Ralphs, King Soopers and the rest) | Reads products and stores, and adds your shopping list to your Kroger cart. | [Grocery cart](features/KROGER.md) |
| **Open Food Facts and UPCitemdb** | Reads a product's name when you scan its barcode. | [Shopping](features/SHOPPING.md) |

## Photos

| Service | What Prism does | Guide |
|---|---|---|
| **OneDrive** | Reads the photos in a folder you choose. | [Photos](features/PHOTOS.md) |
| **Immich** | Reads the photos in a shared album link. | [Photos](features/PHOTOS.md) |
| **OpenStreetMap** | Reads the name of the town where a photo was taken, when you turn on **Show where photos were taken**. Prism sends a location rounded to about a kilometre. | [Photos](features/PHOTOS.md) |

## Weather, sky and maps

| Service | What Prism does | Guide |
|---|---|---|
| **Open-Meteo** | Reads the weather. This is the default and needs no account. | [First-time setup](getting-started/first-time-setup.md) |
| **OpenWeatherMap** | Reads the weather, with your own key. | [First-time setup](getting-started/first-time-setup.md) |
| **Pirate Weather** | Reads the weather, with your own key. | [First-time setup](getting-started/first-time-setup.md) |
| **NOAA aurora forecast** | Reads the aurora forecast for the night sky, when you turn it on. | [Idle, away and sitter screens](features/DISPLAY-MODES.md) |
| **OpenStreetMap and OpenFreeMap** | Find places and draw the maps on the travel globe and the bus map. | [Travel map](features/TRAVEL.md) |

## School bus

| Service | What Prism does | Guide |
|---|---|---|
| **Gmail** (FirstView bus emails) | Reads the bus alert emails under a label you choose, and marks each one read once Prism has it. | [School bus](features/BUS.md) |
| **Live bus positions** | A bus position service can send positions to Prism. Prism receives them and calls out to no one. | [School bus](features/BUS.md) |

## Smart home and voice

| Service | What Prism does | Guide |
|---|---|---|
| **Home Assistant** | Prism runs as a Home Assistant add-on, shows inside a dashboard, and answers Home Assistant's sensors. | [Home Assistant](home-assistant.md) |
| **Alexa** | A personal Alexa skill asks Prism for today's events, tasks, the weather, the list and the bus, and can add to the list. | [Voice and automation API](voice-api.md) |
| **Voice and automation API** | Any assistant or script with a token can read the day and add shopping items, tick chores and post messages. | [Voice and automation API](voice-api.md) |
| **AI assistants over MCP** | A small MCP server lets an assistant such as Claude read and change your family's data through Prism, with a token you create. | [MCP server on GitHub](https://github.com/sandydargoport/prism/tree/master/.mcp) |

## Prism itself

| Service | What Prism does | Guide |
|---|---|---|
| **The community gallery on GitHub** | Reads layouts and themes other households have shared. | [The wall screen](features/DASHBOARD.md) |
| **The update check** | Sends one anonymous check a week, which you can switch off. | [Update check](features/TELEMETRY.md) |

## Coming next

Prism already has a place to plug in each of these, so each would be a small addition:

- **Todoist** for tasks
- **AnyList, KitchenOwl and Grocy** for shopping lists
- **Grocy and other recipe managers** for recipes and meal plans
- More weather services and more photo sources

If you would like one of these, or a service that is not listed, [open a feature request](https://github.com/sandydargoport/prism/issues/new/choose).
