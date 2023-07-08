#!/usr/bin/env node

import { runFastify } from '../utilities/fastify/server.js';
import { makeServer } from '../server.js';

await runFastify(await makeServer());
