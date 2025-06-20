import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["out/**", "node_modules/**", "*.js", "*.mjs"],
  },
  {
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "variableLike",
          format: ["camelCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-inferrable-types": "warn",

      // General code quality rules
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      semi: "warn",
      "no-console": "warn",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-unused-expressions": "error",
      "prefer-arrow-callback": "warn",
      "prefer-const": "error",
      "prefer-template": "warn",

      // Code formatting rules (let Prettier handle these)
      "object-curly-spacing": "off",
      "array-bracket-spacing": "off",
      "computed-property-spacing": "off",

      // Security rules
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
    },
  },
  {
    files: ["tests/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      // Relax some rules for tests
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
];