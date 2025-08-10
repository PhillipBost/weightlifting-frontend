# WeightliftingDB Frontend
mobile friendly web application for exploring USA Weightlifting competition results and athlete performance data.

## Features
- Search athletes by name or membership number
- Interactive performance charts showing progression over time
- Detailed competition result breakdowns
- Q-score tracking and analysis

## Tech stack
|Purpose|Tool|
|------|---------|
| Development tools / Vibe coding assistance|<ul><li>Claude</li><li>Copilot within vscode</li><li>Meta AI to cross-reference Claude</li><li>Supabase AI assistant</li></ul> |
| Cloud hosts   | <ul><li>Supabase</li><li>Github</li><li>Vercel</ol> |
|Daily automated scraping / database upload|Node.js hosted by standalone backend GitHub repository|
|Frontend|<ul><li>Next.js</li><li>React</li><li>TypeScript</li><li>Tailwind</li><li>Recharts</li></ul>|
|Backend / Database|Supabase (PostgreSQL)|
|Raw data resources|USA Weightlifting's Sport80 tables|

## Data Pipeline
Competition results are automatically scraped and processed via a separate Node.js service. Data is updated daily and includes four distinct scraping tasks:
- Meets
- Meet results
- Athlete information
- Athlete metadata

Q-scores and and birth years are computed within Supabase.
Vercel pulls database information in real-time as end-users browse the website.

## Contributing
I would love general feedback and beta-testing notes however you can get them to me.

## Costs
- Claude $20 / month
- Supabase $25 / month
- Vercel free
- GitHub free
- Domain registration n/a yet

## Licence
Open source / MIT