# WeightliftingDB Frontend
Mobile-friendly web application for exploring USA Weightlifting competition results and athlete performance data.
Project is currently deployed here: https://weightlifting-db.vercel.app/

## Features
- Search athletes by name or membership number
- Interactive performance charts showing progression over time
- Detailed competition result breakdowns
- Q-score tracking and analysis
- [Future feature wishlist](https://github.com/PhillipBost/weightlifting-frontend/blob/main/feature-wishlist.md)
- Associated database / back-end GitHub repository can be found here: https://github.com/PhillipBost/weightlifting-database

## Tech stack
|Purpose|Tool|
|------|---------|
| Development tools / Vibe coding assistance|<ul><li>Claude</li><li>Copilot within vscode</li><li>Meta AI to cross-reference Claude</li><li>Supabase AI assistant</li></ul> |
| Cloud hosts   | <ul><li>Supabase</li><li>Github</li><li>Vercel</ol> |
|Daily automated scraping / database upload|Node.js hosted by standalone backend GitHub repository|
|Frontend|<ul><li>Next.js</li><li>React</li><li>TypeScript</li><li>Tailwind</li><li>Recharts</li></ul>|
|Backend / Database|Supabase (PostgreSQL)|
|Raw data resources|USA Weightlifting's Sport80 tables|

## Development Workflow

### First Time Setup
Before running the dev server for the first time, generate all static data files:
```bash
npm install
npm run generate-all  # Takes ~2 minutes, generates 52 data files
```

### Daily Development
Start the dev server with fast startup (no prebuild):
```bash
npm run dev  # Starts in ~3 seconds with Turbopack
```

The `predev` script automatically validates that required static data files exist. If they're missing, you'll see a helpful error message.

### Available Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with Turbopack (fast startup) |
| `npm run dev:clean` | Clean cache and start dev server (use if experiencing build issues) |
| `npm run build` | Build for production (includes automatic data generation) |
| `npm run clean` | Manually clean `.next` and `node_modules/.cache` |
| `npm run generate-all` | Regenerate all static data files (run after database changes) |
| `npm run generate-static` | Generate static data files only |
| `npm run generate-search` | Generate search indexes only |
| `npm run generate-rankings` | Generate rankings data only |

### When to Regenerate Data
Run `npm run generate-all` when:
- Database schema or data has changed
- Search indexes need updating
- Rankings data is stale

### Troubleshooting Build Cache Issues
If you encounter "Uncaught SyntaxError" or other build errors on initial load:
```bash
npm run dev:clean
```

This clears the build cache and starts fresh. The new workflow prevents the race condition that previously caused recurring cache corruption.

## Data Pipeline
Competition results are automatically scraped and processed via a separate Node.js service. Data is updated daily and includes four distinct scraping tasks:
- Meets (daily)
- Meet results (daily)
- Athlete information (daily)
- Athlete metadata (weekly)

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

## License
**Code**: MIT License

**Data**: See [DATA_LICENSE.md](DATA_LICENSE.md) for information about data sourcing and usage
