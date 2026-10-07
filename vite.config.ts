import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { readFileSync } from 'node:fs';
import manifest from './package.json' with { type: 'json' };

const version = manifest.version;
const license = readFileSync(new URL('./LICENSE', import.meta.url), 'utf8')
    .replace(/\r\n?/g, '\n')
    .trim();

export default defineConfig(({ command }) => ({
    build: { target: 'es2022', minify: false, sourcemap: false },
    server: { host: '127.0.0.1' },
    plugins: [
        monkey({
            entry: 'src/main.ts',
            generate: ({ userscript, mode }) =>
                mode === 'build' ? `${userscript}\n\n/*\n${license}\n*/\n` : userscript,
            userscript: {
                name: 'NTR ToolBox',
                namespace: 'http://tampermonkey.net/',
                version,
                author: 'TheNano',
                description: 'ToolBox for Novel Translate bot website',
                match: [
                    'https://books.fishhawk.top/*',
                    'https://books1.fishhawk.top/*',
                    'https://n.novelia.cc/*',
                ],
                icon: 'https://github.com/LittleSurvival/NTR-ToolBox/blob/main/icon.jpg?raw=true',
                license: 'MIT',
                grant: 'none',
                'run-at': 'document-idle',
                noframes: true,
                ...(command === 'build'
                    ? {
                          downloadURL:
                              'https://update.greasyfork.org/scripts/527754/NTR%20ToolBox.user.js',
                          updateURL:
                              'https://update.greasyfork.org/scripts/527754/NTR%20ToolBox.meta.js',
                      }
                    : { downloadURL: 'none', updateURL: 'none' }),
            },
            build: {
                fileName: 'novelia-toolbox.user.js',
                metaFileName: 'novelia-toolbox.meta.js',
                autoGrant: false,
                cssSideEffects: (css) => {
                    const style = document.createElement('style');
                    style.textContent = css;
                    document.head.append(style);
                },
            },
        }),
    ],
}));
