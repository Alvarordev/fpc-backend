import { CanActivate, Injectable } from '@nestjs/common';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}
