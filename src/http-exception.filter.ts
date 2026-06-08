import { Catch, ArgumentsHost, HttpException, ExceptionFilter } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const res = exception.getResponse();

    const logPath = path.join(__dirname, '..', 'debug.log');
    fs.appendFileSync(logPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      status,
      res
    }) + '\n');

    response.status(status).json(res);
  }
}
