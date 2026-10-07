import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        environmentOptions: { jsdom: { url: 'https://n.novelia.cc/' } },
        include: ['tests/**/*.test.ts'],
        setupFiles: ['tests/setup.ts'],
    },
});
