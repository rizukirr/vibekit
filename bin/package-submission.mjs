#!/usr/bin/env node
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSubmission } from '../lib/submission.mjs'

try {
  const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const { artifact } = buildSubmission({ sourceRoot })
  console.log(`submission archive: ${artifact}`)
} catch (error) {
  console.error(`vibekit submission: ${error.message}`)
  process.exitCode = 1
}
