import { defineConfig } from "eslint/config";
import { fixupConfigRules } from "@eslint/compat";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

const sharedExtends = fixupConfigRules(compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/electron",
    "plugin:import/typescript",
));

const sharedLanguageOptions = {
    globals: { ...globals.browser, ...globals.node },
    parser: tsParser,
    parserOptions: { ecmaVersion: "latest", sourceType: "module" },
};

const sharedSettings = {
    "import/resolver": {
        typescript: { alwaysTryTypes: true },
    },
};

export default defineConfig([
    { ignores: ["**/node_modules/**", "**/.webpack/**", "**/dist/**"] },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.mjs"],
        extends: sharedExtends,
        languageOptions: sharedLanguageOptions,
        settings: sharedSettings,
    },
    {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        extends: sharedExtends,
        languageOptions: {
            ...sharedLanguageOptions,
            parserOptions: {
                ...sharedLanguageOptions.parserOptions,
                project: "./tsconfig.json",
            },
        },
        settings: sharedSettings,
    },
]);