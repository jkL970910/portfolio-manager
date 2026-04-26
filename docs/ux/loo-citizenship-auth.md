# Loo国公民身份与认证体验

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.


Last updated: 2026-03-22

## Scope

This document defines the Chinese-mode-only citizen identity layer for Loo国的财富宝库.

It does not replace the underlying account system. It changes how login, registration, and profile are presented in Chinese mode.

## Experience Split

### Chinese mode

- Login becomes "进入 Loo国"
- Registration becomes "加入 Loo国"
- A citizen ID card is used as the main identity surface
- Settings includes a citizen profile section
- Loo国 terms must be acknowledged during login and registration

### English mode

- Keep standard Portfolio Manager login, registration, and profile behavior
- Do not show Loo国 narration, citizen card issuance, or oath language

## Login

### Logged out state

- Show a default citizen ID template
- Embed email and password fields inside the ID card
- Show a Loo国 terms checkbox
- Show a CTA to enter Loo国
- Show a path to apply for citizenship

### Logged in state

- Show the current signed-in user's citizen ID card
- Provide a clear CTA to enter Loo国 / continue into the product
- Do not show the login form again

## Registration

- Capture:
  - citizen name
  - gender
  - birth date
- Require acceptance of Loo国 terms
- On success:
  - create account
  - create citizen profile
  - show "citizen ID issued" modal
  - do not auto-enter the product

## Citizen Profile

### User-provided fields

- citizen name
- gender
- birth date

### System-derived fields

- Loo国 identity rank
- Loo国 address tier
- citizen ID code

### Wealth tier mapping

- `< 5k CAD`: 低等牛 / 牛棚
- `5k - 10k CAD`: 原皮Loo / Loo国郊区
- `10k - 20k CAD`: Loo国子民 / Loo国城内
- `> 20k CAD`: Loo皇大将军 / Loo皇殿前
- `Loo皇`: admin override only

### ID rarity

- ID code is generated automatically
- Higher wealth tiers receive rarer number patterns
- Top-tier ceremonial codes remain reserved for admin override

## Admin Override

### P0 design

- Admin access is controlled by email allowlist
- Admin can override:
  - rank
  - address
  - citizen ID code
- Admin controls live inside Settings > Profile
- No separate admin dashboard in the first version

## Asset Files To Reserve

- `citizen-id-template.png`
- `citizen-default.png`
- `citizen-male.png`
- `citizen-female.png`
- `loo-emperor.png`
