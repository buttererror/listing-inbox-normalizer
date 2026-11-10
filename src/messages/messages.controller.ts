import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import {
  MessageSuccess,
  ProcessingFailure,
  messageSuccessSchema,
  processingFailureSchema,
} from './message-result.schema';
import { PersistentIngestionService } from './persistent-ingestion.service';
import { extractCandidateMessageId, rawMessageSchema } from './raw-message.schema';

const FAILURE_HTTP_STATUS: Record<ProcessingFailure['error']['code'], HttpStatus> = {
  invalid_input: HttpStatus.BAD_REQUEST,
  message_conflict: HttpStatus.CONFLICT,
  invalid_extraction: HttpStatus.BAD_GATEWAY,
  provider_unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  provider_timeout: HttpStatus.GATEWAY_TIMEOUT,
  internal_error: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** HTTP adapter for persistent single-message ingestion and replay. */
@Controller('messages')
export class MessagesController {
  constructor(private readonly ingestion: PersistentIngestionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async ingest(@Body() body: unknown): Promise<MessageSuccess> {
    const validated = rawMessageSchema.safeParse(body);
    if (!validated.success) {
      const failure: ProcessingFailure = {
        message_id: extractCandidateMessageId(body),
        error: { code: 'invalid_input', message: 'Invalid message' },
      };
      throw new HttpException(failure, HttpStatus.BAD_REQUEST);
    }

    let result: unknown;
    try {
      result = await this.ingestion.ingest(validated.data);
    } catch {
      const failure: ProcessingFailure = {
        message_id: validated.data.id,
        error: { code: 'internal_error', message: 'Message processing failed' },
      };
      throw new HttpException(failure, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const parsedFailure = processingFailureSchema.safeParse(result);
    if (parsedFailure.success) {
      throw new HttpException(
        parsedFailure.data,
        FAILURE_HTTP_STATUS[parsedFailure.data.error.code],
      );
    }

    const parsedSuccess = messageSuccessSchema.safeParse(result);
    if (parsedSuccess.success) {
      return parsedSuccess.data;
    }

    const internalFailure: ProcessingFailure = {
      message_id: validated.data.id,
      error: { code: 'internal_error', message: 'Message processing failed' },
    };
    throw new HttpException(internalFailure, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
