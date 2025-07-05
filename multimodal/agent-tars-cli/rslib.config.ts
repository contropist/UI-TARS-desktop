/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { defineConfig } from '@rslib/core';

const BANNER = `/**
* Copyright (c) 2025 Bytedance, Inc. and its affiliates.
* SPDX-License-Identifier: Apache-2.0
*/`;

export default defineConfig({
  source: {
    entry: {
      index: ['src/index.ts'],
    },
  },
  lib: [
    {
      format: 'cjs',
      syntax: 'es2021',
      bundle: true,
      dts: true,
      banner: { js: BANNER },
      autoExternal: {
        dependencies: false,
        optionalDependencies: true,
        peerDependencies: true,
      },
      output: {
        externals: ['@agent-tars/core', '@agent-tars/server'],
      },
    },
  ],
  output: {
    target: 'node',
    cleanDistPath: false,
    sourceMap: false,
  },
});
