import { mkdtemp, rm } from 'node:fs/promises'
import { type AddressInfo, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
    /** Each test file's uploads go in a folder under this one; all of it is deleted at the end. */
    storageRoot: string
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      server.close(() => resolve(port))
    })
  })
}

/**
 * A throwaway Postgres and upload folder for the whole e2e run, deleted afterwards. Never the
 * dev database.
 *
 * CI passes E2E_DATABASE_URL instead (a postgres service container): embedded Postgres can't
 * run there, because initdb refuses to run as root and CI containers run as root.
 */
export default async function setup(project: TestProject) {
  const storageRoot = await mkdtemp(join(tmpdir(), 'autodoc-e2e-storage-'))
  project.provide('storageRoot', storageRoot)
  const cleanStorage = () => rm(storageRoot, { recursive: true, force: true })

  const external = process.env.E2E_DATABASE_URL
  if (external) {
    project.provide('databaseUrl', external)
    return cleanStorage
  }

  const databaseDir = await mkdtemp(join(tmpdir(), 'autodoc-e2e-'))
  const port = await freePort()
  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  })

  await pg.initialise()
  await pg.start()
  await pg.createDatabase('autodoc_test')
  project.provide('databaseUrl', `postgres://postgres:postgres@127.0.0.1:${port}/autodoc_test`)

  return async () => {
    await pg.stop()
    await rm(databaseDir, { recursive: true, force: true })
    await cleanStorage()
  }
}
