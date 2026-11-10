import { readFile } from 'node:fs/promises';
import { createApplicationContext } from './bootstrap';
import { ExtractionService } from './extraction/extraction.service';
import { LlmGateway } from './llm-gateway/llm-request';
import { runJsonl } from './messages/jsonl-runner';
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
  if (args.length !== 2 || args[0] !== 'process' || !args[1]) {
    dependencies.stderr('Usage: process <input.jsonl>\n');
    return 1;
  }

  let input: string;
  try {
    input = await readFile(args[1], 'utf8');
  } catch {
    dependencies.stderr('Unable to read input file\n');
    return 1;
  }

  let context: CliContext | undefined;
  let exitCode: 0 | 1 = 1;
  try {
    context = await dependencies.createContext();
    exitCode = await runJsonl(input, context.getProcessor(), dependencies.stdout);
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
    ? new ListingMessageProcessor(extractionService)
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
