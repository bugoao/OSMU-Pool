import { ValueTransformer } from 'typeorm';

export class DateTimeTransformer implements ValueTransformer {
    to(value: Date | null): string | null {

        return value ? value.toISOString() : null;
    }

    from(value: string | null): Date | null {

        return value ? new Date(value) : null;
    }
}
