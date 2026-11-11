import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const page = (name: string) => resolve(__dirname, `${name}.html`);

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: page('index'),
        experience: page('experience'),
        projects: page('projects'),
        about: page('about'),
        contact: page('contact'),
      },
    },
  },
});
