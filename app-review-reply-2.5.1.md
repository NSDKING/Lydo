Hello,

Thank you for the feedback on Guideline 2.5.1. You're right that the version you reviewed (1.1.3, build 20) didn't clearly surface the app's HealthKit usage anywhere in the UI — the only indication was the system permission prompt, which doesn't satisfy this guideline on its own.

We've since updated the app to add a permanent, always-visible "Apple Health" section on the Profile tab (not a dismissible banner — it's there every time the screen is opened) that explains both of the app's HealthKit uses in plain language:

1. Reading the user's recent step count from Apple Health to suggest an appropriate activity level for their calorie target.
2. Adding the meals the user logs as eaten to Apple Health's nutrition data.

This section also shows a live "Connected" / "Not connected" status reflecting the actual HealthKit permission state, so it's clear to the user exactly what's happening and why.

This fix is included starting in build 24, and the version currently in TestFlight (1.1.4, build 25) has it along with a couple of unrelated improvements. Please review that build for this submission — happy to provide a screen recording of the "Apple Health" section on the Profile tab if that would help, just let us know.

Please let me know if any further information is needed.

Best regards,
Dimitri
