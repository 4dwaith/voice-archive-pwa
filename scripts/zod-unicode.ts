import ts from 'typescript'

type PropertyCall = ts.CallExpression & {
  expression: ts.PropertyAccessExpression
}

function isPropertyCall(node: ts.Node): node is PropertyCall {
  return (
    ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
  )
}

function isStringChain(node: ts.Node): boolean {
  if (!isPropertyCall(node)) return false
  const receiver = node.expression.expression
  const methodName = node.expression.name.text
  const callsZodDirectly = ts.isIdentifier(receiver) && receiver.text === 'zod'
  if (callsZodDirectly) return methodName === 'string'

  // Walk through earlier chained checks until we find zod.string(). This
  // prevents rewriting numeric min/max checks such as zod.int().min(1).
  return isStringChain(receiver)
}

function isStringLengthCheck(node: ts.Node): node is PropertyCall {
  if (!isPropertyCall(node)) return false
  const methodName = node.expression.name.text
  const isLengthMethod = methodName === 'min' || methodName === 'max'
  return isLengthMethod && isStringChain(node.expression.expression)
}

function createLengthRefinement(
  factory: ts.NodeFactory,
  originalCall: PropertyCall,
  isMinimum: boolean,
): ts.CallExpression {
  // Construct a predicate that counts Array.from(value).length. Array.from
  // iterates Unicode code points, whereas value.length counts UTF-16 units.
  const valueIdentifier = factory.createIdentifier('value')
  const arrayFromFunction = factory.createPropertyAccessExpression(
    factory.createIdentifier('Array'),
    'from',
  )
  const codePoints = factory.createCallExpression(
    arrayFromFunction,
    undefined,
    [valueIdentifier],
  )
  const codePointCount = factory.createPropertyAccessExpression(
    codePoints,
    'length',
  )
  const comparisonOperator = isMinimum
    ? ts.SyntaxKind.GreaterThanEqualsToken
    : ts.SyntaxKind.LessThanEqualsToken
  // Reuse the generated limit expression; do not maintain a second limit.
  const limit = originalCall.arguments[0]
  const lengthIsValid = factory.createBinaryExpression(
    codePointCount,
    comparisonOperator,
    limit,
  )
  const valueParameter = factory.createParameterDeclaration(
    undefined,
    undefined,
    'value',
  )
  const lengthPredicate = factory.createArrowFunction(
    undefined,
    undefined,
    [valueParameter],
    undefined,
    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    lengthIsValid,
  )
  const errorMessage = isMinimum
    ? 'String has too few Unicode code points'
    : 'String has too many Unicode code points'
  const errorProperty = factory.createPropertyAssignment(
    'error',
    factory.createStringLiteral(errorMessage),
  )
  const refinementOptions = factory.createObjectLiteralExpression([
    errorProperty,
  ])
  const refineFunction = factory.createPropertyAccessExpression(
    originalCall.expression.expression,
    'refine',
  )
  return factory.createCallExpression(refineFunction, undefined, [
    lengthPredicate,
    refinementOptions,
  ])
}

// JSON Schema/Python lengths count Unicode code points; Zod string min/max
// count UTF-16 code units. Keep generated limits faithful for non-BMP text.
// This transforms generated string constraints, never individual model fields.
export function unicodeStringLengths(source: string): string {
  const sourceFile = ts.createSourceFile(
    'schemas.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  )
  const transformation = ts.transform(sourceFile, [
    (context) => {
      function visit(node: ts.Node): ts.VisitResult<ts.Node> {
        // Match against the original chain, then transform children first.
        // That way both checks in string().min(1).max(750) are rewritten.
        const shouldReplaceLengthCheck = isStringLengthCheck(node)
        const updatedNode = ts.visitEachChild(node, visit, context)
        if (!shouldReplaceLengthCheck || !isPropertyCall(updatedNode))
          return updatedNode
        const isMinimum = node.expression.name.text === 'min'
        return createLengthRefinement(context.factory, updatedNode, isMinimum)
      }
      return (root) => ts.visitEachChild(root, visit, context)
    },
  ])
  try {
    const transformedFile = transformation.transformed[0]
    const printer = ts.createPrinter()
    return printer.printFile(transformedFile)
  } finally {
    transformation.dispose()
  }
}
