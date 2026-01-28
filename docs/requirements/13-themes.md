### 13. Dark/Light Mode

#### Theme Options
- **Light Mode:** White/light gray backgrounds, dark text
- **Dark Mode:** Dark backgrounds, light text (easier on eyes at night)
- **Auto:** Switch based on time of day (light during day, dark at night)

#### Auto-Switch Settings
- **Sunrise/Sunset:** Switch at actual sunrise/sunset times
- **Custom Times:** User-defined switch times (e.g., 7am/7pm)
- **Ambient Light:** Switch based on room brightness (requires sensor - future)

#### Theme Customization
- **Color Schemes:** Pre-defined palettes for each mode
- **Contrast Options:** High contrast for accessibility
- **Font Size:** Adjustable for readability

#### Color Variables (Tailwind)
```css
/* Light Mode */
--bg-primary: #ffffff;
--bg-secondary: #f3f4f6;
--text-primary: #111827;
--text-secondary: #6b7280;

/* Dark Mode */
--bg-primary: #111827;
--bg-secondary: #1f2937;
--text-primary: #f9fafb;
--text-secondary: #9ca3af;
```

---

### 14. Seasonal Themes (12 Monthly Themes)

#### Theme Schedule
1. **January** - New Year / Winter Wonderland
   - Colors: Blues, whites, silver
   - Icons: Snowflakes, champagne glasses
   - Backgrounds: Snow scenes, fireworks

2. **February** - Valentine's Day
   - Colors: Pinks, reds, purples
   - Icons: Hearts, roses, cupid
   - Backgrounds: Heart patterns, romantic scenes

3. **March** - St. Patrick's Day / Spring Awakening
   - Colors: Greens, golds, pastels
   - Icons: Clovers, rainbows, flowers blooming
   - Backgrounds: Irish landscapes, spring gardens

4. **April** - Easter / Spring Blooms
   - Colors: Pastels (pink, yellow, blue, green)
   - Icons: Easter eggs, bunnies, flowers
   - Backgrounds: Spring meadows, gardens

5. **May** - Spring / Mother's Day
   - Colors: Florals, bright colors
   - Icons: Flowers, butterflies, hearts
   - Backgrounds: Flower gardens, nature

6. **June** - Summer / Father's Day
   - Colors: Blues, yellows, greens
   - Icons: Sun, beach, BBQ, ties
   - Backgrounds: Beach scenes, outdoor activities

7. **July** - Independence Day / Summer
   - Colors: Red, white, blue
   - Icons: Flags, fireworks, stars
   - Backgrounds: Patriotic themes, summer fun

8. **August** - Back to School
   - Colors: Yellows, reds, blues
   - Icons: School bus, pencils, apples, backpacks
   - Backgrounds: School themes, autumn preview

9. **September** - Fall / Autumn Harvest
   - Colors: Oranges, browns, yellows, reds
   - Icons: Falling leaves, pumpkins, scarecrows
   - Backgrounds: Autumn foliage, harvest scenes

10. **October** - Halloween
    - Colors: Orange, black, purple
    - Icons: Pumpkins, ghosts, bats, witches
    - Backgrounds: Spooky scenes, jack-o-lanterns

11. **November** - Thanksgiving
    - Colors: Warm oranges, browns, golds
    - Icons: Turkeys, cornucopia, autumn leaves
    - Backgrounds: Harvest tables, family gatherings

12. **December** - Christmas / Winter Holidays
    - Colors: Red, green, gold, silver
    - Icons: Snowflakes, trees, ornaments, presents
    - Backgrounds: Winter scenes, holiday lights

#### Theme Controls
- **Auto-Switch:** Changes on 1st of each month (default)
- **Manual Override:** Select any theme manually
- **Theme Intensity:** Subtle (colors only) or Full (colors + icons + backgrounds)
- **Disable Themes:** Option for minimal/clean look year-round
- **Custom Themes:** Users can upload custom theme assets (future)

#### Theme Assets
```
themes/
├── january/
│   ├── background.jpg
│   ├── colors.css
│   └── icons/
├── february/
│   ├── background.jpg
│   ├── colors.css
│   └── icons/
└── ...
```
