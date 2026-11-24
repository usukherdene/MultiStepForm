import path from "node:path";
import Components from "eslint-plugin-react/lib/util/Components.js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Use the same component detection as react/no-multi-comp.
const componentFilename = {
  meta: {
    schema: [],
    messages: {
      mismatch: "Use {{name}} as the filename for this component.",
      anonymous: "Give the component a name that matches its filename.",
    },
  },
  create: Components.detect((context, components) => ({
    "Program:exit"() {
      const { name: filename, ext } = path.parse(context.filename);
      for (const { node } of Object.values(components.list())) {
        let declaration = node;
        while (["CallExpression", "TSAsExpression", "TSSatisfiesExpression"].includes(declaration.parent?.type)) {
          declaration = declaration.parent;
        }
        const name = declaration.parent?.type === "VariableDeclarator"
          ? declaration.parent.id.name
          : declaration.id?.name;
        if (!name || name !== filename) {
          context.report({
            node,
            messageId: name ? "mismatch" : "anonymous",
            data: { name: name + ext },
          });
        }
      }
    },
  })),
};

const functionSpacing = {
  meta: {
    type: "layout",
    fixable: "whitespace",
    schema: [],
    messages: { separate: "Leave a blank line between functions." },
  },
  create(context) {
    const source = context.sourceCode;
    const declaresFunction = (statement) => {
      const node = statement.declaration ?? statement;
      return node.type === "FunctionDeclaration" ||
        (node.type === "VariableDeclaration" && node.declarations.some(
          ({ init }) => ["ArrowFunctionExpression", "FunctionExpression"].includes(init?.type),
        ));
    };

    const check = ({ body }) => {
      for (let i = 1; i < body.length; i++) {
        const previous = body[i - 1];
        const current = body[i];
        if (!declaresFunction(previous) || !declaresFunction(current)) continue;
        const comments = source.getCommentsBefore(current).filter(
          (comment) => comment.loc.start.line > previous.loc.end.line,
        );
        const first = comments[0] ?? current;
        const before = source.getTokenBefore(first, { includeComments: true });
        if (first.loc.start.line - before.loc.end.line >= 2) continue;
        context.report({
          node: current,
          messageId: "separate",
          fix: (fixer) => fixer.insertTextAfter(before, first.loc.start.line === before.loc.end.line ? "\n\n" : "\n"),
        });
      }
    };

    return { Program: check, BlockStatement: check };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    rules: { "no-duplicate-imports": "error" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression > ArrowFunctionExpression, NewExpression > ArrowFunctionExpression, JSXExpressionContainer > ArrowFunctionExpression, ReturnStatement > ArrowFunctionExpression",
          message: "Extract callbacks into named arrow functions before passing or returning them.",
        },
        {
          selector: "FunctionDeclaration, FunctionExpression",
          message: "Use a named const arrow function.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/components/ui/**"],
    plugins: { firstleaf: { rules: { "component-filename": componentFilename } } },
    rules: {
      "react/no-multi-comp": "error",
      "firstleaf/component-filename": "error",
    },
  },
  {
    files: ["src/app/**/{page,layout,template,loading,error,global-error,not-found,global-not-found,default,forbidden,unauthorized,opengraph-image,twitter-image,icon,apple-icon}.{js,jsx,ts,tsx}"],
    rules: { "firstleaf/component-filename": "off" },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/components/ui/**"],
    plugins: { spacing: { rules: { "between-functions": functionSpacing } } },
    rules: { "spacing/between-functions": "error" },
  },
  // The registry component manages its renderer and feature detection internally.
  { files: ["src/components/animated/GlassSurface.jsx"], rules: { "react-hooks/refs": "off", "react-hooks/set-state-in-effect": "off", "react-hooks/immutability": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
