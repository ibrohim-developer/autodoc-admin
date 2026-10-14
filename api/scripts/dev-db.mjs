// Local PostgreSQL for development, no system install needed: real Postgres 17
// binaries from the `embedded-postgres` dev dependency, data in api/.pgdata.
//   pnpm dev:db        (from the repo root) — leave it running, Ctrl+C stops it.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const databaseDir = fileURLToPath(new URL('../.pgdata', import.meta.url))
const port = Number(process.env.DEV_DB_PORT ?? 5433)
const database = 'autodoc'

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  // Same encoding as production, whatever the Windows locale is.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})

if (!existsSync(databaseDir)) await pg.initialise()
await pg.start()

const client = pg.getPgClient()
await client.connect()
const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
await client.end()
if (!rowCount) await pg.createDatabase(database)

console.log(`Postgres is up: postgres://postgres:postgres@localhost:${port}/${database}`)
console.log('Ctrl+C to stop.')

const stop = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
