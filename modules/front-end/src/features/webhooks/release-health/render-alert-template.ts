import Handlebars from "handlebars"

const valueHelper = "__releaseHealthValue"

class JsonVariables extends Handlebars.Visitor {
  MustacheStatement(node: hbs.AST.MustacheStatement) {
    // Explicit helpers in existing templates retain their original behavior.
    if (
      node.path.type === "PathExpression" &&
      (node.path as hbs.AST.PathExpression).original === "json"
    )
      return
    const variable =
      node.path.type === "PathExpression"
        ? (node.path as hbs.AST.PathExpression).original
        : "expression"
    const expression: hbs.AST.Expression =
      node.params.length || node.hash?.pairs.length
        ? ({
            type: "SubExpression",
            path: node.path,
            params: node.params,
            hash: node.hash,
            loc: node.loc,
          } as hbs.AST.SubExpression)
        : node.path
    node.path = {
      type: "PathExpression",
      original: valueHelper,
      parts: [valueHelper],
      data: false,
      depth: 0,
      loc: node.loc,
    }
    node.params = [
      expression,
      {
        type: "StringLiteral",
        value: variable,
        original: variable,
        loc: node.loc,
      } as hbs.AST.StringLiteral,
    ]
    node.hash = { type: "Hash", pairs: [], loc: node.loc }
    node.escaped = false
  }
}

function stringContent(value: unknown) {
  const text =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value)
  return JSON.stringify(text).slice(1, -1)
}

// Resolve values only after Handlebars has selected branches/loops. Quote context
// must come from the rendered JSON, not from branches that were never emitted.
function resolveValues(
  rendered: string,
  prefix: string,
  values: Map<string, unknown>
) {
  let inString = false
  let escaped = false
  let result = ""
  for (let index = 0; index < rendered.length;) {
    if (rendered.startsWith(prefix, index)) {
      const end = rendered.indexOf("__", index + prefix.length) + 2
      const token = rendered.slice(index, end)
      if (values.has(token)) {
        if (escaped)
          throw new Error(
            "A template variable cannot follow an incomplete JSON escape."
          )
        const value = values.get(token)
        result += inString
          ? stringContent(value)
          : JSON.stringify(value ?? null)
        index = end
        continue
      }
    }
    const character = rendered[index++]
    result += character
    if (escaped) escaped = false
    else if (inString && character === "\\") escaped = true
    else if (character === '"') inString = !inString
  }
  return result
}

export function compileAlertTemplate(template: string) {
  const ast = Handlebars.parse(template)
  new JsonVariables().accept(ast)
  const engine = Handlebars.create()
  const values = new Map<string, unknown>()
  const prefix = `__rh_${crypto.randomUUID()}_`
  engine.registerHelper(valueHelper, (value: unknown, variable: string) => {
    if (value === undefined)
      throw new Error(`Unknown template variable: ${variable}`)
    const token = `${prefix}${values.size}__`
    values.set(token, value)
    return new Handlebars.SafeString(token)
  })
  // Existing custom templates can still use explicit JSON serialization.
  engine.registerHelper(
    "json",
    (value: unknown) => new Handlebars.SafeString(JSON.stringify(value ?? null))
  )
  engine.registerHelper(
    "eq",
    function (this: unknown, left: unknown, right: unknown, options) {
      const equal = left === right
      return typeof options.fn === "function"
        ? equal
          ? options.fn(this)
          : options.inverse(this)
        : equal
    }
  )
  const render = engine.compile(ast, { strict: true })
  return (context: unknown) => {
    values.clear()
    return resolveValues(render(context), prefix, values)
  }
}

export function renderAlertTemplate(template: string, context: unknown) {
  return compileAlertTemplate(template)(context)
}
