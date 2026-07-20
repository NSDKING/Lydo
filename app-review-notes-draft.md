# App Review Notes — draft for App Store Connect

## 2. Devices tested
iPhone 14, running the latest publicly available version of iOS at the time of testing.

## 3. App purpose & target audience
Dano is an AI-powered weekly meal-planning app. Based on the user's calorie target, dietary preferences/restrictions, and grocery budget, it generates a personalized 7-day meal plan and matches ingredients to real promotional pricing at Lidl supermarkets, so users can eat according to their goals while shopping cost-effectively. Target audience: home cooks (primarily in France/Europe, where Lidl operates) who want to plan meals, track nutrition, and control grocery spend without manually researching recipes, macros, and prices separately. The app also lets users import recipes shared from TikTok and adapts them to use discounted Lidl ingredients.

## 4. Setup & access instructions
Dano uses **Sign in with Apple exclusively** — there is no separate email/password login, so no separate demo credentials exist. After signing in, a new user completes a short onboarding flow (personal stats, dietary goal, activity level, budget) which takes under two minutes; the app then generates a free one-day preview meal plan immediately. The full 7-day plan and additional features (shopping-list, household-size scaling for guests, meal swapping) are part of the "dano Pro" auto-renewing subscription, reachable via the in-app paywall.
[If you want reviewers to see the paid tier without purchasing, consider adding: "For review purposes, please use Sandbox/TestFlight in-app purchase testing to access dano Pro features" — or provide a specific pre-configured demo account with an active entitlement.]

## 5. External services used
- **Anthropic (Claude API)** — AI meal-plan generation, recipe extraction from imported TikTok links, and food/receipt-photo nutrition analysis.
- **Supabase** — user accounts (authentication) and application database.
- **RevenueCat** — subscription/in-app-purchase management on top of Apple's StoreKit.
- **Apple Sign in with Apple** — the app's sole login method.
- **Railway** — backend API hosting.
- Public promotional pricing data from Lidl is used for informational grocery-matching purposes; the app is not affiliated with or endorsed by Lidl.

## 6. Regional differences
The app is available in English and French, and adapts to the device's language automatically (with a manual override in Settings). Its core grocery-matching feature is built around Lidl, so it is most useful in regions where Lidl operates; all other features (AI meal planning, nutrition tracking, recipe import) function identically everywhere.
[Confirm: is App Store availability currently restricted to specific territories? If so, state which.]

## 7. Regulated industry / protected material
Dano is a consumer nutrition/lifestyle app, not a medical device, and does not operate in a highly regulated industry. It displays general AI-generated nutrition information with an in-app disclaimer that it is not medical advice. It references the "Lidl" brand name for informational price-comparison purposes only, based on publicly available promotional data — Dano is not affiliated with, endorsed by, or operating under license from Lidl.

---

## Not covered here — you still need to provide:
1. **Screen recording** (physical device, latest iOS): launch → onboarding → Sign in with Apple → today's meal plan → tapping into a recipe → shopping list → paywall/subscription flow → Profile (including the new Delete Account option) → camera/photo-scan permission prompt if you demo food scanning.
2. **Demo account** in the App Review Information "Sign-In Information" section, if you want reviewers testing with a specific pre-existing account rather than creating their own via Sign in with Apple.
