import { ValueTransformer } from 'typeorm';
import { format } from 'date-fns-tz';

export class DateTimeTransformer implements ValueTransformer {
  to(value: Date | null): string | null {
    return value ? format(value, 'yyyy-MM-dd HH:mm:ss', { timeZone: 'UTC' }) : null;
  }

  from(value: string | null): Date | null {
    return value ? new Date(value + 'Z') : null;
  }
}
