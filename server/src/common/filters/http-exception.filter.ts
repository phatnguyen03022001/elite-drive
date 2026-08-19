import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

interface HttpErrorBody {
  message?: string | string[];
  error?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = this.getRequestId(request);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.getPublicMessage(status, errorResponse);

    response.setHeader('X-Request-Id', requestId);

    const logContext = {
      requestId,
      method: request.method,
      path: request.originalUrl || request.url,
      status,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify(logContext),
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(JSON.stringify(logContext));
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    });
  }

  private getPublicMessage(
    status: number,
    errorResponse: string | object | undefined,
  ): string | string[] {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Internal server error';
    }
    if (typeof errorResponse === 'string') return errorResponse;
    if (errorResponse && typeof errorResponse === 'object') {
      const body = errorResponse as HttpErrorBody;
      if (body.message) return body.message;
      if (body.error) return body.error;
    }
    return 'Request failed';
  }

  private getRequestId(request: Request) {
    const supplied = request.header('x-request-id')?.trim();
    if (supplied && /^[A-Za-z0-9._:-]{1,64}$/.test(supplied)) return supplied;
    return randomUUID();
  }
}
