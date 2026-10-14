// Module hooks that let plain Node load the landing's content files (src/content/*.ts):
// "@/…" paths, extensionless imports, TypeScript types, and image imports, which become
// { src: "<absolute path>" } so the importer can upload the file itself.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

let site = ''

export function initialize(data) {
  site = data.site
}

const ASSET = /\.(webp|png|jpe?g|svg|gif|avif|mp4)$/i

function probe(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  let target = null
  if (specifier.startsWith('@/')) target = join(site, 'src', specifier.slice(2))
  else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith('file:')) {
    target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
  }
  if (target) {
    const file = ASSET.test(target) ? target : probe(target)
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:')) {
    const path = fileURLToPath(url)
    if (ASSET.test(path)) {
      return {
        format: 'module',
        source: `export default { src: ${JSON.stringify(path)} }`,
        shortCircuit: true,
      }
    }
    if (path.endsWith('.ts')) {
      return {
        format: 'module',
        source: stripTypeScriptTypes(readFileSync(path, 'utf8')),
        shortCircuit: true,
      }
    }
  }
  return nextLoad(url, context)
}
