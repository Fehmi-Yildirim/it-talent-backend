
import { validate } from 'class-validator';

import { DemoLoginDto } from './demo-login.dto';

describe('DemoLoginDto', () => {
    it('accepts the CANDIDATE role', async () => {
        const dto = Object.assign(new DemoLoginDto(), {
            role: 'CANDIDATE',
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    });

    it('accepts the RECRUITER role', async () => {
        const dto = Object.assign(new DemoLoginDto(), {
            role: 'RECRUITER',
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    });

    it('rejects the ADMIN role', async () => {
        const dto = Object.assign(new DemoLoginDto(), {
            role: 'ADMIN',
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects a missing role', async () => {
        const dto = new DemoLoginDto();

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
    });
});
