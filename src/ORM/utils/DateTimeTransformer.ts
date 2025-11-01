import { ValueTransformer } from 'typeorm';

export class DateTimeTransformer implements ValueTransformer {
    to(value: Date | null): Date | null {
        return value ?? null;
    }

    from(value: Date | null): Date | null {
        return value ?? null;
    }
}
