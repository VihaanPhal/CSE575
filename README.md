# NF Search

Netflix movie search app built with Next.js, Tailwind CSS, and Vercel's design language. Search the Netflix movie dataset by index or title.

## Setup

```bash
npm install
```

Place your `movie_titles.csv` file in the `data/` directory. The CSV format is:

```
MovieID,YearOfRelease,Title
```

No column headers — each row is `index,year,title`. Year may be `NULL`.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Reference

### GET /api/search

Search for a movie by index or name.

| Param  | Type   | Description                        |
|--------|--------|------------------------------------|
| `type` | string | `index` or `name`                  |
| `q`    | string | The search query                   |

**Responses:**

- `200` — `{ index, name, year }`
- `400` — Missing `q` or invalid `type`
- `404` — No match found

### GET /api/stats

Returns dataset statistics.

**Response:** `{ totalRecords: number }`

## Tech Stack

- Next.js (App Router)
- Tailwind CSS v4
- csv-parse
- Geist font

## Added Functionality (Matrix Factorization)

The following was added as an extension (without replacing existing project files/logic):

- Matrix factorization script: `cse575_sorting/matrix_factorization.py`
- Node/Python bridge helper: `lib/loadRecommendations.js`
- New API route for direct recommendations: `app/api/recommend/route.js`
- `/api/search` user responses can include:
  - `recommendations`: top predicted unseen items
  - `recommendationError`: details if the recommender fails
- UI now displays matrix-factorization recommendation results in user search view.

### Additional setup for matrix-factorization feature

Install Python dependencies:

```bash
pip install numpy pandas
```

Optional on Windows if `python` resolves to a different interpreter:

```bash
set PYTHON_BIN=C:\path\to\python.exe
```

### Matrix recommendation endpoint

`GET /api/recommend`

Query params:

- `userId` (required): integer
- `topN` (optional): positive integer, default `5`
- `method` (optional): `svd` or `gd`, default `svd`
