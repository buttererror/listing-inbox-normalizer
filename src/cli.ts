import { readFile } from 'node:fs/promises';
import { createApplicationContext } from './bootstrap';
import { ExtractionService } from './extraction/extraction.service';
import { ListingsService } from './listings/listings.service';
import { LlmGateway } from './llm-gateway/llm-request';
import { runJsonl } from './messages/jsonl-runner';
import { runTable } from './messages/table-runner';
import { ListingMessageProcessor } from './messages/listing-message-processor';
import { MESSAGE_PROCESSOR, MessageProcessor } from './messages/message-processor';

type CliContext = {
  getProcessor(): MessageProcessor;
  close(): Promise<void>;
};

type CliDependencies = {
  createContext(): Promise<CliContext>;
  stdout(text: string): void;
  stderr(text: string): void;
};

export async function runCli(args: string[], dependencies: CliDependencies): Promise<0 | 1> {
  const isTable = args.includes('--format=table');
  const fileArgs = args.slice(1).filter((arg) => arg !== '--format=table');

  if (args.length < 2 || args[0] !== 'process' || fileArgs.length !== 1 || !fileArgs[0]) {
    dependencies.stderr('Usage: process <input.jsonl>\n');
    return 1;
  }

  let input: string;
  try {
    input = await readFile(fileArgs[0], 'utf8');
  } catch {
    dependencies.stderr('Unable to read input file\n');
    return 1;
  }

  let context: CliContext | undefined;
  let exitCode: 0 | 1 = 1;
  try {
    context = await dependencies.createContext();
    exitCode = isTable
      ? await runTable(input, context.getProcessor(), dependencies.stdout)
      : await runJsonl(input, context.getProcessor(), dependencies.stdout);
  } catch {
    dependencies.stderr('Unable to run message processing\n');
  } finally {
    if (context) {
      try {
        await context.close();
      } catch {
        dependencies.stderr('Unable to close application context\n');
        exitCode = 1;
      }
    }
  }
  return exitCode;
}

export async function createCliContext(options?: { gateway?: LlmGateway }): Promise<CliContext> {
  const app = await createApplicationContext({ logger: false });
  const extractionService = options?.gateway
    ? new ExtractionService(options.gateway)
    : app.get(ExtractionService);

  const processor = options?.gateway
    ? new ListingMessageProcessor(extractionService, app.get(ListingsService))
    : app.get<MessageProcessor>(MESSAGE_PROCESSOR);

  return {
    getProcessor: () => processor,
    close: () => app.close(),
  };
}

async function main(): Promise<void> {
  process.exitCode = await runCli(process.argv.slice(2), {
    createContext: createCliContext,
    stdout: (text) => { process.stdout.write(text); },
    stderr: (text) => { process.stderr.write(text); },
  });
}

if (require.main === module) void main();
