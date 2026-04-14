# Nexora

Nexora is a focus analytics dashboard that calculates resilience score, escape time, and rabbit hole incidents from daily activity entries, then visualizes trends and streaks.

## Features
- Calculate resilience score and escape time from activity entries
- Detect rabbit hole incidents (consecutive non-study blocks)
- Sync daily analytics to Supabase
- Analytics dashboard with charts and streak calendar
- AI assistant (OpenRouter)

## Tech Stack
- React + Vite
- Recharts
- Supabase REST API

## Getting Started

### 1) Install
```bash
npm install
```

### 2) Environment Variables
Create `Nexora/.env.local`:
```env
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
VITE_OPENROUTER_MODEL=openai/gpt-4o-mini

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANALYTICS_USER_ID=default-user-id
```

### 3) Run
```bash
npm run dev
```

## Supabase Table
Default table expected: `daily_analytics`

Required columns:
- `user_id` (text)
- `entry_date` (date)
- `resilience_score` (numeric)
- `average_escape_time` (numeric)
- `rabbit_hole` (int4)

Optional columns (used when present):
- `streaks` (int4)
- `source` (text)
- `raw_payload` (json)

## Scripts
- `npm run dev` - start local dev server
- `npm run build` - build for production
- `npm run preview` - preview production build

## Notes
- If Supabase keys are missing, analytics are saved locally.
- If OpenRouter key is missing, the AI assistant will not respond.


<img width="1335" height="643" alt="image" src="https://github.com/user-attachments/assets/4d46d37a-269a-4362-88e0-86e57a745ae7" />
<img width="1339" height="640" alt="image" src="https://github.com/user-attachments/assets/6ae87e6f-8beb-44c4-97f3-336635955539" />
<img width="1313" height="632" alt="image" src="https://github.com/user-attachments/assets/ed3fbf8b-0ced-4d24-8c46-cd6d18bcd07d" />
<img width="1336" height="645" alt="image" src="https://github.com/user-attachments/assets/c3afe062-62b8-47ab-b8e3-58365bd4482f" />
<img width="1323" height="606" alt="image" src="https://github.com/user-attachments/assets/3c6c6c11-47c7-472d-a30f-bc1e4ab61b69" />
<img width="1316" height="554" alt="image" src="https://github.com/user-attachments/assets/6ea587e5-1ce5-40c5-b827-59746d5054f3" />
<img width="1336" height="619" alt="image" src="https://github.com/user-attachments/assets/f77477da-4114-450d-a9d5-f71854c24ea4" />
<img width="1304" height="578" alt="image" src="https://github.com/user-attachments/assets/fba7d5a7-9334-47af-992d-b7521a8b8fb7" />
<img width="1325" height="604" alt="image" src="https://github.com/user-attachments/assets/f2baf183-14dd-4162-8cf0-133e144a7ee3" />








