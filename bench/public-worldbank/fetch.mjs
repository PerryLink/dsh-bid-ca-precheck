#!/usr/bin/env node
/**
 * Reproducible download of the World Bank procurement notices used by this bench.
 *
 * The endpoint is public and keyless. This script only downloads and records
 * provenance; it does not filter or transform the notices. `adapter.mjs` does the
 * construction-related selection and writes the requirement pack and bid fixtures.
 *
 * Defaults:
 *   endpoint  https://search.worldbank.org/api/v2/procnotices
 *   query     format=json&rows=200&page=1&qterm=construction
 *   output    bench/public-worldbank/.data/wb-procnotices.construction.json
 *   metadata  <output without .json>.meta.json
 *
 * Usage:
 *   node bench/public-worldbank/fetch.mjs
 *   node bench/public-worldbank/fetch.mjs --rows 500 --qterm construction
 *
 * No credentials are read, written or printed by this script.
 */

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(HERE, '.data')
const DEFAULT_OUT = resolve(DATA_DIR, 'wb-procnotices.construction.json')
const DEFAULT_ENDPOINT = 'https://search.worldbank.org/api/v2/procnotices'

/** Dataset-level provenance. The API response itself carries no license field. */
const DATASET = {
  title: 'Procurement Notice',
  catalogId: '0037776',
  financesOneId: 'DS00979',
  publisher: 'World Bank',
  catalogUrl: 'https://datacatalog.worldbank.org/search/dataset/0037776/procurement-notice',
  licenseName: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  licenseUrl: 'https://datacatalog.worldbank.org/public-licenses',
  licenseVerifiedAt: '2026-11-10',
  licenseNote:
    'The World Bank Data Catalog lists the Procurement Notice dataset (DS00979) as CC BY 4.0. ' +
    'The API response has no license field; verified at the dataset level. Re-verify before redistribution.',
}

function usage() {
  console.log(`Download World Bank procurement notices for the bench.

Usage: node bench/public-worldbank/fetch.mjs [options]

Options:
  --endpoint <url>   API endpoint (default: ${DEFAULT_ENDPOINT})
  --rows <n>         Page size, 1..1000 (default: 200)
  --page <n>         Page number, >= 1 (default: 1)
  --qterm <text>     Search term (default: construction)
  --out <path>       Output JSON path (default: ${DEFAULT_OUT})
  --timeout-ms <n>   Per-attempt timeout (default: 30000)
  --retries <n>      Attempts on network/HTTP/JSON failure, 1..5 (default: 3)
  --help             Show this help

The raw response is written as pretty JSON; a sidecar .meta.json records the
exact URL, retrieval time, HTTP status and SHA-256 of the written file.
`)
}

function parseArgs(argv) {
  const options = {
    endpoint: DEFAULT_ENDPOINT,
    rows: 200,
    page: 1,
    qterm: 'construction',
    out: DEFAULT_OUT,
    timeoutMs: 30_000,
    retries: 3,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index]
    if (raw === '--help' || raw === '-h') {
      usage()
      process.exit(0)
    }
    if (!raw.startsWith('--')) throw new Error(`unknown argument: ${raw}`)
    const equals = raw.indexOf('=')
    const name = equals === -1 ? raw : raw.slice(0, equals)
    const inline = equals === -1 ? undefined : raw.slice(equals + 1)
    const value = inline ?? argv[(index += 1)]
    if (value === undefined) throw new Error(`missing value for ${name}`)
    switch (name) {
      case '--endpoint':
        options.endpoint = value
        break
      case '--rows':
        options.rows = Number.parseInt(value, 10)
        break
      case '--page':
        options.page = Number.parseInt(value, 10)
        break
      case '--qterm':
        options.qterm = value
        break
      case '--out':
        options.out = isAbsolute(value) ? value : resolve(process.cwd(), value)
        break
      case '--timeout-ms':
        options.timeoutMs = Number.parseInt(value, 10)
        break
      case '--retries':
        options.retries = Number.parseInt(value, 10)
        break
      default:
        throw new Error(`unknown argument: ${name}`)
    }
  }

  if (!Number.isInteger(options.rows) || options.rows < 1 || options.rows > 1000) {
    throw new Error('--rows must be an integer from 1 to 1000')
  }
  if (!Number.isInteger(options.page) || options.page < 1) {
    throw new Error('--page must be an integer >= 1')
  }
  if (options.qterm.trim() === '') throw new Error('--qterm must not be empty')
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error('--timeout-ms must be an integer >= 1000')
  }
  if (!Number.isInteger(options.retries) || options.retries < 1 || options.retries > 5) {
    throw new Error('--retries must be an integer from 1 to 5')
  }
  return options
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function buildUrl(options) {
  const url = new URL(options.endpoint)
  url.searchParams.set('format', 'json')
  url.searchParams.set('rows', String(options.rows))
  url.searchParams.set('page', String(options.page))
  url.searchParams.set('qterm', options.qterm)
  return url
}

async function fetchOnce(url, timeoutMs) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 300)}`)
  }
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    throw new Error(`response was not JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  return {
    data,
    httpStatus: response.status,
    contentType: response.headers.get('content-type') ?? '',
  }
}

function validate(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('response root is not a JSON object')
  }
  if (!Array.isArray(data.procnotices)) {
    throw new Error('response has no "procnotices" array')
  }
  if (data.procnotices.length === 0) {
    throw new Error('response has an empty "procnotices" array')
  }
  for (const [index, notice] of data.procnotices.entries()) {
    if (notice === null || typeof notice !== 'object' || Array.isArray(notice)) {
      throw new Error(`procnotices[${index}] is not an object`)
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const url = buildUrl(options)
  const metaPath = `${options.out.replace(/\.json$/i, '')}.meta.json`

  let lastError
  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      const { data, httpStatus, contentType } = await fetchOnce(url, options.timeoutMs)
      validate(data)

      const body = `${JSON.stringify(data, null, 2)}\n`
      const bytes = Buffer.byteLength(body)
      const digest = sha256(body)

      await mkdir(dirname(options.out), { recursive: true })
      await writeFile(options.out, body, 'utf8')

      const meta = {
        schemaVersion: 1,
        dataset: DATASET,
        endpoint: url.toString(),
        retrievedAt: new Date().toISOString(),
        httpStatus,
        contentType,
        query: {
          format: 'json',
          rows: options.rows,
          page: options.page,
          qterm: options.qterm,
        },
        api: {
          rows: data.rows ?? null,
          page: data.page ?? null,
          total: data.total ?? null,
          noticesOnPage: data.procnotices.length,
        },
        file: options.out,
        bytes,
        sha256: digest,
      }
      await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')

      console.log(
        `wb fetch: ${data.procnotices.length} notices on page ${data.page ?? options.page} ` +
          `(API total ${data.total ?? 'unknown'})`,
      )
      console.log(`  raw:  ${options.out}`)
      console.log(`  meta: ${metaPath}`)
      console.log(`  sha256: ${digest}`)
      return
    } catch (error) {
      lastError = error
      if (attempt < options.retries) {
        const delay = 750 * attempt
        console.error(
          `wb fetch: attempt ${attempt}/${options.retries} failed (${error instanceof Error ? error.message : String(error)}); retrying in ${delay}ms`,
        )
        await sleep(delay)
      }
    }
  }

  throw new Error(
    `wb fetch failed after ${options.retries} attempt(s): ` +
      `${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
