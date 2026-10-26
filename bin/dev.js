#!/usr/bin/env node

import {flush, handle, run, settings} from '@oclif/core'
import {DevhelmError, forOclif} from '../dist/lib/errors.js'

process.env.NODE_ENV = 'development'
settings.debug = true

// One central handler: every typed error exits through its D-2 code.
await run(process.argv.slice(2), import.meta.url)
  .then(() => flush())
  .catch((error) => handle(error instanceof DevhelmError ? forOclif(error) : error))
