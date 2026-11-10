import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Job Fill',
  description:
    'Autofill job application forms from your local profile, with optional manual field mappings.',
  version: '1.1.0',
  icons: {
    '16': 'public/icons/icon-16.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Job Fill',
    default_icon: {
      '16': 'public/icons/icon-16.png',
      '48': 'public/icons/icon-48.png',
      '128': 'public/icons/icon-128.png',
    },
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: true,
      match_about_blank: true,
    },
  ],
  permissions: ['storage', 'scripting'],
  host_permissions: ['http://*/*', 'https://*/*'],
  commands: {
    'fill-page': {
      suggested_key: {
        default: 'Alt+Shift+F',
        mac: 'Alt+Shift+F',
      },
      description: 'Fill the current page with your Job Fill profile',
    },
  },
})
