Hello,

Thank you for the feedback. Please find the requested information below. A screen recording demonstrating the app's functionality is attached to this reply.

**1. Screen recording**: Attached — captured on a physical device (iPhone 14) running the latest publicly available iOS. It shows app launch → Sign in with Apple → onboarding → today's free meal plan → the paywall/subscription flow → HealthKit and camera permission prompts → the shopping list → Profile, including the account deletion flow.

**2. Devices tested**: iPhone 14, running the latest publicly available version of iOS at the time of testing.

**3. App purpose & target audience**: Dano is an AI-powered weekly meal-planning app. Based on the user's calorie target, dietary preferences/restrictions, and grocery budget, it generates a personalized 7-day meal plan and matches ingredients to real promotional pricing at Lidl supermarkets, so users can eat according to their goals while shopping cost-effectively. Target audience: home cooks (primarily in France/Europe, where Lidl operates) who want to plan meals, track nutrition, and control grocery spend without manually researching recipes, macros, and prices separately. The app also lets users import recipes shared from TikTok and adapts them to use discounted Lidl ingredients.

**4. Setup & access instructions**: Dano uses Sign in with Apple exclusively — there is no separate email/password login, so reviewers can sign in with their own Apple ID directly; no separate demo credentials are needed. After signing in, a new user completes a short onboarding flow (personal stats, dietary goal, activity level, budget) which takes under two minutes; the app then generates a free one-day preview meal plan immediately. The full 7-day plan and additional features (shopping list, household-size scaling for guests, meal swapping) are part of the "dano Pro" auto-renewing subscription, reachable via the in-app paywall — Sandbox/TestFlight in-app purchase testing can be used to access these without a real charge.

**5. External services used**: Anthropic (Claude API) for AI meal-plan generation, recipe extraction from imported TikTok links, and food/receipt-photo nutrition analysis; Supabase for user accounts and application data; RevenueCat for subscription/in-app-purchase management on top of Apple's StoreKit; Apple Sign in with Apple as the app's sole login method; Railway for backend API hosting. Public promotional pricing data from Lidl is used for informational grocery-matching purposes; the app is not affiliated with or endorsed by Lidl.

**6. Regional differences**: The app is available in English and French, adapting to the device's language automatically (with a manual override in Settings). It is available across all territories where it has been submitted for distribution, with no region-specific feature restrictions — its core grocery-matching feature is built around Lidl and is most useful where Lidl operates, but all other features (AI meal planning, nutrition tracking, recipe import) function identically everywhere.

**7. Regulated industry / protected material**: Dano is a consumer nutrition/lifestyle app, not a medical device, and does not operate in a highly regulated industry. It displays general AI-generated nutrition information with an in-app disclaimer that it is not medical advice. It references the "Lidl" brand name for informational price-comparison purposes only, based on publicly available promotional data — Dano is not affiliated with, endorsed by, or operating under license from Lidl.

Please let me know if any further information is needed.

Best regards,
Dimitri
