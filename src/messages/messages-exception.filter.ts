import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  HttpException,
  HttpServer,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ProcessingFailure, processingFailureSchema } from './message-result.schema';

/**
 * Formats pre-controller JSON body parsing failures and unexpected errors on
 * POST /messages into the shared ProcessingFailure envelope without altering other routes.
 */
@Catch()
export class MessagesExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const adapter = this.applicationRef ?? this.httpAdapterHost?.httpAdapter;
    const http = host.switchToHttp();
    const request = http.getRequest<unknown>();
    const response = http.getResponse<unknown>();

    if (adapter && this.isPostMessagesRequest(adapter, request)) {
      if (
        exception instanceof HttpException &&
        processingFailureSchema.safeParse(exception.getResponse()).success
      ) {
        this.reply(adapter, response, exception.getResponse(), exception.getStatus());
        return;
      }

      if (
        exception instanceof BadRequestException ||
        exception instanceof SyntaxError ||
        (this.isHttpError(exception) && exception.statusCode === 400)
      ) {
        const failure: ProcessingFailure = {
          message_id: null,
          error: { code: 'invalid_input', message: 'Invalid JSON body' },
        };
        this.reply(adapter, response, failure, HttpStatus.BAD_REQUEST);
        return;
      }

      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : this.isHttpError(exception)
            ? exception.statusCode
            : HttpStatus.INTERNAL_SERVER_ERROR;

      if (status >= 500) {
        const failure: ProcessingFailure = {
          message_id: null,
          error: { code: 'internal_error', message: 'Message processing failed' },
        };
        this.reply(adapter, response, failure, HttpStatus.INTERNAL_SERVER_ERROR);
        return;
      }
    }

    super.catch(exception, host);
  }

  private isPostMessagesRequest(adapter: HttpServer, request: unknown): boolean {
    if (
      typeof adapter.getRequestMethod !== 'function' ||
      typeof adapter.getRequestUrl !== 'function'
    ) {
      return false;
    }
    const method = String(adapter.getRequestMethod(request) ?? '').toUpperCase();
    const url = String(adapter.getRequestUrl(request) ?? '');
    const path = url.split('?')[0].replace(/\/+$/, '');
    return method === 'POST' && path === '/messages';
  }

  private reply(
    adapter: Pick<HttpServer, 'isHeadersSent' | 'reply' | 'end'>,
    response: unknown,
    body: unknown,
    statusCode: number,
  ): void {
    if (!adapter.isHeadersSent(response)) {
      adapter.reply(response, body, statusCode);
    } else {
      adapter.end(response);
    }
  }
}
