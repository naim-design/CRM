CRM SMART MATCH V5
==================

Replace:
- app.html
- js/app.js

Smart Matching improvements:
- same date scoring
- ±1 day fallback for timezone/near-midnight events
- Wabot account/instance similarity
- closest blast time scoring
- template/source/category text similarity
- confidence threshold and ambiguity protection

Result:
- If a safe CRM match is found, "Tanpa Campaign" becomes the matched template/source/category.
- Mapping column shows e.g. "Auto CRM 90%".
- Buyer / Sales / Conversion Rate / ROAS can then use the matched CRM entry.
- If confidence is weak, system does NOT force a wrong campaign.
