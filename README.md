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
