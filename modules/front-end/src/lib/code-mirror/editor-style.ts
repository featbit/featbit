import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { tags } from "@lezer/highlight"

const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--cm-json-property)" },
  { tag: tags.string, color: "var(--cm-json-string)" },
  { tag: tags.number, color: "var(--cm-json-number)" },
  { tag: [tags.bool, tags.null], color: "var(--cm-json-literal)" },
  {
    tag: [tags.bracket, tags.separator],
    color: "var(--cm-json-punctuation)",
  },
])

const editorTheme = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "var(--background)",
    fontSize: "0.75rem",
    "--cm-json-property": "#0451a5",
    "--cm-json-string": "#a31515",
    "--cm-json-number": "#098658",
    "--cm-json-literal": "#6f42c1",
    "--cm-json-punctuation": "var(--foreground)",
    "--cm-collapse-color": "var(--muted-foreground)",
    "--cm-collapse-background": "var(--muted)",
    "--cm-collapse-hover": "var(--accent)",
    "--cm-collapse-border": "var(--border)",
  },
  ".dark &": {
    color: "#d4d4d4",
    backgroundColor: "#1e1e1e",
    "--cm-json-property": "#9cdcfe",
    "--cm-json-string": "#ce9178",
    "--cm-json-number": "#b5cea8",
    "--cm-json-literal": "#c586c0",
    "--cm-json-punctuation": "#d4d4d4",
    "--cm-collapse-color": "#a6a6a6",
    "--cm-collapse-background": "#252526",
    "--cm-collapse-hover": "#2a2d2e",
    "--cm-collapse-border": "#333333",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-content": {
    padding: "12px 0",
    caretColor: "var(--foreground)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--foreground)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground":
    {
      backgroundColor: "#add6ff !important",
    },
  ".cm-activeLine": {
    backgroundColor: "#cceeff44",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--muted)",
  },
  ".cm-gutters": {
    color: "var(--muted-foreground)",
    backgroundColor: "var(--muted)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px",
  },
  ".cm-changeGutter": {
    width: "20px",
    paddingLeft: "0",
  },
  ".cm-mergeSpacer": {
    lineHeight: "0",
  },
  ".cm-tooltip": {
    color: "var(--popover-foreground)",
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    color: "var(--accent-foreground)",
    backgroundColor: "var(--accent)",
  },
  ".cm-diagnostic-error": {
    borderLeftColor: "var(--destructive)",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--destructive)",
  },
  "&.cm-merge-a .cm-changedLine": {
    backgroundColor: "var(--color-red-100)",
  },
  "&.cm-merge-b .cm-changedLine": {
    backgroundColor: "var(--color-green-200)",
  },
  "&.cm-merge-a .cm-changedText, &.cm-merge-b .cm-changedText": {
    background: "none",
  },
  "&.cm-merge-a .cm-changedLineGutter": {
    width: "20px",
    color: "var(--color-red-700)",
    backgroundColor: "var(--color-red-100)",
  },
  "&.cm-merge-b .cm-changedLineGutter": {
    width: "20px",
    color: "var(--color-green-700)",
    backgroundColor: "var(--color-green-200)",
  },
  "&.cm-merge-a .cm-changedLineGutter::after": {
    content: '"−"',
    display: "block",
    textAlign: "center",
  },
  "&.cm-merge-b .cm-changedLineGutter::after": {
    content: '"+"',
    display: "block",
    textAlign: "center",
  },
  ".dark &.cm-merge-a .cm-changedLine, .dark &.cm-merge-a .cm-changedLineGutter":
    {
      backgroundColor: "#3b2426",
    },
  ".dark &.cm-merge-b .cm-changedLine, .dark &.cm-merge-b .cm-changedLineGutter":
    {
      backgroundColor: "#20382a",
    },
  ".dark &.cm-merge-a .cm-changedText": {
    backgroundColor: "#5a2d31",
  },
  ".dark &.cm-merge-b .cm-changedText": {
    backgroundColor: "#275c38",
  },
  ".dark &.cm-merge-a .cm-changedLineGutter": {
    color: "var(--color-red-400)",
    backgroundColor: "#512b2f",
    fontWeight: "700",
  },
  ".dark &.cm-merge-b .cm-changedLineGutter": {
    color: "var(--color-green-400)",
    backgroundColor: "#244a31",
    fontWeight: "700",
  },
  ".dark & .cm-gutters": {
    color: "#858585",
    backgroundColor: "#181818",
    borderRightColor: "#333333",
  },
  ".cm-collapsedLines.cm-collapsedLines": {
    color: "var(--cm-collapse-color)",
    background: "var(--cm-collapse-background)",
    borderTop: "1px solid var(--cm-collapse-border)",
    borderBottom: "1px solid var(--cm-collapse-border)",
    boxShadow: "none",
    textShadow: "none",
  },
  ".cm-collapsedLines.cm-collapsedLines:hover": {
    color: "var(--foreground)",
    background: "var(--cm-collapse-hover)",
  },
  ".cm-collapsedLines.cm-collapsedLines::before, .cm-collapsedLines.cm-collapsedLines::after":
    {
      content: '"···"',
      color: "var(--cm-collapse-color)",
    },
  ".dark & .cm-content": {
    caretColor: "#d4d4d4",
  },
  ".dark & .cm-cursor": {
    borderLeftColor: "#d4d4d4",
  },
  ".dark &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .dark & .cm-selectionLayer .cm-selectionBackground":
    {
      backgroundColor: "#264f78 !important",
    },
  ".dark & .cm-activeLine": {
    backgroundColor: "#99eeff33",
  },
  ".dark & .cm-activeLineGutter": {
    backgroundColor: "#252526",
  },
  ".dark & .cm-tooltip": {
    color: "#d4d4d4",
    backgroundColor: "#252526",
    borderColor: "#3f3f46",
  },
  ".dark & .cm-tooltip-autocomplete ul li[aria-selected]": {
    color: "#ffffff",
    backgroundColor: "#3f3f46",
  },
})

const fillHeightTheme = EditorView.theme({
  "&": {
    height: "100%",
  },
})

export function codeMirrorEditorStyle(
  isDark: boolean,
  { fillHeight = false }: { fillHeight?: boolean } = {}
): Extension {
  return [
    syntaxHighlighting(jsonHighlightStyle),
    EditorView.darkTheme.of(isDark),
    editorTheme,
    fillHeight ? fillHeightTheme : [],
  ]
}
