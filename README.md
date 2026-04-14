# Recommendation Studio

MovieLens recommendation product built with Next.js, Tailwind CSS v4, Recharts, and a thin Python bridge over the existing recommender scripts in `cse575_sorting/`.

## What It Does

- New-user cold-start onboarding with interview movies and wiZAN-based recommendations
- Existing-user workspace with model switching across content, explained simple, matrix factorization, wiZAN, and ensemble views
- Movie detail pages with tags, trends, rating distributions, and similar-title navigation
- Discovery hub for popular, hidden-gem, polarizing, and similar-to-item browsing
- Analytics dashboard with dataset charts and benchmark diagnostics

## Routes

### App routes

- `/` landing page
- `/onboarding` cold-start interview flow
- `/users/[userId]` existing-user recommendation workspace
- `/movies/[movieId]` movie detail page
- `/discover` browse and discovery hub
- `/analytics` dataset analytics and benchmark diagnostics

### API routes

- `GET /api/search?type=title|user|movie&q=...`
- `GET /api/recommend?userId=...&model=...&limit=...`
- `GET /api/discover?sort=...&genre=...&min=...&limit=...`
- `GET /api/stats`
- `GET /api/benchmarks`
- `GET /api/movies/[movieId]`
- `GET /api/users/[userId]/summary`
- `GET /api/users/[userId]/recommendations?model=...&limit=...`
- `GET /api/users/[userId]/comparison?limit=...`
- `GET /api/recommendations/interview?count=...`
- `POST /api/recommendations/coldstart`

## Data And Backend

The web app reads MovieLens data from:

- `cse575_sorting/movielens_combined.csv`
- `cse575_sorting/ratings.csv`
- `cse575_sorting/movies.csv`
- `cse575_sorting/tags.csv`
- `cse575_sorting/links.csv`

The Python bridge calls:

- `IDrec.py`
- `matrix_factorization.py`
- `wizan_api.py`
- `test_recommenders.py`

## Setup

Install JavaScript dependencies:

```bash
npm install
```

Install Python dependencies used by the recommender bridge:

```bash
python3 -m pip install pandas numpy scipy scikit-learn
```

## Development

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Verification

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```
