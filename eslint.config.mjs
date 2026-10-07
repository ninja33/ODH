import js from '@eslint/js';
import globals from 'globals';

// These bindings are consumed by other classic scripts or the dictionary loader.
// Keep the actual class IDs: filenames do not always match the evaluated classes.
const classicExports = {
    'src/lib/agent.js': ['Agent'],
    'src/lib/envelope.js': ['ODH_DEFAULT_REQUEST_TIMEOUT_MS', 'odhErrorMessage', 'odhLog', 'odhError', 'odhOk', 'odhFail', 'odhIsEnvelope', 'odhUnwrap', 'odhWithTimeout'],
    'src/bg/js/ankiconnect.js': ['Ankiconnect'],
    'src/bg/js/builtin.js': ['Builtin'],
    'src/bg/js/deinflector.js': ['Deinflector'],
    'src/bg/js/options_api.js': ['OptionsAPI'],
    'src/bg/js/utils.js': ['optionsLoad', 'optionsSave', 'utilAsync', 'localizeHtmlPage', 'setupOffscreenDocument'],
    'src/bg/sandbox/sign.js': ['hash'],
    'src/fg/js/frontend_api.js': ['FrontendAPI'],
    'src/fg/js/popup.js': ['Popup'],
    'src/fg/js/range.js': ['rangeFromPoint', 'TextSourceRange'],
    'src/fg/js/text.js': ['isEmpty', 'getSentence', 'selectedText', 'isValidElement'],
    'src/fg/js/frame.js': ['api_setActionState'],
    'src/fg/js/spell.js': ['spell'],
    'src/dict/builtin_encn_Collins.js': ['builtin_encn_Collins'],
    'src/dict/cncn_Zdic.js': ['cncn_Zdic'],
    'src/dict/cncn_Zdic_old.js': ['cncn_Zdic'],
    'src/dict/decn_Eudict.js': ['decn_Eudict'],
    'src/dict/encn_Baicizhan.js': ['encn_Baicizhan'],
    'src/dict/encn_Cambridge.js': ['encn_Cambridge'],
    'src/dict/encn_Cambridge_tc.js': ['encn_Cambridge_tc'],
    'src/dict/encn_Collins.js': ['encn_Collins'],
    'src/dict/encn_LDOCE5MDX.js': ['encn_LDOCE5MDX'],
    'src/dict/encn_Oxford.js': ['encn_Oxford'],
    'src/dict/encn_Oxford_bing.js': ['encn_Oxford'],
    'src/dict/encn_Youdao.js': ['encn_Youdao'],
    'src/dict/enen_Collins.js': ['enen_Collins'],
    'src/dict/enen_LDOCE6MDX.js': ['encn_LDOCE6MDX'],
    'src/dict/enen_UrbanDict.js': ['enen_UrbanDict'],
    'src/dict/enfr_Cambridge.js': ['enfr_Cambridge'],
    'src/dict/enfr_Collins.js': ['enfr_Collins'],
    'src/dict/escn_Eudict.js': ['escn_Eudict'],
    'src/dict/esen_Spanishdict.js': ['esen_Spanishdict'],
    'src/dict/frcn_Eudict.js': ['frcn_Eudict'],
    'src/dict/frcn_Youdao.js': ['frcn_Youdao'],
    'src/dict/fren_Cambridge.js': ['fren_Cambridge'],
    'src/dict/fren_Collins.js': ['fren_Collins'],
    'src/dict/general_Makenotes.js': ['general_Makenotes'],
    'src/dict/itcn_Dict.js': ['itcn_Dict'],
    'src/dict/rucn_Qianyi.js': ['rucn_Qianyi']
};

export default [
    {
        ignores: [
            '.agent/**',
            'src/bg/data/**',
            // Vendored dictionaries are eval-loaded third-party scripts; their
            // class names are persisted dictionary IDs, so they are excluded
            // from hygiene checks until they are migrated one by one.
            'src/dict/**',
            'src/lib/jquery-3.0.0.min.js',
            // Minified third-party hash helper (single line, single-letter names);
            // it is used as-is and never edited here.
            'src/bg/sandbox/sign.js',
            'node_modules/**',
            'dist/**',
            'tmp/**',
            'out-tsc/**'
        ]
    },
    {
        files: ['**/*.{js,mjs,cjs}'],
        rules: {
            ...js.configs.recommended.rules,
            // Callback signatures and catch bindings are fixed by the platform
            // and by Chrome APIs, so unused ones are not worth reporting.
            'no-unused-vars': ['error', {
                args: 'after-used',
                argsIgnorePattern: '^_',
                // '_' is the project placeholder for a binding that exists only
                // to document a signature, so it is not a leftover.
                varsIgnorePattern: '^_',
                caughtErrors: 'none'
            }]
        },
        linterOptions: { reportUnusedDisableDirectives: 'error' }
    },
    {
        files: ['eslint.config.mjs'],
        languageOptions: { globals: globals.nodeBuiltin, sourceType: 'module' }
    },
    {
        files: ['tests/**/*.cjs'],
        languageOptions: { globals: globals.node, sourceType: 'commonjs' }
    },
    {
        files: ['src/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'script' }
    },
    {
        files: [
            'src/bg/js/serviceworker.js',
            'src/bg/js/ankiconnect.js',
            'src/bg/js/builtin.js',
            'src/bg/js/deinflector.js'
        ],
        languageOptions: { globals: globals.serviceworker }
    },
    {
        files: [
            'src/lib/agent.js',
            'src/bg/js/background.js',
            'src/bg/js/options.js',
            'src/bg/js/popup.js',
            'src/bg/js/tabmenu.js',
            'src/bg/sandbox/*.js',
            'src/dict/*.js',
            'src/fg/js/*.js'
        ],
        languageOptions: { globals: globals.browser }
    },
    {
        // envelope.js is shared by every context and only uses console; options_api.js
        // runs on the options/action pages, which the chrome block does not cover.
        files: ['src/lib/envelope.js', 'src/bg/js/options_api.js'],
        languageOptions: { globals: globals.browser }
    },
    {
        // utils.js is imported by the worker, but its DOM helper runs only in UI pages.
        files: ['src/bg/js/utils.js'],
        languageOptions: { globals: { chrome: 'readonly', document: 'readonly' } }
    },
    {
        files: [
            'src/bg/js/serviceworker.js',
            'src/bg/js/background.js',
            'src/bg/js/options_api.js',
            'src/bg/js/options.js',
            'src/bg/js/popup.js',
            'src/fg/js/frontend_api.js',
            'src/fg/js/frontend.js'
        ],
        languageOptions: { globals: { chrome: 'readonly' } }
    },
    {
        // Only these active pages load jQuery.
        files: ['src/bg/js/options.js', 'src/bg/js/popup.js'],
        languageOptions: { globals: globals.jquery }
    },
    {
        files: ['src/bg/js/serviceworker.js'],
        languageOptions: { globals: { setupOffscreenDocument: 'readonly' } }
    },
    {
        files: ['src/bg/js/options.js', 'src/bg/js/popup.js'],
        languageOptions: { globals: { OptionsAPI: 'readonly' } }
    },
    {
        // frontend_api is created on window by frontend.js after the API class loads.
        files: ['src/fg/js/frontend.js'],
        languageOptions: { globals: { FrontendAPI: 'readonly', frontend_api: 'readonly' } }
    },
    ...Object.entries(classicExports).map(([file, names]) => ({
        files: [file],
        rules: {
            // Per-file rules replace the options object, so the base options for
            // required-but-unused signatures must be repeated here.
            'no-unused-vars': ['error', {
                varsIgnorePattern: `^(${names.join('|')}|_)$`,
                args: 'after-used',
                argsIgnorePattern: '^_',
                caughtErrors: 'none'
            }]
        }
    }))
];
