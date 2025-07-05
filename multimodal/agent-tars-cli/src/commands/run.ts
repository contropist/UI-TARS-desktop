/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

import { CAC } from 'cac';
import { AgentTARSCLIArguments, addCommonOptions, processCommonOptions } from './options';
import { processSilentRun } from '../core/run';
import { processServerRun } from '../core/server-run';

/**
 * Helper function to read from stdin
 * @returns Promise that resolves with the content from stdin
 */
async function readFromStdin(): Promise<string> {
  return new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];

    // Handle case when no stdin is provided (e.g. direct command invocation)
    if (process.stdin.isTTY) {
      return resolve('');
    }

    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks).toString().trim());
    });

    // Set stdin to receive data
    process.stdin.resume();
  });
}

/**
 * Register the 'run' command for silent execution
 */
export function registerRunCommand(cli: CAC): void {
  const runCommand = cli.command(
    'run',
    'Run Agent TARS in silent mode and output results to stdout',
  );

  runCommand
    .option('--input [...query]', 'Input query to process (can be omitted when using pipe)')
    .option('--format [format]', 'Output format: "json" or "text" (default: "text")', {
      default: 'text',
    })
    .option('--include-logs', 'Include captured logs in the output (for debugging)', {
      default: false,
    })
    .option('--cache [cache]', 'Cache results in server storage (requires server mode)', {
      default: true,
    });

  addCommonOptions(runCommand).action(async (options: AgentTARSCLIArguments = {}) => {
    try {
      let input: string;

      // Check if input is provided via --input parameter
      if (options.input && (Array.isArray(options.input) ? options.input.length > 0 : true)) {
        input = Array.isArray(options.input) ? options.input.join(' ') : options.input;
      } else {
        // If no --input is provided, try to read from stdin (pipe)
        const stdinInput = await readFromStdin();

        if (!stdinInput) {
          console.error('Error: No input provided. Use --input parameter or pipe content to stdin');
          process.exit(1);
        }

        input = stdinInput;
      }

      // Only force quiet mode if debug mode is not enabled
      const quietMode = options.debug ? false : true;

      const { appConfig, isDebug } = await processCommonOptions({
        ...options,
        quiet: quietMode, // Don't force quiet mode when debug is enabled
      });

      // Check if we should use server mode with caching
      const useCache = options.cache !== false;

      if (useCache) {
        // Process the query using server mode (with storage)
        await processServerRun({
          appConfig,
          input,
          format: options.format as 'json' | 'text',
          includeLogs: options.includeLogs || !!options.debug,
          isDebug,
        });
      } else {
        // Process the query in silent mode (original behavior)
        await processSilentRun({
          appConfig,
          input,
          format: options.format as 'json' | 'text',
          includeLogs: options.includeLogs || !!options.debug,
        });
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
}
