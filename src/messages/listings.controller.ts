import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ListingResult,
  ProcessingFailure,
  StoredListingResult,
  listingResultSchema,
  processingFailureSchema,
  storedListingResultSchema,
} from './message-result.schema';
import { StoredListingsService } from './stored-listings.service';
import { approvalRequestSchema } from './approval-request.schema';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: StoredListingsService) {}

  @Get()
  async list(@Query('needs_review') needsReview: unknown): Promise<{ listings: StoredListingResult[] }> {
    const parsedFilter = parseNeedsReview(needsReview);
    if (!parsedFilter.valid) {
      throw new HttpException(invalidFilterFailure, HttpStatus.BAD_REQUEST);
    }

    try {
      return { listings: await this.listings.list(parsedFilter.value) };
    } catch {
      throw new HttpException(internalFailure, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string, @Body() body: unknown): Promise<StoredListingResult> {
    const request = approvalRequestSchema.safeParse(body === undefined ? {} : body);
    if (!request.success) {
      throw new HttpException(invalidApprovalRequestFailure, HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.listings.approve(id, request.data);
      const failure = processingFailureSchema.safeParse(result);
      if (failure.success) {
        throw new HttpException(failure.data, FAILURE_HTTP_STATUS[failure.data.error.code]);
      }
      return storedListingResultSchema.parse(result);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(internalApprovalFailure, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

const FAILURE_HTTP_STATUS: Record<ProcessingFailure['error']['code'], HttpStatus> = {
  invalid_input: HttpStatus.BAD_REQUEST,
  message_conflict: HttpStatus.CONFLICT,
  invalid_extraction: HttpStatus.BAD_GATEWAY,
  provider_unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  provider_timeout: HttpStatus.GATEWAY_TIMEOUT,
  internal_error: HttpStatus.INTERNAL_SERVER_ERROR,
  listing_not_found: HttpStatus.NOT_FOUND,
  approval_conflict: HttpStatus.CONFLICT,
};

const invalidFilterFailure: ProcessingFailure = {
  message_id: null,
  error: { code: 'invalid_input', message: 'Invalid needs_review filter' },
};

const internalFailure: ProcessingFailure = {
  message_id: null,
  error: { code: 'internal_error', message: 'Listing retrieval failed' },
};

const invalidApprovalRequestFailure: ProcessingFailure = {
  message_id: null,
  error: { code: 'invalid_input', message: 'Invalid approval request' },
};

const internalApprovalFailure: ProcessingFailure = {
  message_id: null,
  error: { code: 'internal_error', message: 'Listing approval failed' },
};

function parseNeedsReview(value: unknown): { valid: true; value: boolean | undefined } | { valid: false } {
  if (value === undefined) return { valid: true, value: undefined };
  if (value === 'true') return { valid: true, value: true };
  if (value === 'false') return { valid: true, value: false };
  return { valid: false };
}
