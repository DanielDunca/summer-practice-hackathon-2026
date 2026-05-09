# ShowUp2Move — Master Plan

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | Fastest dev, SSR, in their stack |
| Database | Supabase (PostgreSQL + PostGIS) | Auth + DB + Realtime + Storage — one platform |
| AI | Gemini API (free tier, vision capable) | Sport detection from text AND photo |
| Maps | Leaflet + OpenStreetMap | 100% free, no credit card, no API key |
| Deployment | Vercel + Supabase hosted | Zero DevOps overhead |

---

## Database Schema

```
profiles          → user_id, bio, avatar_url, location (PostGIS), skill_level
sports            → id, name, min_players, max_players
user_sports       → user_id, sport_id, skill_level
availability      → user_id, date, is_available, sport_ids[]
groups            → id, sport_id, captain_id, status, created_at
group_members     → group_id, user_id, status (pending/confirmed)
events            → id, group_id, venue, location, time, status
messages          → id, group_id, user_id, content, created_at
votes             → id, event_id, option_type, option_value
user_votes        → user_id, vote_id, choice
achievements      → user_id, type, awarded_at
```

---

## Feature Phases

### Phase 1 — Foundation
- Project scaffold: Next.js + Tailwind + Supabase + shadcn/ui
- Supabase Auth (email/password + Google OAuth)
- Responsive layout, mobile-first design
- Clean component architecture

**Points target:** ~1300p (application runs + integration + architecture + responsive UI)

---

### Phase 2 — User Profiles
- Profile creation: name, bio, avatar upload → Supabase Storage
- Sport preferences picker (multi-select with icons)
- Skill level per sport (beginner / intermediate / advanced)
- AI hook #1: On bio save, call Claude → auto-suggest sports from text
- AI hook #2: On photo upload, call Claude Vision → detect sports from image

**Points target:** ~1300p (auth + profile + sports prefs + photo + skill level)

---

### Phase 3 — ShowUpToday? System
- Daily prompt component (banner / modal)
- One-click Yes/No toggle with sport selection for today
- Availability stored per user per date
- Browser notification reminder at configurable time

**Points target:** ~500p

---

### Phase 4 — Smart Matching Engine
- Trigger: manual ("Match me now") or scheduled (Vercel cron)
- Algorithm:
  1. Collect all users who said Yes for today + sport overlap
  2. PostGIS proximity filter (configurable radius)
  3. Fill groups to sport's min/max player count (football=10-14, tennis=2-4, basketball=6-10)
  4. Claude generates compatibility score between users
  5. Randomly assign captain
  6. Create group + group chat + send notifications
- Match confirmation workflow (accept/decline)

**Points target:** ~2100p (availability + auto matching + description matching + group size + proximity + confirmation)

---

### Phase 5 — Communication
- Supabase Realtime → group chat with live message updates
- Event-specific sub-chat
- Notification system (in-app + browser push)

**Points target:** ~1300p (group chat + event chat + notifications + real-time)

---

### Phase 6 — Event & Location
- Auto-event setup: captain gets prefilled event after group forms
- Manual event creation: any user can create open events
- Google Maps: map display + proximity-based venue search
- Venue suggestions: search nearby sports facilities via Places API
- Price estimation: Google Places pricing info
- Voting/polling: captain posts venue options → members vote
- Captain coordination tools dashboard

**Points target:** ~2800p (captain + auto-event + manual event + venue suggestions + price + voting + maps)

---

### Phase 7 — AI Features
- Sports from bio text: Claude API extract sports from description
- Sports from profile photo: Claude Vision detect sports from image
- Compatibility scoring: Claude compares two user profiles, returns 0-100 score
- Smart teammate recommendations: Claude ranks available users for a captain

**Points target:** ~1600p

---

### Phase 8 — Bonus (after core is solid)
- Calendar integration (Google Calendar API)
- Weather API check before suggesting outdoor venues
- Team balancing by skill level
- Achievements / gamification (XP, streaks, badges)
- Social sharing (invite link)
- Multi-language support

**Points target:** ~1500p

---

## AI Feature Map

| Feature | Implementation |
|---|---|
| Sports from bio text | Claude API: `"Extract sports from this bio: {bio}"` |
| Sports from profile photo | Claude Vision: send image, ask for sports detection |
| Compatibility scoring | Claude: compare two user profiles, return 0-100 score |
| Smart teammate recommendations | Claude: rank available users for a captain |

---

## Points Estimate

| Category | Target |
|---|---|
| Foundation | ~1300p |
| Profiles + Auth | ~1300p |
| Availability system | ~500p |
| Matching (all sub-features) | ~2100p |
| AI features | ~1600p |
| Chat + notifications | ~1300p |
| Events + Maps | ~2800p |
| Bonus features | ~1500p |
| Innovation/UX bonus | ~1500p |
| **Total** | **~13,900p** |

---

## Why Supabase over Firebase

- Supabase uses PostgreSQL with PostGIS — proximity queries are one line:
  `ST_DWithin(user.location, target_point, radius_meters)`
- Firebase/Firestore is NoSQL with no native geospatial queries — requires manual Geohash implementation
- 1500p (proximity matching + maps/location) depends on getting this right under time pressure
- Complex matching filters (sport + availability + location) are trivial in SQL, painful in Firestore

---

## Open Decisions

- [ ] Laravel backend instead of Next.js API routes? (shows more backend depth, costs ~2h)
- [ ] React Native mobile app? (huge UX points, doubles the work)
- [ ] Neo4j for graph-based matching? (unique differentiator, ~3h setup)
- [ ] Solo build scope — which phases to cut if time is short?
