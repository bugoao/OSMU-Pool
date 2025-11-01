import { ValueTransformer } from 'typeorm';

export class DateTimeTransformer implements ValueTransformer {
    to(value: Date | string | null | undefined): string | null | undefined {
        if (value === null || value === undefined) {
            return value === undefined ? undefined : null;
        }
        const date = value instanceof Date ? value : new Date(value);
        return date.toISOString();
    }

    from(value: string | null | undefined): Date | null | undefined {
        if (value === null || value === undefined) {
            return value === undefined ? undefined : null;
        }
        return new Date(value);
    }
}
