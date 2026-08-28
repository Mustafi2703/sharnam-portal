# Comms & email flow — UAT test pack (15 emails)

**Portal:** https://portal.spdc.in  
**Project:** SPDC-DEMO-01  
**From mailbox:** `pmc-portal@spdc.in` (Graph)

## Live team logins

| Email | Role | Password |
|-------|------|----------|
| baibhabmustafi@gmail.com | Admin | Demo@1234 |
| admin@twinoxis.com | Admin | Demo@1234 |
| hello@twinoxis.com | Office | Demo@1234 |
| nirav@spdc.in | Office | Demo@1234 |
| operations@spdc.in | Office | Demo@1234 |

Seed users + matrix + meetings + NCR/CAR + coordination:

```bash
npm run db:seed-live-team
```

Send 15 automated test emails (no human reply needed):

```bash
npm run email:comms-uat-preview
npm run email:comms-uat-all
```

## Portal walkthrough

1. Comms → Matrix — verify live contacts  
2. Comms → Agenda — “Weekly PMC coordination — UAT demo”  
3. Comms → MoM → Follow-up  
4. Drawings → Design coordination — send follow-up  
5. RFIs — RFI-2026-UAT-142  
6. Quality — NCR-Q-018 + CAR-007  
7. QAP — UAT demo row  
